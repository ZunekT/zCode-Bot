import { env } from '@/lib/env';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return new Response('Not found', { status: 404 });
  const res = await fetch(`${env.internalUrl}/internal/public/portfolio/images/${id}`, {
    headers: { 'x-internal-secret': env.internalSecret },
    next: { revalidate: 86400 },
  }).catch(() => null);
  if (!res?.ok) return new Response('Not found', { status: 404 });
  return new Response(await res.arrayBuffer(), {
    headers: {
      'content-type': res.headers.get('content-type') ?? 'image/png',
      'cache-control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  });
}
