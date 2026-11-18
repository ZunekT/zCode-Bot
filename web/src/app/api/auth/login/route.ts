import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { STATE_COOKIE } from '@/lib/session';

export async function GET(request: Request) {
  const next = new URL(request.url).searchParams.get('next');
  const state = randomBytes(16).toString('hex');
  const url = new URL('https://discord.com/oauth2/authorize');
  url.searchParams.set('client_id', env.discordClientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'identify');
  url.searchParams.set('redirect_uri', `${env.siteUrl}/api/auth/callback`);
  url.searchParams.set('state', state);
  url.searchParams.set('prompt', 'none');

  const res = NextResponse.redirect(url);
  // Tylko ścieżki wewnątrz strony – bez otwartego przekierowania.
  const safeNext = next && /^\/(?!\/)[\w\-/]*$/.test(next) ? next : '/panel';
  res.cookies.set(STATE_COOKIE, `${state}|${safeNext}`, {
    httpOnly: true,
    secure: env.secureCookies,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 600,
  });
  return res;
}
