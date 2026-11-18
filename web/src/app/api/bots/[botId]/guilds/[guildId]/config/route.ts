import { api } from '@/lib/api';
import { guarded } from '@/lib/route';

export async function PUT(request: Request, { params }: { params: Promise<{ botId: string; guildId: string }> }) {
  const { botId, guildId } = await params;
  return guarded(request, (session, body) => {
    const b = (body ?? {}) as { values?: unknown; permissions?: unknown };
    return api.saveConfig(session.id, botId, guildId, {
      ...(b.values !== undefined && { values: b.values }),
      ...(b.permissions !== undefined && { permissions: b.permissions }),
    });
  });
}
