import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('redis');

export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

redis.on('error', (err) => log.error('Błąd połączenia z Redis', err));

/** Klucze trzymamy w jednym miejscu, żeby nie było literówek. */
export const RedisKeys = {
  guildConfig: (guildId: string) => `zx:config:${guildId}`,
  cooldown: (command: string, userId: string) => `zx:cd:${command}:${userId}`,
  lock: (name: string) => `zx:lock:${name}`,
};
