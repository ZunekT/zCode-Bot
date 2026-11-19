import type { FastifyInstance, FastifyReply } from 'fastify';
import type { OrderStatus } from '../generated/prisma/client.js';
import type { ZxClient } from '../client.js';
import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { ORDER_STATUSES, STATUS_ORDER, ACTIVE_ORDER_STATUSES } from '../modules/orders/constants.js';
import { totalsOf } from '../modules/orders/panels.js';
import { addPayment, getOrder, setDoneTasks, setOrderStatus } from '../modules/orders/service.js';
import { sendError } from '../modules/sdk/routes.js';
import { formatOrderId } from '../utils/format.js';

type OwnerCheck = (params: unknown, reply: FastifyReply) => Promise<string | null>;

const users = new Map<string, { name: string; avatar: string | null; at: number }>();
async function who(client: ZxClient, id: string) {
  const hit = users.get(id);
  if (hit && Date.now() - hit.at < 3600_000) return hit;
  const u = await client.users.fetch(id).catch(() => null);
  const v = {
    name: u?.globalName ?? u?.username ?? `Użytkownik ${id.slice(-4)}`,
    avatar: u?.displayAvatarURL({ size: 64, extension: 'png' }) ?? null,
    at: Date.now(),
  };
  users.set(id, v);
  return v;
}
const person = async (client: ZxClient, id: string) => {
  const w = await who(client, id);
  return { id, name: w.name, avatar: w.avatar };
};

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const round = (v: number) => Math.round(v * 100) / 100;
const channelUrl = (channelId: string | null) =>
  channelId ? `https://discord.com/channels/${env.GUILD_ID}/${channelId}` : null;

