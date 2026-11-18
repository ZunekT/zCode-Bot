import { AttachmentBuilder, FileBuilder, type SendableChannels } from 'discord.js';
import type { Order, OrderStatus, Prisma } from '../../generated/prisma/client.js';
import type { ZxClient } from '../../client.js';
import { prisma } from '../../db/prisma.js';
import { getSendableChannel } from '../../core/channels.js';
import { getConfig } from '../../core/config-service.js';
import { UserError } from '../../core/errors.js';
import type { Panel } from '../../ui/builders/container.js';
import { v2Message } from '../../ui/builders/payload.js';
import { card, change } from '../../ui/components/card.js';
import { cents, discordTime, formatMoney, formatOrderId, padNumber } from '../../utils/format.js';
import { withLock } from '../../utils/locks.js';
import { createLogger } from '../../utils/logger.js';
import { syncClientRoles } from '../clients/service.js';
import { discountLabel, discountValue, findValidDiscount } from '../pricing/discounts.js';
import { requestReview } from '../reviews/service.js';
import { ORDER_STATUSES } from './constants.js';
import { invoiceFileName, renderInvoice } from './invoice.js';
import { financeTable, orderPanel, statusChangeCard, totalsOf, type FullOrder } from './panels.js';

const log = createLogger('orders');

const include = {
  tasks: { orderBy: { position: 'asc' } },
  payments: { orderBy: { paidAt: 'asc' } },
  invoices: { orderBy: { issuedAt: 'asc' } },
} as const satisfies Prisma.OrderInclude;

export async function getOrder(id: number): Promise<FullOrder> {
  const order = Number.isSafeInteger(id) ? await prisma.order.findUnique({ where: { id }, include }) : null;
  if (!order) throw new UserError(`Nie ma zlecenia ${Number.isSafeInteger(id) ? formatOrderId(id) : ''}.`);
  return order;
}

async function locked<T>(id: number, fn: () => Promise<T>): Promise<T> {
  const r = await withLock(`order:${id}`, fn, 30);
  if (r === null) throw new UserError('To zlecenie jest właśnie zmieniane – spróbuj za chwilę.');
  return r;
}

const avatarOf = async (client: ZxClient, userId: string) =>
  (await client.users.fetch(userId).catch(() => null))?.displayAvatarURL({ size: 128 }) ??
  'https://cdn.discordapp.com/embed/avatars/0.png';

export async function orderPanelPayload(client: ZxClient, order: FullOrder) {
  return v2Message(orderPanel(order, await avatarOf(client, order.userId)));
}

export async function refreshOrderPanel(client: ZxClient, id: number): Promise<void> {
  const order = await getOrder(id);
  if (!order.panelChannelId || !order.panelMessageId) return;
  try {
    const channel = await getSendableChannel(client, order.panelChannelId);
    if (!channel || !('messages' in channel)) return;
    const msg = await channel.messages.fetch(order.panelMessageId);
    await msg.edit(await orderPanelPayload(client, order));
  } catch (err) {
    log.debug(`Nie udało się odświeżyć panelu ${formatOrderId(id)}`, err);
  }
}

export async function postOrderPanel(client: ZxClient, id: number, channel: SendableChannels): Promise<void> {
  const order = await getOrder(id);
  const msg = await channel.send({
    ...(await orderPanelPayload(client, order)),
    allowedMentions: { users: [order.userId] },
  });
  await msg.pin().catch(() => undefined);
  await prisma.order.update({
    where: { id },
    data: { panelChannelId: msg.channelId, panelMessageId: msg.id },
  });
}

export async function notifyClient(
  client: ZxClient,
  userId: string,
  panel: Panel,
  files?: AttachmentBuilder[],
) {
  try {
    const user = await client.users.fetch(userId);
    await user.send(v2Message(panel, { files }));
  } catch {
    log.debug(`DM do ${userId} niedostępny`);
  }
}

