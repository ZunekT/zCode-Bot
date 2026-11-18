import { StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import type { Invoice, Order, OrderStatus, OrderTask, Payment } from '../../generated/prisma/client.js';
import { Colors } from '../../config/constants.js';
import { Panel } from '../../ui/builders/container.js';
import { button } from '../../ui/builders/buttons.js';
import { card, change } from '../../ui/components/card.js';
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

const money = (v: number | null, currency = 'PLN') => (v === null ? '_do wyceny_' : formatMoney(v, currency));
const statusText = (s: OrderStatus) => `${ORDER_STATUSES[s].icon} ${ORDER_STATUSES[s].label}`;

/** Oś postępu: ✅ Wycena › ✅ Akceptacja › ▶ **Płatność** › ▫ Realizacja … */
export function timeline(status: OrderStatus): string {
  if (status === 'CANCELLED') return `${ORDER_STATUSES.CANCELLED.icon} **Zlecenie anulowane**`;
  const current = ORDER_STATUSES[status].step;
  const steps = STATUS_ORDER.filter((s) => ORDER_STATUSES[s].step > 0).map((s) => {
    const def = ORDER_STATUSES[s];
    if (def.step < current || status === 'COMPLETED') return `✅ ${def.short}`;
    if (def.step === current) return `▶️ **${def.short}**`;
    return `▫️ ${def.short}`;
  });
  return `${steps.join(' › ')}\n${progressBar(current, 7, 14)}`;
}

export function actionSelect(order: Order): StringSelectMenuBuilder {
  return new StringSelectMenuBuilder()
    .setCustomId(`order:action:${order.id}`)
    .setPlaceholder('⚙️ Zarządzaj zleceniem… (obsługa)')
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
  const def = ORDER_STATUSES[order.status];
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
    .text(`${e(def.emoji)} **Status:** ${statusText(order.status)}\n${timeline(order.status)}`)
    .separator()
    .text(
      [
        `${e('coins')} **Cena:** ${money(t.price, order.currency)}${t.discount ? ` – rabat \`${order.discountCode}\` (−${formatMoney(t.discount, order.currency)}) = **${money(t.total, order.currency)}**` : ''}`,
        `${e('money')} **Wpłacono:** ${formatMoney(t.paid, order.currency)}${t.due !== null ? ` • **Do zapłaty:** ${t.due > 0 ? formatMoney(t.due, order.currency) : '✅ opłacone'}` : ''}`,
        `${e('calendar')} **Termin:** ${order.deadline ? `${discordTime(order.deadline, 'D')} (${discordTime(order.deadline, 'R')})` : '_do ustalenia_'}`,
        ...(order.repoUrl ? [`${e('git_branch')} **Repozytorium:** ${order.repoUrl}`] : []),
        ...(order.invoices.length
          ? [
              `${e('invoice')} **Proformy:** ${order.invoices.map((i) => `\`${i.number}\` ${i.status === 'PAID' ? '✅' : i.status === 'OVERDUE' ? '⚠️' : '⏳'}`).join(', ')}`,
            ]
          : []),
      ].join('\n'),
    );

  if (order.tasks.length) {
    panel
      .separator()
      .text(
        `### ${e('checklist')} Zadania (${done}/${order.tasks.length})\n${progressBar(done, order.tasks.length, 10)}\n` +
          truncate(
            order.tasks
              .map((x) => `${x.done ? '✅' : '▫️'} ${x.done ? `~~${x.content}~~` : x.content}`)
              .join('\n'),
            1500,
          ),
      );
  }
  if (order.description)
    panel.separator().text(`### ${e('documentation')} Opis\n>>> ${truncate(order.description, 800)}`);

  if (!interactive) return panel.footer('Podgląd • panel z akcjami znajdziesz w tickecie zlecenia');
  panel.separator();
  if (order.status === 'QUOTE' && order.price !== null) {
    panel.buttons(
      button(`order:accept:${order.id}`, `Akceptuję wycenę (${money(t.total, order.currency)})`, {
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
      return `${ORDER_STATUSES[o.status].icon} **${formatOrderId(o.id)}** ${truncate(o.title, 50)} • <@${o.userId}> • ${money(t.total, o.currency)}${t.due && t.due > 0 && o.status !== 'CANCELLED' ? ` (do zapłaty ${formatMoney(t.due, o.currency)})` : ''}`;
    })
    .join('\n');
}
