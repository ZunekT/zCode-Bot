import { api } from '@/lib/api';
import { guarded } from '@/lib/route';

export async function PUT(request: Request) {
  return guarded(request, (session, body) => {
    const b = (body ?? {}) as { launched?: unknown; previewUsers?: unknown };
    return api.saveSiteAccess(session.id, {
      ...(typeof b.launched === 'boolean' && { launched: b.launched }),
      ...(Array.isArray(b.previewUsers) && { previewUsers: b.previewUsers.map(String) }),
    });
  });
}
