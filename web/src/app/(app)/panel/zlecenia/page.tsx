import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { api } from '@/lib/api';
import { date, pln, statusTone } from '@/lib/money';
import { requireSession } from '@/lib/session';
import { KindTag } from '@/components/ui/KindTag';

export const metadata = { title: 'Moje zlecenia' };

export default async function MyOrders() {
  const session = await requireSession();
  const { steps, orders } = await api.myOrders(session.id);
  const maxStep = Math.max(...steps.map((s) => s.step), 1);

  return (
    <div className="app-page">
      <div className="app-head">
        <div>
          <h1>Moje zlecenia</h1>
          <p>Postęp prac, zadania, płatności i proformy.</p>
        </div>
        <div className="actions">
          <a href="/zamow" className="btn btn-primary">
            <Icon name="cart" size={16} /> Nowe zlecenie
          </a>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="card empty">
          <Icon name="package" size={56} />
          <h2>Nie masz jeszcze zleceń</h2>
          <p>Zamów bota na naszym Discordzie – zlecenie pojawi się tutaj, a postęp zobaczysz na żywo.</p>
          <a href="/zamow" className="btn btn-primary">
            Zamów bota
          </a>
        </div>
      ) : (
        <div className="tiles">
          {orders.map((o) => {
            const pct = o.status === 'CANCELLED' ? 0 : Math.round((o.step / maxStep) * 100);
            return (
              <Link key={o.id} href={`/panel/zlecenia/${o.id}`} className="card tile2 glow">
                <div className="tile2-head">
                  <span className="ring" style={{ '--p': pct } as React.CSSProperties}>
                    {pct}%
                  </span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{o.title}</div>
                    <div className="faint small row" style={{ gap: 8 }}>
                      <KindTag kind={o.kind} /> {o.number} · {date(o.createdAt)}
                    </div>
                  </div>
                </div>
                <div className="row">
                  <span className={`pill ${statusTone(o.status)}`}>{o.statusLabel}</span>
                  {o.tasksTotal > 0 && (
                    <span className="muted small">
                      zadania {o.tasksDone}/{o.tasksTotal}
                    </span>
                  )}
                </div>
                <div className="row" style={{ justifyContent: 'space-between', marginTop: 'auto' }}>
                  <span className="muted small">{pln(o.total, 'wycena w toku')}</span>
                  {(o.due ?? 0) > 0 ? (
                    <span className="pill pill-warn">do zapłaty {pln(o.due)}</span>
                  ) : o.total !== null && o.paid > 0 ? (
                    <span className="pill pill-ok pill-done">opłacone</span>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
