import { revalidatePath, revalidateTag } from 'next/cache';
import { api } from '@/lib/api';
import { guarded } from '@/lib/route';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id) || 0;
  return guarded(request, async (session, body) => {
    const b = (body ?? {}) as { content?: unknown; revision?: unknown };
    const r = await api.cmsSave(session.id, id, { content: b.content, revision: typeof b.revision === 'number' ? b.revision : undefined });
    revalidateTag('zxcode-content', { expire: 0 });
    revalidatePath('/', 'layout');
    return r;
  });
}
