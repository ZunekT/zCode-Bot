import { api } from '@/lib/api';
import { guarded } from '@/lib/route';

type Ctx = { params: Promise<{ botId: string; memberId: string }> };

export async function PUT(request: Request, { params }: Ctx) {
  const { botId, memberId } = await params;
  return guarded(request, (session, body) => {
    const b = (body ?? {}) as { permissions?: unknown; modules?: unknown; guilds?: unknown };
    return api.saveBotMember(session.id, botId, memberId, {
      permissions: b.permissions,
      modules: b.modules,
      guilds: b.guilds,
    });
  });
}

export async function DELETE(request: Request, { params }: Ctx) {
  const { botId, memberId } = await params;
  return guarded(request, (session) => api.removeBotMember(session.id, botId, memberId));
}
