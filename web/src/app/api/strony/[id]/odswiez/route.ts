import { api } from '@/lib/api';
import { guarded } from '@/lib/route';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id) || 0;
  return guarded(request, (session) => api.cmsRefresh(session.id, id));
}
