import type { GuildConfig, Prisma } from '../generated/prisma/client.js';
import { prisma } from '../db/prisma.js';
import { redis, RedisKeys } from '../db/redis.js';
import { env } from '../config/env.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('config');
const TTL_SECONDS = 300;

function revive(raw: string): GuildConfig {
  const parsed = JSON.parse(raw) as GuildConfig & { updatedAt: string };
  return { ...parsed, updatedAt: new Date(parsed.updatedAt) };
}

export async function getConfig(guildId: string = env.GUILD_ID): Promise<GuildConfig> {
  const key = RedisKeys.guildConfig(guildId);
  try {
    const cached = await redis.get(key);
    if (cached) return revive(cached);
  } catch (err) {
    log.warn('Cache configu niedostępny, czytam z bazy', err);
  }

  const config = await prisma.guildConfig.upsert({
    where: { guildId },
    create: { guildId },
    update: {},
  });
  await redis.set(key, JSON.stringify(config), 'EX', TTL_SECONDS).catch(() => undefined);
  return config;
}

export async function updateConfig(
  data: Prisma.GuildConfigUpdateInput,
  guildId: string = env.GUILD_ID,
): Promise<GuildConfig> {
  const config = await prisma.guildConfig.upsert({
    where: { guildId },
    create: { ...(data as Prisma.GuildConfigCreateInput), guildId },
    update: data,
  });
  await redis.del(RedisKeys.guildConfig(guildId)).catch(() => undefined);
  for (const fn of updateListeners) {
    try {
      fn(config);
    } catch (err) {
      log.warn('Błąd słuchacza zmian configu', err);
    }
  }
  return config;
}

type UpdateListener = (config: GuildConfig) => void;
const updateListeners = new Set<UpdateListener>();

export function onConfigUpdated(fn: UpdateListener): () => void {
  updateListeners.add(fn);
  return () => updateListeners.delete(fn);
}

export function isModuleEnabled(config: GuildConfig, moduleName: string): boolean {
  const modules = (config.modules ?? {}) as Record<string, boolean>;
  return modules[moduleName] !== false;
}
