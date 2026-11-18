import type { FastifyInstance, FastifyReply } from 'fastify';
import type { APIMessageComponent, Message } from 'discord.js';
import type { Prisma, TicketStatus } from '../generated/prisma/client.js';
import type { ZxClient } from '../client.js';
import { env } from '../config/env.js';
import { audit } from '../core/audit.js';
import { UserError } from '../core/errors.js';
import { prisma } from '../db/prisma.js';
import { addTasks, createOrder, editOrder, getOrder, issueInvoice } from '../modules/orders/service.js';
import { sendError } from '../modules/sdk/routes.js';
import { CATEGORIES } from '../modules/tickets/constants.js';
import { recordStaffActivity } from '../modules/tickets/services/activity.js';
import { getTicketTextChannel } from '../modules/tickets/services/channel.js';
import { closeTicket } from '../modules/tickets/services/close.js';
import { v2Message } from '../ui/builders/payload.js';
import { card } from '../ui/components/card.js';
import { formatOrderId } from '../utils/format.js';
import { invoiceHtml } from './client-orders.js';

type OwnerCheck = (params: unknown, reply: FastifyReply) => Promise<string | null>;

const names = new Map<string, { name: string; avatar: string | null; at: number }>();
async function person(client: ZxClient, id: string) {
  const hit = names.get(id);
  if (hit && Date.now() - hit.at < 3600_000) return { id, name: hit.name, avatar: hit.avatar };
  const u = await client.users.fetch(id).catch(() => null);
  const v = {
    name: u?.globalName ?? u?.username ?? `Użytkownik ${id.slice(-4)}`,
    avatar: u?.displayAvatarURL({ size: 64, extension: 'png' }) ?? null,
    at: Date.now(),
  };
  names.set(id, v);
  return { id, name: v.name, avatar: v.avatar };
}

const round = (v: number) => Math.round(v * 100) / 100;
const channelUrl = (id: string | null) => (id ? `https://discord.com/channels/${env.GUILD_ID}/${id}` : null);

// ───────────────────────────── Ewidencja i limit ─────────────────────────────

const DEFAULT_QUARTER_LIMIT = 10813.5;

async function ledgerSettings() {
  const row = await prisma.siteSetting.findUnique({ where: { key: 'ledger' } });
  const v = (row?.value ?? {}) as { quarterLimit?: number };
  return {
    quarterLimit:
      typeof v.quarterLimit === 'number' && v.quarterLimit > 0 ? v.quarterLimit : DEFAULT_QUARTER_LIMIT,
  };
}

const quarterOf = (d: Date) => Math.floor(d.getMonth() / 3) + 1;
const quarterRange = (year: number, q: number) =>
  [new Date(year, (q - 1) * 3, 1), new Date(year, q * 3, 1)] as const;

// ───────────────────────────── Tickety ─────────────────────────────

const TICKET_STATUS: Record<TicketStatus, string> = {
  OPEN: 'Otwarty',
  CLAIMED: 'Przejęty',
  WAITING_CLIENT: 'Czeka na klienta',
  CLOSED: 'Zamknięty',
  ARCHIVED: 'Zarchiwizowany',
};

function componentText(components: readonly unknown[]): string {
  const out: string[] = [];
  const walk = (
    c: Partial<APIMessageComponent> & { content?: string; components?: unknown[]; accessory?: unknown },
  ) => {
    if (typeof c?.content === 'string') out.push(c.content);
    for (const x of c?.components ?? []) walk(x as never);
  };
  for (const c of components) walk(((c as { toJSON?: () => unknown }).toJSON?.() as never) ?? (c as never));
  return out.join('\n').slice(0, 2000);
}

function messageView(m: Message) {
  return {
    id: m.id,
    author: {
      id: m.author.id,
      name: m.member?.displayName ?? m.author.globalName ?? m.author.username,
      avatar: m.author.displayAvatarURL({ size: 64, extension: 'png' }),
      bot: m.author.bot,
    },
    content: (
      m.content ||
      componentText(m.components) ||
      m.embeds.map((e) => [e.title, e.description].filter(Boolean).join('\n')).join('\n')
    ).slice(0, 4000),
    attachments: [...m.attachments.values()]
      .slice(0, 6)
      .map((a) => ({ name: a.name, url: a.url, image: !!a.contentType?.startsWith('image/') })),
    createdAt: m.createdAt,
  };
}

