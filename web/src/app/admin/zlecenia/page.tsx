import Link from 'next/link';
import { PersonChip } from '@/components/PersonChip';
import { api } from '@/lib/api';
import { date, pln, statusTone } from '@/lib/money';
import { requireSession } from '@/lib/session';

export const metadata = { title: 'Zlecenia' };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const [{ status, q }, session] = await Promise.all([searchParams, requireSession()]);
  const filter = status ?? 'active';
  const d = await api.orders(session.id, filter === 'all' ? undefined : filter, q);
  const href = (s: string) => `/admin/zlecenia?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
  const sum = d.orders.reduce((a, o) => ({ total: a.total + (o.total ?? 0), due: a.due + Math.max(0, o.due ?? 0) }), { total: 0, due: 0 });

  return (
    <>
      <div className="filters">
        <nav className="seg" aria-label="Status">
          <Link href={href('active')} aria-current={filter === 'active' ? 'page' : undefined}>
            W toku
          </Link>
          <Link href={href('all')} aria-current={filter === 'all' ? 'page' : undefined}>
            Wszystkie
          </Link>
          {d.statuses.map((s) => (
            <Link key={s.status} href={href(s.status)} aria-current={filter === s.status ? 'page' : undefined}>
              {s.label}
            </Link>
          ))}
        </nav>
        <form action="/admin/zlecenia">
          <input type="hidden" name="status" value={filter} />
          <input className="input" name="q" defaultValue={q} placeholder="Szukaj: tytuł, ZX-0042, ID klienta" style={{ width: 260, height: 36 }} />
          <button className="btn btn-sm" type="submit" style={{ height: 36 }}>
            Szukaj
          </button>
        </form>
      </div>

      <section className="card">
        {d.orders.length === 0 ? (
          <div className="card-body muted">Brak zleceń dla tego filtra.</div>
        ) : (
          <div className="table-wrap">
            <table className="dtable">
              <thead>
                <tr>
                  <th>Zlecenie</th>
                  <th className="hide-sm">Klient</th>
                  <th>Status</th>
                  <th className="hide-sm">Zadania</th>
                  <th className="hide-sm">Termin</th>
                  <th className="r">Kwota</th>
                  <th className="r">Do zapłaty</th>
                </tr>
              </thead>
              <tbody>
                {d.orders.map((o) => (
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
                    <td className="hide-sm muted">{o.tasksTotal ? `${o.tasksDone}/${o.tasksTotal}` : '—'}</td>
                    <td className="hide-sm muted">{date(o.deadline)}</td>
                    <td className="r">{pln(o.total, 'do wyceny')}</td>
                    <td className="r" style={{ color: (o.due ?? 0) > 0 ? 'var(--warn)' : undefined }}>
                      {o.due === null ? '—' : pln(Math.max(0, o.due))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="muted small" colSpan={5}>
                    {d.orders.length} zleceń
                  </td>
                  <td className="r">
                    <b>{pln(sum.total)}</b>
                  </td>
                  <td className="r">
                    <b>{pln(sum.due)}</b>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
