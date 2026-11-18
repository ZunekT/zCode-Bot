import { api } from '@/lib/api';
import { guarded } from '@/lib/route';

export async function PUT(request: Request, { params }: { params: Promise<{ botId: string }> }) {
  const { botId } = await params;
  return guarded(request, (session, body) => {
    const b = (body ?? {}) as { presence?: unknown; username?: unknown; avatar?: unknown };
    return api.saveProfile(session.id, botId, { presence: b.presence, username: b.username, avatar: b.avatar });
  });
}
