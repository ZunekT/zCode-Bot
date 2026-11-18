import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { SESSION_COOKIE, STATE_COOKIE, cookieOptions, encodeSession } from '@/lib/session';

function fail(reason: string) {
  const url = new URL('/logowanie', env.siteUrl);
  url.searchParams.set('blad', reason);
  const res = NextResponse.redirect(url);
  res.cookies.delete({ name: STATE_COOKIE, path: '/api/auth' });
  return res;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const code = params.get('code');
  const state = params.get('state');
  const [expected, next = '/panel'] = ((await cookies()).get(STATE_COOKIE)?.value ?? '').split('|');
  if (params.get('error')) return fail('anulowano');
  if (!code || !state || !expected || state !== expected) return fail('sesja');

  const tokenRes = await fetch('https://discord.com/api/v10/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.discordClientId,
      client_secret: env.discordClientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${env.siteUrl}/api/auth/callback`,
    }),
    cache: 'no-store',
  });
  if (!tokenRes.ok) return fail('discord');
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) return fail('discord');

  const userRes = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { authorization: `Bearer ${token.access_token}` },
    cache: 'no-store',
  });
  if (!userRes.ok) return fail('discord');
  const user = (await userRes.json()) as {
    id: string;
    username: string;
    global_name: string | null;
    avatar: string | null;
  };

  void fetch('https://discord.com/api/v10/oauth2/token/revoke', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.discordClientId,
      client_secret: env.discordClientSecret,
      token: token.access_token,
      token_type_hint: 'access_token',
    }),
  }).catch(() => undefined);

  const res = NextResponse.redirect(new URL(next, env.siteUrl));
  res.cookies.set(
    SESSION_COOKIE,
    encodeSession({
      id: user.id,
      username: user.username,
      globalName: user.global_name,
      avatar: user.avatar,
    }),
    cookieOptions(),
  );
  res.cookies.delete({ name: STATE_COOKIE, path: '/api/auth' });
  return res;
}
