import Link from 'next/link';
import { CopyButton } from '@/components/ui/CopyButton';
import { Icon } from '@/components/Icon';
import { api } from '@/lib/api';
import { date, dateTime, pln, statusTone } from '@/lib/money';
import { requireSession } from '@/lib/session';

const INVOICE: Record<string, string> = { ISSUED: 'do zapłaty', PAID: 'opłacona', OVERDUE: 'po terminie' };

export default async function MyOrder({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, requireSession()]);
  const d = await api.myOrder(session.id, id);
  const o = d.order;
  const cancelled = o.status === 'CANCELLED';
  const done = d.tasks.filter((t) => t.done).length;

  return (
    <div className="app-page">
      <div className="crumbs">
        <Link href="/panel/zlecenia">Moje zlecenia</Link>
        <span className="sep">/</span>
        <span>{o.number}</span>
      </div>
      <div className="app-head">
        <div style={{ minWidth: 0 }}>
          <h1>{o.title}</h1>
          <div className="meta" style={{ marginTop: 8 }}>
            <span className={`pill ${statusTone(o.status)}`}>{o.statusLabel}</span>
            <span>{o.number}</span>
            {o.deadline && <span>termin {date(o.deadline)}</span>}
          </div>
        </div>
        {d.ticketUrl && (
          <div className="actions">
            <a href={d.ticketUrl} className="btn" target="_blank" rel="noreferrer">
              <Icon name="discord" size={16} /> Napisz w tickecie
            </a>
          </div>
        )}
      </div>

      {!cancelled && (
        <section className="card card-pad glow" style={{ marginBottom: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>Postęp</b>
            <span className="muted small">{o.statusText}</span>
          </div>
          <div className="track" style={{ '--n': d.steps.length } as React.CSSProperties}>
            {d.steps.map((s, i) => (
              <div
                key={s.status}
                className={`track-step${s.step < o.step ? ' done' : ''}${s.step === o.step ? ' now' : ''}`}
                style={{ '--i': i } as React.CSSProperties}
              >
                <i />
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="two-col">
        <div className="stack">
          <section className="card">
            <div className="stats">
              <div className="stat">
                <div className="stat-label">Kwota</div>
                <div className="stat-value" style={{ fontSize: 20 }}>
                  {pln(o.total, 'wycena w toku')}
                </div>
                {o.discount > 0 && <div className="faint small">rabat {pln(o.discount)}</div>}
              </div>
              <div className="stat">
                <div className="stat-label">Zapłacono</div>
                <div className="stat-value" style={{ fontSize: 20, color: 'var(--ok)' }}>
                  {pln(o.paid)}
                </div>
              </div>
              <div className="stat">
                <div className="stat-label">Do zapłaty</div>
                <div className="stat-value" style={{ fontSize: 20, color: (o.due ?? 0) > 0 ? 'var(--warn)' : undefined }}>
                  {o.due === null ? '—' : pln(Math.max(0, o.due))}
                </div>
              </div>
            </div>
          </section>

          {d.payment && (
            <section className="card card-pad glow" style={{ borderColor: 'rgba(245,176,65,.35)' }}>
              <div className="row" style={{ marginBottom: 10 }}>
                <Icon name="payment_card" />
                <b>Dane do przelewu</b>
              </div>
              {d.payment.details ? (
                <>
                  <pre className="pay-details">{d.payment.details}</pre>
                  <div className="row" style={{ marginTop: 10 }}>
                    <span className="muted small">Tytuł przelewu:</span>
                    <code>{d.payment.title}</code>
                    <CopyButton text={d.payment.title} />
                  </div>
                </>
              ) : (
                <p className="muted small">Dane do przelewu dostaniesz w tickecie.</p>
              )}
            </section>
          )}

          {o.description && (
            <section className="card card-pad">
              <div className="field-label" style={{ marginBottom: 6 }}>
                Opis
              </div>
              <p className="muted" style={{ whiteSpace: 'pre-line' }}>
                {o.description}
              </p>
            </section>
          )}

          <section className="card">
            <div className="card-head">
              <Icon name="checklist" />
              <h2>Zadania</h2>
              <div className="spacer" />
              {d.tasks.length > 0 && (
                <span className="muted small">
                  {done}/{d.tasks.length}
                </span>
              )}
            </div>
            {d.tasks.length === 0 ? (
              <div className="card-body muted small">Lista zadań pojawi się, gdy zaczniemy prace.</div>
            ) : (
              d.tasks.map((t) => (
                <div key={t.id} className={`task-row${t.done ? ' done' : ''}`} style={{ cursor: 'default' }}>
                  <span className={`tick${t.done ? ' on' : ''}`} aria-label={t.done ? 'zrobione' : 'do zrobienia'} />
                  <span>{t.content}</span>
                </div>
              ))
            )}
          </section>
        </div>

        <div className="stack">
          <section className="card">
            <div className="card-head">
              <Icon name="invoice" />
              <h2>Proformy i wpłaty</h2>
            </div>
            {d.invoices.length === 0 && d.payments.length === 0 ? (
              <div className="card-body muted small">Brak dokumentów.</div>
            ) : (
              <div className="list">
                {d.invoices.map((i) => (
                  <a key={`i${i.id}`} href={`/api/zlecenia/${o.id}/proforma/${i.id}`} target="_blank" rel="noreferrer" className="link-row">
                    <Icon name="invoice" size={20} />
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>{i.number}</div>
                      <div className="faint small">
                        {INVOICE[i.status] ?? i.status} · termin {date(i.dueDate)}
                      </div>
                    </div>
                    <b className="num">{pln(i.amount)}</b>
                    <span className="chev">↗</span>
                  </a>
                ))}
                {d.payments.map((p) => (
                  <div key={`p${p.id}`} className="link-row">
                    <Icon name="money" size={20} />
                    <div className="grow">
                      <div style={{ fontWeight: 600 }}>Wpłata</div>
                      <div className="faint small">{dateTime(p.paidAt)}</div>
                    </div>
                    <b className="num" style={{ color: 'var(--ok)' }}>
                      +{pln(p.amount)}
                    </b>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="card">
            <div className="card-head">
              <Icon name="calendar" />
              <h2>Historia</h2>
            </div>
            {d.history.length === 0 ? (
              <div className="card-body muted small">Brak zmian.</div>
            ) : (
              <ol className="timeline">
                {d.history.map((h, i) => (
                  <li key={i}>
                    <span>
                      <b>{h.to}</b>
                      <span className="faint small" style={{ display: 'block' }}>
                        {dateTime(h.at)}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
