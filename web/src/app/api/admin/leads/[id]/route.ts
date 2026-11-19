import { NextResponse } from 'next/server';
import { api } from '@/lib/api';
import { guarded } from '@/lib/route';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'Nie znaleziono.' }, { status: 404 });
  return guarded(request, (session, body) => {
    const b = (body ?? {}) as { status?: unknown; note?: unknown };
    return api.saveLead(session.id, id, { status: b.status, note: b.note });
  });
}
