import { randomBytes } from 'node:crypto';
import tls from 'node:tls';
import type { MonitoredBot } from '../../generated/prisma/client.js';
import type { ZxClient } from '../../client.js';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { getSendableChannel } from '../../core/channels.js';
import { getConfig, updateConfig } from '../../core/config-service.js';
import { Panel } from '../../ui/builders/container.js';
import { v2Message } from '../../ui/builders/payload.js';
import { card, diffBlock, type DiffSign } from '../../ui/components/card.js';
import type { EmojiName } from '../../ui/emojis.js';
import { discordTime, formatDuration, truncate } from '../../utils/format.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('monitoring');

export const FAILS_TO_DOWN = 2;
export const HEARTBEAT_TIMEOUT_MS = 3 * 60_000;
const HTTP_TIMEOUT_MS = 10_000;

export const MODES = {
  http: { label: 'HTTP (adres health-check)', emoji: 'server' },
  heartbeat: { label: 'Heartbeat (bot sam się zgłasza)', emoji: 'lightning' },
  presence: { label: 'Status online na Discordzie', emoji: 'discord' },
  site: { label: 'Strona internetowa (WWW + SSL)', emoji: 'laptop' },
} as const satisfies Record<string, { label: string; emoji: EmojiName }>;
export type Mode = keyof typeof MODES;

export const newHeartbeatToken = () => randomBytes(24).toString('hex');

export function heartbeatUrl(token: string): string {
  return `${env.PUBLIC_URL?.replace(/\/$/, '') ?? `http://ADRES-SERWERA:${env.HTTP_PORT}`}/heartbeat/${token}`;
}

export interface CheckResult {
  ok: boolean;
  ms?: number;
  error?: string;
  version?: string;
  sslExpiresAt?: Date | null;
}

const SSL_WARN_DAYS = 14;
const SSL_CACHE_MS = 6 * 3600_000;
const sslCache = new Map<string, { at: number; exp: Date | null }>();

export async function sslExpiry(rawUrl: string): Promise<Date | null> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  const hit = sslCache.get(u.host);
  if (hit && Date.now() - hit.at < SSL_CACHE_MS) return hit.exp;
  const exp = await new Promise<Date | null>((resolve) => {
    const sock = tls.connect(
      { host: u.hostname, port: Number(u.port) || 443, servername: u.hostname, timeout: 8000 },
      () => {
        const cert = sock.getPeerCertificate();
        sock.end();
        resolve(cert?.valid_to ? new Date(cert.valid_to) : null);
      },
    );
    sock.on('error', () => resolve(null));
    sock.on('timeout', () => {
      sock.destroy();
      resolve(null);
    });
  });
  sslCache.set(u.host, { at: Date.now(), exp });
  return exp;
}

export const isSite = (b: Pick<MonitoredBot, 'mode'>) => b.mode === 'site';
const what = (b: Pick<MonitoredBot, 'mode'>) => (isSite(b) ? 'Twoja strona' : 'Twój bot');

export async function checkBot(client: ZxClient, bot: MonitoredBot): Promise<CheckResult> {
  if (bot.mode === 'heartbeat') {
    if (!bot.lastHeartbeatAt) return { ok: false, error: 'Brak heartbeatu (bot jeszcze się nie zgłosił)' };
    const age = Date.now() - bot.lastHeartbeatAt.getTime();
    return age <= HEARTBEAT_TIMEOUT_MS
      ? { ok: true }
      : { ok: false, error: `Ostatni heartbeat ${formatDuration(age)} temu` };
  }

  if (bot.mode === 'presence') {
    if (!env.ENABLE_PRESENCE_INTENT)
      return { ok: false, error: 'Tryb presence wyłączony (ENABLE_PRESENCE_INTENT)' };
    if (!bot.botUserId) return { ok: false, error: 'Brak ID bota' };
    const config = await getConfig();
    const guild = client.guilds.cache.get(config.guildId);
    const member = await guild?.members.fetch({ user: bot.botUserId, withPresences: true }).catch(() => null);
    if (!member) return { ok: false, error: 'Bota nie ma na serwerze zxCode' };
    const status = member.presence?.status ?? 'offline';
    return status === 'offline' ? { ok: false, error: 'Bot jest offline' } : { ok: true };
  }

  if (!bot.healthUrl) return { ok: false, error: 'Brak adresu health-check' };
  const start = performance.now();
  try {
    const res = await fetch(bot.healthUrl, {
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      headers: { 'user-agent': 'zxCode-Monitor/1.0' },
    });
    const ms = Math.round(performance.now() - start);
    if (isSite(bot)) {
      await res.body?.cancel().catch(() => undefined);
      const sslExpiresAt = await sslExpiry(bot.healthUrl);
      return res.ok
        ? { ok: true, ms, sslExpiresAt }
        : { ok: false, ms, error: `HTTP ${res.status}`, sslExpiresAt };
    }
    let version: string | undefined;
    if (res.headers.get('content-type')?.includes('json')) {
      const body = (await res.json().catch(() => null)) as { version?: unknown } | null;
      if (typeof body?.version === 'string') version = body.version.slice(0, 40);
    }
    return res.ok ? { ok: true, ms, version } : { ok: false, ms, error: `HTTP ${res.status}` };
  } catch (err) {
    const name = (err as Error).name;
    return {
      ok: false,
      error:
        name === 'TimeoutError'
          ? `Brak odpowiedzi w ${HTTP_TIMEOUT_MS / 1000}s`
          : truncate((err as Error).message, 150),
    };
  }
}

