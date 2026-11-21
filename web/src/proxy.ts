import { NextResponse, type NextRequest } from 'next/server';
import { decodeSession, SESSION_COOKIE } from '@/lib/session-core';

const TTL_MS = 15_000;
const PRIVATE = /^\/(panel|admin|api|logowanie|zaloguj|przerwa|cms)(\/|$)/;
type Access = {
  allowed: boolean;
  launched: boolean;
  maintenance?: { title: string; message: string; until: string | null } | null;
  redirects?: { from: string; to: string; permanent: boolean }[];
  editor?: boolean;
};
const cache = new Map<string, Access & { at: number }>();
let lastLaunched: boolean | null = null;

async function access(userId: string | null): Promise<Access> {
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
    const v = (await res.json()) as Access;
    if (cache.size > 5000) cache.clear();
    cache.set(key, { ...v, at: Date.now() });
    lastLaunched = v.launched;
    return v;
  } catch {
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
  const v = await access(userId);
  const { pathname } = request.nextUrl;
  const clean = pathname.replace(/\/+$/, '') || '/';

  const redirect = v.redirects?.find((r) => r.from === clean);
  if (redirect && !PRIVATE.test(pathname)) {
    const target = new URL(redirect.to, request.url);
    if (redirect.to.startsWith('/')) target.search = request.nextUrl.search;
    return NextResponse.redirect(target, redirect.permanent ? 308 : 307);
  }

  if (v.allowed && v.maintenance && !v.editor && !PRIVATE.test(pathname)) {
    const res = NextResponse.rewrite(new URL('/przerwa', request.url), { status: 503 });
    res.headers.set('retry-after', String(v.maintenance.until ? Math.max(60, Math.round((new Date(v.maintenance.until).getTime() - Date.now()) / 1000)) : 3600));
    res.headers.set('x-robots-tag', 'noindex');
    res.headers.set('cache-control', 'no-store');
    return res;
  }

  if (v.allowed) return NextResponse.next();

  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Nie znaleziono.' }, { status: 404 });
  const res = NextResponse.rewrite(new URL('/wkrotce', request.url));
  res.headers.set('x-robots-tag', 'noindex');
  res.headers.set('cache-control', 'no-store');
  return res;
}

export const config = {
  matcher: [
    '/((?!_next/|emojis/|branding/|favicon\\.ico$|robots\\.txt$|api/auth/|api/portfolio/|api/t$|cms/|zaloguj$|wkrotce$|przerwa$).*)',
  ],
};
