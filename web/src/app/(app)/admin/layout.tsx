import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { requireSession } from '@/lib/session';

export const metadata = { title: 'Administracja' };

/** Tylko właściciel zxCode – dla pozostałych strona nie istnieje. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const me = await api.me(session.id);
  if (!me.owner) notFound();
  return children;
}
