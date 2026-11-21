import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '../../db/prisma.js';
import { redis } from '../../db/redis.js';
import { dayKey } from '../../utils/time.js';

const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|node-fetch|axios|go-http|java\//i;
const KEEP_DAYS = 400;
const RATE_PER_MIN = 120;

async function dailySalt(day: string): Promise<string> {
  const key = `zx:cms:salt:${day}`;
  const salt = randomBytes(16).toString('hex');
  await redis.set(key, salt, 'EX', 2 * 86_400, 'NX');
  return (await redis.get(key)) ?? salt;
}

function cleanPath(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.startsWith('/')) return null;
  const path = raw.split(/[?#]/)[0]!.slice(0, 200).replace(/\/+$/, '') || '/';
  return /^\/[\w\-./%~]*$/.test(path) ? decodeURIComponentSafe(path) : null;
}

function decodeURIComponentSafe(p: string) {
  try {
    return decodeURIComponent(p).slice(0, 200);
  } catch {
    return p;
  }
}

function source(referrer: unknown, siteHost: string | null): string {
  if (typeof referrer !== 'string' || !referrer) return 'bezpośrednio';
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '').toLowerCase();
    if (!host || (siteHost && host === siteHost)) return 'bezpośrednio';
    return host.slice(0, 100);
  } catch {
    return 'bezpośrednio';
  }
}

export async function recordHit(site: { id: number; url: string | null }, input: { path?: unknown; referrer?: unknown; ip: string; ua: string }): Promise<boolean> {
  if (!input.ua || BOT_UA.test(input.ua)) return false;
  const path = cleanPath(input.path);
  if (!path) return false;
  const rate = `zx:cms:rate:${site.id}:${createHash('sha256').update(input.ip).digest('hex').slice(0, 16)}:${Math.floor(Date.now() / 60_000)}`;
  const n = await redis.incr(rate);
  if (n === 1) await redis.expire(rate, 120);
  if (n > RATE_PER_MIN) return false;

  const day = dayKey();
  const visitor = createHash('sha256').update(`${await dailySalt(day)}|${site.id}|${input.ip}|${input.ua}`).digest('hex');
  const fresh = (await redis.pfadd(`zx:cms:uv:${site.id}:${day}`, visitor)) === 1;
  await redis.expire(`zx:cms:uv:${site.id}:${day}`, 2 * 86_400);
  const siteHost = site.url ? new URL(site.url).hostname.replace(/^www\./, '') : null;

  await prisma.$transaction([
    prisma.cmsStat.upsert({
      where: { siteId_day_path: { siteId: site.id, day, path: '' } },
      create: { siteId: site.id, day, path: '', views: 1, visitors: fresh ? 1 : 0 },
      update: { views: { increment: 1 }, ...(fresh && { visitors: { increment: 1 } }) },
    }),
    prisma.cmsStat.upsert({
      where: { siteId_day_path: { siteId: site.id, day, path } },
      create: { siteId: site.id, day, path, views: 1 },
      update: { views: { increment: 1 } },
    }),
    prisma.cmsStatRef.upsert({
      where: { siteId_day_source: { siteId: site.id, day, source: source(input.referrer, siteHost) } },
      create: { siteId: site.id, day, source: source(input.referrer, siteHost), views: 1 },
      update: { views: { increment: 1 } },
    }),
  ]);
  return true;
}

export async function siteStats(siteId: number, days: number) {
  const span = Math.min(365, Math.max(7, days));
  const keys: string[] = [];
  for (let i = span - 1; i >= 0; i--) keys.push(dayKey(new Date(Date.now() - i * 86_400_000)));
  const from = keys[0]!;
  const [totals, paths, refs] = await Promise.all([
    prisma.cmsStat.findMany({ where: { siteId, path: '', day: { gte: from } } }),
    prisma.cmsStat.groupBy({ by: ['path'], where: { siteId, day: { gte: from }, NOT: { path: '' } }, _sum: { views: true }, orderBy: { _sum: { views: 'desc' } }, take: 10 }),
    prisma.cmsStatRef.groupBy({ by: ['source'], where: { siteId, day: { gte: from } }, _sum: { views: true }, orderBy: { _sum: { views: 'desc' } }, take: 10 }),
  ]);
  const map = new Map(totals.map((t) => [t.day, t]));
  const series = keys.map((day) => ({ day, views: map.get(day)?.views ?? 0, visitors: map.get(day)?.visitors ?? 0 }));
  return {
    days: span,
    series,
    views: series.reduce((a, b) => a + b.views, 0),
    visitors: series.reduce((a, b) => a + b.visitors, 0),
    pages: paths.map((p) => ({ path: p.path, views: p._sum.views ?? 0 })),
    sources: refs.map((r) => ({ source: r.source, views: r._sum.views ?? 0 })),
  };
}

export async function pruneStats(): Promise<void> {
  const cutoff = dayKey(new Date(Date.now() - KEEP_DAYS * 86_400_000));
  await prisma.cmsStat.deleteMany({ where: { day: { lt: cutoff } } });
  await prisma.cmsStatRef.deleteMany({ where: { day: { lt: cutoff } } });
}

export const TRACKER_JS = `(function(){var s=document.currentScript;if(!s)return;var id=s.getAttribute('data-site');if(!id)return;var u=new URL('/cms/v1/hit',s.src).href;var last='',ref=document.referrer||'';function hit(){var p=location.pathname;if(p===last)return;last=p;var b=JSON.stringify({t:id,p:p,r:ref});ref='';if(navigator.sendBeacon){navigator.sendBeacon(u,b)}else{fetch(u,{method:'POST',body:b,keepalive:true,mode:'no-cors'})}}var h=history;['pushState','replaceState'].forEach(function(k){var o=h[k];h[k]=function(){var r=o.apply(this,arguments);setTimeout(hit,0);return r}});addEventListener('popstate',hit);if(document.visibilityState==='prerender'){document.addEventListener('visibilitychange',function f(){if(document.visibilityState==='visible'){document.removeEventListener('visibilitychange',f);hit()}})}else{hit()}})();`;
