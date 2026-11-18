'use client';

import { useRef, useState } from 'react';

/**
 * Wykres liniowy jednej serii w procentach (0–100): linia 2px, delikatne wypełnienie,
 * recesywna siatka, krzyżyk i podpowiedź po najechaniu (także klawiaturą: strzałki).
 */
export function MetricChart({
  label,
  points,
  range,
}: {
  label: string;
  points: { t: number; v: number }[];
  range: 'hour' | 'day' | 'week' | 'month';
}) {
  const W = 600;
  const H = 160;
  const PAD = { l: 34, r: 8, t: 10, b: 22 };
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (points.length < 2) {
    return <div className="chart-empty muted small">Brak danych dla tego zakresu.</div>;
  }

  const t0 = points[0]!.t;
  const t1 = points[points.length - 1]!.t;
  const x = (t: number) => PAD.l + ((t - t0) / Math.max(1, t1 - t0)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - Math.min(100, Math.max(0, v)) / 100) * (H - PAD.t - PAD.b);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const area = `${line}L${x(t1).toFixed(1)},${y(0)}L${x(t0).toFixed(1)},${y(0)}Z`;

  const fmt = (t: number) => {
    const d = new Date(t * 1000);
    return range === 'hour' || range === 'day'
      ? d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' }) +
          (range === 'week' ? ` ${d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}` : '');
  };
  const ticks = [0, 0.5, 1].map((f) => t0 + f * (t1 - t0));

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const t = t0 + ((px - PAD.l) / (W - PAD.l - PAD.r)) * (t1 - t0);
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(points[i]!.t - t) < Math.abs(points[best]!.t - t)) best = i;
    setHover(best);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    setHover((h) => {
      const cur = h ?? points.length - 1;
      return Math.min(points.length - 1, Math.max(0, cur + (e.key === 'ArrowLeft' ? -1 : 1)));
    });
  }

  const hp = hover === null ? null : points[hover]!;
  const avg = points.reduce((s, p) => s + p.v, 0) / points.length;
  const max = Math.max(...points.map((p) => p.v));

  return (
    <figure className="chart">
      <figcaption className="chart-head">
        <span className="chart-title">{label}</span>
        <span className="muted small">
          średnio <b className="num">{avg.toFixed(1)}%</b> · szczyt <b className="num">{max.toFixed(1)}%</b>
        </span>
      </figcaption>
      <div className="chart-wrap">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="chart-svg"
          role="img"
          aria-label={`${label}: średnio ${avg.toFixed(1)}%, szczyt ${max.toFixed(1)}%`}
          tabIndex={0}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          onKeyDown={onKey}
          onBlur={() => setHover(null)}
        >
          {[0, 50, 100].map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="chart-grid" />
              <text x={PAD.l - 6} y={y(v) + 4} className="chart-axis" textAnchor="end">
                {v}%
              </text>
            </g>
          ))}
          {ticks.map((t, i) => (
            <text key={i} x={x(t)} y={H - 6} className="chart-axis" textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}>
              {fmt(t)}
            </text>
          ))}
          <path d={area} className="chart-area" />
          <path d={line} className="chart-line" />
          {hp && (
            <>
              <line x1={x(hp.t)} x2={x(hp.t)} y1={PAD.t} y2={y(0)} className="chart-cross" />
              <circle cx={x(hp.t)} cy={y(hp.v)} r={4.5} className="chart-dot" />
            </>
          )}
        </svg>
        {hp && (
          <div
            className="chart-tip"
            style={{ left: `${(x(hp.t) / W) * 100}%`, transform: `translateX(${x(hp.t) > W * 0.7 ? '-105%' : '8px'})` }}
          >
            <b className="num">{hp.v.toFixed(1)}%</b>
            <span>{fmt(hp.t)}</span>
          </div>
        )}
      </div>
    </figure>
  );
}
