'use client';

import { useState } from 'react';
import type { CmsStats } from '@/lib/cms';
import { Segmented } from '../ui/Segmented';

const RANGES = [
  { value: '7', label: '7 dni' },
  { value: '30', label: '30 dni' },
  { value: '90', label: '90 dni' },
];

const num = (n: number) => n.toLocaleString('pl-PL');
const short = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });

function Chart({ series }: { series: CmsStats['series'] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...series.map((s) => s.views));
  const W = 700;
  const H = 180;
  const bw = W / series.length;
  const h = hover !== null ? series[hover] : null;
  return (
    <div className="stats-chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Wykres odwiedzin" onMouseLeave={() => setHover(null)}>
        {series.map((s, i) => {
          const vh = (s.views / max) * (H - 10);
          const uh = (s.visitors / max) * (H - 10);
          return (
            <g key={s.day} onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)}>
              <rect x={i * bw} y={0} width={bw} height={H} fill="transparent" />
              <rect x={i * bw + bw * 0.15} y={H - vh} width={bw * 0.7} height={vh} rx={Math.min(4, bw * 0.2)} className={`bar-v${hover === i ? ' on' : ''}`} />
              <rect x={i * bw + bw * 0.3} y={H - uh} width={bw * 0.4} height={uh} rx={Math.min(3, bw * 0.15)} className="bar-u" />
            </g>
          );
        })}
      </svg>
      <div className="stats-tip">
        {h ? (
          <>
            <b>{short(h.day)}</b> · {num(h.views)} wyświetleń · {num(h.visitors)} odwiedzających
          </>
        ) : (
          <span className="faint">Najedź na słupek, żeby zobaczyć dzień</span>
        )}
      </div>
      <div className="stats-axis faint small">
        <span>{short(series[0]!.day)}</span>
        <span>{short(series[series.length - 1]!.day)}</span>
      </div>
    </div>
  );
}

export function StatsView({ siteId, initial }: { siteId: number; initial: CmsStats }) {
  const [stats, setStats] = useState(initial);
  const [range, setRange] = useState(String(initial.days));
  const [loading, setLoading] = useState(false);

  async function load(days: string) {
    setRange(days);
    setLoading(true);
    const res = await fetch(`/api/strony/${siteId}/stats?days=${days}`).catch(() => null);
    if (res?.ok) setStats((await res.json()) as CmsStats);
    setLoading(false);
  }

  const maxPage = Math.max(1, ...stats.pages.map((p) => p.views));
  const maxSrc = Math.max(1, ...stats.sources.map((p) => p.views));

  return (
    <div className={`stats-wrap${loading ? ' loading-soft' : ''}`}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
        <Segmented ariaLabel="Zakres" value={range} items={RANGES} onChange={load} />
      </div>
      <div className="kpis" style={{ marginBottom: 16 }}>
        <div className="card kpi">
          <div className="kpi-label">Wyświetlenia</div>
          <div className="kpi-value">{num(stats.views)}</div>
          <div className="faint small">ostatnie {stats.days} dni</div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">Odwiedzający</div>
          <div className="kpi-value">{num(stats.visitors)}</div>
          <div className="faint small">unikalni dziennie, sumowani</div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">Na osobę</div>
          <div className="kpi-value">{stats.visitors ? (stats.views / stats.visitors).toLocaleString('pl-PL', { maximumFractionDigits: 1 }) : '—'}</div>
          <div className="faint small">podstron na wizytę</div>
        </div>
      </div>
      <section className="card" style={{ padding: 18, marginBottom: 16 }}>
        <div className="stats-legend small">
          <span>
            <i className="lg-v" /> Wyświetlenia
          </span>
          <span>
            <i className="lg-u" /> Odwiedzający
          </span>
        </div>
        {stats.views ? <Chart series={stats.series} /> : <p className="faint" style={{ padding: '28px 0', textAlign: 'center' }}>Brak odwiedzin w tym okresie.</p>}
      </section>
      <div className="two-col">
        <section className="card">
          <div className="card-head">
            <h2>Najczęściej oglądane</h2>
          </div>
          <ul className="stats-list">
            {stats.pages.length === 0 && <li className="faint">Brak danych</li>}
            {stats.pages.map((p) => (
              <li key={p.path}>
                <span className="stats-bar" style={{ width: `${(p.views / maxPage) * 100}%` }} />
                <span className="stats-name">{p.path}</span>
                <b>{num(p.views)}</b>
              </li>
            ))}
          </ul>
        </section>
        <section className="card">
          <div className="card-head">
            <h2>Skąd przychodzą</h2>
          </div>
          <ul className="stats-list">
            {stats.sources.length === 0 && <li className="faint">Brak danych</li>}
            {stats.sources.map((s) => (
              <li key={s.source}>
                <span className="stats-bar" style={{ width: `${(s.views / maxSrc) * 100}%` }} />
                <span className="stats-name">{s.source}</span>
                <b>{num(s.views)}</b>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
