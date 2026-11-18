import { api } from '@/lib/api';
import { guarded } from '@/lib/route';

export async function POST(request: Request) {
  return guarded(request, (session, body) => api.createOrder(session.id, body));
}
