import Fastify, { type FastifyInstance } from 'fastify';
import type { ZxClient } from '../client.js';
import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { audit } from '../core/audit.js';
import { createLogger } from '../utils/logger.js';
import { safeEqual } from '../modules/sdk/keys.js';
import { sendError } from '../modules/sdk/routes.js';
import { guildData, ownedBot, publicBot, setConfig, setProfile, type Profile } from '../modules/sdk/service.js';
import { uptime } from '../modules/monitoring/service.js';

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
    if (typeof given !== 'string' || !safeEqual(given, secret)) return reply.code(401).send({ error: 'unauthorized' });
  });

  const userParam = (p: unknown) => {
    const { userId, botId } = p as { userId: string; botId?: string };
    if (!/^\d{17,20}$/.test(userId)) throw new Error('bad user');
    return { userId, botId: Number(botId) };
  };

  app.get('/internal/health', async () => ({ ok: true, discord: client.isReady() }));

  /** Boty użytkownika (właściciela). */
  app.get('/internal/users/:userId/bots', async (request, reply) => {
    try {
      const { userId } = userParam(request.params);
      const bots = await prisma.sdkBot.findMany({ where: { ownerId: userId }, orderBy: { createdAt: 'asc' }, include: { _count: { select: { guilds: true } } } });
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
        prisma.sdkGuild.findMany({ where: { botId }, orderBy: { name: 'asc' }, select: { guildId: true, name: true, icon: true } }),
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
          ? { online: monitored.online, uptime: uptime(monitored), lastDownAt: monitored.lastDownAt, version: monitored.version }
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
        guild: { id: guild.guildId, name: guild.name, icon: guild.icon, channels: data.channels, roles: data.roles },
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
      await audit(client, { action: 'sdk.profile', actorId: userId, summary: `Panel WWW: zmiana profilu bota **${bot.name}**` });
      return result;
    } catch (err) {
      return sendError(reply, err);
    }
  });

  await app.listen({ port: env.INTERNAL_PORT, host: '0.0.0.0' });
  log.info(`Wewnętrzne API dla strony nasłuchuje na porcie ${env.INTERNAL_PORT}`);
  return app;
}
