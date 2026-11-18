import type { Prisma, SdkBot } from '../../generated/prisma/client.js';
import { prisma } from '../../db/prisma.js';
import { UserError } from '../../core/errors.js';
import { createLogger } from '../../utils/logger.js';
import { generateKey, hashKey, KEY_RE } from './keys.js';
import { sdkHub } from './hub.js';
import {
  sanitizeGuild,
  sanitizeSchema,
  validatePermissions,
  validateValues,
  type BotSchema,
  type ConfigValues,
  type GuildData,
  type ValidationError,
} from './schema.js';

const log = createLogger('sdk');

export const PRESENCE_STATUSES = ['online', 'idle', 'dnd', 'invisible'] as const;
export const ACTIVITY_TYPES = ['playing', 'watching', 'listening', 'competing', 'custom'] as const;
const MAX_AVATAR_BYTES = 1024 * 1024;

export interface Presence {
  status: (typeof PRESENCE_STATUSES)[number];
  activity?: { type: (typeof ACTIVITY_TYPES)[number]; text: string } | null;
}

export interface Profile {
  presence?: Presence;
  /** Jednorazowe żądania zmiany profilu – bot wykonuje je i zgłasza wynik. */
  request?: { username?: string; avatar?: string } | null;
  lastResult?: { revision: number; ok: boolean; error?: string; at: string } | null;
}

export class ValidationFailed extends UserError {
  constructor(readonly errors: ValidationError[]) {
    super(errors.map((e) => `${e.path}: ${e.message}`).join('\n'), 'Nieprawidłowe dane');
  }
}

const json = (v: unknown) => v as Prisma.InputJsonValue;
const schemaOf = (bot: Pick<SdkBot, 'schema'>): BotSchema => (bot.schema as BotSchema | null) ?? { modules: [] };
const commandsOf = (bot: Pick<SdkBot, 'commands'>): string[] =>
  Array.isArray(bot.commands) ? (bot.commands as { name: string }[]).map((c) => c.name) : [];

// ───────────────────────────── Zarządzanie botami ─────────────────────────────

/** Nowy bot SDK + wpis w monitoringu. Klucz zwracany tylko raz. */
export async function createBot(name: string, ownerId: string): Promise<{ bot: SdkBot; key: string }> {
  const temp = hashKey(`pending-${Date.now()}-${Math.random()}`);
  const bot = await prisma.sdkBot.create({ data: { name, ownerId, keyHash: temp, keyPrefix: '' } });
  const { key, hash, prefix } = generateKey(bot.id);

  // Monitoring (tryb heartbeat) – SDK zgłasza się co minutę.
  let monitorName = name;
  if (await prisma.monitoredBot.findUnique({ where: { name: monitorName } })) monitorName = `${name} (SDK #${bot.id})`;
  const monitored = await prisma.monitoredBot.create({ data: { name: monitorName, mode: 'heartbeat', ownerId } });

  const saved = await prisma.sdkBot.update({
    where: { id: bot.id },
    data: { keyHash: hash, keyPrefix: prefix, monitoredBotId: monitored.id },
  });
  return { bot: saved, key };
}

export async function regenerateKey(botId: number): Promise<string> {
  const { key, hash, prefix } = generateKey(botId);
  await prisma.sdkBot.update({ where: { id: botId }, data: { keyHash: hash, keyPrefix: prefix } });
  sdkHub.closeStreams(botId);
  return key;
}

export async function deleteBot(botId: number): Promise<void> {
  const bot = await prisma.sdkBot.delete({ where: { id: botId } });
  sdkHub.closeStreams(botId);
  if (bot.monitoredBotId) await prisma.monitoredBot.delete({ where: { id: bot.monitoredBotId } }).catch(() => undefined);
}

export async function authenticate(key: string | undefined): Promise<SdkBot | null> {
  if (!key || !KEY_RE.test(key)) return null;
  return prisma.sdkBot.findUnique({ where: { keyHash: hashKey(key) } });
}

// ───────────────────────────── Zdarzenia od bota ─────────────────────────────

async function touch(bot: SdkBot, version?: string | null) {
  const now = new Date();
  await prisma.sdkBot.update({ where: { id: bot.id }, data: { lastSeenAt: now, ...(version && { botVersion: version.slice(0, 40) }) } });
  if (bot.monitoredBotId) {
    await prisma.monitoredBot
      .update({ where: { id: bot.monitoredBotId }, data: { lastHeartbeatAt: now, ...(version && { version: version.slice(0, 40) }) } })
      .catch(() => undefined);
  }
}

