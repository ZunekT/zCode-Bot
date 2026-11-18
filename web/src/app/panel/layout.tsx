import { Topbar } from '@/components/Topbar';
import { requireSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return (
    <>
      <Topbar session={session} active="panel" />
      <main className="container page">{children}</main>
    </>
  );
}
