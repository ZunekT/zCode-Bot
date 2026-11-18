import { NextResponse } from 'next/server';
import { api } from '@/lib/api';
import { guarded } from '@/lib/route';

export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (action !== 'reboot' && action !== 'backup')
    return NextResponse.json({ error: 'Nieznana akcja.' }, { status: 404 });
  return guarded(request, (session) => api.vpsAction(session.id, action));
}
