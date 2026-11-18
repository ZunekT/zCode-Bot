import { NextResponse } from 'next/server';
import { api } from '@/lib/api';
import { guarded } from '@/lib/route';

export async function POST(request: Request, { params }: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await params;
  if (!['reply', 'close'].includes(action) || !/^\d+$/.test(id)) return NextResponse.json({ error: 'Nie znaleziono.' }, { status: 404 });
  return guarded(request, (session, body) => api.ticketAction(session.id, id, action, body));
}
