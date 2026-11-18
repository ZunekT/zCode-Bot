import Link from 'next/link';
import { PersonChip } from '@/components/PersonChip';
import { api } from '@/lib/api';
import { date, pln } from '@/lib/money';
import { requireSession } from '@/lib/session';

export const metadata = { title: 'Klienci' };

export default async function ClientsPage() {
  const session = await requireSession();
  const { clients } = await api.clients(session.id);
  return (
    <section className="card">
      {clients.length === 0 ? (
        <div className="card-body muted">Brak klientów.</div>
      ) : (
        <div className="table-wrap">
          <table className="dtable">
            <thead>
              <tr>
                <th>Klient</th>
                <th className="r">Zlecenia</th>
                <th className="r hide-sm">W toku</th>
                <th className="r hide-sm">Tickety</th>
                <th className="r">Zapłacono</th>
                <th className="r">Należność</th>
                <th className="r hide-sm">Ostatnio</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td>
                    <PersonChip
                      p={c}
                      sub={
                        <>
                          <Link href={`/admin/zlecenia?status=all&q=${c.id}`}>zlecenia</Link>
                          {c.badges.length > 0 && ` · ${c.badges.join(', ')}`}
                        </>
                      }
                    />
                  </td>
                  <td className="r">
                    {c.orders}
                    {c.completed > 0 && <span className="faint small"> ({c.completed} zak.)</span>}
                  </td>
                  <td className="r hide-sm">{c.active || '—'}</td>
                  <td className="r hide-sm">{c.tickets || '—'}</td>
                  <td className="r">{pln(c.paid)}</td>
                  <td className="r" style={{ color: c.due > 0 ? 'var(--warn)' : undefined }}>
                    {c.due > 0 ? pln(c.due) : '—'}
                  </td>
                  <td className="r hide-sm muted">{date(c.lastActivity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
