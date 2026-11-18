import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from './env';

/**
 * Sesja w podpisanym ciasteczku (HMAC-SHA256): dane użytkownika Discord, bez bazy po stronie strony.
 * Token Discorda nie jest przechowywany – po zalogowaniu potrzebujemy tylko ID.
 */

export { SESSION_COOKIE, STATE_COOKIE, encodeSession, decodeSession, type Session } from './session-core';
import { SESSION_COOKIE, decodeSession, type Session } from './session-core';

const MAX_AGE = 7 * 24 * 3600;

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
