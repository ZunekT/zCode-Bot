import Link from 'next/link';
import { PersonChip } from '@/components/PersonChip';
import { KindTag } from '@/components/ui/KindTag';
import { Segmented } from '@/components/ui/Segmented';
import { api } from '@/lib/api';
import { date, pln, statusTone } from '@/lib/money';
import { requireSession } from '@/lib/session';
import { EmptyState } from '@/components/ui/EmptyState';

export const metadata = { title: 'Zlecenia' };

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; typ?: string }>;
}) {
  const [{ status, q, typ }, session] = await Promise.all([searchParams, requireSession()]);
  const filter = status ?? 'active';
  const kind = typ === 'strony' ? 'WEBSITE' : typ === 'boty' ? 'BOT' : undefined;
  const d = await api.orders(session.id, filter === 'all' ? undefined : filter, q, kind);
  const qs = (s: string, t = typ) =>
    `/admin/zlecenia?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ''}${t ? `&typ=${t}` : ''}`;
  const href = (s: string) => qs(s);
  const sum = d.orders.reduce(
    (a, o) => ({ total: a.total + (o.total ?? 0), due: a.due + Math.max(0, o.due ?? 0) }),
    { total: 0, due: 0 },
  );

  return (
    <div className="app-page">
      <div className="app-head">
        <div>
          <h1>Zlecenia</h1>
          <p>Wszystkie zlecenia, filtrowanie i wyszukiwanie.</p>
        </div>
        <div className="actions">
          <Link href="/admin/zlecenia/nowe" className="btn btn-primary">
            Nowe zlecenie
          </Link>
        </div>
      </div>
      <div className="filters">
        <Segmented
          ariaLabel="Status"
          value={filter}
          items={[
            { value: 'active', label: 'W toku', href: href('active') },
            { value: 'all', label: 'Wszystkie', href: href('all') },
            ...d.statuses.map((s) => ({ value: s.status, label: s.label, href: href(s.status) })),
          ]}
        />
        <Segmented
          ariaLabel="Rodzaj"
          value={typ === 'strony' || typ === 'boty' ? typ : ''}
          items={[
            { value: '', label: 'Wszystko', href: qs(filter, '') },
            { value: 'strony', label: 'Strony', href: qs(filter, 'strony') },
            { value: 'boty', label: 'Boty', href: qs(filter, 'boty') },
          ]}
        />
        <form action="/admin/zlecenia">
          <input type="hidden" name="status" value={filter} />
          {typ && <input type="hidden" name="typ" value={typ} />}
          <input
            className="input"
            name="q"
            defaultValue={q}
            placeholder="Szukaj: tytuł, ZX-0042, ID klienta"
            style={{ width: 260, height: 38 }}
          />
          <button className="btn btn-sm" type="submit" style={{ height: 38 }}>
            Szukaj
          </button>
        </form>
      </div>

      <section key={`${status ?? ''}|${q ?? ''}|${typ ?? ''}`} className="card glow tab-in">
        {d.orders.length === 0 ? (
          <EmptyState compact icon="package" title="Brak zleceń" text="Zmień filtr albo wyszukiwaną frazę." />
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
                      <div className="faint small row" style={{ gap: 8 }}>
                        <KindTag kind={o.kind} /> {o.number}
                      </div>
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
    </div>
  );
}
