import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { SESSION_COOKIE } from '@/lib/session';

/** POST, żeby obcy link nie mógł wylogować. */
export async function POST() {
  const res = NextResponse.redirect(new URL('/', env.siteUrl), 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
