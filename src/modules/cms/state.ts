import { createHash } from 'node:crypto';
import type { CmsSite, Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../db/prisma.js';
import { UserError } from '../../core/errors.js';

export const TONES = ['info', 'success', 'warning', 'promo'] as const;
export type Tone = (typeof TONES)[number];

export interface Announcement {
  enabled: boolean;
  text: string;
  link: string;
  linkLabel: string;
  tone: Tone;
  startsAt: string | null;
  endsAt: string | null;
  dismissible: boolean;
  version: number;
}

export interface Maintenance {
  enabled: boolean;
  title: string;
  message: string;
  until: string | null;
}

export interface Redirect {
  from: string;
  to: string;
  permanent: boolean;
}

const MAX_REDIRECTS = 200;

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function date(v: unknown, label: string): string | null {
  if (v === null || v === undefined || v === '') return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new UserError(`Nieprawidłowa data: ${label}.`);
  return d.toISOString();
}

export function safeLink(v: string): boolean {
  if (!v) return true;
  if (v.startsWith('/') && !v.startsWith('//')) return true;
  if (/^(mailto:|tel:)/i.test(v)) return true;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export function readAnnouncement(site: CmsSite): Announcement {
  const a = (site.announcement ?? {}) as Partial<Announcement>;
  return {
    enabled: a.enabled === true,
    text: a.text ?? '',
    link: a.link ?? '',
    linkLabel: a.linkLabel ?? '',
    tone: TONES.includes(a.tone as Tone) ? (a.tone as Tone) : 'info',
    startsAt: a.startsAt ?? null,
    endsAt: a.endsAt ?? null,
    dismissible: a.dismissible !== false,
    version: a.version ?? 0,
  };
}

export function readMaintenance(site: CmsSite): Maintenance {
  const m = (site.maintenance ?? {}) as Partial<Maintenance>;
  return { enabled: m.enabled === true, title: m.title ?? '', message: m.message ?? '', until: m.until ?? null };
}

export const readRedirects = (site: CmsSite): Redirect[] => (Array.isArray(site.redirects) ? (site.redirects as unknown as Redirect[]) : []);

export function activeAnnouncement(site: CmsSite, now = new Date()): Omit<Announcement, 'enabled' | 'startsAt' | 'endsAt'> | null {
  const a = readAnnouncement(site);
  if (!a.enabled || !a.text) return null;
  if (a.startsAt && new Date(a.startsAt) > now) return null;
  if (a.endsAt && new Date(a.endsAt) <= now) return null;
  return { text: a.text, link: a.link, linkLabel: a.linkLabel, tone: a.tone, dismissible: a.dismissible, version: a.version };
}

export function activeMaintenance(site: CmsSite): Omit<Maintenance, 'enabled'> | null {
  const m = readMaintenance(site);
  if (!m.enabled) return null;
  return {
    title: m.title || 'Przerwa techniczna',
    message: m.message || 'Wprowadzamy ulepszenia. Wróć za chwilę.',
    until: m.until && new Date(m.until) > new Date() ? m.until : null,
  };
}

export const bypassHash = (site: CmsSite) => createHash('sha256').update(site.previewToken).digest('hex');

export function publicState(site: CmsSite) {
  return {
    stateRev: site.stateRev,
    announcement: activeAnnouncement(site),
    maintenance: activeMaintenance(site),
    redirects: readRedirects(site),
    bypass: bypassHash(site),
  };
}

async function bump(site: CmsSite, data: Prisma.CmsSiteUpdateInput) {
  return prisma.cmsSite.update({ where: { id: site.id }, data: { ...data, stateRev: { increment: 1 } } });
}

export async function saveAnnouncement(site: CmsSite, input: Record<string, unknown>) {
  const prev = readAnnouncement(site);
  const text = str(input.text, 300);
  const link = str(input.link, 500);
  if (!safeLink(link)) throw new UserError('Nieprawidłowy link (https://…, /podstrona, mailto: lub tel:).');
  const enabled = input.enabled === true;
  if (enabled && !text) throw new UserError('Wpisz treść ogłoszenia.');
  const startsAt = date(input.startsAt, 'od');
  const endsAt = date(input.endsAt, 'do');
  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) throw new UserError('Koniec ogłoszenia musi być po jego początku.');
  const next: Announcement = {
    enabled,
    text,
    link,
    linkLabel: str(input.linkLabel, 40),
    tone: TONES.includes(input.tone as Tone) ? (input.tone as Tone) : 'info',
    startsAt,
    endsAt,
    dismissible: input.dismissible !== false,
    version: prev.version,
  };
  if (next.text !== prev.text || next.link !== prev.link || next.tone !== prev.tone || (next.enabled && !prev.enabled)) next.version = prev.version + 1;
  return bump(site, { announcement: next as unknown as Prisma.InputJsonValue });
}

export async function saveMaintenance(site: CmsSite, input: Record<string, unknown>) {
  const next: Maintenance = {
    enabled: input.enabled === true,
    title: str(input.title, 80),
    message: str(input.message, 1000),
    until: date(input.until, 'planowany koniec'),
  };
  return bump(site, { maintenance: next as unknown as Prisma.InputJsonValue });
}

const PATH_RE = /^\/[^\s?#]*$/;

export async function saveRedirects(site: CmsSite, input: unknown) {
  if (!Array.isArray(input)) throw new UserError('Nieprawidłowa lista przekierowań.');
  if (input.length > MAX_REDIRECTS) throw new UserError(`Maksymalnie ${MAX_REDIRECTS} przekierowań.`);
  const seen = new Set<string>();
  const list: Redirect[] = [];
  for (const [i, raw] of input.entries()) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const from = str(r.from, 300).replace(/\/+$/, '') || '/';
    const to = str(r.to, 1000);
    const n = i + 1;
    if (!PATH_RE.test(from)) throw new UserError(`Przekierowanie ${n}: „skąd” musi być ścieżką zaczynającą się od /, np. /stara-oferta.`);
    if (from.startsWith('/api/') || from.startsWith('/_next/')) throw new UserError(`Przekierowanie ${n}: tej ścieżki nie można przekierować.`);
    if (!to || !safeLink(to) || /^(mailto:|tel:)/i.test(to)) throw new UserError(`Przekierowanie ${n}: „dokąd” musi być ścieżką (/nowa) albo adresem https://.`);
    if (to.replace(/\/+$/, '') === from) throw new UserError(`Przekierowanie ${n} prowadzi samo do siebie.`);
    if (seen.has(from)) throw new UserError(`Ścieżka ${from} jest przekierowana dwa razy.`);
    seen.add(from);
    list.push({ from, to, permanent: r.permanent !== false });
  }
  const map = new Map(list.map((r) => [r.from, r.to]));
  for (const r of list) {
    let hops = 0;
    let at: string | undefined = r.to;
    while (at && map.has(at.replace(/\/+$/, '') || '/') && hops < 10) {
      at = map.get(at.replace(/\/+$/, '') || '/');
      hops++;
    }
    if (hops >= 10) throw new UserError(`Przekierowanie z ${r.from} tworzy pętlę.`);
  }
  return bump(site, { redirects: list as unknown as Prisma.InputJsonValue });
}