async function panelChannelNotice(
  client: ZxClient,
  order: Order,
  panel: Panel,
  files?: AttachmentBuilder[],
  ping = false,
) {
  const channel = await getSendableChannel(client, order.panelChannelId);
  await channel
    ?.send({ ...v2Message(panel, { files }), allowedMentions: { users: ping ? [order.userId] : [] } })
    .catch(() => undefined);
}

async function orderLog(client: ZxClient, panel: Panel) {
  const config = await getConfig();
  const channel = await getSendableChannel(client, config.logChannelId);
  await channel?.send(v2Message(panel)).catch(() => undefined);
}

export interface CreateOrderInput {
  userId: string;
  title: string;
  description?: string | null;
  price?: number | null;
  deadline?: Date | null;
  repoUrl?: string | null;
  ticketId?: number | null;
  actorId: string;
}

export async function createOrder(
  client: ZxClient,
  input: CreateOrderInput,
  panelChannel?: SendableChannels | null,
): Promise<FullOrder> {
  if (input.ticketId) {
    const ticket = await prisma.ticket.findUnique({ where: { id: input.ticketId } });
    if (ticket?.orderId) throw new UserError(`Ten ticket ma już zlecenie ${formatOrderId(ticket.orderId)}.`);
  }
  const order = await prisma.order.create({
    data: {
      userId: input.userId,
      title: input.title.slice(0, 120),
      description: input.description?.slice(0, 2000) || null,
      price: input.price ?? null,
      deadline: input.deadline ?? null,
      repoUrl: input.repoUrl || null,
      statusHistory: { create: { from: null, to: 'QUOTE', changedBy: input.actorId } },
      ...(input.ticketId && { ticket: { connect: { id: input.ticketId } } }),
    },
  });
  if (panelChannel) await postOrderPanel(client, order.id, panelChannel);

  const full = await getOrder(order.id);
  const t = totalsOf(full);
  await notifyClient(
    client,
    order.userId,
    card({
      tone: 'brand',
      emoji: 'package',
      title: `Utworzyliśmy Twoje zlecenie ${formatOrderId(order.id)}`,
      description: `**${order.title}**\nOd teraz o każdej zmianie statusu dowiesz się tutaj. Szczegóły zawsze sprawdzisz komendą \`/zlecenie info\`.`,
      fields: [
        {
          emoji: 'coins',
          label: 'Wycena',
          value: t.total !== null ? formatMoney(t.total) : 'w przygotowaniu',
        },
        {
          emoji: 'calendar',
          label: 'Termin',
          value: order.deadline ? discordTime(order.deadline, 'D') : null,
        },
      ],
    }),
  );
  await orderLog(
    client,
    card({
      tone: 'success',
      emoji: 'package',
      title: `Nowe zlecenie ${formatOrderId(order.id)}`,
      fields: [
        { emoji: 'user', label: 'Klient', value: `<@${order.userId}>` },
        { emoji: 'documentation', label: 'Tytuł', value: order.title },
        { emoji: 'coins', label: 'Cena', value: t.total !== null ? formatMoney(t.total) : null },
        { emoji: 'user_crown', label: 'Utworzył(a)', value: `<@${input.actorId}>` },
        { emoji: 'ticket', label: 'Ticket', value: input.ticketId ? `#${padNumber(input.ticketId)}` : null },
      ],
    }),
  );
  return full;
}

