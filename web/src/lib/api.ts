import 'server-only';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { env } from './env';
import type { BotDetails, GuildSettings, PublicBot } from './types';

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

export async function internalRaw(path: string): Promise<Response | null> {
  try {
    const res = await fetch(`${env.internalUrl}${path}`, {
      headers: { 'x-internal-secret': env.internalSecret },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok ? res : null;
  } catch {
    return null;
  }
}

const user = (userId: string) => `/internal/users/${userId}`;

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

export interface Person {
  id: string;
  name: string;
  avatar: string | null;
}
export interface Money {
  price: number | null;
  discount: number;
  total: number | null;
  paid: number;
  due: number | null;
}
export interface OrderRow extends Money {
  id: number;
  number: string;
  title: string;
  status: string;
  statusLabel: string;
  client: Person;
  tasksDone?: number;
  tasksTotal?: number;
  deadline?: string | null;
  createdAt?: string;
  updatedAt: string;
}
export interface Overview {
  kpi: {
    revenueMonth: number;
    revenuePrevMonth: number;
    receivables: number;
    activeOrders: number;
    openTickets: number;
    firstReplyMin: number | null;
    rating: number | null;
    reviews: number;
    clients: number;
  };
  revenueByMonth: { month: string; amount: number }[];
  ordersByStatus: { status: string; label: string; count: number }[];
  recentOrders: OrderRow[];
  recentPayments: { id: number; amount: number; paidAt: string; note: string | null; order: { id: number; number: string; title: string }; client: Person }[];
  overdueInvoices: { id: number; number: string; amount: number; dueDate: string; order: { id: number; number: string; title: string }; client: Person }[];
}
export interface OrderDetails {
  order: OrderRow & {
    description: string | null;
    currency: string;
    discountCode: string | null;
    repoUrl: string | null;
    completedAt: string | null;
    panelUrl: string | null;
  };
  statuses: { status: string; label: string }[];
  tasks: { id: number; content: string; done: boolean }[];
  payments: { id: number; amount: number; note: string | null; paidAt: string }[];
  invoices: { id: number; number: string; amount: number; status: string; dueDate: string; issuedAt: string }[];
  history: { from: string | null; to: string; at: string; by: string }[];
  ticket: { id: number; status: string; url: string | null; transcriptUrl: string | null } | null;
  review: { rating: number; content: string; approved: boolean } | null;
}
export interface ClientRow extends Person {
  orders: number;
  completed: number;
  active: number;
  paid: number;
  due: number;
  tickets: number;
  badges: string[];
  note: string | null;
  lastActivity: string;
}

export interface Step {
  status: string;
  label: string;
  step: number;
}
export interface MyOrder extends Money {
  id: number;
  number: string;
  title: string;
  status: string;
  statusLabel: string;
  step: number;
  tasksDone: number;
  tasksTotal: number;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface MyOrderDetails {
  steps: Step[];
  order: Omit<MyOrder, 'tasksDone' | 'tasksTotal' | 'updatedAt'> & {
    description: string | null;
    statusText: string;
    discountCode: string | null;
    completedAt: string | null;
  };
  tasks: { id: number; content: string; done: boolean }[];
  payments: { id: number; amount: number; paidAt: string }[];
  invoices: { id: number; number: string; amount: number; status: string; dueDate: string; issuedAt: string }[];
  history: { to: string; at: string }[];
  ticketUrl: string | null;
  payment: { details: string | null; title: string } | null;
}
export interface TicketRow {
  id: number;
  category: string;
  status: string;
  statusLabel: string;
  priority: string;
  subject: string | null;
  client: Person;
  claimedBy: string | null;
  openedAt: string;
  lastActivityAt: string;
  waitingSince: string | null;
  orderId: number | null;
  url: string | null;
  rating: number | null;
}
export interface TicketDetails {
  ticket: Omit<TicketRow, 'lastActivityAt' | 'waitingSince' | 'orderId'> & {
    formData: Record<string, unknown> | null;
    closedAt: string | null;
    closeReason: string | null;
    transcriptUrl: string | null;
    ratingComment: string | null;
    order: { id: number; number: string } | null;
    open: boolean;
  };
  notes: { id: number; content: string; author: string; at: string }[];
  messages: {
    id: string;
    author: { id: string; name: string; avatar: string; bot: boolean };
    content: string;
    attachments: { name: string; url: string; image: boolean }[];
    createdAt: string;
  }[];
}
export interface Ledger {
  year: number;
  quarter: number;
  from: string;
  to: string;
  total: number;
  limit: number;
  usedPct: number;
  months: { month: string; amount: number }[];
  days: { date: string; amount: number }[];
  rows: { lp: number; id: number; date: string; amount: number; order: { id: number; number: string; title: string }; client: Person; note: string | null }[];
}
export interface AuditEntry {
  id: number;
  action: string;
  summary: string;
  actor: Person;
  targetId: string | null;
  at: string;
}

export interface SiteAccessData {
  launched: boolean;
  previewUsers: { id: string; name: string | null; avatar: string | null }[];
}

const adm = (userId: string) => `${user(userId)}/admin`;

export const api = {
  overview: (userId: string) => orNotFound(internal<Overview>('GET', `${adm(userId)}/overview`)),
  orders: (userId: string, status?: string, q?: string) =>
    orNotFound(
      internal<{ statuses: { status: string; label: string }[]; orders: OrderRow[] }>(
        'GET',
        `${adm(userId)}/orders?${new URLSearchParams({ ...(status && { status }), ...(q && { q }) })}`,
      ),
    ),
  order: (userId: string, id: string) => orNotFound(internal<OrderDetails>('GET', `${adm(userId)}/orders/${Number(id)}`)),
  orderAction: (userId: string, id: string, action: string, body: unknown) =>
    internal<{ ok: boolean }>('POST', `${adm(userId)}/orders/${Number(id)}/${action}`, body),
  myOrders: (userId: string) => internal<{ steps: Step[]; orders: MyOrder[] }>('GET', `${user(userId)}/orders`),
  myOrder: (userId: string, id: string) => orNotFound(internal<MyOrderDetails>('GET', `${user(userId)}/orders/${Number(id)}`)),
  tickets: (userId: string, status: string) =>
    orNotFound(internal<{ tickets: TicketRow[] }>('GET', `${adm(userId)}/tickets?status=${encodeURIComponent(status)}`)),
  ticket: (userId: string, id: string) => orNotFound(internal<TicketDetails>('GET', `${adm(userId)}/tickets/${Number(id)}`)),
  ticketAction: (userId: string, id: string, action: string, body: unknown) =>
    internal<{ ok: boolean }>('POST', `${adm(userId)}/tickets/${Number(id)}/${action}`, body),
  ledger: (userId: string, year?: string, quarter?: string) =>
    orNotFound(internal<Ledger>('GET', `${adm(userId)}/ledger?${new URLSearchParams({ ...(year && { year }), ...(quarter && { quarter }) })}`)),
  ledgerSettings: (userId: string, quarterLimit: number) =>
    internal<{ quarterLimit: number }>('PUT', `${adm(userId)}/ledger/settings`, { quarterLimit }),
  audit: (userId: string, before?: string, action?: string) =>
    orNotFound(
      internal<{ entries: AuditEntry[]; next: number | null }>(
        'GET',
        `${adm(userId)}/audit?${new URLSearchParams({ ...(before && { before }), ...(action && { action }) })}`,
      ),
    ),
  people: (userId: string) => orNotFound(internal<{ people: Person[] }>('GET', `${adm(userId)}/people`)),
  createOrder: (userId: string, body: unknown) => internal<{ id: number; number: string }>('POST', `${adm(userId)}/orders`, body),
  editOrder: (userId: string, id: string, body: unknown) => internal<{ ok: boolean }>('PATCH', `${adm(userId)}/orders/${Number(id)}`, body),
  clients: (userId: string) => orNotFound(internal<{ clients: ClientRow[] }>('GET', `${adm(userId)}/clients`)),
  siteAccess: (userId: string) => internal<SiteAccessData>('GET', `${user(userId)}/admin/site`),
  saveSiteAccess: (userId: string, body: { launched?: boolean; previewUsers?: string[] }) =>
    internal<{ launched: boolean; previewUsers: string[] }>('PUT', `${user(userId)}/admin/site`, body),
  me: cache((userId: string) =>
    internal<{ owner: boolean; vps: boolean }>('GET', `${user(userId)}/me`).catch(() => ({ owner: false, vps: false })),
  ),
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
