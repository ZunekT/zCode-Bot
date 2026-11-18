import { api, ApiError } from '@/lib/api';
import { guarded } from '@/lib/route';

export async function PUT(request: Request) {
  return guarded(request, (session, body) => {
    const b = (body ?? {}) as { launched?: unknown; previewUsers?: unknown };
    if (b.launched !== undefined && typeof b.launched !== 'boolean') throw new ApiError(400, { error: 'Nieprawidłowe dane.' });
    if (b.previewUsers !== undefined && !Array.isArray(b.previewUsers)) throw new ApiError(400, { error: 'Nieprawidłowe dane.' });
    return api.saveSiteAccess(session.id, {
      ...(typeof b.launched === 'boolean' && { launched: b.launched }),
      ...(Array.isArray(b.previewUsers) && { previewUsers: b.previewUsers.map(String) }),
    });
  });
}
