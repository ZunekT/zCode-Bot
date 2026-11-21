import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { requireSession } from '@/lib/session';

export const metadata = { title: 'Moje strony' };

const daysLeft = (iso: string | null) => (iso ? Math.floor((new Date(iso).getTime() - Date.now()) / 86_400_000) : null);
const host = (url: string | null) => (url ? url.replace(/^https?:\/\//, '').replace(/\/$/, '') : '');

export default async function SitesPage() {
  const session = await requireSession();
  const [sites, cms] = await Promise.all([api.sites(session.id).catch(() => []), api.cmsSites(session.id).catch(() => [])]);
  return (
    <div className="app-page">
      <div className="app-head">
        <div>
          <h1>Moje strony</h1>
          <p>Treść, dostępność, szybkość i certyfikaty SSL Twoich stron.</p>
        </div>
        <div className="spacer" />
        <Link href="/zamow/strona" className="btn btn-primary">
          <Icon name="laptop" size={16} /> Zamów stronę
        </Link>
      </div>

      {cms.length > 0 && (
        <section className="cms-sites">
          <h2 className="section-title">Edycja treści</h2>
          <div className="cms-site-grid">
            {cms.map((c) => (
              <Link key={c.id} href={`/panel/strony/${c.id}`} className="card cms-site glow">
                <span className="site-ico">
                  <Icon name="documentation" size={22} />
                </span>
                <span className="grow" style={{ minWidth: 0 }}>
                  <b>{c.name}</b>
                  <small>
                    {c.connected ? `${c.sections} ${c.sections === 1 ? 'sekcja' : c.sections % 10 >= 2 && c.sections % 10 <= 4 && (c.sections % 100 < 10 || c.sections % 100 >= 20) ? 'sekcje' : 'sekcji'} · zmiana ${timeAgo(c.updatedAt)}` : 'Czeka na połączenie strony'}
                  </small>
                </span>
                <span className="btn btn-sm btn-primary">Edytuj treść</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {cms.length > 0 && sites.length > 0 && <h2 className="section-title">Monitoring</h2>}
      {sites.length === 0 && cms.length > 0 ? null : sites.length === 0 ? (
        <EmptyState
          icon="laptop"
          title="Nie masz jeszcze stron pod opieką"
          text="Gdy zbudujemy dla Ciebie stronę, zobaczysz tu jej status, czas odpowiedzi i ważność certyfikatu SSL."
        >
          <Link href="/zamow/strona" className="btn btn-primary">
            Bezpłatna wycena strony
          </Link>
        </EmptyState>
      ) : (
        <div className="sites">
          {sites.map((s) => {
            const ssl = daysLeft(s.sslExpiresAt);
            const sslTone = ssl === null ? '' : ssl < 0 ? 'err' : ssl <= 14 ? 'warn' : 'ok';
            const speedTone = s.responseMs === null ? '' : s.responseMs < 600 ? 'ok' : s.responseMs < 1500 ? 'warn' : 'err';
            return (
              <section key={s.id} className={`card site-card glow${s.online ? '' : ' down'}`}>
                <div className="site-head">
                  <span className="site-ico">
                    <Icon name="laptop" size={24} />
                  </span>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="site-name">{s.name}</div>
                    {s.url && (
                      <a href={s.url} target="_blank" rel="noreferrer noopener" className="site-url">
                        {host(s.url)}
                      </a>
                    )}
                  </div>
                  <span className={`pill ${s.online ? 'pill-ok pill-live' : 'pill-err pill-down'}`}>
                    {s.online ? 'Działa' : 'Awaria'}
                  </span>
                </div>
                {!s.online && (
                  <div className="notice notice-err" style={{ margin: '0 20px 4px' }}>
                    <Icon name="shield_x" />
                    <p>
                      {s.error ?? 'Strona nie odpowiada'}
                      {s.lastDownAt && ` · od ${timeAgo(s.lastDownAt)}`}. Już się tym zajmujemy.
                    </p>
                  </div>
                )}
                <div className="stats site-stats">
                  <div className="stat">
                    <div className="stat-label">Dostępność</div>
                    <div className="stat-value">{s.uptime}</div>
                  </div>
                  <div className="stat">
                    <div className="stat-label">Odpowiedź</div>
                    <div className={`stat-value tone-${speedTone}`}>{s.responseMs === null ? '—' : `${s.responseMs} ms`}</div>
                  </div>
                  <div className="stat">
                    <div className="stat-label">Certyfikat SSL</div>
                    <div className={`stat-value tone-${sslTone}`}>
                      {ssl === null ? '—' : ssl < 0 ? 'wygasł' : `${ssl} dni`}
                    </div>
                  </div>
                </div>
                <div className="site-foot faint small">
                  Ostatnie sprawdzenie: {s.lastCheckAt ? timeAgo(s.lastCheckAt) : 'jeszcze nie sprawdzano'}
                  {s.lastDownAt && s.online && ` · ostatnia awaria ${timeAgo(s.lastDownAt)}`}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
