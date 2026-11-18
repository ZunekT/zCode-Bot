import { internalRaw } from '@/lib/api';
import { getSession } from '@/lib/session';

/** Proforma klienta (HTML do wydruku / zapisu jako PDF) – tylko własne zlecenia. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; invoiceId: string }> }) {
  const session = await getSession();
  if (!session) return new Response('Zaloguj się.', { status: 401 });
  const { id, invoiceId } = await params;
  if (!/^\d+$/.test(id) || !/^\d+$/.test(invoiceId)) return new Response('Nie znaleziono.', { status: 404 });
  const res = await internalRaw(`/internal/users/${session.id}/orders/${id}/invoices/${invoiceId}`);
  if (!res) return new Response('Nie znaleziono.', { status: 404 });
  return new Response(await res.text(), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, no-store' } });
}
