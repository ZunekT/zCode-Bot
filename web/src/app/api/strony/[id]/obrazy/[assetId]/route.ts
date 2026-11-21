import { api, ApiError, internalRaw } from '@/lib/api';
import { guarded } from '@/lib/route';
import { getSession } from '@/lib/session';

const ASSET = /^[a-f0-9]{24}$/;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; assetId: string }> }) {
  const { id, assetId } = await params;
  const session = await getSession();
  if (!session || !ASSET.test(assetId)) return new Response('Not found', { status: 404 });
  const res = await internalRaw(`/internal/users/${session.id}/cms/${Number(id) || 0}/assets/${assetId}`);
  if (!res) return new Response('Not found', { status: 404 });
  return new Response(await res.arrayBuffer(), {
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/octet-stream',
      'cache-control': 'private, max-age=3600',
      'content-security-policy': "default-src 'none'; sandbox",
    },
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; assetId: string }> }) {
  const { id, assetId } = await params;
  return guarded(request, (session) => {
    if (!ASSET.test(assetId)) throw new ApiError(404, { error: 'Nie znaleziono.' });
    return api.cmsDeleteAsset(session.id, Number(id) || 0, assetId);
  });
}
