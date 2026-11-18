import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { MetricChart } from '@/components/MetricChart';
import { VpsActions } from '@/components/VpsActions';
import { SiteAccessCard } from '@/components/SiteAccessCard';
import { Segmented } from '@/components/ui/Segmented';
import { ApiError, api, type VpsData } from '@/lib/api';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/session';

const RANGES = [
  { key: 'hour', label: 'Godzina' },
  { key: 'day', label: 'Doba' },
  { key: 'week', label: 'Tydzień' },
  { key: 'month', label: 'Miesiąc' },
] as const;

function bytes(n: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i >= 3 ? 1 : 0).replace('.', ',')} ${units[i]}`;
}

function duration(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return [d && `${d} d`, h && `${h} godz.`, `${m} min`].filter(Boolean).join(' ');
}

const pct = (u: number, t: number) => (t > 0 ? Math.round((u / t) * 100) : 0);
const level = (p: number) => (p >= 90 ? 'err' : p >= 75 ? 'warn' : 'ok');

function Meter({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value num">{value}%</div>
      <div className={`meter meter-${level(value)}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label={label}>
        <span style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <div className="muted small">{sub}</div>
    </div>
  );
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ zakres?: string }> }) {
  const [{ zakres }, session] = await Promise.all([searchParams, requireSession()]);
  if (!(await api.me(session.id)).owner) notFound();
  const range = RANGES.some((r) => r.key === zakres) ? zakres! : 'hour';

  const siteAccess = await api.siteAccess(session.id);
  const siteCard = (
    <>
      <div className="app-head">
        <div>
          <h1>Strona i serwer</h1>
          <p>Tryb „Start wkrótce”, podgląd przed startem i VPS w Mathost.</p>
        </div>
      </div>
      <SiteAccessCard initial={siteAccess} />
    </>
  );

  let data: VpsData;
  try {
    data = await api.vps(session.id, range);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 503 || err.status === 502)) {
      return (
        <div className="app-page">
        {siteCard}
        <div className="card empty">
          <Icon name="server" size={56} />
          <h2>VPS niedostępny w panelu</h2>
          <p>{err.message}</p>
        </div>
        </div>
      );
    }
    throw err;
  }

  const { vps: s, issues, history } = data;
  const running = s.status === 'running';
  const days = Math.ceil((new Date(s.expiresAt).getTime() - Date.now()) / 86_400_000);
  const memPct = pct(s.mem.used, s.mem.total);
  const diskPct = s.disk ? pct(s.disk.used, s.disk.total) : 0;

  return (
    <div className="app-page">
      {siteCard}
      <div className="page-head">
        <h2 style={{ fontSize: 22 }}>Serwer VPS</h2>
        <span className={`pill ${running ? 'pill-ok' : 'pill-err'}`}>{running ? 'Działa' : s.status}</span>
        <div className="spacer" />
        <VpsActions />
      </div>

      {issues.length > 0 && (
        <div className="stack" style={{ marginBottom: 16, gap: 8 }}>
          {issues.map((i) => (
            <div key={i.key} className="notice notice-warn">
              <Icon name="notification" />
              <p>{i.text.replace(/<t:\d+:\w>/g, new Date(s.expiresAt).toLocaleDateString('pl-PL'))}</p>
            </div>
          ))}
        </div>
      )}

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="stats stats-4">
          <Meter label="Procesor" value={Math.round(s.cpuPct)} sub={`${s.cpus} ${s.cpus === 1 ? 'rdzeń' : 'rdzenie'}`} />
          <Meter label="Pamięć RAM" value={memPct} sub={`${bytes(s.mem.used)} z ${bytes(s.mem.total)}`} />
          {s.disk && <Meter label="Dysk" value={diskPct} sub={`${bytes(s.disk.used)} z ${bytes(s.disk.total)}`} />}
          <div className="stat">
            <div className="stat-label">Działa od</div>
            <div className="stat-value" style={{ fontSize: 18 }}>
              {running ? duration(s.uptimeSec) : '—'}
            </div>
            <div className="muted small">
              sieć: ↓ {bytes(s.net.in)} · ↑ {bytes(s.net.out)}
            </div>
          </div>
        </div>
      </section>

      <div className="two-col">
        <section className="card">
          <div className="card-head">
            <Icon name="lightning" />
            <h2>Obciążenie</h2>
            <div className="spacer" />
            <Segmented ariaLabel="Zakres" value={range} items={RANGES.map((r) => ({ value: r.key, label: r.label, href: `/admin/serwer?zakres=${r.key}` }))} />
          </div>
          <div className="card-body stack">
            <MetricChart label="Procesor" range={data.range} points={history.map((p) => ({ t: p.t, v: p.cpu }))} />
            <MetricChart label="Pamięć RAM (z cache systemu)" range={data.range} points={history.map((p) => ({ t: p.t, v: p.mem }))} />
          </div>
        </section>

        <div className="stack">
          <section className="card">
            <div className="card-head">
              <Icon name="server" />
              <h2>{s.name}</h2>
            </div>
            <dl className="kv">
              <dt>Plan</dt>
              <dd>{s.plan || '—'}</dd>
              <dt>Adres IP</dt>
              <dd>
                <code>{s.ip ?? '—'}</code>
              </dd>
              <dt>Cena</dt>
              <dd>{s.price ?? '—'}</dd>
              <dt>Ważny do</dt>
              <dd>
                {new Date(s.expiresAt).toLocaleDateString('pl-PL')}{' '}
                <span className={days <= 7 ? 'text-warn' : 'muted'}>({days > 0 ? `za ${days} dni` : 'wygasł'})</span>
              </dd>
              <dt>Auto-odnawianie</dt>
              <dd className={s.autoRenew ? '' : 'text-warn'}>{s.autoRenew ? 'włączone' : 'wyłączone'}</dd>
              <dt>Transfer (mies.)</dt>
              <dd>{bytes(s.bandwidthMonth)}</dd>
            </dl>
          </section>

          <section className="card">
            <div className="card-head">
              <Icon name="database" />
              <h2>Kopie zapasowe</h2>
            </div>
            {s.backups.length === 0 ? (
              <div className="card-body">
                <p className="text-warn" style={{ fontWeight: 600 }}>Brak kopii zapasowych.</p>
                <p className="muted small" style={{ marginTop: 4 }}>
                  Zrób pierwszą kopię przyciskiem „Kopia zapasowa” – przy awarii dysku przywrócisz cały serwer.
                </p>
              </div>
            ) : (
              <div className="list">
                {s.backups.map((b) => (
                  <div key={b.volid} className="list-item">
                    <div className="grow">
                      <div style={{ fontWeight: 600 }}>
                        {b.ctime ? new Date(b.ctime * 1000).toLocaleString('pl-PL') : b.volid.split('/').pop()}
                      </div>
                      {b.notes && <div className="muted small">{b.notes}</div>}
                    </div>
                    {b.size ? <span className="muted small num">{bytes(b.size)}</span> : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
