import { Canvas, type RGB } from '../../utils/png.js';

const BG_TOP: RGB = [11, 13, 18];
const BG_BOTTOM: RGB = [8, 22, 40];
const BLUE: RGB = [26, 159, 255];
const LIGHT: RGB = [140, 205, 255];
const GRID: RGB = [40, 50, 66];
const WHITE: RGB = [235, 240, 248];

/**
 * Wykres słupkowy (np. wiadomości dziennie) + biała linia drugiej serii (np. wejścia),
 * każda seria w swojej skali. Ostatni słupek (dziś) jest jaśniejszy.
 */
export function barChart(bars: number[], line: number[] = [], width = 640, height = 200): Buffer {
  const c = new Canvas(width, height);
  for (let y = 0; y < height; y++) {
    const t = y / height;
    const col: RGB = [0, 1, 2].map((i) => Math.round(BG_TOP[i]! * (1 - t) + BG_BOTTOM[i]! * t)) as RGB;
    c.rect(0, y, width, 1, col);
  }
  const pad = { l: 16, r: 16, t: 18, b: 14 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  for (let i = 0; i <= 4; i++) c.rect(pad.l, pad.t + (h * i) / 4, w, 1, GRID, 0.7);

  const n = Math.max(bars.length, 1);
  const slot = w / n;
  const barW = Math.max(2, slot * 0.62);
  const max = Math.max(...bars, 1);
  bars.forEach((v, i) => {
    const bh = Math.max(v > 0 ? 3 : 1, (v / max) * h);
    const x = pad.l + slot * i + (slot - barW) / 2;
    const color = i === bars.length - 1 ? LIGHT : BLUE;
    c.rect(x, pad.t + h - bh, barW, bh, color, 0.95);
    c.rect(x, pad.t + h - bh, barW, 2, WHITE, 0.35); // połysk
  });

  if (line.length > 1) {
    const lmax = Math.max(...line, 1);
    const pts = line.map((v, i) => [pad.l + slot * i + slot / 2, pad.t + h - (v / lmax) * h * 0.9] as const);
    for (let i = 1; i < pts.length; i++)
      c.line(pts[i - 1]![0], pts[i - 1]![1], pts[i]![0], pts[i]![1], WHITE, 2, 0.85);
    for (const [x, y] of pts) c.rect(x - 2, y - 2, 5, 5, WHITE);
  }
  return c.toPng();
}

const SPARK = '▁▂▃▄▅▆▇█';
/** Mini-wykres tekstowy: sparkline([1,5,3]) -> "▁█▄" */
export function sparkline(values: number[]): string {
  const max = Math.max(...values, 1);
  return values
    .map((v) => SPARK[Math.min(SPARK.length - 1, Math.round((v / max) * (SPARK.length - 1)))])
    .join('');
}
