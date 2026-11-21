import { NextResponse } from 'next/server';
import { api } from '@/lib/api';
import { guarded } from '@/lib/route';

const MAX_BASE64 = Math.ceil((4 * 1024 * 1024 * 4) / 3) + 8;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id) || 0;
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BASE64 + 2048)
    return NextResponse.json({ error: 'Zdjęcie może mieć maksymalnie 4 MB.' }, { status: 413 });
  return guarded(request, (session, body) => {
    const b = (body ?? {}) as { name?: unknown; data?: unknown };
    const name = typeof b.name === 'string' ? b.name.slice(0, 120) : '';
    const data = typeof b.data === 'string' ? b.data : '';
    return api.cmsUpload(session.id, id, { name, data });
  });
}