export const uptime = (b: Pick<MonitoredBot, 'checksOk' | 'checksTotal'>) =>
  b.checksTotal
    ? `${((b.checksOk / b.checksTotal) * 100).toFixed(b.checksOk === b.checksTotal ? 0 : 2)}%`
    : '—';

async function alert(client: ZxClient, bot: MonitoredBot, down: boolean, result: CheckResult) {
  const config = await getConfig();
  const downtime = !down && bot.lastDownAt ? formatDuration(Date.now() - bot.lastDownAt.getTime()) : null;
  const panel = card({
    tone: down ? 'error' : 'success',
    emoji: down ? 'shield_x' : 'verified',
    title: down ? `${bot.name} nie działa` : `${bot.name} znowu działa`,
    description: down
      ? `${config.staffRoleId ? `<@&${config.staffRoleId}> ` : ''}Monitoring wykrył awarię.`
      : undefined,
    fields: [
      { emoji: 'tools', label: 'Powód', value: down ? (result.error ?? 'nieznany') : null },
      { emoji: 'calendar', label: 'Przerwa trwała', value: downtime },
      { emoji: 'user', label: 'Klient', value: bot.ownerId ? `<@${bot.ownerId}>` : null },
      { emoji: 'lightning', label: 'Odpowiedź', value: result.ms !== undefined ? `${result.ms} ms` : null },
      { emoji: 'checklist', label: 'Uptime', value: uptime(bot) },
    ],
  });
  const channel = await getSendableChannel(client, config.staffAlertChannelId);
  await channel
    ?.send({
      ...v2Message(panel),
      allowedMentions: { roles: down && config.staffRoleId ? [config.staffRoleId] : [] },
    })
    .catch(() => undefined);

  if (bot.ownerId) {
    const owner = await client.users.fetch(bot.ownerId).catch(() => null);
    await owner
      ?.send(
        v2Message(
          card({
            tone: down ? 'error' : 'success',
            emoji: 'bot',
            title: down ? `${what(bot)} ${bot.name} ma problem` : `${what(bot)} ${bot.name} znowu działa`,
            description: down
              ? `Wykryliśmy, że ${isSite(bot) ? 'strona przestała' : 'bot przestał'} odpowiadać. Już się tym zajmujemy – nie musisz nic robić.`
              : `Wszystko wróciło do normy${downtime ? ` (przerwa: ${downtime})` : ''}. Dziękujemy za cierpliwość!`,
          }),
        ),
      )
      .catch(() => undefined);
  }
}

export async function processBot(client: ZxClient, bot: MonitoredBot): Promise<boolean> {
  const result = await checkBot(client, bot);
  const failures = result.ok ? 0 : bot.consecutiveFailures + 1;
  const goesDown = !result.ok && bot.online && failures >= FAILS_TO_DOWN;
  const goesUp = result.ok && !bot.online;

  const updated = await prisma.monitoredBot.update({
    where: { id: bot.id },
    data: {
      consecutiveFailures: failures,
      checksTotal: { increment: 1 },
      checksOk: { increment: result.ok ? 1 : 0 },
      lastCheckAt: new Date(),
      lastResponseMs: result.ms ?? null,
      lastError: result.ok ? null : (result.error ?? null),
      ...(result.version && { version: result.version }),
      ...(goesDown && { online: false, lastDownAt: new Date() }),
      ...(goesUp && { online: true, lastUpAt: new Date() }),
      ...(result.sslExpiresAt !== undefined && { sslExpiresAt: result.sslExpiresAt }),
    },
  });
  await checkSsl(client, updated);
  if (goesDown || goesUp) {
    log.warn(
      `${bot.name}: ${goesDown ? 'AWARIA' : 'działa ponownie'}${result.error ? ` (${result.error})` : ''}`,
    );
    await alert(client, goesUp ? bot : updated, goesDown, result);
  }
  return goesDown || goesUp;
}