export async function setOrderStatus(
  client: ZxClient,
  id: number,
  to: OrderStatus,
  actorId: string,
): Promise<FullOrder> {
  const { from, order } = await locked(id, async () => {
    const current = await getOrder(id);
    if (current.status === to) throw new UserError(`Zlecenie ma już status **${ORDER_STATUSES[to].label}**.`);
    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: to,
        completedAt: to === 'COMPLETED' ? new Date() : current.completedAt,
        statusHistory: { create: { from: current.status, to, changedBy: actorId } },
      },
    });
    return { from: current.status, order: updated };
  });

  const actorAvatar = await avatarOf(client, actorId);
  await panelChannelNotice(client, order, statusChangeCard(order, from, actorAvatar), undefined, true);
  await notifyClient(client, order.userId, statusChangeCard(order, from, undefined, true));
  await refreshOrderPanel(client, id);
  await orderLog(
    client,
    card({
      tone: ORDER_STATUSES[to].tone,
      emoji: ORDER_STATUSES[to].emoji,
      title: `${formatOrderId(id)} • zmiana statusu`,
      fields: [
        {
          emoji: 'checklist',
          label: 'Status',
          value: change(ORDER_STATUSES[from].label, ORDER_STATUSES[to].label),
        },
        { emoji: 'user', label: 'Klient', value: `<@${order.userId}>` },
        { emoji: 'user_crown', label: 'Zmienił(a)', value: `<@${actorId}>` },
      ],
    }),
  );

  if (to === 'COMPLETED') {
    const granted = await syncClientRoles(client, order.userId);
    if (granted.length) {
      await notifyClient(
        client,
        order.userId,
        card({
          tone: 'client',
          emoji: 'client_crown',
          title: 'Nowa ranga na serwerze!',
          description: `Dziękujemy za zaufanie – otrzymujesz: ${granted.map((r) => `<@&${r}>`).join(' ')}`,
          timestamp: false,
        }),
      );
    }
    await requestReview(client, order);
  }
  return getOrder(id);
}

export interface OrderEdit {
  title?: string;
  description?: string | null;
  price?: number | null;
  deadline?: Date | null;
  repoUrl?: string | null;
}

export async function editOrder(
  client: ZxClient,
  id: number,
  data: OrderEdit,
  actorId: string,
): Promise<void> {
  await locked(id, async () => {
    const before = await getOrder(id);
    const after = await prisma.order.update({ where: { id }, data });
    if (data.price !== undefined && before.discountCode) {
      const dc = await prisma.discountCode.findUnique({ where: { code: before.discountCode } });
      if (dc && after.price !== null) {
        await prisma.order.update({
          where: { id },
          data: { discountAmount: discountValue(dc, Number(after.price)) },
        });
      }
    }
    const changes = [
      data.price !== undefined && Number(before.price ?? -1) !== Number(after.price ?? -1)
        ? {
            emoji: 'coins' as const,
            label: 'Cena',
            value: change(
              before.price === null ? '—' : formatMoney(Number(before.price)),
              after.price === null ? '—' : formatMoney(Number(after.price)),
            ),
          }
        : null,
      data.deadline !== undefined && before.deadline?.getTime() !== after.deadline?.getTime()
        ? {
            emoji: 'calendar' as const,
            label: 'Termin',
            value: after.deadline ? discordTime(after.deadline, 'D') : 'usunięty',
          }
        : null,
    ].filter((x): x is NonNullable<typeof x> => !!x);

    if (changes.length) {
      const panel = card({
        tone: 'info',
        emoji: 'code_file',
        title: `${formatOrderId(id)} • zmiana warunków`,
        fields: changes,
      });
      await panelChannelNotice(client, after, panel, undefined, true);
      await notifyClient(client, after.userId, panel);
    }
    await orderLog(
      client,
      card({
        tone: 'info',
        emoji: 'code_file',
        title: `${formatOrderId(id)} • edycja`,
        fields: [{ emoji: 'user_crown', label: 'Edytował(a)', value: `<@${actorId}>` }, ...changes],
      }),
    );
  });
  await refreshOrderPanel(client, id);
}

export async function addTasks(client: ZxClient, id: number, lines: string[]): Promise<number> {
  const items = lines
    .map((l) => l.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 25);
  if (!items.length) throw new UserError('Podaj przynajmniej jedno zadanie.');
  await locked(id, async () => {
    const max = await prisma.orderTask.aggregate({ where: { orderId: id }, _max: { position: true } });
    const start = (max._max.position ?? 0) + 1;
    await prisma.orderTask.createMany({
      data: items.map((content, i) => ({ orderId: id, content: content.slice(0, 200), position: start + i })),
    });
  });
  await refreshOrderPanel(client, id);
  return items.length;
}

