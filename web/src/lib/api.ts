import 'server-only';
import { notFound } from 'next/navigation';
import { env } from './env';
import type { BotDetails, GuildSettings, PublicBot } from './types';

/** Błąd z API bota z kodem HTTP i (opcjonalnie) listą błędów pól. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: { error?: string; errors?: { path: string; message: string }[] },
  ) {
    super(body.error ?? `HTTP ${status}`);
  }
}

export async function internal<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${env.internalUrl}${path}`, {
      method,
      headers: {
        'x-internal-secret': env.internalSecret,
        ...(body !== undefined && { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ApiError(503, { error: 'Bot zxCode jest chwilowo niedostępny. Spróbuj za moment.' });
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

const user = (userId: string) => `/internal/users/${userId}`;

/** „Nie znaleziono bota” (cudzy lub nieistniejący) → strona 404. */
async function orNotFound<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (err) {
    if (err instanceof ApiError && (err.status === 400 || err.status === 404)) notFound();
    throw err;
  }
}

export interface VpsData {
  vps: {
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
    backups: { volid: string; ctime?: number; size?: number; notes?: string }[];
  };
  issues: { key: string; text: string }[];
  range: 'hour' | 'day' | 'week' | 'month';
  history: { t: number; cpu: number; mem: number; netIn: number; netOut: number }[];
}

export const api = {
  me: (userId: string) =>
    internal<{ owner: boolean; vps: boolean }>('GET', `${user(userId)}/me`).catch(() => ({ owner: false, vps: false })),
  vps: (userId: string, range: string) =>
    orNotFound(internal<VpsData>('GET', `${user(userId)}/admin/vps?range=${encodeURIComponent(range)}`)),
  vpsAction: (userId: string, action: 'reboot' | 'backup') =>
    internal<{ ok: boolean }>('POST', `${user(userId)}/admin/vps/${action}`, {}),
  bots: (userId: string) => internal<{ bots: PublicBot[] }>('GET', `${user(userId)}/bots`).then((r) => r.bots),
  bot: (userId: string, botId: string) => orNotFound(internal<BotDetails>('GET', `${user(userId)}/bots/${Number(botId)}`)),
  guild: (userId: string, botId: string, guildId: string) =>
    orNotFound(internal<GuildSettings>('GET', `${user(userId)}/bots/${Number(botId)}/guilds/${guildId.replace(/\D/g, '')}`)),
  saveConfig: (userId: string, botId: string, guildId: string, body: unknown) =>
    internal<{ revision: number; values: unknown; permissions: unknown }>(
      'PUT',
      `${user(userId)}/bots/${Number(botId)}/guilds/${guildId.replace(/\D/g, '')}/config`,
      body,
    ),
  saveProfile: (userId: string, botId: string, body: unknown) =>
    internal<{ profile: unknown; revision: number }>('PUT', `${user(userId)}/bots/${Number(botId)}/profile`, body),
};
