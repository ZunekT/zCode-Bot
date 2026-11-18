import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from './env';

/**
 * Sesja w podpisanym ciasteczku (HMAC-SHA256): dane użytkownika Discord, bez bazy po stronie strony.
 * Token Discorda nie jest przechowywany – po zalogowaniu potrzebujemy tylko ID.
 */

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

const sign = (data: string) => createHmac('sha256', env.sessionSecret).update(data).digest('base64url');

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

export const cookieOptions = () => ({
  httpOnly: true,
  secure: env.secureCookies,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: MAX_AGE,
});

export async function getSession(): Promise<Session | null> {
  return decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Wymaga zalogowania – inaczej przekierowanie na logowanie przez Discord. */
export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect('/api/auth/login');
  return s;
}

export function avatarUrl(s: Pick<Session, 'id' | 'avatar'>, size = 64): string {
  if (s.avatar) return `https://cdn.discordapp.com/avatars/${s.id}/${s.avatar}.png?size=${size}`;
  const idx = Number((BigInt(s.id) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
}
