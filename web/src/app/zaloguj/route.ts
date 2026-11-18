import { NextResponse } from 'next/server';
import { env } from '@/lib/env';

/** Krótki adres do logowania (działa też w trybie „Start wkrótce”). */
export function GET() {
  return NextResponse.redirect(new URL('/api/auth/login', env.siteUrl), 307);
}
