import { env } from '../../config/env.js';
import { UserError } from '../../core/errors.js';

const BASE = 'https://mathost.eu/api';
const TIMEOUT_MS = 15_000;

export class MathostError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    message: string,
  ) {
    super(message);
  }
}

export const mathostEnabled = () => !!env.MATHOST_API_KEY;

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  if (!env.MATHOST_API_KEY)
    throw new UserError('Brak MATHOST_API_KEY w .env – zarządzanie VPS jest wyłączone.');
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${env.MATHOST_API_KEY}`,
        'user-agent': 'zxCode-Bot',
        ...(body !== undefined && { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new MathostError(
      0,
      'network',
      (err as Error).name === 'TimeoutError' ? 'Mathost nie odpowiada' : 'Brak połączenia z Mathost',
    );
  }
  const data = (await res.json().catch(() => null)) as (T & { error?: string; message?: string }) | null;
  if (!res.ok) {
    const msg =
      res.status === 401 || res.status === 403
        ? 'Mathost odrzucił klucz API (MATHOST_API_KEY)'
        : res.status === 429
          ? 'Za dużo zapytań do Mathost – spróbuj za minutę'
          : (data?.message ?? `Mathost: HTTP ${res.status}`);
    throw new MathostError(res.status, data?.error, msg);
  }
  return data as T;
}

export interface MathostService {
  id: string;
  type: 'VPS' | 'DOCKER' | string;
  name?: string;
  ip?: { ip: string }[];
  offer?: { id: string; name: string };
  expiresAt: string;
  suspension: unknown;
}

export interface VpsInfo {
  id: number;
  name: string;
  offer: { name: string; category?: { name: string } };
  price: { price: number; currency: string }[];
  ipAdresses: { ip: string }[];
  bandwidthUsage: number;
  expiresAt: string;
  autoRenew: boolean;
  suspension: { suspendedAt: string; message: string } | null;
  operation: unknown;
}

interface Usage {
  available: boolean;
  used: number;
  total: number;
  cached?: number;
}

export interface VpsLive {
  stats: {
    status: string;
    uptime: number;
    cpu: number;
    cpus: number;
    mem: number;
    maxmem: number;
    netin: number;
    netout: number;
    maxdisk: number;
  };
  disk?: Usage;
  memory?: Usage;
}

export interface RrdPoint {
  time: number;
  cpu?: number;
  mem?: number;
  maxmem?: number;
  netin?: number;
  netout?: number;
}

export interface VpsBackup {
  volid: string;
  ctime?: number;
  size?: number;
  notes?: string;
}

export const mathost = {
  services: () => call<MathostService[]>('GET', '/account/services'),
  vps: (id: number) => call<VpsInfo>('GET', `/account/services/vps/${id}`),
  live: (id: number) => call<VpsLive>('GET', `/account/services/vps/${id}/live`),
  history: (id: number, timeframe: 'hour' | 'day' | 'week' | 'month') =>
    call<RrdPoint[]>('GET', `/account/services/vps/${id}/stats/${timeframe}`),
  backups: (id: number) => call<VpsBackup[]>('GET', `/account/services/vps/${id}/backups`),
  createBackup: (id: number) => call<boolean>('POST', `/account/services/vps/${id}/backups`),
  reboot: (id: number) => call<boolean>('POST', `/account/services/vps/${id}/reboot`),
};

let detectedId: number | null = null;

export async function vpsId(): Promise<number> {
  if (env.MATHOST_VPS_ID) return env.MATHOST_VPS_ID;
  if (detectedId) return detectedId;
  const list = (await mathost.services()).filter((s) => s.type === 'VPS');
  if (list.length !== 1) {
    throw new UserError(
      list.length
        ? `Na koncie Mathost jest ${list.length} VPS – ustaw MATHOST_VPS_ID w .env (${list.map((s) => s.id).join(', ')}).`
        : 'Na koncie Mathost nie ma żadnego VPS.',
    );
  }
  detectedId = Number(list[0]!.id);
  return detectedId;
}
