import { notFound } from 'next/navigation';
import { AdminTabs } from '@/components/AdminTabs';
import { Topbar } from '@/components/Topbar';
import { api } from '@/lib/api';
import { requireSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Administracja' };

/** Tylko właściciel zxCode – dla pozostałych strona nie istnieje. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const me = await api.me(session.id);
  if (!me.owner) notFound();
  return (
    <>
      <Topbar session={session} active="admin" owner />
      <main className="container page">
        <AdminTabs />
        {children}
      </main>
    </>
  );
}