async function upsertGuilds(botId: number, guilds: unknown[], replaceAll: boolean) {
  const clean = guilds.map((g) => sanitizeGuild(g as Record<string, unknown>)).filter((g) => g !== null);
  for (const g of clean.slice(0, 200)) {
    await prisma.sdkGuild.upsert({
      where: { botId_guildId: { botId, guildId: g.id } },
      create: { botId, guildId: g.id, name: g.name, icon: g.icon, channels: json(g.data.channels), roles: json(g.data.roles) },
      update: { name: g.name, icon: g.icon, channels: json(g.data.channels), roles: json(g.data.roles) },
    });
  }
  if (replaceAll) {
    await prisma.sdkGuild.deleteMany({ where: { botId, guildId: { notIn: clean.map((g) => g.id) } } });
  }
}

export interface HelloPayload {
  sdk?: { version?: string };
  bot?: { version?: string };
  app?: { id?: string; username?: string; avatar?: string | null };
  schema?: unknown;
  commands?: unknown;
  guilds?: unknown[];
}

/** Bot się łączy: zapisujemy schemat, komendy i serwery, oddajemy aktualne ustawienia. */
export async function hello(bot: SdkBot, body: HelloPayload) {
  const { schema, warnings } = sanitizeSchema(body.schema);
  const commands = (Array.isArray(body.commands) ? body.commands : [])
    .slice(0, 200)
    .map((c: Record<string, unknown>) => ({ name: String(c?.name ?? '').slice(0, 32), description: String(c?.description ?? '').slice(0, 100) }))
    .filter((c) => /^[\w-]{1,32}$/.test(c.name));

  const updated = await prisma.sdkBot.update({
    where: { id: bot.id },
    data: {
      schema: json(schema),
      commands: json(commands),
      sdkVersion: body.sdk?.version?.slice(0, 20) ?? null,
      appId: body.app?.id?.slice(0, 20) ?? null,
      username: body.app?.username?.slice(0, 40) ?? null,
      avatarUrl: body.app?.avatar?.slice(0, 300) ?? null,
    },
  });
  if (Array.isArray(body.guilds)) await upsertGuilds(bot.id, body.guilds, true);
  await touch(updated, body.bot?.version);
  if (warnings.length) log.warn(`Bot #${bot.id} (${bot.name}): ${warnings.length} ostrzeżeń schematu`, warnings.slice(0, 5));

  const configs = await prisma.sdkConfig.findMany({ where: { botId: bot.id } });
  return {
    botId: bot.id,
    warnings,
    profile: (updated.profile as Profile | null) ?? {},
    profileRevision: updated.profileRevision,
    configs: configs.map((c) => ({ guildId: c.guildId, values: c.values, permissions: c.permissions, revision: c.revision })),
  };
}

export async function syncGuilds(bot: SdkBot, body: { guilds?: unknown[]; removed?: unknown[] }) {
  if (Array.isArray(body.guilds)) await upsertGuilds(bot.id, body.guilds, false);
  const removed = (Array.isArray(body.removed) ? body.removed : []).filter((x): x is string => typeof x === 'string');
  if (removed.length) await prisma.sdkGuild.deleteMany({ where: { botId: bot.id, guildId: { in: removed } } });
}

export async function heartbeat(bot: SdkBot, body: { version?: string }) {
  await touch(bot, body.version);
}

export async function setConnected(botId: number, connected: boolean) {
  await prisma.sdkBot.update({ where: { id: botId }, data: { connected, lastSeenAt: new Date() } }).catch(() => undefined);
}

export async function profileResult(bot: SdkBot, body: { revision?: number; ok?: boolean; error?: string }) {
  const profile = ((bot.profile as Profile | null) ?? {}) as Profile;
  if (body.revision !== bot.profileRevision) return; // wynik starego żądania
  profile.request = null;
  profile.lastResult = { revision: bot.profileRevision, ok: body.ok === true, error: body.error?.slice(0, 300), at: new Date().toISOString() };
  await prisma.sdkBot.update({ where: { id: bot.id }, data: { profile: json(profile) } });
}

// ───────────────────────────── Ustawienia ─────────────────────────────

export async function guildData(botId: number, guildId: string): Promise<GuildData | null> {
  const g = await prisma.sdkGuild.findUnique({ where: { botId_guildId: { botId, guildId } } });
  return g ? { channels: g.channels as unknown as GuildData['channels'], roles: g.roles as unknown as GuildData['roles'] } : null;
}

/**
 * Zapis ustawień serwera (z panelu albo od samego bota).
 * Moduły podmieniane w całości, pozostałe zostają. Bot dostaje zmianę na żywo.
 */
