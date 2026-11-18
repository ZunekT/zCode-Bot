import type { SdkBot } from '../../generated/prisma/client.js';
import type { ZxClient } from '../../client.js';
import { UserError } from '../../core/errors.js';
import { prisma } from '../../db/prisma.js';
import { v2Message } from '../../ui/builders/payload.js';
import { card } from '../../ui/components/card.js';
import { createLogger } from '../../utils/logger.js';
import { schemaOf } from './service.js';

const log = createLogger('sdk:members');

export const BOT_PERMS = ['settings', 'commands', 'profile', 'access'] as const;
export type BotPerm = (typeof BOT_PERMS)[number];

export const PERM_LABELS: Record<BotPerm, string> = {
  settings: 'ustawienia serwerów',
  commands: 'uprawnienia komend',
  profile: 'profil bota',
  access: 'zarządzanie dostępem',
};

const MAX_MEMBERS = 25;
const SNOWFLAKE = /^\d{17,20}$/;

export class Forbidden extends UserError {}

export interface BotAccess {
  bot: SdkBot;
  owner: boolean;
  perms: BotPerm[];
  modules: string[] | null;
  guilds: string[] | null;
}

const clean = (list: readonly string[]): BotPerm[] => BOT_PERMS.filter((p) => list.includes(p));
const scope = (list: readonly string[]) => (list.length ? [...list] : null);

export async function botAccess(botId: number, userId: string): Promise<BotAccess> {
  const bot = Number.isSafeInteger(botId) ? await prisma.sdkBot.findUnique({ where: { id: botId } }) : null;
  if (!bot) throw new UserError('Nie znaleziono bota.');
  if (bot.ownerId === userId) return { bot, owner: true, perms: [...BOT_PERMS], modules: null, guilds: null };
  const member = await prisma.sdkBotMember.findUnique({ where: { botId_userId: { botId, userId } } });
  if (!member) throw new UserError('Nie znaleziono bota.');
  return {
    bot,
    owner: false,
    perms: clean(member.permissions),
    modules: scope(member.modules),
    guilds: scope(member.guilds),
  };
}

export function requirePerm(a: BotAccess, perm: BotPerm): void {
  if (!a.perms.includes(perm)) throw new Forbidden(`Nie masz uprawnienia: ${PERM_LABELS[perm]}.`);
}

export const canSeeGuild = (a: BotAccess, guildId: string) => !a.guilds || a.guilds.includes(guildId);

export function requireGuild(a: BotAccess, guildId: string): void {
  if (!canSeeGuild(a, guildId)) throw new UserError('Bot nie jest na tym serwerze.');
}

export function requireModules(a: BotAccess, keys: string[]): void {
  if (!a.modules) return;
  const denied = keys.filter((k) => !a.modules!.includes(k));
  if (denied.length) throw new Forbidden(`Nie masz uprawnienia do edycji modułów: ${denied.join(', ')}.`);
}

function parsePerms(input: unknown): BotPerm[] {
  if (
    !Array.isArray(input) ||
    input.some((p) => typeof p !== 'string' || !BOT_PERMS.includes(p as BotPerm))
  ) {
    throw new UserError('Nieprawidłowe uprawnienia.');
  }
  return clean(input as string[]);
}

function parseList(input: unknown, allowed: Set<string>, what: string): string[] {
  if (input === undefined || input === null) return [];
  if (
    !Array.isArray(input) ||
    input.length > 50 ||
    input.some((x) => typeof x !== 'string' || !allowed.has(x))
  ) {
    throw new UserError(`Nieprawidłowa lista: ${what}.`);
  }
  return [...new Set(input as string[])];
}

function assertWithin(
  a: BotAccess,
  t: { permissions: readonly BotPerm[]; modules: readonly string[]; guilds: readonly string[] },
): void {
  const extra = t.permissions.filter((p) => !a.perms.includes(p));
  if (extra.length) {
    throw new Forbidden(
      `Nie możesz zarządzać uprawnieniem, którego sam nie masz: ${extra.map((p) => PERM_LABELS[p]).join(', ')}.`,
    );
  }
  const check = (mine: string[] | null, theirs: readonly string[], what: string) => {
    if (!mine) return;
    if (!theirs.length || theirs.some((x) => !mine.includes(x))) {
      throw new Forbidden(`Możesz przydzielać tylko ${what}, do których sam masz dostęp.`);
    }
  };
  if (t.permissions.includes('settings')) check(a.modules, t.modules, 'moduły');
  if (t.permissions.includes('settings') || t.permissions.includes('commands'))
    check(a.guilds, t.guilds, 'serwery');
}

