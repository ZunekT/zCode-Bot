import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { LimitEditor } from '@/components/LimitEditor';
import { PersonChip } from '@/components/PersonChip';
import { Segmented } from '@/components/ui/Segmented';
import { api } from '@/lib/api';
import { date, pln } from '@/lib/money';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { EmptyState } from '@/components/ui/EmptyState';

export const metadata = { title: 'Ewidencja sprzedaży' };

export default async function LedgerPage({ searchParams }: { searchParams: Promise<{ rok?: string; kw?: string }> }) {
  const [{ rok, kw }, session] = await Promise.all([searchParams, requireSession()]);
  if (!(await api.me(session.id)).owner) notFound();
  const l = await api.ledger(session.id, rok, kw);
  const now = new Date();
  const years = [now.getFullYear() - 1, now.getFullYear()];
  const level = l.usedPct >= 100 ? 'over' : l.usedPct >= 80 ? 'warn' : '';
  const left = Math.max(0, l.limit - l.total);
  const q = (y: number, k: number) => `/admin/ewidencja?rok=${y}&kw=${k}`;

  return (
    <div className="app-page">
      <div className="app-head">
        <div>
          <h1>Ewidencja sprzedaży</h1>
          <p>Uproszczona ewidencja z wpłat i limit przychodu działalności nierejestrowanej.</p>
        </div>
        <div className="actions">
          <a href={`/api/admin/ledger/csv?year=${l.year}&quarter=${l.quarter}`} className="btn">
            <Icon name="cloud_upload" size={16} /> Eksport CSV
          </a>
        </div>
      </div>

      <div className="filters">
        <Segmented
          ariaLabel="Kwartał"
          value={`${l.year}-${l.quarter}`}
          items={years.flatMap((y) => [1, 2, 3, 4].map((k) => ({ value: `${y}-${k}`, label: `Q${k} ${y}`, href: q(y, k) })))}
        />
      </div>

      <section key={`l${rok}-${kw}`} className="card limit glow tab-in" style={{ marginBottom: 16 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="kpi-label">
              Przychód Q{l.quarter} {l.year}
            </div>
            <div className="kpi-value">{pln(l.total)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="kpi-label">Limit kwartalny</div>
            <LimitEditor limit={l.limit} />
          </div>
        </div>
        <div className={`limit-bar ${level}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, l.usedPct)} aria-label="Wykorzystanie limitu">
          <span style={{ width: `${Math.min(100, l.usedPct)}%` }} />
        </div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className={level === 'over' ? 'down' : level === 'warn' ? 'text-warn' : 'muted'} style={{ fontWeight: 600 }}>
            {l.usedPct.toLocaleString('pl-PL')}% wykorzystane
          </span>
          <span className="muted small">{level === 'over' ? 'Limit przekroczony – trzeba zarejestrować działalność.' : `zostało ${pln(left)}`}</span>
        </div>
        <div className="grid2" style={{ marginTop: 18, gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
          {l.months.map((m) => (
            <div key={m.month} className="stat" style={{ border: 0, padding: 0 }}>
              <div className="stat-label">{new Date(`${m.month}-01T00:00:00`).toLocaleDateString('pl-PL', { month: 'long' })}</div>
              <div style={{ fontWeight: 700, marginTop: 4 }}>{pln(m.amount)}</div>
            </div>
          ))}
        </div>
      </section>

      <section key={`t${rok}-${kw}`} className="card glow tab-in">
        <div className="card-head">
          <Icon name="invoice" />
          <h2>Wpisy ({l.rows.length})</h2>
        </div>
        {l.rows.length === 0 ? (
          <EmptyState compact icon="money" title="Brak wpłat w tym kwartale" />
        ) : (
          <div className="table-wrap">
            <table className="dtable">
              <thead>
                <tr>
                  <th>Lp.</th>
                  <th>Data</th>
                  <th>Zlecenie</th>
                  <th className="hide-sm">Klient</th>
                  <th className="r">Kwota</th>
                </tr>
              </thead>
              <tbody>
                {l.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.lp}</td>
                    <td className="mono">{date(r.date)}</td>
                    <td>
                      <Link href={`/admin/zlecenia/${r.order.id}`}>
                        {r.order.number} · {r.order.title}
                      </Link>
                      {r.note && <div className="faint small">{r.note}</div>}
                    </td>
                    <td className="hide-sm">
                      <PersonChip p={r.client} />
                    </td>
                    <td className="r">{pln(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="muted small">
                    Razem
                  </td>
                  <td className="r">
                    <b>{pln(l.total)}</b>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
      <p className="faint small" style={{ marginTop: 14 }}>
        Wpisy tworzą się z wpłat zapisanych w zleceniach. Limit domyślnie: 225% płacy minimalnej na kwartał – zmień go, gdy zmieni się płaca minimalna.
      </p>
    </div>
  );
}
