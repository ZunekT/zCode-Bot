import { Topbar } from '@/components/Topbar';
import { api } from '@/lib/api';
import { requireSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const me = await api.me(session.id);
  return (
    <>
      <Topbar session={session} active="panel" owner={me.owner} />
      <main className="container page">{children}</main>
    </>
  );
}
