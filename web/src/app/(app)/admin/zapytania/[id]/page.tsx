import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { LeadActions } from '@/components/LeadActions';
import { CopyButton } from '@/components/ui/CopyButton';
import { api } from '@/lib/api';
import { leadTone, timeAgo } from '@/lib/format';
import { requireSession } from '@/lib/session';

export const metadata = { title: 'Zapytanie' };

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, requireSession()]);
  const l = await api.lead(session.id, id);
  const subject = `Wycena strony – zxCode`;
  const body = `Dzień dobry,\n\ndziękujemy za zapytanie o stronę internetową (${l.siteType}).\n\n`;
  const mailto = `mailto:${encodeURIComponent(l.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const site = l.website ? (/^https?:\/\//.test(l.website) ? l.website : `https://${l.website}`) : null;

  return (
    <div className="app-page">
      <div className="crumbs">
        <Link href="/admin/zapytania">Zapytania</Link>
        <span className="sep">/</span>
        <span>#{l.id}</span>
      </div>
      <div className="app-head">
        <div>
          <h1>{l.name}</h1>
          <p>
            {l.company ? `${l.company} · ` : ''}
            {l.siteType} · wysłane {timeAgo(l.createdAt)}
          </p>
        </div>
        <div className="spacer" />
        <span className={`pill ${leadTone(l.status)}`}>{l.statusLabel}</span>
      </div>

      <div className="two-col">
        <div className="stack">
          <section className="card glow">
            <div className="card-head">
              <Icon name="documentation" />
              <h2>Projekt</h2>
            </div>
            <div className="stats">
              <div className="stat">
                <div className="stat-label">Rodzaj</div>
                <div className="stat-value" style={{ fontSize: 16 }}>
                  {l.siteType}
                </div>
              </div>
              <div className="stat">
                <div className="stat-label">Budżet</div>
                <div className="stat-value" style={{ fontSize: 16 }}>
                  {l.budget}
                </div>
              </div>
              <div className="stat">
                <div className="stat-label">Termin</div>
                <div className="stat-value" style={{ fontSize: 16 }}>
                  {l.deadline}
                </div>
              </div>
            </div>
            <div className="card-body lead-desc">{l.description}</div>
          </section>
          <section className="card">
            <div className="card-head">
              <Icon name="tools" />
              <h2>Obsługa</h2>
            </div>
            <div className="card-body">
              <LeadActions id={l.id} status={l.status} note={l.note} statuses={l.statuses} />
            </div>
          </section>
        </div>

        <section className="card glow">
          <div className="card-head">
            <Icon name="user" />
            <h2>Kontakt</h2>
          </div>
          <div className="card-body stack" style={{ gap: 14 }}>
            <div>
              <span className="field-label">E-mail</span>
              <div className="row" style={{ gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                <b style={{ wordBreak: 'break-all' }}>{l.email}</b>
                <CopyButton text={l.email} />
              </div>
            </div>
            {site && (
              <div>
                <span className="field-label">Obecna strona</span>
                <div style={{ marginTop: 6 }}>
                  <a href={site} target="_blank" rel="noreferrer noopener nofollow" style={{ color: 'var(--brand)', wordBreak: 'break-all' }}>
                    {l.website}
                  </a>
                </div>
              </div>
            )}
            {l.discord && (
              <div>
                <span className="field-label">Discord</span>
                <div style={{ marginTop: 6 }}>{l.discord}</div>
              </div>
            )}
            <a href={mailto} className="btn btn-primary">
              <Icon name="notification" size={16} /> Odpowiedz e-mailem
            </a>
            <p className="faint small">
              Gdy klient zaakceptuje wycenę, utwórz zlecenie typu „Strona” w zakładce Zlecenia – klient zobaczy postęp w panelu po
              zalogowaniu przez Discord.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
