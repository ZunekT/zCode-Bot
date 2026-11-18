import { createHmac, timingSafeEqual } from 'node:crypto';

/** Podpis i odczyt sesji (bez zależności od Next – używane też w proxy.ts). */

const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET musi mieć min. 32 znaki');
  return s;
};

export const SESSION_COOKIE = 'zx_session';
export const STATE_COOKIE = 'zx_oauth_state';
const MAX_AGE = 7 * 24 * 3600;

export interface Session {
  id: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
  exp: number;
}

const sign = (data: string) => createHmac('sha256', secret()).update(data).digest('base64url');

export function encodeSession(user: Omit<Session, 'exp'>): string {
  const payload = Buffer.from(JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + MAX_AGE })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(raw: string | undefined): Session | null {
  if (!raw) return null;
  const [payload, sig] = raw.split('.');
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Session;
    if (!/^\d{17,20}$/.test(s.id) || s.exp < Date.now() / 1000) return null;
    return s;
  } catch {
    return null;
  }
}