export async function setDoneTasks(client: ZxClient, id: number, doneIds: number[]): Promise<void> {
  await locked(id, async () => {
    await prisma.$transaction([
      prisma.orderTask.updateMany({ where: { orderId: id, id: { in: doneIds } }, data: { done: true } }),
      prisma.orderTask.updateMany({ where: { orderId: id, id: { notIn: doneIds } }, data: { done: false } }),
    ]);
  });
  await refreshOrderPanel(client, id);
}

export async function addPayment(
  client: ZxClient,
  id: number,
  amount: number,
  note: string | null,
  actorId: string,
) {
  if (!(amount > 0)) throw new UserError('Kwota musi być większa od zera.');
  const { order, totals } = await locked(id, async () => {
    await prisma.payment.create({
      data: { orderId: id, amount, note: note?.slice(0, 200) || null, recordedBy: actorId },
    });
    const o = await getOrder(id);
    const t = totalsOf(o);
    if (t.due !== null && t.due <= 0) {
      await prisma.invoice.updateMany({
        where: { orderId: id, status: { in: ['ISSUED', 'OVERDUE'] } },
        data: { status: 'PAID' },
      });
    }
    return { order: o, totals: t };
  });

  const panel = card({
    tone: 'success',
    emoji: 'money',
    title: `Zaksięgowano wpłatę • ${formatOrderId(id)}`,
    description:
      totals.due !== null && totals.due <= 0 ? '**Zlecenie w pełni opłacone.** Dziękujemy!' : undefined,
    fields: [
      { label: 'Kwota wpłaty', value: `**${formatMoney(amount, order.currency)}**` },
      { label: 'Notatka', value: note },
    ],
    body: financeTable(order),
  });
  await panelChannelNotice(client, order, panel, undefined, true);
  await notifyClient(client, order.userId, panel);
  await orderLog(
    client,
    card({
      tone: 'success',
      emoji: 'money',
      title: `Wpłata ${formatMoney(amount)} • ${formatOrderId(id)}`,
      fields: [
        { emoji: 'user', label: 'Klient', value: `<@${order.userId}>` },
        { emoji: 'user_crown', label: 'Zapisał(a)', value: `<@${actorId}>` },
      ],
    }),
  );

  if (totals.due !== null && totals.due <= 0 && order.status === 'AWAITING_PAYMENT') {
    await setOrderStatus(client, id, 'IN_PROGRESS', actorId);
  } else {
    await refreshOrderPanel(client, id);
  }
  return totals;
}

