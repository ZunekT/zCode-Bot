import { redis, RedisKeys } from '../db/redis.js';

export async function acquireLock(name: string, ttlSeconds = 10): Promise<(() => Promise<void>) | null> {
  const key = RedisKeys.lock(name);
  const token = `${process.pid}:${Date.now()}:${Math.random()}`;
  const ok = await redis.set(key, token, 'EX', ttlSeconds, 'NX');
  if (ok !== 'OK') return null;
  return async () => {
    // Zwalniamy tylko własną blokadę.
    await redis.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      1,
      key,
      token,
    );
  };
}

export async function withLock<T>(name: string, fn: () => Promise<T>, ttlSeconds = 10): Promise<T | null> {
  const release = await acquireLock(name, ttlSeconds);
  if (!release) return null;
  try {
    return await fn();
  } finally {
    await release();
  }
}

export async function checkCooldown(command: string, userId: string, seconds: number): Promise<number> {
  const key = RedisKeys.cooldown(command, userId);
  const ok = await redis.set(key, '1', 'EX', seconds, 'NX');
  if (ok === 'OK') return 0;
  const ttl = await redis.ttl(key);
  return Math.max(ttl, 1);
}