export async function listMembers(client: ZxClient, a: BotAccess) {
  const rows = await prisma.sdkBotMember.findMany({
    where: { botId: a.bot.id },
    orderBy: { createdAt: 'asc' },
  });
  const person = async (id: string) => {
    const u = await client.users.fetch(id).catch(() => null);
    return {
      id,
      name: u?.globalName ?? u?.username ?? id,
      avatar: u?.displayAvatarURL({ size: 64, extension: 'png' }) ?? null,
    };
  };
  const [owner, members] = await Promise.all([
    person(a.bot.ownerId),
    Promise.all(
      rows.map(async (m) => ({
        ...(await person(m.userId)),
        permissions: clean(m.permissions),
        modules: m.modules,
        guilds: m.guilds,
        addedBy: m.addedBy,
        createdAt: m.createdAt,
      })),
    ),
  ]);
  return { owner, members, me: { owner: a.owner, perms: a.perms, modules: a.modules, guilds: a.guilds } };
}

export async function setMember(
  client: ZxClient,
  a: BotAccess,
  actorId: string,
  targetId: string,
  input: { permissions?: unknown; modules?: unknown; guilds?: unknown },
): Promise<{ added: boolean; permissions: BotPerm[]; modules: string[]; guilds: string[] }> {
  requirePerm(a, 'access');
  if (!SNOWFLAKE.test(targetId)) throw new UserError('Podaj poprawne ID Discord.');
  if (targetId === a.bot.ownerId) throw new UserError('To właściciel bota – ma pełny dostęp.');
  if (targetId === actorId) throw new UserError('Nie możesz zmieniać własnych uprawnień.');
  const permissions = parsePerms(input.permissions);

  const botGuilds = await prisma.sdkGuild.findMany({ where: { botId: a.bot.id }, select: { guildId: true } });
  const moduleKeys = new Set(schemaOf(a.bot).modules.map((m) => m.key));
  const modules = permissions.includes('settings') ? parseList(input.modules, moduleKeys, 'moduły') : [];
  const guilds =
    permissions.includes('settings') || permissions.includes('commands')
      ? parseList(input.guilds, new Set(botGuilds.map((g) => g.guildId)), 'serwery')
      : [];
  const target = { permissions, modules, guilds };
  assertWithin(a, target);

  const key = { botId_userId: { botId: a.bot.id, userId: targetId } };
  const existing = await prisma.sdkBotMember.findUnique({ where: key });
  if (existing) {
    assertWithin(a, {
      permissions: clean(existing.permissions),
      modules: existing.modules,
      guilds: existing.guilds,
    });
    await prisma.sdkBotMember.update({ where: key, data: target });
    return { added: false, ...target };
  }

  const count = await prisma.sdkBotMember.count({ where: { botId: a.bot.id } });
  if (count >= MAX_MEMBERS) throw new UserError(`Bot może mieć maksymalnie ${MAX_MEMBERS} osób z dostępem.`);
  const user = await client.users.fetch(targetId).catch(() => null);
  if (!user) throw new UserError('Nie ma użytkownika Discord o takim ID.');
  if (user.bot) throw new UserError('Dostęp można dać tylko osobie, nie botowi.');
  await prisma.sdkBotMember.create({
    data: { botId: a.bot.id, userId: targetId, ...target, addedBy: actorId },
  });

  await user
    .send(
      v2Message(
        card({
          tone: 'success',
          emoji: 'bot',
          title: `Masz dostęp do bota ${a.bot.name}`,
          description: `Dostęp nadany przez <@${actorId}> w panelu zxcode.pl.\n-# Uprawnienia: ${describe(target)}. Bot jest w zakładce **Moje boty**.`,
        }),
      ),
    )
    .catch((err) => log.debug(`Nie wysłano DM do ${targetId}`, err));
  return { added: true, ...target };
}

export function describe(t: {
  permissions: readonly BotPerm[];
  modules: readonly string[];
  guilds: readonly string[];
}): string {
  if (!t.permissions.length) return 'tylko podgląd';
  const parts = t.permissions.map((p) =>
    p === 'settings' && t.modules.length
      ? `${PERM_LABELS[p]} (moduły: ${t.modules.join(', ')})`
      : PERM_LABELS[p],
  );
  return parts.join(', ') + (t.guilds.length ? `; serwery: ${t.guilds.length}` : '');
}

export async function removeMember(a: BotAccess, actorId: string, targetId: string): Promise<void> {
  const key = { botId_userId: { botId: a.bot.id, userId: targetId } };
  const existing = await prisma.sdkBotMember.findUnique({ where: key });
  if (!existing) throw new UserError('Ta osoba nie ma dostępu do bota.');
  if (targetId !== actorId) {
    requirePerm(a, 'access');
    assertWithin(a, {
      permissions: clean(existing.permissions),
      modules: existing.modules,
      guilds: existing.guilds,
    });
  }
  await prisma.sdkBotMember.delete({ where: key });
}
