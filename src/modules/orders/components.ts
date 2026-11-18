import { StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import type { OrderStatus } from '../../generated/prisma/client.js';
import { prisma } from '../../db/prisma.js';
import { UserError } from '../../core/errors.js';
import { defineComponent, type ComponentHandler } from '../../core/types.js';
import { v2, v2Message } from '../../ui/builders/payload.js';
import { card } from '../../ui/components/card.js';
import { emojiComponent } from '../../ui/emojis.js';
import { formatMoney, formatOrderId, truncate } from '../../utils/format.js';
import { ORDER_ACTIONS, ORDER_STATUSES, STATUS_ORDER, type OrderAction } from './constants.js';
import {
  discountModal,
  invoiceModal,
  orderEditModal,
  paymentModal,
  readDeadline,
  readPrice,
  readUrl,
  tasksModal,
} from './forms.js';
import { totalsOf } from './panels.js';
import {
  addPayment,
  addTasks,
  applyDiscountToOrder,
  createOrder,
  editOrder,
  getOrder,
  issueInvoice,
  refreshOrderPanel,
  setDoneTasks,
  setOrderStatus,
} from './service.js';

const orderId = (args: string[]) => {
  const id = Number(args[0]);
  if (!Number.isSafeInteger(id) || id <= 0) throw new UserError('Nieprawidłowe zlecenie.');
  return id;
};

const done = (title: string, description?: string) =>
  v2Message(card({ tone: 'success', title, description, timestamp: false }));

export const orderComponents: ComponentHandler[] = [
  // ── Utworzenie z ticketu ──
  defineComponent({
    id: 'order:create',
    type: 'modal',
    access: 'staff',
    async run(interaction, args, { client }) {
      const ticket = await prisma.ticket.findUnique({ where: { id: Number(args[0]) } });
      if (!ticket) throw new UserError('Ticket nie istnieje.');
      const f = interaction.fields;
      const price = readPrice(f.getTextInputValue('price'));
      const deadline = readDeadline(f.getTextInputValue('deadline'));
      if (!interaction.channel?.isSendable()) throw new UserError('Nie mogę pisać na tym kanale.');

      await interaction.deferReply({ flags: ['Ephemeral'] });
      const order = await createOrder(
        client,
        {
          userId: ticket.userId,
          title: f.getTextInputValue('title').trim(),
          description: f.getTextInputValue('description').trim() || null,
          price,
          deadline,
          ticketId: ticket.id,
          actorId: interaction.user.id,
        },
        interaction.channel,
      );
      await interaction.editReply(
        done(
          `Utworzono zlecenie ${formatOrderId(order.id)}`,
          'Panel zlecenia jest przypięty w tym kanale. Klient dostał powiadomienie w DM.',
        ),
      );
    },
  }),

  // ── Menu panelu zlecenia ──
  defineComponent({
    id: 'order:action',
    type: 'select',
    access: 'staff',
    async run(interaction, args, { client }) {
      const id = orderId(args);
      const action = interaction.values[0] as OrderAction | undefined;
      try {
        if (!action || !(action in ORDER_ACTIONS)) throw new UserError('Nieznana akcja.');
        const order = await getOrder(id);
        const t = totalsOf(order);
        switch (action) {
          case 'status': {
            const menu = new StringSelectMenuBuilder()
              .setCustomId(`order:setStatus:${id}`)
              .setPlaceholder('Wybierz nowy status…')
              .addOptions(
                STATUS_ORDER.map((s) =>
                  new StringSelectMenuOptionBuilder()
                    .setValue(s)
                    .setLabel(ORDER_STATUSES[s].label)
                    .setDescription(truncate(ORDER_STATUSES[s].clientText, 100))
                    .setEmoji(emojiComponent(ORDER_STATUSES[s].emoji))
                    .setDefault(s === order.status),
                ),
              );
            return await interaction.reply(
              v2(
                card({
                  tone: 'info',
                  emoji: 'checklist',
                  title: `Status ${formatOrderId(id)}`,
                  timestamp: false,
                }).select(menu),
                { ephemeral: true },
              ),
            );
          }
          case 'task_toggle': {
            if (!order.tasks.length)
              throw new UserError('To zlecenie nie ma zadań. Dodaj je przez „Dodaj zadania”.');
            const menu = new StringSelectMenuBuilder()
              .setCustomId(`order:tasks:${id}`)
              .setPlaceholder('Zaznacz zrobione zadania…')
              .setMinValues(0)
              .setMaxValues(Math.min(order.tasks.length, 25))
              .addOptions(
                order.tasks
                  .slice(0, 25)
                  .map((task) =>
                    new StringSelectMenuOptionBuilder()
                      .setValue(String(task.id))
                      .setLabel(truncate(task.content, 100))
                      .setDefault(task.done),
                  ),
              );
            return await interaction.reply(
              v2(
                card({
                  tone: 'info',
                  emoji: 'checklist',
                  title: `Zadania ${formatOrderId(id)}`,
                  description: 'Zaznaczone = zrobione.',
                  timestamp: false,
                }).select(menu),
                {
                  ephemeral: true,
                },
              ),
            );
          }
          case 'edit':
            return await interaction.showModal(orderEditModal(order));
          case 'task_add':
            return await interaction.showModal(tasksModal(order));
          case 'payment':
            return await interaction.showModal(paymentModal(order, t.due));
          case 'invoice':
            return await interaction.showModal(invoiceModal(order, t.due));
          case 'discount':
            return await interaction.showModal(discountModal(order));
        }
      } finally {
        void refreshOrderPanel(client, id).catch(() => undefined); // reset menu
      }
    },
  }),

  defineComponent({
    id: 'order:setStatus',
    type: 'select',
    access: 'staff',
    async run(interaction, args, { client }) {
      const status = interaction.values[0] as OrderStatus | undefined;
      if (!status || !(status in ORDER_STATUSES)) throw new UserError('Nieznany status.');
      await interaction.deferUpdate();
      const order = await setOrderStatus(client, orderId(args), status, interaction.user.id);
      await interaction.editReply(
        done(`${formatOrderId(order.id)} • ${ORDER_STATUSES[status].label}`, 'Klient dostał powiadomienie.'),
      );
    },
  }),

  defineComponent({
    id: 'order:tasks',
    type: 'select',
    access: 'staff',
    async run(interaction, args, { client }) {
      const id = orderId(args);
      await setDoneTasks(client, id, interaction.values.map(Number));
      await interaction.update(done('Zapisano zadania', `Zrobione: **${interaction.values.length}**`));
    },
  }),

  // ── Klient akceptuje wycenę ──
  defineComponent({
    id: 'order:accept',
    type: 'button',
    async run(interaction, args, { client }) {
      const id = orderId(args);
      const order = await getOrder(id);
      if (order.userId !== interaction.user.id) throw new UserError('Wycenę może zaakceptować tylko klient.');
      if (order.status !== 'QUOTE') throw new UserError('Ta wycena została już zaakceptowana.');
      await interaction.deferReply({ flags: ['Ephemeral'] });
      await setOrderStatus(client, id, 'ACCEPTED', interaction.user.id);
      await interaction.editReply(
        done('Dziękujemy za akceptację!', 'Przygotujemy fakturę proforma i ruszamy z pracą.'),
      );
    },
  }),

  // ── Formularze ──
  defineComponent({
    id: 'order:editSubmit',
    type: 'modal',
    access: 'staff',
    async run(interaction, args, { client }) {
      const f = interaction.fields;
      await editOrder(
        client,
        orderId(args),
        {
          title: f.getTextInputValue('title').trim(),
          description: f.getTextInputValue('description').trim() || null,
          price: readPrice(f.getTextInputValue('price')),
          deadline: readDeadline(f.getTextInputValue('deadline')),
          repoUrl: readUrl(f.getTextInputValue('repo')),
        },
        interaction.user.id,
      );
      await interaction.reply(
        v2(card({ tone: 'success', title: 'Zapisano zmiany', timestamp: false }), { ephemeral: true }),
      );
    },
  }),

  defineComponent({
    id: 'order:tasksSubmit',
    type: 'modal',
    access: 'staff',
    async run(interaction, args, { client }) {
      const n = await addTasks(
        client,
        orderId(args),
        interaction.fields.getTextInputValue('tasks').split('\n'),
      );
      await interaction.reply(
        v2(card({ tone: 'success', title: `Dodano zadania: ${n}`, timestamp: false }), { ephemeral: true }),
      );
    },
  }),

  defineComponent({
    id: 'order:paymentSubmit',
    type: 'modal',
    access: 'staff',
    async run(interaction, args, { client }) {
      const amount = readPrice(interaction.fields.getTextInputValue('amount'));
      if (amount === null) throw new UserError('Podaj kwotę wpłaty.');
      await interaction.deferReply({ flags: ['Ephemeral'] });
      const t = await addPayment(
        client,
        orderId(args),
        amount,
        interaction.fields.getTextInputValue('note').trim() || null,
        interaction.user.id,
      );
      await interaction.editReply(
        done(
          `Zapisano wpłatę ${formatMoney(amount)}`,
          t.due !== null
            ? t.due > 0
              ? `Pozostało: **${formatMoney(t.due)}**`
              : 'Zlecenie opłacone w całości.'
            : undefined,
        ),
      );
    },
  }),

  defineComponent({
    id: 'order:invoiceSubmit',
    type: 'modal',
    access: 'staff',
    async run(interaction, args, { client }) {
      const amount = readPrice(interaction.fields.getTextInputValue('amount'));
      const daysRaw = interaction.fields.getTextInputValue('days').trim();
      const days = daysRaw ? Number(daysRaw) : 7;
      if (!Number.isInteger(days) || days < 1 || days > 90)
        throw new UserError('Termin płatności: od 1 do 90 dni.');
      await interaction.deferReply({ flags: ['Ephemeral'] });
      const invoice = await issueInvoice(client, orderId(args), amount, days, interaction.user.id);
      await interaction.editReply(
        done(
          `Wystawiono proformę ${invoice.number}`,
          `Kwota: **${formatMoney(Number(invoice.amount))}** • klient dostał dokument w tickecie i w DM.`,
        ),
      );
    },
  }),

  defineComponent({
    id: 'order:discountSubmit',
    type: 'modal',
    access: 'staff',
    async run(interaction, args, { client }) {
      const value = await applyDiscountToOrder(
        client,
        orderId(args),
        interaction.fields.getTextInputValue('code'),
        interaction.user.id,
      );
      await interaction.reply(
        v2(
          card({
            tone: 'success',
            emoji: 'gift',
            title: `Rabat zastosowany: −${formatMoney(value)}`,
            timestamp: false,
          }),
          { ephemeral: true },
        ),
      );
    },
  }),
];
