import type { Metadata } from 'next';
import { env } from '@/lib/env';
import './przerwa.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Przerwa techniczna', robots: { index: false } };

export default async function MaintenancePage() {
  type M = { title: string; message: string; until: string | null };
  let m = null as M | null;
  try {
    const res = await fetch(`${env.internalUrl}/internal/cms/self/state`, { headers: { 'x-internal-secret': env.internalSecret }, cache: 'no-store', signal: AbortSignal.timeout(3000) });
    if (res.ok) m = ((await res.json()) as { maintenance: M | null }).maintenance;
  } catch {}
  const until = m?.until ? new Date(m.until) : null;
  return (
    <main className="maint">
      <div className="maint-card">
        <img src="/emojis/logo_round.png" alt="" width={72} height={72} className="maint-logo" />
        <h1>{m?.title || 'Przerwa techniczna'}</h1>
        <p>{m?.message || 'Wprowadzamy ulepszenia. Wróć za chwilę.'}</p>
        {until && (
          <p className="maint-until">
            Planowany powrót: {until.toLocaleString('pl-PL', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Warsaw' })}
          </p>
        )}
        <a href="mailto:kontakt@zxcode.pl" className="maint-mail">
          kontakt@zxcode.pl
        </a>
      </div>
    </main>
  );
}