export function adminRoutes(app: FastifyInstance, client: ZxClient, ownerCheck: OwnerCheck) {
  const base = '/internal/users/:userId/admin';

  app.get(`${base}/overview`, async (request, reply) => {
    try {
      if (!(await ownerCheck(request.params, reply))) return;
      const now = new Date();
      const from12 = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const since30 = new Date(Date.now() - 30 * 86400_000);

      const [
        payments12,
        active,
        byStatus,
        openTickets,
        tickets30,
        reviews,
        recentOrders,
        recentPayments,
        overdue,
        clients,
      ] = await Promise.all([
        prisma.payment.findMany({
          where: { paidAt: { gte: from12 } },
          select: { amount: true, paidAt: true },
        }),
        prisma.order.findMany({
          where: { status: { in: ACTIVE_ORDER_STATUSES } },
          include: { payments: { select: { amount: true } } },
        }),
        prisma.order.groupBy({ by: ['status'], _count: true }),
        prisma.ticket.count({ where: { status: { in: ['OPEN', 'CLAIMED', 'WAITING_CLIENT'] } } }),
        prisma.ticket.findMany({
          where: { openedAt: { gte: since30 }, firstStaffReplyAt: { not: null } },
          select: { openedAt: true, firstStaffReplyAt: true },
        }),
        prisma.review.aggregate({ where: { approved: true }, _avg: { rating: true }, _count: true }),
        prisma.order.findMany({
          orderBy: { updatedAt: 'desc' },
          take: 6,
          include: { payments: { select: { amount: true } } },
        }),
        prisma.payment.findMany({
          orderBy: { paidAt: 'desc' },
          take: 6,
          include: { order: { select: { id: true, title: true, userId: true } } },
        }),
        prisma.invoice.findMany({
          where: { status: { in: ['ISSUED', 'OVERDUE'] }, dueDate: { lt: now } },
          orderBy: { dueDate: 'asc' },
          take: 10,
          include: { order: { select: { id: true, title: true, userId: true } } },
        }),
        prisma.order.findMany({ distinct: ['userId'], select: { userId: true } }),
      ]);

      const months: { month: string; amount: number }[] = [];
      for (let i = 0; i < 12; i++) {
        const d = new Date(from12.getFullYear(), from12.getMonth() + i, 1);
        months.push({ month: monthKey(d), amount: 0 });
      }
      for (const p of payments12) {
        const m = months.find((x) => x.month === monthKey(p.paidAt));
        if (m) m.amount = round(m.amount + Number(p.amount));
      }
      const sumBetween = (a: Date, b: Date) =>
        round(
          payments12.filter((p) => p.paidAt >= a && p.paidAt < b).reduce((s, p) => s + Number(p.amount), 0),
        );
      const replyMins = tickets30.map((t) => (t.firstStaffReplyAt!.getTime() - t.openedAt.getTime()) / 60000);

      return {
        kpi: {
          revenueMonth: sumBetween(monthStart, new Date(8.64e15)),
          revenuePrevMonth: sumBetween(prevStart, monthStart),
          receivables: round(active.reduce((s, o) => s + Math.max(0, totalsOf(o).due ?? 0), 0)),
          activeOrders: active.length,
          openTickets,
          firstReplyMin: replyMins.length
            ? Math.round(replyMins.sort((a, b) => a - b)[Math.floor(replyMins.length / 2)]!)
            : null,
          rating: reviews._count ? round(reviews._avg.rating ?? 0) : null,
          reviews: reviews._count,
          clients: clients.length,
        },
        revenueByMonth: months,
        ordersByStatus: STATUS_ORDER.map((s) => ({
          status: s,
          label: ORDER_STATUSES[s].label,
          count: byStatus.find((b) => b.status === s)?._count ?? 0,
        })),
        recentOrders: await Promise.all(
          recentOrders.map(async (o) => ({
            id: o.id,
            number: formatOrderId(o.id),
            title: o.title,
            status: o.status,
            kind: o.kind,
            statusLabel: ORDER_STATUSES[o.status].label,
            client: await person(client, o.userId),
            ...totalsOf(o),
            updatedAt: o.updatedAt,
          })),
        ),
        recentPayments: await Promise.all(
          recentPayments.map(async (p) => ({
            id: p.id,
            amount: Number(p.amount),
            paidAt: p.paidAt,
            note: p.note,
            order: { id: p.order.id, number: formatOrderId(p.order.id), title: p.order.title },
            client: await person(client, p.order.userId),
          })),
        ),
        overdueInvoices: await Promise.all(
          overdue.map(async (i) => ({
            id: i.id,
            number: i.number,
            amount: Number(i.amount),
            dueDate: i.dueDate,
            order: { id: i.order.id, number: formatOrderId(i.order.id), title: i.order.title },
            client: await person(client, i.order.userId),
          })),
        ),
      };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get(`${base}/orders`, async (request, reply) => {
    try {
      if (!(await ownerCheck(request.params, reply))) return;
      const q = request.query as { status?: string; q?: string; kind?: string };
      const kind = q.kind === 'BOT' || q.kind === 'WEBSITE' ? q.kind : undefined;
      const status = STATUS_ORDER.includes(q.status as OrderStatus) ? (q.status as OrderStatus) : undefined;
      const active = q.status === 'active';
      const search = q.q?.trim().slice(0, 60);
      const idFromSearch = search?.match(/^(?:zx-?)?0*(\d{1,7})$/i)?.[1];
      const orders = await prisma.order.findMany({
        where: {
          ...(status && { status }),
          ...(kind && { kind }),
          ...(active && { status: { in: ACTIVE_ORDER_STATUSES } }),
          ...(search && {
            OR: [
              { title: { contains: search, mode: 'insensitive' as const } },
              { userId: search },
              ...(idFromSearch ? [{ id: Number(idFromSearch) }] : []),
            ],
          }),
        },
        orderBy: { updatedAt: 'desc' },
        take: 200,
        include: { payments: { select: { amount: true } }, tasks: { select: { done: true } } },
      });
      return {
        statuses: STATUS_ORDER.map((s) => ({ status: s, label: ORDER_STATUSES[s].label })),
        orders: await Promise.all(
          orders.map(async (o) => ({
            id: o.id,
            number: formatOrderId(o.id),
            title: o.title,
            status: o.status,
            kind: o.kind,
            statusLabel: ORDER_STATUSES[o.status].label,
            client: await person(client, o.userId),
            ...totalsOf(o),
            tasksDone: o.tasks.filter((t) => t.done).length,
            tasksTotal: o.tasks.length,
            deadline: o.deadline,
            createdAt: o.createdAt,
            updatedAt: o.updatedAt,
          })),
        ),
      };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get(`${base}/orders/:id`, async (request, reply) => {
    try {
      if (!(await ownerCheck(request.params, reply))) return;
      const id = Number((request.params as { id: string }).id);
      const o = await getOrder(id);
      const [history, ticket, review] = await Promise.all([
        prisma.orderStatusChange.findMany({ where: { orderId: id }, orderBy: { createdAt: 'asc' } }),
        prisma.ticket.findUnique({
          where: { orderId: id },
          select: { id: true, channelId: true, status: true, transcriptUrl: true },
        }),
        prisma.review.findUnique({
          where: { orderId: id },
          select: { rating: true, content: true, approved: true },
        }),
      ]);
      return {
        order: {
          id: o.id,
          number: formatOrderId(o.id),
          title: o.title,
          description: o.description,
          status: o.status,
          kind: o.kind,
          statusLabel: ORDER_STATUSES[o.status].label,
          client: await person(client, o.userId),
          ...totalsOf(o),
          currency: o.currency,
          discountCode: o.discountCode,
          deadline: o.deadline,
          repoUrl: o.repoUrl,
          createdAt: o.createdAt,
          completedAt: o.completedAt,
          panelUrl: channelUrl(o.panelChannelId),
        },
        statuses: STATUS_ORDER.map((s) => ({ status: s, label: ORDER_STATUSES[s].label })),
        tasks: o.tasks.map((t) => ({ id: t.id, content: t.content, done: t.done })),
        payments: o.payments.map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          note: p.note,
          paidAt: p.paidAt,
        })),
        invoices: o.invoices.map((i) => ({
          id: i.id,
          number: i.number,
          amount: Number(i.amount),
          status: i.status,
          dueDate: i.dueDate,
          issuedAt: i.issuedAt,
        })),
        history: await Promise.all(
          history.map(async (h) => ({
            from: h.from ? ORDER_STATUSES[h.from].label : null,
            to: ORDER_STATUSES[h.to].label,
            at: h.createdAt,
            by: (await who(client, h.changedBy)).name,
          })),
        ),
        ticket: ticket
          ? {
              id: ticket.id,
              status: ticket.status,
              url: channelUrl(ticket.channelId),
              transcriptUrl: ticket.transcriptUrl,
            }
          : null,
        review,
      };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post(`${base}/orders/:id/:action`, async (request, reply) => {
    try {
      const userId = await ownerCheck(request.params, reply);
      if (!userId) return;
      const { id: rawId, action } = request.params as { id: string; action: string };
      const id = Number(rawId);
      const body = (request.body ?? {}) as {
        status?: string;
        amount?: number;
        note?: string;
        doneIds?: number[];
      };
      if (action === 'status') {
        if (!STATUS_ORDER.includes(body.status as OrderStatus))
          return reply.code(400).send({ error: 'Nieznany status.' });
        await setOrderStatus(client, id, body.status as OrderStatus, userId);
      } else if (action === 'payment') {
        const amount = Math.round(Number(body.amount) * 100) / 100;
        if (!(amount > 0) || amount > 1_000_000)
          return reply.code(400).send({ error: 'Podaj kwotę większą od zera.' });
        await addPayment(client, id, amount, typeof body.note === 'string' ? body.note : null, userId);
      } else if (action === 'tasks') {
        if (!Array.isArray(body.doneIds) || body.doneIds.some((x) => !Number.isSafeInteger(x)))
          return reply.code(400).send({ error: 'Nieprawidłowa lista zadań.' });
        await getOrder(id);
        await setDoneTasks(client, id, body.doneIds);
      } else {
        return reply.code(404).send({ error: 'Nieznana akcja.' });
      }
      return { ok: true };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get(`${base}/clients`, async (request, reply) => {
    try {
      if (!(await ownerCheck(request.params, reply))) return;
      const [orders, profiles, tickets] = await Promise.all([
        prisma.order.findMany({ include: { payments: { select: { amount: true } } } }),
        prisma.clientProfile.findMany(),
        prisma.ticket.groupBy({ by: ['userId'], _count: true }),
      ]);
      const map = new Map<
        string,
        { orders: number; completed: number; active: number; paid: number; due: number; last: Date }
      >();
      for (const o of orders) {
        const t = totalsOf(o);
        const c = map.get(o.userId) ?? {
          orders: 0,
          completed: 0,
          active: 0,
          paid: 0,
          due: 0,
          last: o.createdAt,
        };
        c.orders++;
        if (o.status === 'COMPLETED') c.completed++;
        if (ACTIVE_ORDER_STATUSES.includes(o.status)) {
          c.active++;
          c.due += Math.max(0, t.due ?? 0);
        }
        c.paid += t.paid;
        if (o.updatedAt > c.last) c.last = o.updatedAt;
        map.set(o.userId, c);
      }
      for (const p of profiles)
        if (!map.has(p.userId))
          map.set(p.userId, { orders: 0, completed: 0, active: 0, paid: 0, due: 0, last: p.createdAt });
      const list = await Promise.all(
        [...map.entries()].map(async ([id, c]) => {
          const prof = profiles.find((p) => p.userId === id);
          return {
            ...(await person(client, id)),
            orders: c.orders,
            completed: c.completed,
            active: c.active,
            paid: round(c.paid),
            due: round(c.due),
            tickets: tickets.find((t) => t.userId === id)?._count ?? 0,
            badges: prof?.badges ?? [],
            note: prof?.note ?? null,
            lastActivity: c.last,
          };
        }),
      );
      list.sort((a, b) => b.paid - a.paid || +new Date(b.lastActivity) - +new Date(a.lastActivity));
      return { clients: list };
    } catch (err) {
      return sendError(reply, err);
    }
  });
}
