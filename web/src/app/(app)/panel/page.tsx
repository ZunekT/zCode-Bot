import Link from 'next/link';
import { BotAvatar } from '@/components/BotAvatar';
import { Icon } from '@/components/Icon';
import { CountUp } from '@/components/site/islands';
import { api } from '@/lib/api';
import { pln } from '@/lib/money';
import { requireSession } from '@/lib/session';

export const metadata = { title: 'Pulpit' };

const hello = () => {
  const h = Number(new Date().toLocaleString('pl-PL', { hour: 'numeric', hour12: false, timeZone: 'Europe/Warsaw' }));
  return h < 5 ? 'Dobranoc' : h < 12 ? 'Dzień dobry' : h < 18 ? 'Cześć' : 'Dobry wieczór';
};

export default async function Dashboard() {
  const session = await requireSession();
  const [bots, mine] = await Promise.all([api.bots(session.id), api.myOrders(session.id).catch(() => ({ steps: [], orders: [] }))]);
  const maxStep = Math.max(...mine.steps.map((s) => s.step), 1);
  const active = mine.orders.filter((o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED');
  const due = active.reduce((s, o) => s + Math.max(0, o.due ?? 0), 0);
  const online = bots.filter((b) => b.connected).length;
  const name = session.globalName ?? session.username;

  return (
    <div className="app-page">
      <div className="app-head">
        <div>
          <h1>
            {hello()}, <span className="grad-text">{name}</span>
          </h1>
          <p>Twoje boty, zlecenia i płatności w jednym miejscu.</p>
        </div>
        <div className="actions">
          <a href="/zamow" className="btn btn-primary">
            <Icon name="cart" size={16} /> Zamów bota
          </a>
        </div>
      </div>

      <div className="kpis">
        <div className="card kpi glow">
          <Icon name="bot" size={22} className="kpi-icon" />
          <div className="kpi-label">Boty</div>
          <div className="kpi-value">
            <CountUp to={bots.length} />
          </div>
          <div className="kpi-sub">{bots.length ? `${online} połączonych` : 'jeszcze żadnego'}</div>
        </div>
        <div className="card kpi glow">
          <Icon name="package" size={22} className="kpi-icon" />
          <div className="kpi-label">Zlecenia w toku</div>
          <div className="kpi-value">
            <CountUp to={active.length} />
          </div>
          <div className="kpi-sub">{mine.orders.length} wszystkich</div>
        </div>
        <div className="card kpi glow">
          <Icon name="payment_card" size={22} className="kpi-icon" />
          <div className="kpi-label">Do zapłaty</div>
          <div className="kpi-value" style={due > 0 ? { color: 'var(--warn)' } : undefined}>
            {pln(due)}
          </div>
          <div className="kpi-sub">{due > 0 ? 'dane do przelewu w zleceniu' : 'wszystko opłacone'}</div>
        </div>
        <div className="card kpi glow">
          <Icon name="lightning" size={22} className="kpi-icon" />
          <div className="kpi-label">Monitoring</div>
          <div className="kpi-value">{bots.length ? (online === bots.length ? 'OK' : `${bots.length - online} off`) : '—'}</div>
          <div className="kpi-sub">{bots.length ? 'sprawdzane co minutę' : 'po wdrożeniu bota'}</div>
        </div>
      </div>

      <div className="two-col">
        <section className="card">
          <div className="card-head">
            <Icon name="package" />
            <h2>Aktywne zlecenia</h2>
            <div className="spacer" />
            <Link href="/panel/zlecenia" className="btn btn-sm">
              Wszystkie
            </Link>
          </div>
          {active.length === 0 ? (
            <div className="card-body muted">
              Brak aktywnych zleceń.{' '}
              <a href="/zamow" style={{ color: 'var(--brand)' }}>
                Zamów bota →
              </a>
            </div>
          ) : (
            <div className="list">
              {active.map((o) => (
                <Link key={o.id} href={`/panel/zlecenia/${o.id}`} className="link-row">
                  <span className="ring" style={{ '--p': Math.round((o.step / maxStep) * 100) } as React.CSSProperties}>
                    {Math.round((o.step / maxStep) * 100)}%
                  </span>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{o.title}</div>
                    <div className="faint small">
                      {o.number} · {o.statusLabel}
                      {o.tasksTotal > 0 && ` · zadania ${o.tasksDone}/${o.tasksTotal}`}
                    </div>
                  </div>
                  {(o.due ?? 0) > 0 && <span className="pill pill-warn">{pln(o.due)}</span>}
                  <span className="chev">›</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <Icon name="bot" />
            <h2>Moje boty</h2>
            <div className="spacer" />
            <Link href="/panel/boty" className="btn btn-sm">
              Wszystkie
            </Link>
          </div>
          {bots.length === 0 ? (
            <div className="card-body muted">Gdy zamówisz bota, pojawi się tutaj.</div>
          ) : (
            <div className="list">
              {bots.slice(0, 5).map((b) => (
                <Link key={b.id} href={`/panel/boty/${b.id}`} className="link-row">
                  <BotAvatar bot={b} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{b.name}</div>
                    <div className="faint small">{b.username ? `@${b.username}` : 'jeszcze się nie połączył'}</div>
                  </div>
                  <span className={`pill ${b.connected ? 'pill-ok' : 'pill-err'}`}>{b.connected ? 'Online' : 'Offline'}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
