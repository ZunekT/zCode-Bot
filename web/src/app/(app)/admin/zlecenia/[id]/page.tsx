import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { OrderActions, TaskList } from '@/components/OrderActions';
import { PersonChip } from '@/components/PersonChip';
import { api } from '@/lib/api';
import { date, dateTime, pln, statusTone } from '@/lib/money';
import { requireSession } from '@/lib/session';

const INVOICE: Record<string, string> = { ISSUED: 'wystawiona', PAID: 'opłacona', OVERDUE: 'po terminie', CANCELLED: 'anulowana' };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, requireSession()]);
  const d = await api.order(session.id, id);
  const o = d.order;
  const doneCount = d.tasks.filter((t) => t.done).length;

  return (
    <div className="app-page">
      <div className="crumbs">
        <Link href="/admin/zlecenia">Zlecenia</Link>
        <span className="sep">/</span>
        <span>{o.number}</span>
      </div>
      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <h1>{o.title}</h1>
          <div className="meta" style={{ marginTop: 8 }}>
            <span className={`pill ${statusTone(o.status)}`}>{o.statusLabel}</span>
            <span>{o.number}</span>
            <span>utworzone {date(o.createdAt)}</span>
            {o.deadline && <span>termin {date(o.deadline)}</span>}
          </div>
        </div>
        <div className="spacer" />
        {d.ticket?.url && (
          <a href={d.ticket.url} className="btn btn-sm" target="_blank" rel="noreferrer">
            <Icon name="ticket" size={16} /> Ticket #{d.ticket.id}
          </a>
        )}
        {o.panelUrl && (
          <a href={o.panelUrl} className="btn btn-sm" target="_blank" rel="noreferrer">
            <Icon name="discord" size={16} /> Panel na Discordzie
          </a>
        )}
      </div>

      <div className="two-col">
        <div className="stack">
          <section className="card glow">
            <div className="stats stats-4">
              <div className="stat">
                <div className="stat-label">Kwota</div>
                <div className="stat-value" style={{ fontSize: 18 }}>{pln(o.total, 'do wyceny')}</div>
                {o.discount > 0 && <div className="faint small">rabat {pln(o.discount)}{o.discountCode && ` (${o.discountCode})`}</div>}
              </div>
              <div className="stat">
                <div className="stat-label">Zapłacono</div>
                <div className="stat-value" style={{ fontSize: 18, color: 'var(--ok)' }}>{pln(o.paid)}</div>
              </div>
              <div className="stat">
                <div className="stat-label">Do zapłaty</div>
                <div className="stat-value" style={{ fontSize: 18, color: (o.due ?? 0) > 0 ? 'var(--warn)' : undefined }}>
                  {o.due === null ? '—' : pln(Math.max(0, o.due))}
                </div>
              </div>
              <div className="stat">
                <div className="stat-label">Klient</div>
                <div style={{ marginTop: 6 }}>
                  <PersonChip p={o.client} />
                </div>
              </div>
            </div>
          </section>

          {o.description && (
            <section className="card card-pad">
              <div className="field-label" style={{ marginBottom: 6 }}>Opis</div>
              <p className="muted" style={{ whiteSpace: 'pre-line' }}>{o.description}</p>
              {o.repoUrl && (
                <p style={{ marginTop: 10 }}>
                  <a href={o.repoUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--brand)' }}>
                    Repozytorium ↗
                  </a>
                </p>
              )}
            </section>
          )}

          <section className="card glow">
            <div className="card-head">
              <Icon name="checklist" />
              <h2>Zadania</h2>
              <div className="spacer" />
              {d.tasks.length > 0 && <span className="muted small">{doneCount}/{d.tasks.length}</span>}
            </div>
            {d.tasks.length ? <TaskList id={o.id} tasks={d.tasks} /> : <div className="card-body muted small">Brak zadań – dodaj je w „Akcjach”.</div>}
          </section>

          <section className="card glow">
            <div className="card-head">
              <Icon name="money" />
              <h2>Wpłaty i proformy</h2>
            </div>
            {d.payments.length === 0 && d.invoices.length === 0 ? (
              <div className="card-body muted small">Brak wpłat i proform.</div>
            ) : (
              <div className="table-wrap">
                <table className="dtable">
                  <tbody>
                    {d.invoices.map((i) => (
                      <tr key={`i${i.id}`}>
                        <td className="mono">
                          <a href={`/api/admin/orders/${o.id}/invoices/${i.id}`} target="_blank" rel="noreferrer" style={{ color: 'var(--brand)' }}>
                            {i.number} ↗
                          </a>
                        </td>
                        <td className="muted">proforma · {INVOICE[i.status] ?? i.status} · termin {date(i.dueDate)}</td>
                        <td className="r">{pln(i.amount)}</td>
                      </tr>
                    ))}
                    {d.payments.map((p) => (
                      <tr key={`p${p.id}`}>
                        <td className="mono">{dateTime(p.paidAt)}</td>
                        <td className="muted">wpłata{p.note && ` · ${p.note}`}</td>
                        <td className="r" style={{ color: 'var(--ok)' }}>+{pln(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="stack">
          <OrderActions
            order={{ id: o.id, title: o.title, description: o.description, price: o.price, deadline: o.deadline ?? null, repoUrl: o.repoUrl }}
            status={o.status}
            statuses={d.statuses}
            due={o.due}
          />
          <section className="card glow">
            <div className="card-head">
              <Icon name="calendar" />
              <h2>Historia</h2>
            </div>
            {d.history.length === 0 ? (
              <div className="card-body muted small">Brak zmian statusu.</div>
            ) : (
              <ol className="timeline">
                {d.history.map((h, i) => (
                  <li key={i}>
                    <span>
                      {h.from ? `${h.from} → ` : ''}
                      <b>{h.to}</b>
                      <span className="faint small" style={{ display: 'block' }}>
                        {dateTime(h.at)} · {h.by}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
          {d.review && (
            <section className="card card-pad">
              <div className="field-label">Opinia klienta {d.review.approved ? '' : '(czeka na zatwierdzenie)'}</div>
              <div style={{ margin: '6px 0', fontWeight: 700 }}>Ocena: {d.review.rating}/5</div>
              <p className="muted small">{d.review.content}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
