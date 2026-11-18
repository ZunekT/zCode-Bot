import { api } from '@/lib/api';
import { guarded } from '@/lib/route';

export async function PUT(request: Request) {
  return guarded(request, (session, body) => {
    const b = (body ?? {}) as { users?: unknown; roles?: unknown };
    return api.saveAdmins(session.id, {
      ...(Array.isArray(b.users) && { users: b.users.map(String) }),
      ...(Array.isArray(b.roles) && { roles: b.roles.map(String) }),
    });
  });
}
