import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { requireSession } from '@/lib/session';

export const metadata = { title: 'Administracja' };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const me = await api.me(session.id);
  if (!me.owner) notFound();
  return children;
}
