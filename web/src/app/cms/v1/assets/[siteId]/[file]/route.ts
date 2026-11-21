import { env } from '@/lib/env';

const FILE = /^[a-f0-9]{24}\.(png|jpg|webp|gif)$/;

export async function GET(_req: Request, { params }: { params: Promise<{ siteId: string; file: string }> }) {
  const { siteId, file } = await params;
  if (!/^\d{1,9}$/.test(siteId) || !FILE.test(file)) return new Response('Not found', { status: 404 });
  const res = await fetch(`${env.internalUrl}/internal/cms/assets/${siteId}/${file}`, {
    headers: { 'x-internal-secret': env.internalSecret },
    next: { revalidate: 86400 },
  }).catch(() => null);
  if (!res?.ok) return new Response('Not found', { status: 404 });
  return new Response(await res.arrayBuffer(), {
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/octet-stream',
      'cache-control': 'public, max-age=31536000, immutable',
      'content-security-policy': "default-src 'none'; sandbox",
    },
  });
}
