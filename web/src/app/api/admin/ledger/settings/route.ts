import { api } from '@/lib/api';
import { guarded } from '@/lib/route';

export async function PUT(request: Request) {
  return guarded(request, (session, body) => api.ledgerSettings(session.id, Number((body as { quarterLimit?: unknown })?.quarterLimit)));
}
