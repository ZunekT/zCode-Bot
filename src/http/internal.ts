import Fastify, { type FastifyInstance } from 'fastify';
import type { ZxClient } from '../client.js';
import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { audit } from '../core/audit.js';
import { createLogger } from '../utils/logger.js';
import { safeEqual } from '../modules/sdk/keys.js';
import { sendError } from '../modules/sdk/routes.js';
import { publicSiteRoutes } from './public-site.js';
import { adminRoutes } from './admin.js';
import { adminMoreRoutes } from './admin-more.js';
import { clientOrderRoutes } from './client-orders.js';
import { getAccess, setAccess } from '../modules/site/service.js';
import {
  guildData,
  ownedBot,
  publicBot,
  setConfig,
  setProfile,
  type Profile,
} from '../modules/sdk/service.js';
import { uptime } from '../modules/monitoring/service.js';
import { MathostError, mathost, mathostEnabled, vpsId } from '../modules/vps/mathost.js';
import { isOwner, issues, snapshot } from '../modules/vps/service.js';

const log = createLogger('http:internal');

/**
 * Wewnętrzne API dla strony zxcode.pl. Nasłuchuje na osobnym porcie, NIE wystawianym na zewnątrz
 * (tylko sieć Dockera). Strona weryfikuje sesję Discord i podaje ID użytkownika w ścieżce;
 * bot sprawdza, czy użytkownik jest właścicielem bota.
 */