async function nextInvoiceNumber(now: Date): Promise<string> {
  const prefix = `PF/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/`;
  const last = await prisma.invoice.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: 'desc' },
  });
  const n = last ? Number(last.number.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(n).padStart(4, '0')}`;
}

export async function issueInvoice(
  client: ZxClient,
  id: number,
  amountInput: number | null,
  days: number,
  actorId: string,
) {
  const config = await getConfig();
  const result = await withLock(
    'invoice:number',
    async () => {
      const order = await getOrder(id);
      const t = totalsOf(order);
      const amount = amountInput ?? t.due;
      if (amount === null)
        throw new UserError('Zlecenie nie ma ceny – ustaw ją w „Edytuj szczegóły” albo podaj kwotę.');
      if (!(amount > 0)) throw new UserError('Nie ma nic do zapłaty.');
      const now = new Date();
      const invoice = await prisma.invoice.create({
        data: {
          number: await nextInvoiceNumber(now),
          orderId: id,
          amount: cents(amount),
          currency: order.currency,
          dueDate: new Date(now.getTime() + days * 86_400_000),
        },
      });
      return { order, invoice, totals: t };
    },
    30,
  );
  if (!result) throw new UserError('Inna proforma jest właśnie wystawiana – spróbuj za chwilę.');
  const { order, invoice, totals } = result;

  const client_ = await client.users.fetch(order.userId).catch(() => null);
  const html = renderInvoice(invoice, order, {
    clientName: client_?.username ?? order.userId,
    paymentDetails: config.paymentDetails,
    totalPrice: totals.total,
    paidBefore: totals.paid,
  });
  const name = invoiceFileName(invoice);
  const panel = () => {
    const p = card({
      tone: 'warning',
      emoji: 'invoice',
      title: `Faktura proforma ${invoice.number}`,
      description: `Zlecenie **${formatOrderId(id)}** – ${order.title}`,
      fields: [
        {
          emoji: 'coins',
          label: 'Do zapłaty',
          value: `**${formatMoney(Number(invoice.amount), invoice.currency)}**`,
        },
        {
          emoji: 'calendar',
          label: 'Termin płatności',
          value: `${discordTime(invoice.dueDate, 'D')} (${discordTime(invoice.dueDate, 'R')})`,
        },
        {
          emoji: 'documentation',
          label: 'Tytuł przelewu',
          value: `\`${formatOrderId(id)} ${invoice.number}\``,
        },
      ],
      body: config.paymentDetails
        ? `**Dane do przelewu:**\n\`\`\`\n${config.paymentDetails}\n\`\`\``
        : '-# Dane do przelewu przekaże obsługa.',
      footer: 'Otwórz plik w przeglądarce, aby wydrukować lub zapisać jako PDF',
    });
    p.container.addFileComponents(new FileBuilder().setURL(`attachment://${name}`));
    return p;
  };
  const file = () => [new AttachmentBuilder(html, { name })];

  await panelChannelNotice(client, order, panel(), file(), true);
  await notifyClient(client, order.userId, panel(), file());
  await orderLog(
    client,
    card({
      tone: 'warning',
      emoji: 'invoice',
      title: `Proforma ${invoice.number} • ${formatOrderId(id)}`,
      fields: [
        { emoji: 'coins', label: 'Kwota', value: formatMoney(Number(invoice.amount)) },
        { emoji: 'user_crown', label: 'Wystawił(a)', value: `<@${actorId}>` },
      ],
    }),
  );

  if (order.status === 'QUOTE' || order.status === 'ACCEPTED')
    await setOrderStatus(client, id, 'AWAITING_PAYMENT', actorId);
  else await refreshOrderPanel(client, id);
  return invoice;
}

export async function applyDiscountToOrder(client: ZxClient, id: number, code: string, actorId: string) {
  const order = await getOrder(id);
  if (order.discountCode) throw new UserError(`Zlecenie ma już kod \`${order.discountCode}\`.`);
  if (order.price === null) throw new UserError('Najpierw ustaw cenę zlecenia.');
  const dc = await findValidDiscount(code);
  const value = discountValue(dc, Number(order.price));

  const { count } = await prisma.discountCode.updateMany({
    where: { code: dc.code, OR: [{ maxUses: null }, { uses: { lt: dc.maxUses ?? 0 } }] },
    data: { uses: { increment: 1 } },
  });
  if (count === 0) throw new UserError(`Kod \`${dc.code}\` został już wykorzystany.`);
  await prisma.order.update({ where: { id }, data: { discountCode: dc.code, discountAmount: value } });

  const panel = card({
    tone: 'client',
    emoji: 'gift',
    title: `Rabat ${discountLabel(dc)} • ${formatOrderId(id)}`,
    fields: [
      { emoji: 'gift', label: 'Kod', value: `\`${dc.code}\`` },
      {
        emoji: 'coins',
        label: 'Nowa cena',
        value: change(formatMoney(Number(order.price)), formatMoney(cents(Number(order.price) - value))),
      },
    ],
  });
  await panelChannelNotice(client, order, panel, undefined, true);
  await notifyClient(client, order.userId, panel);
  await orderLog(
    client,
    card({
      tone: 'client',
      emoji: 'gift',
      title: `Rabat \`${dc.code}\` • ${formatOrderId(id)}`,
      fields: [{ emoji: 'user_crown', label: 'Zastosował(a)', value: `<@${actorId}>` }],
    }),
  );
  await refreshOrderPanel(client, id);
  return value;
}
