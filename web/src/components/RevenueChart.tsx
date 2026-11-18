'use client';

import { useState } from 'react';
import { pln } from '@/lib/money';

/** Przychód z wpłat w ostatnich 12 miesiącach – słupki jednej serii, podpowiedź po najechaniu / fokusie. */
export function RevenueChart({ data }: { data: { month: string; amount: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = 220;
  const PAD = { l: 52, r: 8, t: 12, b: 26 };
  const max = Math.max(...data.map((d) => d.amount), 1);
  const nice = (() => {
    const p = 10 ** Math.floor(Math.log10(max));
    const m = max / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
  })();
  const bw = (W - PAD.l - PAD.r) / data.length;
  const y = (v: number) => PAD.t + (1 - v / nice) * (H - PAD.t - PAD.b);
  const label = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString('pl-PL', { month: 'short' });
  const total = data.reduce((s, d) => s + d.amount, 0);
  const h = hover === null ? null : data[hover]!;

  return (
    <figure className="chart" style={{ margin: 0 }}>
      <figcaption className="chart-head">
        <span className="chart-title">Przychód z wpłat – 12 miesięcy</span>
        <span className="muted small">
          razem <b className="num">{pln(total)}</b>
        </span>
      </figcaption>
      <div className="chart-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label={`Przychód w 12 miesięcy: ${pln(total)}`}>
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(nice * f)} y2={y(nice * f)} className="chart-grid" />
              <text x={PAD.l - 8} y={y(nice * f) + 4} className="chart-axis" textAnchor="end">
                {nice * f >= 1000 ? `${(nice * f) / 1000}k` : nice * f}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = PAD.l + i * bw + bw * 0.18;
            const w = bw * 0.64;
            const top = y(d.amount);
            const hgt = Math.max(0, y(0) - top);
            const r = Math.min(4, w / 2, hgt);
            return (
              <g
                key={d.month}
                tabIndex={0}
                role="img"
                aria-label={`${label(d.month)}: ${pln(d.amount)}`}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                style={{ outline: 'none' }}
              >
                <rect x={PAD.l + i * bw} y={PAD.t} width={bw} height={H - PAD.t - PAD.b} fill="transparent" />
                {hgt > 0 && (
                  <path
                    d={`M${x},${y(0)} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${y(0)} Z`}
                    className={`bar${hover === i ? ' on' : ''}`}
                  />
                )}
                <text x={x + w / 2} y={H - 8} className="chart-axis" textAnchor="middle">
                  {label(d.month)}
                </text>
              </g>
            );
          })}
        </svg>
        {h && hover !== null && (
          <div
            className="chart-tip"
            style={{
              left: `${((PAD.l + hover * bw + bw / 2) / W) * 100}%`,
              transform: `translateX(${hover > data.length * 0.7 ? '-105%' : '8px'})`,
            }}
          >
            <b className="num">{pln(h.amount)}</b>
            <span>{new Date(`${h.month}-01T00:00:00`).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}</span>
          </div>
        )}
      </div>
    </figure>
  );
}
