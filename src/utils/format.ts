import { ORDER_PREFIX } from '../config/constants.js';

/** 42 -> "ZX-0042" */
export function formatOrderId(id: number): string {
  return `${ORDER_PREFIX}-${String(id).padStart(4, '0')}`;
}

/** "ZX-0042" | "zx42" | "42" -> 42 */
export function parseOrderId(input: string): number | null {
  const match = input.trim().match(new RegExp(`^(?:${ORDER_PREFIX}-?)?0*(\\d+)$`, 'i'));
  if (!match?.[1]) return null;
  const n = Number(match[1]);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Numer ticketu do nazwy kanału: 42 -> "0042" */
export function padNumber(n: number, length = 4): string {
  return String(n).padStart(length, '0');
}

const moneyFormatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(amount: number | string | { toString(): string }, currency = 'PLN'): string {
  let fmt = moneyFormatters.get(currency);
  if (!fmt) {
    fmt = new Intl.NumberFormat('pl-PL', { style: 'currency', currency });
    moneyFormatters.set(currency, fmt);
  }
  return fmt.format(Number(amount.toString()));
}

type TimestampStyle = 't' | 'T' | 'd' | 'D' | 'f' | 'F' | 'R';

/** Znacznik czasu Discorda, który każdy widzi w swojej strefie. */
export function discordTime(date: Date, style: TimestampStyle = 'f'): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;
}

/** Bezpieczny slug do nazwy kanału. */
export function slugify(input: string, max = 20): string {
  return (
    input
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/ł/g, 'l')
      .replace(/Ł/g, 'L')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, max) || 'user'
  );
}

/** Skraca tekst do limitu z wielokropkiem. */
export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** Pasek postępu z bloków: progressBar(3, 5) -> "▰▰▰▱▱ 60%" */
export function progressBar(value: number, total: number, size = 10): string {
  const ratio = total <= 0 ? 0 : Math.min(1, Math.max(0, value / total));
  const filled = Math.round(ratio * size);
  return `${'▰'.repeat(filled)}${'▱'.repeat(size - filled)} ${Math.round(ratio * 100)}%`;
}

export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const parts = [d && `${d}d`, h && `${h}h`, m && `${m}m`].filter(Boolean);
  return parts.length ? parts.join(' ') : `${s % 60}s`;
}
