import { api } from '@/lib/api';
import { guarded } from '@/lib/route';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id) || 0;
  return guarded(request, (session, body) => {
    const b = (body ?? {}) as { content?: unknown; revision?: unknown };
    return api.cmsSave(session.id, id, { content: b.content, revision: typeof b.revision === 'number' ? b.revision : undefined });
  });
}
