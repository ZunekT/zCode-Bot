import { draftMode } from 'next/headers';
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? '';
  const path = url.searchParams.get('path') ?? '/';
  const res = await fetch(`${env.internalUrl}/internal/cms/self/preview?token=${encodeURIComponent(token)}`, {
    headers: { 'x-internal-secret': env.internalSecret },
    cache: 'no-store',
  }).catch(() => null);
  const ok = res?.ok && ((await res.json()) as { ok: boolean }).ok;
  if (!ok) return new NextResponse('Nieprawidłowy link podglądu.', { status: 401 });
  (await draftMode()).enable();
  const safe = path.startsWith('/') && !path.startsWith('//') ? path : '/';
  return NextResponse.redirect(new URL(safe, env.siteUrl), 307);
}

export async function DELETE() {
  (await draftMode()).disable();
  return NextResponse.json({ ok: true });
}
