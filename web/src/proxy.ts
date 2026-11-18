import { NextResponse, type NextRequest } from 'next/server';
import { decodeSession, SESSION_COOKIE } from '@/lib/session-core';

const TTL_MS = 15_000;
const cache = new Map<string, { at: number; allowed: boolean; launched: boolean }>();
let lastLaunched: boolean | null = null;

async function access(userId: string | null): Promise<{ allowed: boolean; launched: boolean }> {
  const key = userId ?? '-';
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit;
  try {
    const base = (process.env.INTERNAL_API_URL ?? 'http://localhost:3100').replace(/\/$/, '');
    const res = await fetch(`${base}/internal/site/access${userId ? `?user=${userId}` : ''}`, {
      headers: { 'x-internal-secret': process.env.INTERNAL_API_SECRET ?? '' },
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(String(res.status));
    const v = (await res.json()) as { allowed: boolean; launched: boolean };
    if (cache.size > 5000) cache.clear();
    cache.set(key, { ...v, at: Date.now() });
    lastLaunched = v.launched;
    return v;
  } catch {
    // Bot niedostępny: ostatni znany stan, a bez niego – strona ukryta (bezpieczniej).
    if (hit) return hit;
    return { allowed: lastLaunched === true, launched: lastLaunched === true };
  }
}

export async function proxy(request: NextRequest) {
  let userId: string | null = null;
  try {
    userId = decodeSession(request.cookies.get(SESSION_COOKIE)?.value)?.id ?? null;
  } catch {
    userId = null;
  }
  const { allowed } = await access(userId);
  if (allowed) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Nie znaleziono.' }, { status: 404 });
  const res = NextResponse.rewrite(new URL('/wkrotce', request.url));
  res.headers.set('x-robots-tag', 'noindex');
  res.headers.set('cache-control', 'no-store');
  return res;
}

export const config = {
  matcher: [
    // Wszystko poza: plikami Next, grafikami, logowaniem i samą stroną „Start wkrótce”.
    '/((?!_next/|emojis/|branding/|favicon\\.ico$|robots\\.txt$|api/auth/|api/portfolio/|zaloguj$|wkrotce$).*)',
  ],
};
