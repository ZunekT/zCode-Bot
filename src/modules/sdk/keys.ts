import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export function generateKey(botId: number): { key: string; hash: string; prefix: string } {
  const key = `zxk_${botId}_${randomBytes(24).toString('hex')}`;
  return { key, hash: hashKey(key), prefix: key.slice(0, key.indexOf('_', 4) + 5) };
}

export const hashKey = (key: string) => createHash('sha256').update(key).digest('hex');

export const KEY_RE = /^zxk_\d+_[a-f0-9]{48}$/;

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
