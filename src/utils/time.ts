import { TIMEZONE } from '../config/constants.js';

const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TIMEZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export interface ZonedParts {
  year: number;
  month: number; // 0-11
  day: number;
  hour: number;
  minute: number;
}

/** Data/godzina „na zegarku” w strefie serwera. */
export function zonedParts(date: Date): ZonedParts {
  const p = Object.fromEntries(partsFmt.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    year: Number(p.year),
    month: Number(p.month) - 1,
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
  };
}

/** Przesunięcie strefy względem UTC w ms dla danej chwili (np. +1h zimą, +2h latem). */
function offsetAt(date: Date): number {
  const z = zonedParts(date);
  const asUtc = Date.UTC(z.year, z.month, z.day, z.hour, z.minute);
  return asUtc - Math.floor(date.getTime() / 60_000) * 60_000;
}

/** Chwila odpowiadająca godzinie „na zegarku” w strefie serwera (z obsługą zmiany czasu). */
export function zonedDate(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  const guess = Date.UTC(year, month, day, hour, minute);
  let result = guess - offsetAt(new Date(guess));
  result = guess - offsetAt(new Date(result));
  return new Date(result);
}

/** Klucz dnia RRRR-MM-DD w strefie serwera. */
export function dayKey(date = new Date()): string {
  const z = zonedParts(date);
  return `${z.year}-${String(z.month + 1).padStart(2, '0')}-${String(z.day).padStart(2, '0')}`;
}

const UNITS: Record<string, number> = {
  d: 86_400_000,
  dni: 86_400_000,
  dzien: 86_400_000,
  h: 3_600_000,
  godz: 3_600_000,
  m: 60_000,
  min: 60_000,
};

/**
 * Kiedy? Po polsku:
 *  • „30m”, „2h”, „1h30m”, „3d”, „2 dni”
 *  • „18:00” (dziś albo jutro, jeśli już minęła), „jutro 10:00”, „dziś 18:30”, „pojutrze 9”
 *  • „24.12 18:00”, „24.12.2026 18:00”, „24.12” (9:00)
 */
export function parseWhen(input: string, now = new Date()): Date | null {
  const s = input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace('dzisiaj', 'dziś')
    .replace('dzis', 'dziś');

  const dur = s.replace(/\s/g, '').match(/^(\d+(?:d|dni|dzien|h|godz|m|min))+$/);
  if (dur) {
    let ms = 0;
    for (const m of s.replace(/\s/g, '').matchAll(/(\d+)(dni|dzien|godz|min|d|h|m)/g))
      ms += Number(m[1]) * UNITS[m[2]!]!;
    return ms > 0 ? new Date(now.getTime() + ms) : null;
  }

  const today = zonedParts(now);
  const time = (t: string | undefined, fallbackHour = 9): [number, number] | null => {
    if (!t) return [fallbackHour, 0];
    const m = t.match(/^(\d{1,2})(?::(\d{2}))?$/);
    if (!m) return null;
    const h = Number(m[1]);
    const mi = Number(m[2] ?? 0);
    return h < 24 && mi < 60 ? [h, mi] : null;
  };

  const rel = s.match(/^(dziś|jutro|pojutrze)(?: (?:o )?(\S+))?$/);
  if (rel) {
    const add = { dziś: 0, jutro: 1, pojutrze: 2 }[rel[1] as 'dziś' | 'jutro' | 'pojutrze'];
    const t = time(rel[2]);
    if (!t) return null;
    return zonedDate(today.year, today.month, today.day + add, t[0], t[1]);
  }

  const onlyTime = s.match(/^(?:o )?(\d{1,2}:\d{2})$/);
  if (onlyTime) {
    const t = time(onlyTime[1])!;
    if (!t) return null;
    let d = zonedDate(today.year, today.month, today.day, t[0], t[1]);
    if (d.getTime() <= now.getTime()) d = zonedDate(today.year, today.month, today.day + 1, t[0], t[1]);
    return d;
  }

  const abs = s.match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?(?: (?:o )?(\S+))?$/);
  if (abs) {
    const day = Number(abs[1]);
    const month = Number(abs[2]) - 1;
    const t = time(abs[4]);
    if (!t || month < 0 || month > 11 || day < 1 || day > 31) return null;
    const year = abs[3] ? Number(abs[3].length === 2 ? `20${abs[3]}` : abs[3]) : today.year;
    let d = zonedDate(year, month, day, t[0], t[1]);
    if (zonedParts(d).day !== day) return null; // np. 31.02
    if (!abs[3] && d.getTime() <= now.getTime()) d = zonedDate(year + 1, month, day, t[0], t[1]);
    return d;
  }
  return null;
}

export const WHEN_HINT = '30m, 2h, 1h30m, 3d, 18:00, jutro 10:00, 24.12 18:00';