async function checkSsl(client: ZxClient, bot: MonitoredBot) {
  if (!isSite(bot) || !bot.sslExpiresAt) return;
  const days = Math.floor((bot.sslExpiresAt.getTime() - Date.now()) / 86_400_000);
  if (days > SSL_WARN_DAYS + 6 && bot.sslWarnedAt) {
    await prisma.monitoredBot.update({ where: { id: bot.id }, data: { sslWarnedAt: null } });
    return;
  }
  if (days > SSL_WARN_DAYS) return;
  if (bot.sslWarnedAt && Date.now() - bot.sslWarnedAt.getTime() < 3 * 86_400_000) return;
  await prisma.monitoredBot.update({ where: { id: bot.id }, data: { sslWarnedAt: new Date() } });
  const when = days < 0 ? 'wygasł' : days === 0 ? 'wygasa dziś' : `wygasa za ${days} dni`;
  const config = await getConfig();
  const channel = await getSendableChannel(client, config.staffAlertChannelId);
  await channel
    ?.send(
      v2Message(
        card({
          tone: 'warning',
          emoji: 'lock',
          title: `Certyfikat SSL: ${bot.name}`,
          description: `Certyfikat ${when} (${discordTime(bot.sslExpiresAt, 'D')}). Odnów go, zanim przeglądarki zaczną ostrzegać odwiedzających.`,
          fields: [
            { emoji: 'laptop', label: 'Strona', value: bot.healthUrl },
            { emoji: 'user', label: 'Klient', value: bot.ownerId ? `<@${bot.ownerId}>` : null },
          ],
        }),
      ),
    )
    .catch(() => undefined);
  if (bot.ownerId) {
    const owner = await client.users.fetch(bot.ownerId).catch(() => null);
    await owner
      ?.send(
        v2Message(
          card({
            tone: 'warning',
            emoji: 'lock',
            title: `Certyfikat SSL strony ${bot.name} ${when}`,
            description: 'Wiemy o tym i zajmiemy się odnowieniem – nie musisz nic robić.',
          }),
        ),
      )
      .catch(() => undefined);
  }
}

export function statusBoard(bots: MonitoredBot[]): Panel {
  const allOk = bots.every((b) => b.online);
  const panel = new Panel({ tone: allOk ? 'success' : 'error' }).title('server', 'Status usług zxCode');
  if (!bots.length) return panel.text('-# Brak monitorowanych usług.');
  panel.text(
    allOk ? '**Wszystkie systemy działają.**' : '**Część usług ma problemy** – już nad tym pracujemy.',
  );

  const nameW = Math.min(24, Math.max(...bots.map((b) => b.name.length)));
  const rows = bots.map((b): [DiffSign, string] => {
    const cols = [
      truncate(b.name, nameW).padEnd(nameW),
      (b.online ? 'online' : 'offline').padEnd(8),
      uptime(b).padEnd(8),
      b.version ? `v${b.version.replace(/^v/, '')}` : '',
      b.online && (b.mode === 'http' || b.mode === 'site') && b.lastResponseMs !== null
        ? `${b.lastResponseMs} ms`
        : '',
      !b.online && b.lastDownAt ? `od ${formatDuration(Date.now() - b.lastDownAt.getTime())}` : '',
    ];
    return [b.online ? '+' : '-', cols.filter(Boolean).join('  ').trimEnd()];
  });
  panel.text(diffBlock(rows));
  return panel.footer(
    `Sprawdzane co minutę · tablica odświeżana co 10 min · ostatnio ${discordTime(new Date(), 'T')}`,
  );
}

export const BOARD_REFRESH_MS = 10 * 60_000;
let lastBoardRefresh = 0;

export async function runChecks(client: ZxClient): Promise<void> {
  const bots = await prisma.monitoredBot.findMany({ orderBy: { name: 'asc' } });
  let changed = false;
  for (const bot of bots) {
    try {
      if (await processBot(client, bot)) changed = true;
    } catch (err) {
      log.error(`Błąd sprawdzania ${bot.name}`, err);
    }
  }
  if (changed || Date.now() - lastBoardRefresh >= BOARD_REFRESH_MS) {
    lastBoardRefresh = Date.now();
    await refreshBoard(client);
  }
}

export async function refreshBoard(client: ZxClient): Promise<void> {
  const config = await getConfig();
  if (!config.statusBoardChannelId || !config.statusBoardMessageId) return;
  const channel = await getSendableChannel(client, config.statusBoardChannelId);
  const msg =
    channel && 'messages' in channel
      ? await channel.messages.fetch(config.statusBoardMessageId).catch(() => null)
      : null;
  if (!msg) {
    await updateConfig({ statusBoardChannelId: null, statusBoardMessageId: null });
    return;
  }
  const bots = await prisma.monitoredBot.findMany({ orderBy: { name: 'asc' } });
  await msg
    .edit(v2Message(statusBoard(bots)))
    .catch((err) => log.warn('Nie udało się odświeżyć tablicy statusu', err));
}
