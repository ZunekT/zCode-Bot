import { env } from '@/lib/env';

export async function POST(request: Request) {
  const text = await request.text().catch(() => '');
  if (text.length > 2000) return new Response(null, { status: 204 });
  let body: { p?: unknown; r?: unknown } = {};
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 204 });
  }
  const forwarded = request.headers.get('x-forwarded-for')?.split(',').map((s) => s.trim()).filter(Boolean);
  const ip = forwarded?.[forwarded.length - 1] ?? request.headers.get('x-real-ip') ?? '0.0.0.0';
  await fetch(`${env.internalUrl}/internal/cms/self/hit`, {
    method: 'POST',
    headers: { 'x-internal-secret': env.internalSecret, 'content-type': 'application/json' },
    body: JSON.stringify({ path: body.p, referrer: body.r, ip, ua: request.headers.get('user-agent') ?? '' }),
    signal: AbortSignal.timeout(3000),
  }).catch(() => null);
  return new Response(null, { status: 204 });
}
