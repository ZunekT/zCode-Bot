import type { ZxClient } from '../../client.js';
import { env } from '../../config/env.js';
import { getConfig } from '../../core/config-service.js';
import { getSendableChannel } from '../../core/channels.js';
import { redis } from '../../db/redis.js';
import type { Panel } from '../../ui/builders/container.js';
import { v2Message } from '../../ui/builders/payload.js';
import { card, tableBlock } from '../../ui/components/card.js';
import { sparkline } from '../stats/chart.js';
import { discordTime, formatDuration, progressBar } from '../../utils/format.js';
import { createLogger } from '../../utils/logger.js';
import { mathost, vpsId, type RrdPoint, type VpsBackup } from './mathost.js';

const log = createLogger('vps');

export const LIMITS = { diskPct: 85, memPct: 90, cpuPct: 90, expiryDays: 7 };
const DAY_MS = 86_400_000;

export interface VpsSnapshot {
  id: number;
  name: string;
  plan: string;
  ip: string | null;
  status: string;
  uptimeSec: number;
  cpuPct: number;
  cpus: number;
  mem: { used: number; total: number; fromAgent: boolean };
  disk: { used: number; total: number } | null;
  net: { in: number; out: number };
  bandwidthMonth: number;
  expiresAt: string;
  autoRenew: boolean;
  suspended: string | null;
  price: string | null;
  cpuHour: number[];
  memHour: number[];
  backups: VpsBackup[];
}

export async function snapshot(opts: { backups?: boolean } = {}): Promise<VpsSnapshot> {
  const id = await vpsId();
  const [info, live, hour, backups] = await Promise.all([
    mathost.vps(id),
    mathost.live(id),
    mathost.history(id, 'hour').catch(() => [] as RrdPoint[]),
    opts.backups === false
      ? Promise.resolve([] as VpsBackup[])
      : mathost.backups(id).catch(() => [] as VpsBackup[]),
  ]);
  const s = live.stats;
  const agentMem = live.memory?.available ? live.memory : null;
  const points = hour.filter((p) => typeof p.cpu === 'number').slice(-30);
  const price = info.price?.[0];
  return {
    id,
    name: info.name,
    plan: [info.offer?.category?.name, info.offer?.name].filter(Boolean).join(' '),
    ip: info.ipAdresses?.[0]?.ip ?? null,
    status: s.status,
    uptimeSec: s.uptime,
    cpuPct: Math.min(100, Math.round(s.cpu * 1000) / 10),
    cpus: s.cpus,
    // Pamięć z agenta w systemie (bez cache) – realne zużycie; bez agenta: to, co widzi hypervisor.
    mem: agentMem
      ? { used: agentMem.used, total: agentMem.total, fromAgent: true }
      : { used: s.mem, total: s.maxmem, fromAgent: false },
    disk: live.disk?.available ? { used: live.disk.used, total: live.disk.total } : null,
    net: { in: s.netin, out: s.netout },
    bandwidthMonth: info.bandwidthUsage ?? 0,
    expiresAt: info.expiresAt,
    autoRenew: info.autoRenew,
    suspended: info.suspension ? (info.suspension.message ?? 'zawieszony') : null,
    price: price ? `${price.price} ${price.currency}/mies.` : null,
    cpuHour: points.map((p) => Math.min(100, Math.round((p.cpu ?? 0) * 100))),
    memHour: points.map((p) => (p.maxmem ? Math.round(((p.mem ?? 0) / p.maxmem) * 100) : 0)),
    backups: [...backups].sort((a, b) => (b.ctime ?? 0) - (a.ctime ?? 0)),
  };
}

export const pct = (used: number, total: number) => (total > 0 ? Math.round((used / total) * 100) : 0);

