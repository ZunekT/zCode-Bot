import { createLogger } from './logger.js';

const log = createLogger('refresh');
const pending = new Map<string, NodeJS.Timeout>();

export function scheduleRefresh(key: string, fn: () => Promise<unknown>, delayMs = 2500): void {
  if (pending.has(key)) return;
  pending.set(
    key,
    setTimeout(() => {
      pending.delete(key);
      fn().catch((err) => log.warn(`Odświeżenie ${key} nie powiodło się`, err));
    }, delayMs),
  );
}

export function cancelRefresh(key: string): void {
  const t = pending.get(key);
  if (t) clearTimeout(t);
  pending.delete(key);
}
