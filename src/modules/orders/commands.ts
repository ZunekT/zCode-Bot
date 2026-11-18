import { SlashCommandBuilder, type AutocompleteInteraction, type SlashCommandStringOption } from 'discord.js';
import type { OrderStatus, Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../db/prisma.js';
import { getConfig } from '../../core/config-service.js';
import { UserError } from '../../core/errors.js';
import { isStaff } from '../../core/permissions.js';
import { defineCommand } from '../../core/types.js';
import { v2, v2Message } from '../../ui/builders/payload.js';
import { card } from '../../ui/components/card.js';
import { formatMoney, formatOrderId, parseOrderId, truncate } from '../../utils/format.js';
import { ACTIVE_ORDER_STATUSES, ORDER_STATUSES, STATUS_ORDER } from './constants.js';
import { readDeadline, readPrice } from './forms.js';
import { orderListLines, orderPanel } from './panels.js';
import {
  addPayment,
  createOrder,
  getOrder,
  issueInvoice,
  postOrderPanel,
  setOrderStatus,
} from './service.js';

async function orderAutocomplete(interaction: AutocompleteInteraction<'cached'>) {
  const config = await getConfig();
  const staff = isStaff(interaction.member, config);
  const q = interaction.options.getFocused().trim();
  const asId = parseOrderId(q);
  const where: Prisma.OrderWhereInput = {
    ...(staff ? {} : { userId: interaction.user.id }),
    ...(q && {
      OR: [...(asId ? [{ id: asId }] : []), { title: { contains: q, mode: 'insensitive' as const } }],
    }),
  };
  const orders = await prisma.order.findMany({ where, orderBy: { updatedAt: 'desc' }, take: 25 });
  await interaction.respond(
    orders.map((o) => ({
      name: truncate(`${ORDER_STATUSES[o.status].icon} ${formatOrderId(o.id)} – ${o.title}`, 100),
      value: String(o.id),
    })),
  );
}

const numberOption =
  (required = true) =>
  (o: SlashCommandStringOption) =>
    o
      .setName('numer')
      .setDescription('Numer zlecenia, np. ZX-0042')
      .setRequired(required)
      .setAutocomplete(true);

function readOrderId(raw: string | null): number | null {
  if (raw === null) return null;
  const id = parseOrderId(raw);
  if (!id) throw new UserError(`Nieprawidłowy numer zlecenia „${raw}”.`);
  return id;
}

export const orderCommand = defineCommand({
  data: new SlashCommandBuilder()
    .setName('zlecenie')
    .setDescription('Zlecenia zxCode')
    .addSubcommand((s) => s.setName('moje').setDescription('Twoje zlecenia'))
    .addSubcommand((s) =>
      s.setName('info').setDescription('Szczegóły zlecenia').addStringOption(numberOption(false)),
    )
    .addSubcommand((s) =>
      s
        .setName('lista')
        .setDescription('[Obsługa] Lista zleceń')
        .addStringOption((o) =>
          o
            .setName('status')
            .setDescription('Filtr statusu (domyślnie aktywne)')
            .addChoices(
              ...STATUS_ORDER.map((st) => ({
                name: `${ORDER_STATUSES[st].icon} ${ORDER_STATUSES[st].label}`,
                value: st,
              })),
            ),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('utworz')
        .setDescription('[Obsługa] Nowe zlecenie (panel trafi na ten kanał)')
        .addUserOption((o) => o.setName('klient').setDescription('Klient').setRequired(true))
        .addStringOption((o) =>
          o.setName('tytul').setDescription('Tytuł zlecenia').setRequired(true).setMaxLength(120),
        )
        .addStringOption((o) => o.setName('cena').setDescription('Cena w zł, np. 450'))
        .addStringOption((o) => o.setName('termin').setDescription('dd.mm.rrrr, dd.mm albo +14'))
        .addStringOption((o) => o.setName('opis').setDescription('Zakres prac').setMaxLength(2000)),
    )
    .addSubcommand((s) =>
      s
        .setName('status')
        .setDescription('[Obsługa] Zmień status')
        .addStringOption(numberOption())
        .addStringOption((o) =>
          o
            .setName('nowy')
            .setDescription('Nowy status')
            .setRequired(true)
            .addChoices(
              ...STATUS_ORDER.map((st) => ({
                name: `${ORDER_STATUSES[st].icon} ${ORDER_STATUSES[st].label}`,
                value: st,
              })),
            ),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('wplata')
        .setDescription('[Obsługa] Zapisz wpłatę')
        .addStringOption(numberOption())
        .addStringOption((o) => o.setName('kwota').setDescription('Kwota w zł').setRequired(true))
        .addStringOption((o) => o.setName('notatka').setDescription('np. przelew, BLIK').setMaxLength(200)),
    )
    .addSubcommand((s) =>
      s
        .setName('proforma')
        .setDescription('[Obsługa] Wystaw fakturę proforma')
        .addStringOption(numberOption())
        .addStringOption((o) => o.setName('kwota').setDescription('Domyślnie pozostała kwota'))
        .addIntegerOption((o) =>
          o
            .setName('dni')
            .setDescription('Termin płatności w dniach (domyślnie 7)')
            .setMinValue(1)
            .setMaxValue(90),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('panel')
        .setDescription('[Obsługa] Przenieś panel zlecenia na ten kanał')
        .addStringOption(numberOption()),
    ),

  autocomplete: orderAutocomplete,

  async run(interaction, { client, config }) {
    const sub = interaction.options.getSubcommand();
    const staff = isStaff(interaction.member, config);
    if (!['moje', 'info'].includes(sub) && !staff)
      throw new UserError('Ta komenda jest dostępna tylko dla obsługi.', 'Brak uprawnień');

    switch (sub) {
      case 'moje': {
        const orders = await prisma.order.findMany({
          where: { userId: interaction.user.id },
          include: { payments: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        });
        return interaction.reply(
          v2(
            card({
              tone: 'brand',
              emoji: 'package',
              title: `Twoje zlecenia (${orders.length})`,
              description: orders.length
                ? orderListLines(orders)
                : 'Nie masz jeszcze zleceń. Zamów bota przez panel ticketów! 🚀',
              footer: 'Szczegóły: /zlecenie info',
              timestamp: false,
            }),
            { ephemeral: true },
          ),
        );
      }

      case 'info': {
        let id = readOrderId(interaction.options.getString('numer'));
        if (!id) {
          const latest = await prisma.order.findFirst({
            where: { userId: interaction.user.id },
            orderBy: { createdAt: 'desc' },
          });
          if (!latest) throw new UserError('Nie masz jeszcze zleceń.');
          id = latest.id;
        }
        const order = await getOrder(id);
        if (order.userId !== interaction.user.id && !staff)
          throw new UserError('To nie jest Twoje zlecenie.');
        const avatar =
          (await client.users.fetch(order.userId).catch(() => null))?.displayAvatarURL({ size: 128 }) ??
          interaction.user.displayAvatarURL();
        return interaction.reply(v2(orderPanel(order, avatar, false), { ephemeral: true }));
      }

      case 'lista': {
        const status = interaction.options.getString('status') as OrderStatus | null;
        const orders = await prisma.order.findMany({
          where: { status: status ? status : { in: ACTIVE_ORDER_STATUSES } },
          include: { payments: true },
          orderBy: { updatedAt: 'desc' },
          take: 25,
        });
        return interaction.reply(
          v2(
            card({
              tone: 'brand',
              emoji: 'package',
              title: `Zlecenia: ${status ? ORDER_STATUSES[status].label : 'aktywne'} (${orders.length})`,
              description: orders.length ? orderListLines(orders) : 'Brak zleceń.',
              timestamp: false,
            }),
            { ephemeral: true },
          ),
        );
      }

      case 'utworz': {
        const user = interaction.options.getUser('klient', true);
        if (user.bot) throw new UserError('Klient nie może być botem.');
        if (!interaction.channel?.isSendable()) throw new UserError('Nie mogę pisać na tym kanale.');
        const price = readPrice(interaction.options.getString('cena') ?? '');
        const deadline = readDeadline(interaction.options.getString('termin') ?? '');
        const ticket = await prisma.ticket.findUnique({ where: { channelId: interaction.channelId } });
        await interaction.deferReply({ flags: ['Ephemeral'] });
        const order = await createOrder(
          client,
          {
            userId: user.id,
            title: interaction.options.getString('tytul', true),
            description: interaction.options.getString('opis'),
            price,
            deadline,
            ticketId: ticket && !ticket.orderId && ticket.userId === user.id ? ticket.id : null,
            actorId: interaction.user.id,
          },
          interaction.channel,
        );
        return interaction.editReply(
          v2Message(
            card({ tone: 'success', title: `Utworzono ${formatOrderId(order.id)}`, timestamp: false }),
          ),
        );
      }

      case 'status': {
        const id = readOrderId(interaction.options.getString('numer', true))!;
        const to = interaction.options.getString('nowy', true) as OrderStatus;
        await interaction.deferReply({ flags: ['Ephemeral'] });
        await setOrderStatus(client, id, to, interaction.user.id);
        return interaction.editReply(
          v2Message(
            card({
              tone: 'success',
              title: `${formatOrderId(id)} • ${ORDER_STATUSES[to].icon} ${ORDER_STATUSES[to].label}`,
              timestamp: false,
            }),
          ),
        );
      }

      case 'wplata': {
        const id = readOrderId(interaction.options.getString('numer', true))!;
        const amount = readPrice(interaction.options.getString('kwota', true));
        if (amount === null) throw new UserError('Podaj kwotę.');
        await interaction.deferReply({ flags: ['Ephemeral'] });
        const t = await addPayment(
          client,
          id,
          amount,
          interaction.options.getString('notatka'),
          interaction.user.id,
        );
        return interaction.editReply(
          v2Message(
            card({
              tone: 'success',
              title: `Wpłata ${formatMoney(amount)} • ${formatOrderId(id)}`,
              description:
                t.due !== null && t.due > 0 ? `Pozostało: **${formatMoney(t.due)}**` : '✅ Opłacone',
              timestamp: false,
            }),
          ),
        );
      }

      case 'proforma': {
        const id = readOrderId(interaction.options.getString('numer', true))!;
        const amount = readPrice(interaction.options.getString('kwota') ?? '');
        await interaction.deferReply({ flags: ['Ephemeral'] });
        const invoice = await issueInvoice(
          client,
          id,
          amount,
          interaction.options.getInteger('dni') ?? 7,
          interaction.user.id,
        );
        return interaction.editReply(
          v2Message(
            card({
              tone: 'success',
              emoji: 'invoice',
              title: `Wystawiono ${invoice.number}`,
              description: formatMoney(Number(invoice.amount)),
              timestamp: false,
            }),
          ),
        );
      }

      case 'panel': {
        const id = readOrderId(interaction.options.getString('numer', true))!;
        if (!interaction.channel?.isSendable()) throw new UserError('Nie mogę pisać na tym kanale.');
        await postOrderPanel(client, id, interaction.channel);
        return interaction.reply(
          v2(
            card({ tone: 'success', title: `Panel ${formatOrderId(id)} jest teraz tutaj`, timestamp: false }),
            { ephemeral: true },
          ),
        );
      }
    }
  },
});