export async function startInternalServer(client: ZxClient): Promise<FastifyInstance | null> {
  const secret = env.INTERNAL_API_SECRET;
  if (!secret) {
    log.info('INTERNAL_API_SECRET nie ustawiony – wewnętrzne API dla strony wyłączone');
    return null;
  }

  const app = Fastify({ logger: false, bodyLimit: 3 * 1024 * 1024 });

  app.addHook('onRequest', async (request, reply) => {
    const given = request.headers['x-internal-secret'];
    if (typeof given !== 'string' || !safeEqual(given, secret))
      return reply.code(401).send({ error: 'unauthorized' });
  });

  const userParam = (p: unknown) => {
    const { userId, botId } = p as { userId: string; botId?: string };
    if (!/^\d{17,20}$/.test(userId)) throw new Error('bad user');
    return { userId, botId: Number(botId) };
  };

  publicSiteRoutes(app, client);
  clientOrderRoutes(app, client);

  app.get('/internal/health', async () => ({ ok: true, discord: client.isReady() }));

  /** Boty użytkownika (właściciela). */
  app.get('/internal/users/:userId/bots', async (request, reply) => {
    try {
      const { userId } = userParam(request.params);
      const bots = await prisma.sdkBot.findMany({
        where: { ownerId: userId },
        orderBy: { createdAt: 'asc' },
        include: { _count: { select: { guilds: true } } },
      });
      return { bots: bots.map((b) => ({ ...publicBot(b), guildCount: b._count.guilds })) };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  /** Szczegóły bota: schemat, komendy, serwery, profil, monitoring. */
  app.get('/internal/users/:userId/bots/:botId', async (request, reply) => {
    try {
      const { userId, botId } = userParam(request.params);
      const bot = await ownedBot(botId, userId);
      const [guilds, monitored] = await Promise.all([
        prisma.sdkGuild.findMany({
          where: { botId },
          orderBy: { name: 'asc' },
          select: { guildId: true, name: true, icon: true },
        }),
        bot.monitoredBotId ? prisma.monitoredBot.findUnique({ where: { id: bot.monitoredBotId } }) : null,
      ]);
      return {
        bot: publicBot(bot),
        schema: bot.schema ?? { modules: [] },
        commands: bot.commands ?? [],
        guilds: guilds.map((g) => ({ id: g.guildId, name: g.name, icon: g.icon })),
        profile: (bot.profile as Profile | null) ?? {},
        profileRevision: bot.profileRevision,
        monitoring: monitored
          ? {
              online: monitored.online,
              uptime: uptime(monitored),
              lastDownAt: monitored.lastDownAt,
              version: monitored.version,
            }
          : null,
      };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  /** Ustawienia bota na konkretnym serwerze + kanały i role do wyboru. */
  app.get('/internal/users/:userId/bots/:botId/guilds/:guildId', async (request, reply) => {
    try {
      const { userId, botId } = userParam(request.params);
      const { guildId } = request.params as { guildId: string };
      await ownedBot(botId, userId);
      const [guild, data, config] = await Promise.all([
        prisma.sdkGuild.findUnique({ where: { botId_guildId: { botId, guildId } } }),
        guildData(botId, guildId),
        prisma.sdkConfig.findUnique({ where: { botId_guildId: { botId, guildId } } }),
      ]);
      if (!guild || !data) return reply.code(404).send({ error: 'Bot nie jest na tym serwerze.' });
      return {
        guild: {
          id: guild.guildId,
          name: guild.name,
          icon: guild.icon,
          channels: data.channels,
          roles: data.roles,
        },
        values: config?.values ?? {},
        permissions: config?.permissions ?? {},
        revision: config?.revision ?? 0,
        updatedAt: config?.updatedAt ?? null,
        updatedBy: config?.updatedBy ?? null,
      };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.put('/internal/users/:userId/bots/:botId/guilds/:guildId/config', async (request, reply) => {
    try {
      const { userId, botId } = userParam(request.params);
      const { guildId } = request.params as { guildId: string };
      const bot = await ownedBot(botId, userId);
      const body = (request.body ?? {}) as { values?: unknown; permissions?: unknown };
      const saved = await setConfig(botId, guildId, body, userId);
      await audit(client, {
        action: body.permissions !== undefined ? 'sdk.permissions' : 'sdk.config',
        actorId: userId,
        targetId: guildId,
        summary: `Panel WWW: zmiana ${body.permissions !== undefined ? 'uprawnień' : 'ustawień'} bota **${bot.name}** (serwer \`${guildId}\`)`,
      });
      return { revision: saved.revision, values: saved.values, permissions: saved.permissions };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.put('/internal/users/:userId/bots/:botId/profile', async (request, reply) => {
    try {
      const { userId, botId } = userParam(request.params);
      const bot = await ownedBot(botId, userId);
      const result = await setProfile(botId, (request.body ?? {}) as Record<string, unknown>);
      await audit(client, {
        action: 'sdk.profile',
        actorId: userId,
        summary: `Panel WWW: zmiana profilu bota **${bot.name}**`,
      });
      return result;
    } catch (err) {
      return sendError(reply, err);
    }
  });

  // ───────────── Dostęp do strony (tryb „Start wkrótce”) ─────────────

  /** Pytane przez stronę przy każdym wejściu (z cache po obu stronach). */
  app.get('/internal/site/access', async (request, reply) => {
    try {
      const user = (request.query as { user?: string }).user;
      const access = await getAccess();
      if (access.launched) return { launched: true, allowed: true };
      const id = user && /^\d{17,20}$/.test(user) ? user : null;
      const allowed = !!id && (access.previewUsers.includes(id) || (await isOwner(client, id)));
      return { launched: false, allowed };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  // ───────────── Administracja (tylko właściciel zxCode) ─────────────

  const ownerCheck = async (params: unknown, reply: { code(n: number): { send(b: unknown): unknown } }) => {
    const { userId } = userParam(params);
    if (await isOwner(client, userId)) return userId;
    reply.code(404).send({ error: 'Nie znaleziono.' });
    return null;
  };

  adminRoutes(app, client, ownerCheck as never);
  adminMoreRoutes(app, client, ownerCheck as never);

  app.get('/internal/users/:userId/admin/site', async (request, reply) => {
    try {
      if (!(await ownerCheck(request.params, reply))) return;
      const access = await getAccess();
      const users = await Promise.all(
        access.previewUsers.map(async (id) => {
          const u = await client.users.fetch(id).catch(() => null);
          return {
            id,
            name: u?.globalName ?? u?.username ?? null,
            avatar: u?.displayAvatarURL({ size: 64, extension: 'png' }) ?? null,
          };
        }),
      );
      return { launched: access.launched, previewUsers: users };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.put('/internal/users/:userId/admin/site', async (request, reply) => {
    try {
      const userId = await ownerCheck(request.params, reply);
      if (!userId) return;
      const body = (request.body ?? {}) as { launched?: unknown; previewUsers?: unknown };
      const before = await getAccess();
      const next = await setAccess(
        {
          launched: body.launched as boolean | undefined,
          previewUsers: body.previewUsers as string[] | undefined,
        },
        userId,
      );
      if (before.launched !== next.launched || before.previewUsers.join() !== next.previewUsers.join()) {
        await audit(client, {
          action: 'site.access',
          actorId: userId,
          summary:
            before.launched !== next.launched
              ? `Panel WWW: strona ${next.launched ? 'uruchomiona publicznie' : 'w trybie „Start wkrótce”'}`
              : `Panel WWW: lista podglądu strony (${next.previewUsers.length} os.)`,
        });
      }
      return next;
    } catch (err) {
      return sendError(reply, err);
    }
  });

  // ───────────── Administracja: VPS ─────────────

  app.get('/internal/users/:userId/me', async (request, reply) => {
    try {
      const { userId } = userParam(request.params);
      return { owner: await isOwner(client, userId), vps: mathostEnabled() };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  /** Zwraca false (i 404) dla każdego poza właścicielem – strona nie zdradza, że panel istnieje. */
  const ownerOnly = async (
    request: { params: unknown },
    reply: { code(n: number): { send(b: unknown): unknown } },
  ) => {
    const { userId } = userParam(request.params);
    if (!(await isOwner(client, userId))) {
      reply.code(404).send({ error: 'Nie znaleziono.' });
      return null;
    }
    if (!mathostEnabled()) {
      reply.code(503).send({ error: 'Zarządzanie VPS wyłączone – brak MATHOST_API_KEY w .env bota.' });
      return null;
    }
    return userId;
  };
  const mathostError = (reply: { code(n: number): { send(b: unknown): unknown } }, err: unknown) =>
    err instanceof MathostError
      ? reply.code(502).send({ error: err.message })
      : sendError(reply as never, err);

  app.get('/internal/users/:userId/admin/vps', async (request, reply) => {
    try {
      if (!(await ownerOnly(request, reply))) return;
      const tf = (request.query as { range?: string }).range;
      const range = tf === 'day' || tf === 'week' || tf === 'month' ? tf : 'hour';
      const id = await vpsId();
      const [s, history] = await Promise.all([snapshot(), mathost.history(id, range).catch(() => [])]);
      const points = history
        .filter((p) => typeof p.cpu === 'number')
        .map((p) => ({
          t: p.time,
          cpu: Math.min(100, Math.round((p.cpu ?? 0) * 1000) / 10),
          mem: p.maxmem ? Math.round(((p.mem ?? 0) / p.maxmem) * 1000) / 10 : 0,
          netIn: Math.round(p.netin ?? 0),
          netOut: Math.round(p.netout ?? 0),
        }));
      return { vps: s, issues: issues(s), range, history: points };
    } catch (err) {
      return mathostError(reply, err);
    }
  });

  app.post('/internal/users/:userId/admin/vps/:action', async (request, reply) => {
    try {
      const userId = await ownerOnly(request, reply);
      if (!userId) return;
      const { action } = request.params as { action: string };
      const id = await vpsId();
      if (action === 'reboot') {
        await audit(client, {
          action: 'vps.reboot',
          actorId: userId,
          summary: 'Panel WWW: restart VPS (Mathost)',
        });
        await mathost.reboot(id);
      } else if (action === 'backup') {
        await mathost.createBackup(id);
        await audit(client, {
          action: 'vps.backup',
          actorId: userId,
          summary: 'Panel WWW: kopia zapasowa VPS (Mathost)',
        });
      } else {
        return reply.code(404).send({ error: 'Nieznana akcja.' });
      }
      return { ok: true };
    } catch (err) {
      return mathostError(reply, err);
    }
  });

  await app.listen({ port: env.INTERNAL_PORT, host: '0.0.0.0' });
  log.info(`Wewnętrzne API dla strony nasłuchuje na porcie ${env.INTERNAL_PORT}`);
  return app;
}
