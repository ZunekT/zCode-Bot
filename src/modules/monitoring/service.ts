import { randomBytes } from 'node:crypto';
import type { MonitoredBot } from '../../generated/prisma/client.js';
import type { ZxClient } from '../../client.js';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { getSendableChannel } from '../../core/channels.js';
import { getConfig, updateConfig } from '../../core/config-service.js';
import { Panel } from '../../ui/builders/container.js';
import { v2Message } from '../../ui/builders/payload.js';
import { card } from '../../ui/components/card.js';
import { e } from '../../ui/emojis.js';
import { discordTime, formatDuration, truncate } from '../../utils/format.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('monitoring');

/** Ile nieudanych sprawdzeń z rzędu oznacza awarię (chroni przed fałszywymi alarmami). */
export const FAILS_TO_DOWN = 2;
/** Brak heartbeatu dłużej niż tyle = awaria. */
export const HEARTBEAT_TIMEOUT_MS = 3 * 60_000;
const HTTP_TIMEOUT_MS = 10_000;

export const MODES = {
  http: { label: 'HTTP (adres health-check)', icon: '🌐' },
  heartbeat: { label: 'Heartbeat (bot sam się zgłasza)', icon: '💓' },
  presence: { label: 'Status online na Discordzie', icon: '🟢' },
} as const;
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
}

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
    title: down ? `🔴 ${bot.name} nie działa` : `🟢 ${bot.name} znowu działa`,
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
            title: down ? `Twój bot ${bot.name} ma problem` : `Twój bot ${bot.name} znowu działa`,
            description: down
              ? 'Wykryliśmy, że bot przestał odpowiadać. Już się tym zajmujemy – nie musisz nic robić.'
              : `Wszystko wróciło do normy${downtime ? ` (przerwa: ${downtime})` : ''}. Dziękujemy za cierpliwość!`,
          }),
        ),
      )
      .catch(() => undefined);
  }
}

/** Jedno sprawdzenie bota z zapisem wyniku i alertami przy zmianie stanu. Zwraca, czy stan się zmienił. */
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
    },
  });
  if (goesDown || goesUp) {
    log.warn(
      `${bot.name}: ${goesDown ? 'AWARIA' : 'działa ponownie'}${result.error ? ` (${result.error})` : ''}`,
    );
    await alert(client, goesUp ? bot : updated, goesDown, result);
  }
  return goesDown || goesUp;
}

/** Tablica statusu (publiczna). */
export function statusBoard(bots: MonitoredBot[]): Panel {
  const panel = new Panel({ tone: bots.some((b) => !b.online) ? 'warning' : 'success' }).title(
    'server',
    'Status botów zxCode',
  );
  if (!bots.length) return panel.text('-# Brak monitorowanych botów.');
  const allOk = bots.every((b) => b.online);
  panel
    .text(
      allOk
        ? `${e('verified')} **Wszystkie systemy działają**`
        : `${e('shield_x')} **Część botów ma problemy** – pracujemy nad tym.`,
    )
    .separator();
  panel.text(
    bots
      .map((b) => {
        const details = [
          `uptime ${uptime(b)}`,
          b.lastResponseMs !== null && b.mode === 'http' ? `${b.lastResponseMs} ms` : null,
          b.version ? `v${b.version.replace(/^v/, '')}` : null,
          !b.online && b.lastDownAt ? `nie działa od ${discordTime(b.lastDownAt, 'R')}` : null,
        ].filter(Boolean);
        return `${b.online ? '🟢' : '🔴'} **${b.name}**\n-# ${details.join(' • ')}`;
      })
      .join('\n'),
  );
  return panel.footer(`Sprawdzane co minutę • ostatnia aktualizacja ${discordTime(new Date(), 'T')}`);
}

let runs = 0;

/** Zadanie: sprawdza wszystkie boty, a tablicę statusu odświeża przy zmianie stanu albo co 5 minut. */
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
  runs++;
  if (changed || runs % 5 === 1) await refreshBoard(client);
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