export async function setConfig(
  botId: number,
  guildId: string,
  input: { values?: unknown; permissions?: unknown },
  updatedBy: string,
  opts: { requireGuild?: boolean; notify?: boolean } = {},
) {
  if (!/^\d{17,20}$/.test(guildId)) throw new UserError('Nieprawidłowy serwer.');
  const bot = await prisma.sdkBot.findUnique({ where: { id: botId } });
  if (!bot) throw new UserError('Bot nie istnieje.');
  const guild = await guildData(botId, guildId);
  if (!guild && opts.requireGuild !== false) throw new UserError('Bot nie jest na tym serwerze (albo jeszcze go nie zgłosił).');

  const current = await prisma.sdkConfig.findUnique({ where: { botId_guildId: { botId, guildId } } });
  const data: { values?: Prisma.InputJsonValue; permissions?: Prisma.InputJsonValue } = {};

  if (input.values !== undefined) {
    const { values, errors } = validateValues(schemaOf(bot), input.values, guild);
    if (errors.length) throw new ValidationFailed(errors);
    data.values = json({ ...((current?.values as ConfigValues | null) ?? {}), ...values });
  }
  if (input.permissions !== undefined) {
    const { permissions, errors } = validatePermissions(input.permissions, commandsOf(bot), guild);
    if (errors.length) throw new ValidationFailed(errors);
    data.permissions = json(permissions);
  }

  const saved = await prisma.sdkConfig.upsert({
    where: { botId_guildId: { botId, guildId } },
    create: { botId, guildId, values: data.values ?? {}, permissions: data.permissions ?? {}, updatedBy },
    update: { ...data, revision: { increment: 1 }, updatedBy },
  });
  if (opts.notify !== false) {
    sdkHub.send(botId, { type: 'config', guildId, values: saved.values, permissions: saved.permissions, revision: saved.revision });
  }
  return saved;
}

/** Profil bota z panelu: status/aktywność (trwałe) oraz zmiana nazwy/avatara (jednorazowo). */
export async function setProfile(botId: number, input: { presence?: unknown; username?: unknown; avatar?: unknown }) {
  const bot = await prisma.sdkBot.findUnique({ where: { id: botId } });
  if (!bot) throw new UserError('Bot nie istnieje.');
  const profile = ((bot.profile as Profile | null) ?? {}) as Profile;
  const errors: ValidationError[] = [];
  const request: NonNullable<Profile['request']> = {};

  if (input.presence !== undefined) {
    const p = input.presence as Record<string, unknown>;
    const status = p?.status as Presence['status'];
    if (!PRESENCE_STATUSES.includes(status)) errors.push({ path: 'presence.status', message: 'nieznany status' });
    let activity: Presence['activity'] = null;
    const a = p?.activity as Record<string, unknown> | null | undefined;
    if (a && a.text) {
      const type = a.type as NonNullable<Presence['activity']>['type'];
      if (!ACTIVITY_TYPES.includes(type)) errors.push({ path: 'presence.activity.type', message: 'nieznany typ aktywności' });
      const text = String(a.text).trim().slice(0, 128);
      activity = { type, text };
    }
    profile.presence = { status, activity };
  }
  if (input.username !== undefined && input.username !== null && input.username !== '') {
    const name = String(input.username).trim();
    if (name.length < 2 || name.length > 32) errors.push({ path: 'username', message: 'nazwa: od 2 do 32 znaków' });
    else request.username = name;
  }
  if (input.avatar !== undefined && input.avatar !== null && input.avatar !== '') {
    const m = String(input.avatar).match(/^data:image\/(png|jpeg|gif|webp);base64,([A-Za-z0-9+/=]+)$/);
    if (!m) errors.push({ path: 'avatar', message: 'avatar musi być obrazkiem PNG/JPG/GIF/WEBP' });
    else if (Buffer.byteLength(m[2]!, 'base64') > MAX_AVATAR_BYTES) errors.push({ path: 'avatar', message: 'avatar może mieć maksymalnie 1 MB' });
    else request.avatar = String(input.avatar);
  }
  if (errors.length) throw new ValidationFailed(errors);
  profile.request = Object.keys(request).length ? request : null;

  const saved = await prisma.sdkBot.update({ where: { id: botId }, data: { profile: json(profile), profileRevision: { increment: 1 } } });
  sdkHub.send(botId, { type: 'profile', profile, revision: saved.profileRevision });
  return { profile, revision: saved.profileRevision };
}

// ───────────────────────────── Odczyt dla panelu ─────────────────────────────

export async function ownedBot(botId: number, userId: string): Promise<SdkBot> {
  const bot = Number.isSafeInteger(botId) ? await prisma.sdkBot.findUnique({ where: { id: botId } }) : null;
  // Brak bota i cudzy bot zwracają ten sam komunikat – nie zdradzamy, że istnieje.
  if (!bot || bot.ownerId !== userId) throw new UserError('Nie znaleziono bota.');
  return bot;
}

export function publicBot(bot: SdkBot) {
  return {
    id: bot.id,
    name: bot.name,
    keyPrefix: bot.keyPrefix,
    appId: bot.appId,
    username: bot.username,
    avatarUrl: bot.avatarUrl,
    sdkVersion: bot.sdkVersion,
    botVersion: bot.botVersion,
    connected: sdkHub.isConnected(bot.id),
    lastSeenAt: bot.lastSeenAt,
    createdAt: bot.createdAt,
  };
}
