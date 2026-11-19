import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { PersonChip } from '@/components/PersonChip';
import { Segmented } from '@/components/ui/Segmented';
import { api } from '@/lib/api';
import { dateTime } from '@/lib/money';
import { requireSession } from '@/lib/session';
import { EmptyState } from '@/components/ui/EmptyState';

export const metadata = { title: 'Dziennik zmian' };

const FILTERS = [
  { value: '', label: 'Wszystko' },
  { value: 'order', label: 'Zlecenia' },
  { value: 'ticket', label: 'Tickety' },
  { value: 'config', label: 'Ustawienia' },
  { value: 'sdk', label: 'Panel botów' },
  { value: 'vps', label: 'VPS' },
  { value: 'site', label: 'Strona' },
];

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ przed?: string; typ?: string }> }) {
  const [{ przed, typ }, session] = await Promise.all([searchParams, requireSession()]);
  const { entries, next } = await api.audit(session.id, przed, typ);
  const href = (t: string) => `/admin/dziennik${t ? `?typ=${t}` : ''}`;

  return (
    <div className="app-page">
      <div className="app-head">
        <div>
          <h1>Dziennik zmian</h1>
          <p>Kto, co i kiedy zmienił – z Discorda i z panelu.</p>
        </div>
      </div>
      <div className="filters">
        <Segmented value={typ ?? ''} items={FILTERS.map((f) => ({ ...f, href: href(f.value) }))} />
      </div>
      <section key={`${typ ?? ""}|${przed ?? ""}`} className="card glow tab-in">
        {entries.length === 0 ? (
          <EmptyState compact icon="documentation" title="Brak wpisów" text="Zmiany z panelu i bota pojawią się w dzienniku." />
        ) : (
          <div className="list">
            {entries.map((e) => (
              <div key={e.id} className="link-row">
                <PersonChip p={e.actor} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14 }}>{e.summary}</div>
                  <div className="faint small">
                    <code>{e.action}</code> · {dateTime(e.at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      {next && (
        <div className="more" style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <Link href={`/admin/dziennik?przed=${next}${typ ? `&typ=${typ}` : ''}`} className="btn">
            <Icon name="calendar" size={16} /> Starsze wpisy
          </Link>
        </div>
      )}
    </div>
  );
}
