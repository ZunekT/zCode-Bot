import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { PersonChip } from '@/components/PersonChip';
import { RevenueChart } from '@/components/RevenueChart';
import { api } from '@/lib/api';
import { CountUp } from '@/components/site/islands';
import { Amount } from '@/components/ui/Amount';
import { date, dateTime, pln, statusTone } from '@/lib/money';
import { requireSession } from '@/lib/session';
import { EmptyState } from '@/components/ui/EmptyState';

export default async function AdminOverview() {
  const session = await requireSession();
  const d = await api.overview(session.id);
  const k = d.kpi;
  const diff = k.revenuePrevMonth > 0 ? Math.round(((k.revenueMonth - k.revenuePrevMonth) / k.revenuePrevMonth) * 100) : null;
  const maxStatus = Math.max(...d.ordersByStatus.map((s) => s.count), 1);

  return (
    <div className="app-page">
      <div className="app-head">
        <div>
          <h1>Przegląd</h1>
          <p>Przychody, zlecenia i obsługa w jednym miejscu.</p>
        </div>
        <div className="actions">
          <Link href="/admin/zlecenia/nowe" className="btn btn-primary">
            <Icon name="package" size={16} /> Nowe zlecenie
          </Link>
        </div>
      </div>
      <div className="kpis">
        <div className="card kpi glow">
          <div className="kpi-label">Przychód w tym miesiącu</div>
          <div className="kpi-value"><Amount v={k.revenueMonth} /></div>
          <div className="kpi-sub">
            {diff === null ? `poprzedni: ${pln(k.revenuePrevMonth)}` : <span className={diff >= 0 ? 'up' : 'down'}>{diff >= 0 ? '+' : ''}{diff}% vs poprzedni</span>}
          </div>
        </div>
        <div className="card kpi glow">
          <div className="kpi-label">Należności</div>
          <div className="kpi-value"><Amount v={k.receivables} /></div>
          <div className="kpi-sub">{k.activeOrders} zleceń w toku</div>
        </div>
        <div className="card kpi glow">
          <div className="kpi-label">Otwarte tickety</div>
          <div className="kpi-value"><CountUp to={k.openTickets} /></div>
          <div className="kpi-sub">{k.firstReplyMin === null ? 'brak danych o odpowiedziach' : `mediana 1. odpowiedzi: ${k.firstReplyMin < 60 ? `${k.firstReplyMin} min` : `${Math.round(k.firstReplyMin / 60)} godz.`}`}</div>
        </div>
        <div className="card kpi glow">
          <div className="kpi-label">Klienci</div>
          <div className="kpi-value"><CountUp to={k.clients} /></div>
          <div className="kpi-sub">{k.rating === null ? 'brak opinii' : `ocena ${k.rating.toLocaleString('pl-PL')}/5 (${k.reviews})`}</div>
        </div>
      </div>

      <div className="two-col" style={{ marginBottom: 16 }}>
        <section className="card card-pad glow">
          <RevenueChart data={d.revenueByMonth} />
        </section>
        <section className="card">
          <div className="card-head">
            <Icon name="checklist" />
            <h2>Zlecenia wg statusu</h2>
          </div>
          <div className="status-bars">
            {d.ordersByStatus.map((s) => (
              <Link key={s.status} href={`/admin/zlecenia?status=${s.status}`} className="sbar">
                <span className="muted">{s.label}</span>
                <span className="sbar-track" aria-hidden>
                  <span style={{ width: `${(s.count / maxStatus) * 100}%` }} />
                </span>
                <b>{s.count}</b>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {d.overdueInvoices.length > 0 && (
        <section className="card" style={{ marginBottom: 16, borderColor: 'rgba(245,176,65,.4)' }}>
          <div className="card-head">
            <Icon name="invoice" />
            <h2>Zaległe proformy ({d.overdueInvoices.length})</h2>
          </div>
          <div className="table-wrap">
            <table className="dtable">
              <tbody>
                {d.overdueInvoices.map((i) => (
                  <tr key={i.id}>
                    <td className="mono">{i.number}</td>
                    <td>
                      <Link href={`/admin/zlecenia/${i.order.id}`}>
                        {i.order.number} · {i.order.title}
                      </Link>
                    </td>
                    <td className="hide-sm">
                      <PersonChip p={i.client} />
                    </td>
                    <td className="r">{pln(i.amount)}</td>
                    <td className="r" style={{ color: 'var(--warn)' }}>termin {date(i.dueDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="two-col">
        <section className="card">
          <div className="card-head">
            <Icon name="package" />
            <h2>Ostatnio zmieniane zlecenia</h2>
            <div className="spacer" />
            <Link href="/admin/zlecenia" className="btn btn-sm">
              Wszystkie
            </Link>
          </div>
          {d.recentOrders.length === 0 ? (
            <EmptyState compact icon="package" title="Brak zleceń" />
          ) : (
            <div className="table-wrap">
              <table className="dtable">
                <tbody>
                  {d.recentOrders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/admin/zlecenia/${o.id}`} style={{ fontWeight: 600 }}>
                          {o.title}
                        </Link>
                        <div className="faint small">{o.number}</div>
                      </td>
                      <td className="hide-sm">
                        <PersonChip p={o.client} />
                      </td>
                      <td>
                        <span className={`pill ${statusTone(o.status)}`}>{o.statusLabel}</span>
                      </td>
                      <td className="r">{pln(o.total, 'do wyceny')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="card">
          <div className="card-head">
            <Icon name="money" />
            <h2>Ostatnie wpłaty</h2>
          </div>
          {d.recentPayments.length === 0 ? (
            <EmptyState compact icon="money" title="Brak wpłat" />
          ) : (
            <div className="list">
              {d.recentPayments.map((p) => (
                <Link key={p.id} href={`/admin/zlecenia/${p.order.id}`} className="list-item">
                  <PersonChip p={p.client} sub={`${p.order.number} · ${dateTime(p.paidAt)}`} />
                  <div className="spacer" />
                  <b className="num" style={{ color: 'var(--ok)' }}>+{pln(p.amount)}</b>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
