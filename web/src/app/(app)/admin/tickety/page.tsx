import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { PersonChip } from '@/components/PersonChip';
import { Segmented } from '@/components/ui/Segmented';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { requireSession } from '@/lib/session';

export const metadata = { title: 'Tickety' };

const tone = (s: string) =>
  s === 'OPEN'
    ? 'pill-info'
    : s === 'CLAIMED'
      ? 'pill-ok'
      : s === 'WAITING_CLIENT'
        ? 'pill-muted'
        : 'pill-muted';

export default async function TicketsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [{ status }, session] = await Promise.all([searchParams, requireSession()]);
  const filter = status === 'closed' || status === 'all' ? status : 'open';
  const { tickets } = await api.tickets(session.id, filter);
  const waiting = tickets.filter((t) => t.waitingSince).length;

  return (
    <div className="app-page">
      <div className="app-head">
        <div>
          <h1>Tickety</h1>
          <p>
            {filter === 'open'
              ? waiting
                ? `${waiting} czeka na odpowiedź`
                : 'Wszyscy mają odpowiedź'
              : 'Historia zgłoszeń'}
          </p>
        </div>
      </div>
      <div className="filters">
        <Segmented
          value={filter}
          items={[
            { value: 'open', label: 'Otwarte', href: '/admin/tickety' },
            { value: 'closed', label: 'Zamknięte', href: '/admin/tickety?status=closed' },
            { value: 'all', label: 'Wszystkie', href: '/admin/tickety?status=all' },
          ]}
        />
      </div>
      <div key={filter} className="tab-in">
        {tickets.length === 0 ? (
          <div className="card empty">
            <Icon name="ticket" size={56} />
            <h2>Brak ticketów</h2>
            <p>Nic tu nie czeka na odpowiedź – wszystko obsłużone.</p>
          </div>
        ) : (
          <section className="card glow">
            <div className="list">
              {tickets.map((t) => (
                <Link key={t.id} href={`/admin/tickety/${t.id}`} className="link-row">
                  {t.waitingSince ? (
                    <span className="badge-dot" title="Klient czeka na odpowiedź" />
                  ) : (
                    <span style={{ width: 8 }} />
                  )}
                  <PersonChip
                    p={t.client}
                    sub={`#${t.id} · ${t.category}${t.subject ? ` · ${t.subject}` : ''}`}
                  />
                  <div className="spacer" />
                  {t.waitingSince && (
                    <span className="pill pill-warn">
                      czeka {timeAgo(t.waitingSince).replace(' temu', '')}
                    </span>
                  )}
                  <span className={`pill ${tone(t.status)}`}>{t.statusLabel}</span>
                  <span className="faint small hide-sm" style={{ minWidth: 90, textAlign: 'right' }}>
                    {timeAgo(t.lastActivityAt)}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
