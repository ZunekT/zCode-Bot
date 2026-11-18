import { NextResponse } from 'next/server';
import { env } from '@/lib/env';

/** „Zamów bota” → zaproszenie na serwer Discord (czytane przy każdym wejściu, nie przy budowaniu). */
export function GET() {
  return NextResponse.redirect(env.discordInvite ?? new URL('/panel', env.siteUrl), 307);
}
