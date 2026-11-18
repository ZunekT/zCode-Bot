import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { PersonChip } from '@/components/PersonChip';
import { TicketChat } from '@/components/TicketChat';
import { api } from '@/lib/api';
import { dateTime } from '@/lib/money';
import { requireSession } from '@/lib/session';

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, requireSession()]);
  const d = await api.ticket(session.id, id);
  const t = d.ticket;
  const form = t.formData && typeof t.formData === 'object' ? Object.entries(t.formData).filter(([, v]) => typeof v === 'string' && v) : [];

  return (
    <div className="app-page">
      <div className="crumbs">
        <Link href="/admin/tickety">Tickety</Link>
        <span className="sep">/</span>
        <span>#{t.id}</span>
      </div>
      <div className="app-head">
        <div style={{ minWidth: 0 }}>
          <h1>
            #{t.id} · {t.category}
          </h1>
          <div className="meta" style={{ marginTop: 8 }}>
            <span className={`pill ${t.open ? 'pill-info' : 'pill-muted'}`}>{t.statusLabel}</span>
            <span>otwarty {dateTime(t.openedAt)}</span>
            {t.claimedBy && <span>przejął: {t.claimedBy}</span>}
          </div>
        </div>
        <div className="actions">
          {t.order && (
            <Link href={`/admin/zlecenia/${t.order.id}`} className="btn btn-sm">
              <Icon name="package" size={16} /> {t.order.number}
            </Link>
          )}
          {t.url && t.open && (
            <a href={t.url} className="btn btn-sm" target="_blank" rel="noreferrer">
              <Icon name="discord" size={16} /> Otwórz na Discordzie
            </a>
          )}
          {t.transcriptUrl && (
            <a href={t.transcriptUrl} className="btn btn-sm" target="_blank" rel="noreferrer">
              Transkrypt ↗
            </a>
          )}
        </div>
      </div>

      <div className="two-col">
        <TicketChat id={t.id} open={t.open} messages={d.messages} />
        <div className="stack">
          <section className="card card-pad glow">
            <div className="field-label" style={{ marginBottom: 10 }}>
              Klient
            </div>
            <PersonChip p={t.client} sub={`ID ${t.client.id}`} />
            {t.subject && <p className="muted small" style={{ marginTop: 12 }}>{t.subject}</p>}
          </section>
          {form.length > 0 && (
            <section className="card card-pad">
              <div className="field-label" style={{ marginBottom: 8 }}>
                Formularz
              </div>
              <dl className="kv" style={{ padding: 0 }}>
                {form.map(([k, v]) => (
                  <div key={k} style={{ display: 'contents' }}>
                    <dt>{k}</dt>
                    <dd style={{ textAlign: 'left', fontWeight: 500, whiteSpace: 'pre-line' }}>{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          {d.notes.length > 0 && (
            <section className="card">
              <div className="card-head">
                <Icon name="documentation" />
                <h2>Notatki obsługi</h2>
              </div>
              <ol className="timeline">
                {d.notes.map((n) => (
                  <li key={n.id}>
                    <span>
                      {n.content}
                      <span className="faint small" style={{ display: 'block' }}>
                        {n.author} · {dateTime(n.at)}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {!t.open && (t.closeReason || t.rating) && (
            <section className="card card-pad">
              {t.closeReason && <p className="muted small">Powód zamknięcia: {t.closeReason}</p>}
              {t.rating && (
                <p style={{ marginTop: 6 }}>
                  <b>Ocena obsługi: {t.rating}/5</b>
                  {t.ratingComment && <span className="muted small"> – {t.ratingComment}</span>}
                </p>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
