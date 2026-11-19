import Link from 'next/link';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState } from '@/components/ui/EmptyState';
import { api } from '@/lib/api';
import { leadTone, timeAgo } from '@/lib/format';
import { requireSession } from '@/lib/session';

export const metadata = { title: 'Zapytania' };

const FILTERS = [
  { value: '', label: 'Aktywne' },
  { value: 'NEW', label: 'Nowe' },
  { value: 'CONTACTED', label: 'W kontakcie' },
  { value: 'WON', label: 'Zamówione' },
  { value: 'CLOSED', label: 'Zamknięte' },
  { value: 'all', label: 'Wszystkie' },
];

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [{ status }, session] = await Promise.all([searchParams, requireSession()]);
  const filter = FILTERS.some((f) => f.value === status) ? status! : '';
  const { leads, counts } = await api.leads(session.id, filter || undefined);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const count = (v: string) =>
    v === 'all' ? total : v === '' ? (counts.NEW ?? 0) + (counts.CONTACTED ?? 0) : (counts[v] ?? 0);

  return (
    <div className="app-page">
      <div className="app-head">
        <div>
          <h1>Zapytania</h1>
          <p>Zapytania o strony z formularza wyceny na zxcode.pl. Nowe trafiają też na kanał obsługi na Discordzie.</p>
        </div>
      </div>
      <div className="filters">
        <Segmented
          value={filter}
          items={FILTERS.map((f) => ({
            value: f.value,
            label: f.label,
            count: count(f.value),
            href: f.value ? `/admin/zapytania?status=${f.value}` : '/admin/zapytania',
          }))}
        />
      </div>
      <div key={filter} className="tab-in">
        {leads.length === 0 ? (
          <EmptyState
            icon="notification"
            title="Brak zapytań"
            text={filter ? 'Nic tu nie ma dla tego filtra.' : 'Nowe zapytania z formularza wyceny pojawią się tutaj.'}
          />
        ) : (
          <section className="card glow">
            <div className="list">
              {leads.map((l) => (
                <Link key={l.id} href={`/admin/zapytania/${l.id}`} className="link-row lead-row">
                  <span className={`pill ${leadTone(l.status)}`}>{l.statusLabel}</span>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>
                      {l.name}
                      {l.company && <span className="muted"> · {l.company}</span>}
                    </div>
                    <div className="faint small lead-preview">{l.preview}</div>
                  </div>
                  <div className="lead-meta">
                    <span className="small">{l.siteType}</span>
                    <span className="faint small">
                      {l.budget} · {timeAgo(l.createdAt)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