export function adminMoreRoutes(app: FastifyInstance, client: ZxClient, ownerCheck: OwnerCheck) {
  const base = '/internal/users/:userId/admin';

  // ───────────── Ewidencja sprzedaży ─────────────
  app.get(`${base}/ledger`, async (request, reply) => {
    try {
      if (!(await ownerCheck(request.params, reply))) return;
      const q = request.query as { year?: string; quarter?: string };
      const now = new Date();
      const year = Number(q.year) || now.getFullYear();
      const quarter = Math.min(4, Math.max(1, Number(q.quarter) || quarterOf(now)));
      const [from, to] = quarterRange(year, quarter);
      const settings = await ledgerSettings();
      const payments = await prisma.payment.findMany({
        where: { paidAt: { gte: from, lt: to } },
        orderBy: { paidAt: 'asc' },
        include: { order: { select: { id: true, title: true, userId: true } } },
      });
      const rows = await Promise.all(
        payments.map(async (p, i) => ({
          lp: i + 1,
          id: p.id,
          date: p.paidAt,
          amount: Number(p.amount),
          order: { id: p.order.id, number: formatOrderId(p.order.id), title: p.order.title },
          client: await person(client, p.order.userId),
          note: p.note,
        })),
      );
      // Dzienne sumy – tak wygląda uproszczona ewidencja sprzedaży.
      const days = new Map<string, number>();
      for (const r of rows) {
        const k = r.date.toISOString().slice(0, 10);
        days.set(k, round((days.get(k) ?? 0) + r.amount));
      }
      const total = round(rows.reduce((s, r) => s + r.amount, 0));
      const months = [0, 1, 2].map((i) => {
        const m = new Date(year, (quarter - 1) * 3 + i, 1);
        const n = new Date(year, (quarter - 1) * 3 + i + 1, 1);
        return {
          month: m.toISOString().slice(0, 7),
          amount: round(rows.filter((r) => r.date >= m && r.date < n).reduce((s, r) => s + r.amount, 0)),
        };
      });
      return {
        year,
        quarter,
        from,
        to,
        total,
        limit: settings.quarterLimit,
        usedPct: Math.round((total / settings.quarterLimit) * 1000) / 10,
        months,
        days: [...days.entries()].map(([date, amount]) => ({ date, amount })),
        rows,
      };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.put(`${base}/ledger/settings`, async (request, reply) => {
    try {
      const userId = await ownerCheck(request.params, reply);
      if (!userId) return;
      const limit = Number((request.body as { quarterLimit?: unknown })?.quarterLimit);
      if (!(limit > 0) || limit > 1_000_000)
        return reply.code(400).send({ error: 'Podaj kwotę limitu większą od zera.' });
      await prisma.siteSetting.upsert({
        where: { key: 'ledger' },
        create: { key: 'ledger', value: { quarterLimit: round(limit) }, updatedBy: userId },
        update: { value: { quarterLimit: round(limit) }, updatedBy: userId },
      });
      await audit(client, {
        action: 'ledger.limit',
        actorId: userId,
        summary: `Panel WWW: limit kwartalny ${round(limit)} zł`,
      });
      return { quarterLimit: round(limit) };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  // ───────────── Tickety ─────────────
  app.get(`${base}/tickets`, async (request, reply) => {
    try {
      if (!(await ownerCheck(request.params, reply))) return;
      const filter = (request.query as { status?: string }).status ?? 'open';
      const where: Prisma.TicketWhereInput =
        filter === 'closed'
          ? { status: { in: ['CLOSED', 'ARCHIVED'] } }
          : filter === 'all'
            ? {}
            : { status: { in: ['OPEN', 'CLAIMED', 'WAITING_CLIENT'] } };
      const tickets = await prisma.ticket.findMany({ where, orderBy: { lastActivityAt: 'desc' }, take: 150 });
      return {
        tickets: await Promise.all(
          tickets.map(async (t) => {
            const waitingSince =
              t.status !== 'CLOSED' &&
              t.status !== 'ARCHIVED' &&
              t.lastClientMsgAt &&
              (!t.lastStaffMsgAt || t.lastClientMsgAt > t.lastStaffMsgAt)
                ? t.lastClientMsgAt
                : null;
            return {
              id: t.id,
              category: CATEGORIES[t.category].label,
              status: t.status,
              statusLabel: TICKET_STATUS[t.status],
              priority: t.priority,
              subject: t.subject,
              client: await person(client, t.userId),
              claimedBy: t.claimedBy ? (await person(client, t.claimedBy)).name : null,
              openedAt: t.openedAt,
              lastActivityAt: t.lastActivityAt,
              waitingSince,
              orderId: t.orderId,
              url: channelUrl(t.channelId),
              rating: t.rating,
            };
          }),
        ),
      };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get(`${base}/tickets/:id`, async (request, reply) => {
    try {
      if (!(await ownerCheck(request.params, reply))) return;
      const id = Number((request.params as { id: string }).id);
      const t = Number.isSafeInteger(id)
        ? await prisma.ticket.findUnique({
            where: { id },
            include: { notes: { orderBy: { createdAt: 'asc' } } },
          })
        : null;
      if (!t) return reply.code(404).send({ error: 'Nie ma takiego ticketu.' });
      const channel =
        t.channelId && t.status !== 'CLOSED' && t.status !== 'ARCHIVED'
          ? await getTicketTextChannel(client, t)
          : null;
      const messages = channel
        ? [...(await channel.messages.fetch({ limit: 60 }).catch(() => new Map())).values()]
        : [];
      return {
        ticket: {
          id: t.id,
          category: CATEGORIES[t.category].label,
          status: t.status,
          statusLabel: TICKET_STATUS[t.status],
          priority: t.priority,
          subject: t.subject,
          formData: t.formData,
          client: await person(client, t.userId),
          claimedBy: t.claimedBy ? (await person(client, t.claimedBy)).name : null,
          openedAt: t.openedAt,
          closedAt: t.closedAt,
          closeReason: t.closeReason,
          transcriptUrl: t.transcriptUrl,
          rating: t.rating,
          ratingComment: t.ratingComment,
          order: t.orderId ? { id: t.orderId, number: formatOrderId(t.orderId) } : null,
          url: channelUrl(t.channelId),
          open: !!channel,
        },
        notes: await Promise.all(
          t.notes.map(async (n) => ({
            id: n.id,
            content: n.content,
            author: (await person(client, n.authorId)).name,
            at: n.createdAt,
          })),
        ),
        messages: (messages as Message[])
          .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
          .map(messageView),
      };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post(`${base}/tickets/:id/:action`, async (request, reply) => {
    try {
      const userId = await ownerCheck(request.params, reply);
      if (!userId) return;
      const { id: raw, action } = request.params as { id: string; action: string };
      const id = Number(raw);
      const t = Number.isSafeInteger(id) ? await prisma.ticket.findUnique({ where: { id } }) : null;
      if (!t) return reply.code(404).send({ error: 'Nie ma takiego ticketu.' });
      const body = (request.body ?? {}) as { content?: string; reason?: string };

      if (action === 'reply') {
        const content = String(body.content ?? '').trim();
        if (!content || content.length > 3500) throw new UserError('Wiadomość: od 1 do 3500 znaków.');
        const channel = await getTicketTextChannel(client, t);
        if (!channel) throw new UserError('Kanał ticketu jest niedostępny (zamknięty?).');
        const author = await person(client, userId);
        await channel.send({
          ...v2Message(
            card({
              tone: 'brand',
              emoji: 'support',
              title: author.name,
              description: content,
              footer: 'Odpowiedź z panelu zxcode.pl',
            }),
          ),
          allowedMentions: { parse: [] },
        });
        await recordStaffActivity(t.id);
        return { ok: true };
      }
      if (action === 'close') {
        if (t.status === 'CLOSED' || t.status === 'ARCHIVED')
          throw new UserError('Ticket jest już zamknięty.');
        const reason =
          String(body.reason ?? '')
            .trim()
            .slice(0, 300) || null;
        await closeTicket(client, t.id, { closedBy: userId, reason });
        await audit(client, {
          action: 'ticket.close',
          actorId: userId,
          targetId: String(t.id),
          summary: `Panel WWW: zamknięto ticket #${t.id}${reason ? ` (${reason})` : ''}`,
        });
        return { ok: true };
      }
      return reply.code(404).send({ error: 'Nieznana akcja.' });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  // ───────────── Zlecenia: tworzenie, edycja, zadania, proformy ─────────────
  app.post(`${base}/orders`, async (request, reply) => {
    try {
      const actorId = await ownerCheck(request.params, reply);
      if (!actorId) return;
      const b = (request.body ?? {}) as {
        userId?: string;
        title?: string;
        description?: string;
        price?: number | null;
        deadline?: string | null;
      };
      const uid = String(b.userId ?? '')
        .replace(/[<@!>]/g, '')
        .trim();
      if (!/^\d{17,20}$/.test(uid)) throw new UserError('Podaj ID klienta (Discord).');
      const title = String(b.title ?? '').trim();
      if (title.length < 3 || title.length > 100) throw new UserError('Tytuł: od 3 do 100 znaków.');
      const price =
        b.price === null || b.price === undefined || (b.price as unknown) === '' ? null : Number(b.price);
      if (price !== null && !(price >= 0 && price < 1_000_000)) throw new UserError('Nieprawidłowa cena.');
      const deadline = b.deadline ? new Date(b.deadline) : null;
      if (deadline && Number.isNaN(deadline.getTime())) throw new UserError('Nieprawidłowy termin.');
      const order = await createOrder(client, {
        userId: uid,
        title,
        description: b.description?.trim().slice(0, 2000) || null,
        price,
        deadline,
        actorId,
      });
      return { id: order.id, number: formatOrderId(order.id) };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.patch(`${base}/orders/:id`, async (request, reply) => {
    try {
      const actorId = await ownerCheck(request.params, reply);
      if (!actorId) return;
      const id = Number((request.params as { id: string }).id);
      const b = (request.body ?? {}) as {
        title?: string;
        description?: string | null;
        price?: number | null;
        deadline?: string | null;
        repoUrl?: string | null;
      };
      const data: Parameters<typeof editOrder>[2] = {};
      if (b.title !== undefined) data.title = String(b.title).trim().slice(0, 100);
      if (b.description !== undefined)
        data.description = b.description ? String(b.description).slice(0, 2000) : null;
      if (b.price !== undefined)
        data.price = b.price === null || (b.price as unknown) === '' ? null : Number(b.price);
      if (b.deadline !== undefined) data.deadline = b.deadline ? new Date(b.deadline) : null;
      if (b.repoUrl !== undefined) data.repoUrl = b.repoUrl ? String(b.repoUrl).slice(0, 300) : null;
      if (data.price !== undefined && data.price !== null && !(data.price >= 0))
        throw new UserError('Nieprawidłowa cena.');
      await editOrder(client, id, data, actorId);
      return { ok: true };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post(`${base}/orders/:id/addtasks`, async (request, reply) => {
    try {
      if (!(await ownerCheck(request.params, reply))) return;
      const id = Number((request.params as { id: string }).id);
      const lines = String((request.body as { text?: string })?.text ?? '')
        .split('\n')
        .slice(0, 30);
      await getOrder(id);
      const added = await addTasks(client, id, lines);
      return { added };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post(`${base}/orders/:id/invoice`, async (request, reply) => {
    try {
      const actorId = await ownerCheck(request.params, reply);
      if (!actorId) return;
      const id = Number((request.params as { id: string }).id);
      const b = (request.body ?? {}) as { amount?: number | null; days?: number };
      const amount =
        b.amount === null || b.amount === undefined || (b.amount as unknown) === '' ? null : Number(b.amount);
      const days = Math.min(60, Math.max(1, Number(b.days) || 7));
      await issueInvoice(client, id, amount, days, actorId);
      return { ok: true };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get(`${base}/orders/:id/invoices/:invoiceId`, async (request, reply) => {
    try {
      if (!(await ownerCheck(request.params, reply))) return;
      const { id, invoiceId } = request.params as { id: string; invoiceId: string };
      const invoice = await prisma.invoice.findUnique({
        where: { id: Number(invoiceId) },
        include: { order: { include: { payments: { select: { amount: true } } } } },
      });
      if (!invoice || invoice.orderId !== Number(id))
        return reply.code(404).send({ error: 'Nie znaleziono.' });
      return reply
        .header('content-type', 'text/html; charset=utf-8')
        .send(await invoiceHtml(client, invoice, invoice.order));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  // ───────────── Dziennik zmian ─────────────
  app.get(`${base}/audit`, async (request, reply) => {
    try {
      if (!(await ownerCheck(request.params, reply))) return;
      const q = request.query as { before?: string; action?: string };
      const before = Number(q.before);
      const rows = await prisma.auditLog.findMany({
        where: {
          ...(Number.isSafeInteger(before) && before > 0 && { id: { lt: before } }),
          ...(q.action && /^[a-z.]{2,40}$/.test(q.action) && { action: { startsWith: q.action } }),
        },
        orderBy: { id: 'desc' },
        take: 50,
      });
      return {
        entries: await Promise.all(
          rows.map(async (r) => ({
            id: r.id,
            action: r.action,
            summary: ((r.details as { summary?: string } | null)?.summary ?? r.action)
              .replace(/<@!?(\d+)>/g, '@$1')
              .replace(/\*\*/g, ''),
            actor: await person(client, r.actorId),
            targetId: r.targetId,
            at: r.createdAt,
          })),
        ),
        next: rows.length === 50 ? rows[rows.length - 1]!.id : null,
      };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get(`${base}/people`, async (request, reply) => {
    try {
      if (!(await ownerCheck(request.params, reply))) return;
      const [o, t, p] = await Promise.all([
        prisma.order.findMany({ distinct: ['userId'], select: { userId: true }, take: 300 }),
        prisma.ticket.findMany({
          distinct: ['userId'],
          select: { userId: true },
          orderBy: { openedAt: 'desc' },
          take: 300,
        }),
        prisma.clientProfile.findMany({ select: { userId: true } }),
      ]);
      const ids = [...new Set([...t, ...o, ...p].map((x) => x.userId))].slice(0, 300);
      return { people: await Promise.all(ids.map((id) => person(client, id))) };
    } catch (err) {
      return sendError(reply, err);
    }
  });
}
