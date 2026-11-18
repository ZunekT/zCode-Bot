import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Invoice, Order } from '../generated/prisma/client.js';
import type { ZxClient } from '../client.js';
import { env } from '../config/env.js';
import { getConfig } from '../core/config-service.js';
import { prisma } from '../db/prisma.js';
import { ORDER_STATUSES, STATUS_ORDER } from '../modules/orders/constants.js';
import { renderInvoice } from '../modules/orders/invoice.js';
import { totalsOf } from '../modules/orders/panels.js';
import { sendError } from '../modules/sdk/routes.js';
import { formatOrderId } from '../utils/format.js';

const STEPS = STATUS_ORDER.filter((s) => ORDER_STATUSES[s].step > 0).map((s) => ({
  status: s,
  label: ORDER_STATUSES[s].short,
  step: ORDER_STATUSES[s].step,
}));

const channelUrl = (id: string | null) => (id ? `https://discord.com/channels/${env.GUILD_ID}/${id}` : null);

const userId = (params: unknown) => {
  const { userId } = params as { userId: string };
  if (!/^\d{17,20}$/.test(userId)) throw new Error('bad user');
  return userId;
};

export async function invoiceHtml(
  client: ZxClient,
  invoice: Invoice,
  order: Order & { payments: { amount: unknown }[] },
) {
  const config = await getConfig();
  const u = await client.users.fetch(order.userId).catch(() => null);
  const t = totalsOf(order as never);
  return renderInvoice(invoice, order, {
    clientName: u?.username ?? order.userId,
    paymentDetails: config.paymentDetails,
    totalPrice: t.total,
    paidBefore: Math.max(0, t.paid - Number(invoice.amount) * (invoice.status === 'PAID' ? 1 : 0)),
  });
}

export function clientOrderRoutes(app: FastifyInstance, client: ZxClient) {
  app.get('/internal/users/:userId/orders', async (request, reply: FastifyReply) => {
    try {
      const uid = userId(request.params);
      const orders = await prisma.order.findMany({
        where: { userId: uid },
        orderBy: { updatedAt: 'desc' },
        include: { payments: { select: { amount: true } }, tasks: { select: { done: true } } },
      });
      return {
        steps: STEPS,
        orders: orders.map((o) => ({
          id: o.id,
          number: formatOrderId(o.id),
          title: o.title,
          status: o.status,
          statusLabel: ORDER_STATUSES[o.status].label,
          step: ORDER_STATUSES[o.status].step,
          ...totalsOf(o),
          tasksDone: o.tasks.filter((t) => t.done).length,
          tasksTotal: o.tasks.length,
          deadline: o.deadline,
          createdAt: o.createdAt,
          updatedAt: o.updatedAt,
        })),
      };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get('/internal/users/:userId/orders/:id', async (request, reply: FastifyReply) => {
    try {
      const uid = userId(request.params);
      const id = Number((request.params as { id: string }).id);
      const o = Number.isSafeInteger(id)
        ? await prisma.order.findUnique({
            where: { id },
            include: {
              tasks: { orderBy: { position: 'asc' } },
              payments: { orderBy: { paidAt: 'asc' } },
              invoices: { orderBy: { issuedAt: 'asc' } },
              statusHistory: { orderBy: { createdAt: 'asc' } },
              ticket: { select: { id: true, channelId: true, status: true } },
            },
          })
        : null;
      if (!o || o.userId !== uid) return reply.code(404).send({ error: 'Nie znaleziono zlecenia.' });
      const t = totalsOf(o);
      const config = await getConfig();
      return {
        steps: STEPS,
        order: {
          id: o.id,
          number: formatOrderId(o.id),
          title: o.title,
          description: o.description,
          status: o.status,
          statusLabel: ORDER_STATUSES[o.status].label,
          statusText: ORDER_STATUSES[o.status].clientText,
          step: ORDER_STATUSES[o.status].step,
          ...t,
          discountCode: o.discountCode,
          deadline: o.deadline,
          createdAt: o.createdAt,
          completedAt: o.completedAt,
        },
        tasks: o.tasks.map((x) => ({ id: x.id, content: x.content, done: x.done })),
        payments: o.payments.map((p) => ({ id: p.id, amount: Number(p.amount), paidAt: p.paidAt })),
        invoices: o.invoices
          .filter((i) => i.status !== 'CANCELLED')
          .map((i) => ({
            id: i.id,
            number: i.number,
            amount: Number(i.amount),
            status: i.status,
            dueDate: i.dueDate,
            issuedAt: i.issuedAt,
          })),
        history: o.statusHistory.map((h) => ({ to: ORDER_STATUSES[h.to].label, at: h.createdAt })),
        ticketUrl:
          o.ticket?.status !== 'CLOSED' && o.ticket?.status !== 'ARCHIVED'
            ? channelUrl(o.ticket?.channelId ?? null)
            : null,
        payment:
          (t.due ?? 0) > 0
            ? { details: config.paymentDetails, title: `${formatOrderId(o.id)} ${o.title}`.slice(0, 80) }
            : null,
      };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get('/internal/users/:userId/orders/:id/invoices/:invoiceId', async (request, reply: FastifyReply) => {
    try {
      const uid = userId(request.params);
      const { id, invoiceId } = request.params as { id: string; invoiceId: string };
      const invoice = await prisma.invoice.findUnique({
        where: { id: Number(invoiceId) },
        include: { order: { include: { payments: { select: { amount: true } } } } },
      });
      if (!invoice || invoice.orderId !== Number(id) || invoice.order.userId !== uid) {
        return reply.code(404).send({ error: 'Nie znaleziono.' });
      }
      const html = await invoiceHtml(client, invoice, invoice.order);
      return reply.header('content-type', 'text/html; charset=utf-8').send(html);
    } catch (err) {
      return sendError(reply, err);
    }
  });
}