export function bytes(n: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i >= 3 ? 1 : 0).replace('.', ',')} ${units[i]}`;
}

export const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / DAY_MS);

export function issues(s: VpsSnapshot): { key: string; text: string }[] {
  const out: { key: string; text: string }[] = [];
  if (s.suspended) out.push({ key: 'suspended', text: `VPS zawieszony: ${s.suspended}` });
  if (s.disk && pct(s.disk.used, s.disk.total) >= LIMITS.diskPct)
    out.push({
      key: 'disk',
      text: `Dysk zajęty w ${pct(s.disk.used, s.disk.total)}% – zostało ${bytes(s.disk.total - s.disk.used)}`,
    });
  if (s.mem.fromAgent && pct(s.mem.used, s.mem.total) >= LIMITS.memPct)
    out.push({ key: 'mem', text: `RAM zajęty w ${pct(s.mem.used, s.mem.total)}%` });
  const recent = s.cpuHour.slice(-10);
  if (recent.length >= 5 && recent.every((v) => v >= LIMITS.cpuPct))
    out.push({ key: 'cpu', text: `Procesor obciążony ponad ${LIMITS.cpuPct}% od ${recent.length} min` });
  const days = daysLeft(s.expiresAt);
  if (!s.autoRenew && days <= LIMITS.expiryDays)
    out.push({
      key: 'expiry',
      text:
        days <= 0
          ? 'VPS wygasł!'
          : `VPS wygasa za ${days} ${days === 1 ? 'dzień' : 'dni'} (${discordTime(new Date(s.expiresAt), 'D')}) – auto-odnawianie wyłączone`,
    });
  return out;
}

export function vpsCard(s: VpsSnapshot): Panel {
  const problems = issues(s);
  const running = s.status === 'running';
  const days = daysLeft(s.expiresAt);
  const rows: [string, string][] = [
    ['CPU', `${progressBar(s.cpuPct, 100)}  ${s.cpus} ${s.cpus === 1 ? 'rdzeń' : 'rdzenie'}`],
    ['RAM', `${progressBar(s.mem.used, s.mem.total)}  ${bytes(s.mem.used)} / ${bytes(s.mem.total)}`],
  ];
  if (s.disk)
    rows.push([
      'Dysk',
      `${progressBar(s.disk.used, s.disk.total)}  ${bytes(s.disk.used)} / ${bytes(s.disk.total)}`,
    ]);

  const panel = card({
    tone: !running || s.suspended ? 'error' : problems.length ? 'warning' : 'success',
    emoji: 'server',
    title: `${s.name}${s.plan ? ` · ${s.plan}` : ''}`,
    description: running ? `Działa od **${formatDuration(s.uptimeSec * 1000)}**` : `Stan: **${s.status}**`,
    fields: [
      { emoji: 'cloud_upload', label: 'Adres IP', value: s.ip ? `\`${s.ip}\`` : null },
      {
        emoji: 'calendar',
        label: 'Ważny do',
        value: `${discordTime(new Date(s.expiresAt), 'D')} (${days > 0 ? `za ${days} dni` : 'wygasł'})${s.autoRenew ? '' : ' · auto-odnawianie **wyłączone**'}`,
      },
      { emoji: 'money', label: 'Cena', value: s.price },
      {
        emoji: 'database',
        label: 'Kopie zapasowe',
        value: s.backups.length
          ? `${s.backups.length}, ostatnia ${s.backups[0]?.ctime ? discordTime(new Date(s.backups[0].ctime * 1000), 'R') : '—'}`
          : '**brak**',
      },
    ],
    body:
      tableBlock(rows, { align: 'left' }) +
      `\n-# Sieć od startu: pobrano ${bytes(s.net.in)}, wysłano ${bytes(s.net.out)}` +
      (s.cpuHour.length > 3
        ? `\n-# CPU, ostatnie ${s.cpuHour.length} min: \`${sparkline(s.cpuHour)}\``
        : '') +
      (problems.length ? `\n\n**Uwaga:**\n${problems.map((p) => `- ${p.text}`).join('\n')}` : ''),
    footer: 'Dane z Mathost',
  });
  return panel;
}

export async function checkVps(client: ZxClient): Promise<void> {
  let s: VpsSnapshot;
  try {
    s = await snapshot({ backups: false });
  } catch (err) {
    log.debug('Sprawdzenie VPS nie powiodło się', err);
    return;
  }
  const fresh: string[] = [];
  for (const p of issues(s)) {
    const set = await redis.set(`zx:vps:alert:${p.key}`, '1', 'EX', 12 * 3600, 'NX').catch(() => null);
    if (set) fresh.push(p.text);
  }
  if (!fresh.length) return;
  log.warn(`VPS: ${fresh.join('; ')}`);
  const config = await getConfig();
  const channel = await getSendableChannel(client, config.staffAlertChannelId);
  await channel
    ?.send({
      ...v2Message(
        card({
          tone: 'warning',
          emoji: 'server',
          title: 'VPS wymaga uwagi',
          description: fresh.map((t) => `- ${t}`).join('\n'),
          footer: 'Szczegóły: /vps status',
        }),
      ),
      allowedMentions: { parse: [] },
    })
    .catch(() => undefined);
}

export async function isOwner(client: ZxClient, userId: string): Promise<boolean> {
  if (env.OWNER_ID) return userId === env.OWNER_ID;
  const guild = client.guilds.cache.get(env.GUILD_ID);
  return !!guild && guild.ownerId === userId;
}
