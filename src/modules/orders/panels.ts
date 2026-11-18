import { StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import type { Invoice, Order, OrderStatus, OrderTask, Payment } from '../../generated/prisma/client.js';
import { Colors } from '../../config/constants.js';
import { Panel } from '../../ui/builders/container.js';
import { button } from '../../ui/builders/buttons.js';
import { card, change, codeBlock, diffBlock, tableBlock, type DiffSign } from '../../ui/components/card.js';
import { e, emojiComponent } from '../../ui/emojis.js';
import { discordTime, formatMoney, formatOrderId, progressBar, truncate } from '../../utils/format.js';
import { ORDER_ACTIONS, ORDER_STATUSES, STATUS_ORDER, type OrderAction } from './constants.js';

export type FullOrder = Order & { tasks: OrderTask[]; payments: Payment[]; invoices: Invoice[] };

export interface Totals {
  price: number | null;
  discount: number;
  total: number | null;
  paid: number;
  due: number | null;
}

export function totalsOf(
  order: Pick<Order, 'price' | 'discountAmount'> & { payments: Pick<Payment, 'amount'>[] },
): Totals {
  const price = order.price === null ? null : Number(order.price);
  const discount = order.discountAmount === null ? 0 : Number(order.discountAmount);
  const total = price === null ? null : Math.max(0, Math.round((price - discount) * 100) / 100);
  const paid = Math.round(order.payments.reduce((s, p) => s + Number(p.amount), 0) * 100) / 100;
  return {
    price,
    discount,
    total,
    paid,
    due: total === null ? null : Math.round((total - paid) * 100) / 100,
  };
}

const statusText = (s: OrderStatus) => ORDER_STATUSES[s].label;
const plainMoney = (v: number | null, currency = 'PLN') =>
  v === null ? 'do wyceny' : formatMoney(v, currency);

/**
 * Postęp zlecenia:
 *   **Etap 4/7 · W realizacji**
 *   ▰▰▰▰▰▰▰▰▱▱▱▱▱▱ 57%
 *   -# Wycena › Akceptacja › Płatność › **Realizacja** › Testy › Dostarczone › Koniec
 */
export function timeline(status: OrderStatus): string {
  if (status === 'CANCELLED') return '**Zlecenie anulowane**';
  const current = ORDER_STATUSES[status].step;
  const steps = STATUS_ORDER.filter((s) => ORDER_STATUSES[s].step > 0).map((s) =>
    ORDER_STATUSES[s].step === current ? `**${ORDER_STATUSES[s].short}**` : ORDER_STATUSES[s].short,
  );
  return `**Etap ${current}/7 · ${ORDER_STATUSES[status].label}**\n${progressBar(current, 7, 14)}\n-# ${steps.join(' › ')}`;
}

/** Rozliczenie jako wyrównana tabelka. */
export function financeTable(order: Order & { payments: Pick<Payment, 'amount'>[] }): string {
  const t = totalsOf(order);
  const c = order.currency;
  if (t.price === null) return codeBlock('Cena          do wyceny');
  const rows: [string, string][] = [['Cena', formatMoney(t.price, c)]];
  if (t.discount)
    rows.push(
      [`Rabat ${order.discountCode ?? ''}`.trim(), `-${formatMoney(t.discount, c)}`],
      ['Po rabacie', formatMoney(t.total ?? 0, c)],
    );
  rows.push(
    ['Wpłacono', formatMoney(t.paid, c)],
    ['Do zapłaty', t.due !== null && t.due > 0 ? formatMoney(t.due, c) : 'opłacone'],
  );
  return tableBlock(rows, { separatorBefore: [rows.length - 1] });
}

/** Checklista: zrobione na zielono (+ [x]), reszta zwykłym tekstem ([ ]). */
export function tasksBlock(tasks: Pick<OrderTask, 'done' | 'content'>[]): string {
  return diffBlock(
    tasks.map((x) => [x.done ? '+' : ' ', `[${x.done ? 'x' : ' '}] ${x.content}`] as [DiffSign, string]),
  );
}

const INVOICE_STATUS = {
  ISSUED: 'czeka',
  PAID: 'opłacona',
  OVERDUE: 'po terminie',
  CANCELLED: 'anulowana',
} as const;

export function actionSelect(order: Order): StringSelectMenuBuilder {
  return new StringSelectMenuBuilder()
    .setCustomId(`order:action:${order.id}`)
    .setPlaceholder('Zarządzaj zleceniem… (obsługa)')
    .addOptions(
      (Object.keys(ORDER_ACTIONS) as OrderAction[]).map((a) =>
        new StringSelectMenuOptionBuilder()
          .setValue(a)
          .setLabel(ORDER_ACTIONS[a].label)
          .setDescription(ORDER_ACTIONS[a].description)
          .setEmoji(emojiComponent(ORDER_ACTIONS[a].emoji)),
      ),
    );
}

/** Główny panel zlecenia. */
export function orderPanel(order: FullOrder, avatarUrl: string, interactive = true): Panel {
  const t = totalsOf(order);
  const done = order.tasks.filter((x) => x.done).length;
  const accent =
    order.status === 'CANCELLED'
      ? Colors.error
      : order.status === 'COMPLETED'
        ? Colors.success
        : Colors.brand;

  const panel = new Panel({ accent })
    .sectionWithThumbnail(
      `## ${e('package')} Zlecenie ${formatOrderId(order.id)}\n**${order.title}**\nKlient: <@${order.userId}>`,
      avatarUrl,
    )
    .separator()
    .text(timeline(order.status))
    .separator()
    .text(
      `### Rozliczenie\n${financeTable(order)}` +
        [
          `**Termin:** ${order.deadline ? `${discordTime(order.deadline, 'D')} · ${discordTime(order.deadline, 'R')}` : 'do ustalenia'}`,
          ...(order.repoUrl ? [`**Repozytorium:** ${order.repoUrl}`] : []),
          ...(order.invoices.length
            ? [
                `**Proformy:** ${order.invoices.map((i) => `\`${i.number}\` ${INVOICE_STATUS[i.status]}`).join(' · ')}`,
              ]
            : []),
        ].join('\n'),
    );

  if (order.tasks.length) {
    // Bez nagłówka liczba pozycji mogłaby rozsadzić limit tekstu – przycinamy listę, nie blok.
    const shown = order.tasks.slice(0, 25);
    panel
      .separator()
      .text(
        `### Zadania · ${done}/${order.tasks.length}\n${progressBar(done, order.tasks.length, 10)}\n` +
          tasksBlock(shown.map((x) => ({ ...x, content: truncate(x.content, 60) }))),
      );
  }
  if (order.description) panel.separator().text(`### Zakres prac\n>>> ${truncate(order.description, 800)}`);

  if (!interactive) return panel.footer('Podgląd • panel z akcjami znajdziesz w tickecie zlecenia');
  panel.separator();
  if (order.status === 'QUOTE' && order.price !== null) {
    panel.buttons(
      button(`order:accept:${order.id}`, `Akceptuję wycenę (${plainMoney(t.total, order.currency)})`, {
        style: 'success',
        emoji: 'verified',
      }),
    );
  }
  return panel
    .select(actionSelect(order))
    .footer('Każdą zmianę statusu dostaniesz też w wiadomości prywatnej');
}

/** Karta zmiany statusu (kanał + DM). */
export function statusChangeCard(
  order: Order,
  from: OrderStatus | null,
  actorAvatar?: string,
  forClient = false,
) {
  const to = ORDER_STATUSES[order.status];
  return card({
    tone: to.tone,
    emoji: to.emoji,
    title: `${formatOrderId(order.id)} • ${to.label}`,
    description: `${forClient ? `**${order.title}**\n` : ''}${to.clientText}`,
    thumbnail: actorAvatar,
    fields: [
      {
        emoji: 'checklist',
        label: 'Status',
        value: from ? change(statusText(from), statusText(order.status)) : statusText(order.status),
      },
    ],
    body: order.status !== 'CANCELLED' ? timeline(order.status) : undefined,
    footer: forClient ? 'Szczegóły: /zlecenie info' : undefined,
  });
}

export function orderListLines(orders: (Order & { payments: Payment[] })[]): string {
  return orders
    .map((o) => {
      const t = totalsOf(o);
      return `**${formatOrderId(o.id)}** \`${ORDER_STATUSES[o.status].label}\` ${truncate(o.title, 50)}\n-# <@${o.userId}> · ${plainMoney(t.total, o.currency)}${t.due && t.due > 0 && o.status !== 'CANCELLED' ? ` · do zapłaty ${formatMoney(t.due, o.currency)}` : ''}`;
    })
    .join('\n');
}
