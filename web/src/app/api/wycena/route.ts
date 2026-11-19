import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { internal, ApiError } from '@/lib/api';
import { env } from '@/lib/env';

const MAX_BODY = 20_000;
const FIELDS = ['name', 'email', 'company', 'siteType', 'budget', 'deadline', 'description', 'website', 'discord'] as const;

function clientIp(request: Request) {
  const fwd = request.headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',').pop()!.trim() : request.headers.get('x-real-ip')) || 'unknown';
}

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(env.siteUrl).origin) {
    return NextResponse.json({ error: 'Nieprawidłowe źródło żądania.' }, { status: 403 });
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ error: 'Za długie zapytanie.' }, { status: 413 });
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe dane.' }, { status: 400 });
  }

  if (body.consent !== true) return NextResponse.json({ error: 'Zaakceptuj politykę prywatności.' }, { status: 400 });
  const elapsed = typeof body.elapsed === 'number' ? body.elapsed : 0;
  if ((typeof body.trap === 'string' && body.trap.length > 0) || elapsed < 2500) {
    return NextResponse.json({ id: 0 });
  }

  const payload: Record<string, unknown> = {
    ipHash: createHmac('sha256', env.sessionSecret).update(`lead:${clientIp(request)}`).digest('hex').slice(0, 32),
  };
  for (const k of FIELDS) if (typeof body[k] === 'string') payload[k] = body[k];

  try {
    const res = await internal<{ id: number }>('POST', '/internal/public/leads', payload);
    return NextResponse.json({ id: res.id });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json(err.body, { status: err.status >= 500 ? 502 : err.status });
    return NextResponse.json({ error: 'Błąd serwera.' }, { status: 500 });
  }
}
