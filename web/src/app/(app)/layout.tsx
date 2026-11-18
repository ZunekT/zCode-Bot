import { AppShell } from '@/components/app/AppShell';
import { api } from '@/lib/api';
import { avatarUrl, requireSession } from '@/lib/session';
import './app.css';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const me = await api.me(session.id);
  return (
    <AppShell user={{ name: session.globalName ?? session.username, avatar: avatarUrl(session, 64) }} owner={me.owner} admin={me.admin}>
      {children}
    </AppShell>
  );
}
