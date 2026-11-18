import { ORDER_PREFIX } from '../config/constants.js';
import { zonedDate, zonedParts } from './time.js';

export function formatOrderId(id: number): string {
  return `${ORDER_PREFIX}-${String(id).padStart(4, '0')}`;
}

export function parseOrderId(input: string): number | null {
  const match = input.trim().match(new RegExp(`^(?:${ORDER_PREFIX}-?)?0*(\\d+)$`, 'i'));
  if (!match?.[1]) return null;
  const n = Number(match[1]);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

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

export function discordTime(date: Date, style: TimestampStyle = 'f'): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;
}

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

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

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

export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/zł|pln|\s/gi, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 && value < 1_000_000 ? Math.round(value * 100) / 100 : null;
}

export function parseDate(input: string, now = new Date()): Date | null {
  const s = input.trim();
  const today = zonedParts(now);
  const rel = s.match(/^\+(\d{1,3})\s*(d|dni)?$/i);
  if (rel) return zonedDate(today.year, today.month, today.day + Number(rel[1]), 23, 59);
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]) - 1;
  if (month < 0 || month > 11) return null;
  const year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : today.year;
  let date = zonedDate(year, month, day, 23, 59);
  if (zonedParts(date).day !== day) return null;
  if (!m[3] && date.getTime() < now.getTime()) date = zonedDate(year + 1, month, day, 23, 59);
  return date;
}

export const cents = (v: number) => Math.round(v * 100) / 100;
