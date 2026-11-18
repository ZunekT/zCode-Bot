import { NextResponse } from 'next/server';
import { env } from '@/lib/env';

export function GET() {
  return NextResponse.redirect(env.discordInvite ?? new URL('/panel', env.siteUrl), 307);
}
