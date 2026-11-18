import { SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import type { Reminder } from '../../generated/prisma/client.js';
import type { ZxClient } from '../../client.js';
import { prisma } from '../../db/prisma.js';
import { getSendableChannel } from '../../core/channels.js';
import { UserError } from '../../core/errors.js';
import { isStaff } from '../../core/permissions.js';
import { defineCommand, defineComponent, defineJob, defineModule } from '../../core/types.js';
import { button } from '../../ui/builders/buttons.js';
import { v2, v2Message } from '../../ui/builders/payload.js';
import { card, quote } from '../../ui/components/card.js';
import { discordTime, formatOrderId, parseOrderId, truncate } from '../../utils/format.js';
import { createLogger } from '../../utils/logger.js';
import { WHEN_HINT, parseWhen, zonedDate, zonedParts } from '../../utils/time.js';

const log = createLogger('reminders');
const MAX_ACTIVE = 25;
const MAX_AHEAD_MS = 365 * 86_400_000;

async function reminderCard(r: Reminder) {
  const order = r.orderId ? await prisma.order.findUnique({ where: { id: r.orderId } }) : null;
  return card({
    tone: 'warning',
    emoji: 'notification',
    title: 'Przypomnienie',
    description: quote(truncate(r.content, 1500)),
    fields: [
      {
        emoji: 'package',
        label: 'Zlecenie',
        value: order ? `${formatOrderId(order.id)} – ${order.title}` : null,
      },
      { emoji: 'calendar', label: 'Ustawione', value: discordTime(r.createdAt, 'R') },
    ],
    timestamp: false,
  }).buttons(
    button(`reminder:snooze:${r.id}:60`, 'Odłóż 1h', { emoji: 'calendar' }),
    button(`reminder:snooze:${r.id}:tomorrow`, 'Jutro 9:00', { emoji: 'calendar' }),
    button(`reminder:done:${r.id}`, 'Gotowe', { style: 'success', emoji: 'order_complete' }),
  );
}

async function deliverDue(client: ZxClient): Promise<void> {
  const due = await prisma.reminder.findMany({
    where: { sent: false, remindAt: { lte: new Date() } },
    take: 50,
  });
  for (const r of due) {
    const { count } = await prisma.reminder.updateMany({
      where: { id: r.id, sent: false },
      data: { sent: true },
    });
    if (!count) continue;
    const payload = v2Message(await reminderCard(r));
    const user = await client.users.fetch(r.userId).catch(() => null);
    const viaDm = await user?.send(payload).then(
      () => true,
      () => false,
    );
    if (!viaDm) {
      const channel = await getSendableChannel(client, r.channelId);
      await channel
        ?.send({ ...payload, allowedMentions: { users: [r.userId] } })
        .catch(() => log.warn(`Nie dostarczono przypomnienia #${r.id}`));
    }
  }
}

const remindCommand = defineCommand({
  data: new SlashCommandBuilder()
    .setName('przypomnij')
    .setDescription('Ustaw przypomnienie (dostaniesz DM)')
    .addStringOption((o) =>
      o.setName('kiedy').setDescription(`np. ${WHEN_HINT}`).setRequired(true).setMaxLength(40),
    )
    .addStringOption((o) =>
      o.setName('tresc').setDescription('O czym przypomnieć').setRequired(true).setMaxLength(1000),
    )
    .addStringOption((o) => o.setName('zlecenie').setDescription('Powiąż ze zleceniem, np. ZX-0042')),
  cooldown: 3,

  async run(interaction, { config }) {
    const when = parseWhen(interaction.options.getString('kiedy', true));
    if (!when) throw new UserError(`Nie rozumiem czasu. Przykłady: ${WHEN_HINT}`);
    if (when.getTime() < Date.now() + 30_000) throw new UserError('Termin musi być w przyszłości.');
    if (when.getTime() > Date.now() + MAX_AHEAD_MS) throw new UserError('Maksymalnie rok do przodu.');

    const active = await prisma.reminder.count({ where: { userId: interaction.user.id, sent: false } });
    if (active >= MAX_ACTIVE)
      throw new UserError(`Masz już ${MAX_ACTIVE} aktywnych przypomnień – usuń któreś (\`/przypomnienia\`).`);

    let orderId: number | null = null;
    const orderRaw = interaction.options.getString('zlecenie');
    if (orderRaw) {
      orderId = parseOrderId(orderRaw);
      const order = orderId ? await prisma.order.findUnique({ where: { id: orderId } }) : null;
      if (!order || (order.userId !== interaction.user.id && !isStaff(interaction.member, config)))
        throw new UserError('Nie znaleziono takiego zlecenia.');
    }

    const r = await prisma.reminder.create({
      data: {
        userId: interaction.user.id,
        content: interaction.options.getString('tresc', true),
        remindAt: when,
        orderId,
        channelId: interaction.channelId,
      },
    });
    return interaction.reply(
      v2(
        card({
          tone: 'success',
          emoji: 'calendar',
          title: 'Przypomnienie ustawione',
          description: `${discordTime(r.remindAt, 'F')} (${discordTime(r.remindAt, 'R')})\n${quote(truncate(r.content, 300))}`,
          footer: 'Przyjdzie w wiadomości prywatnej',
          timestamp: false,
        }),
        { ephemeral: true },
      ),
    );
  },
});

const listCommand = defineCommand({
  data: new SlashCommandBuilder().setName('przypomnienia').setDescription('Twoje aktywne przypomnienia'),
  async run(interaction) {
    const list = await prisma.reminder.findMany({
      where: { userId: interaction.user.id, sent: false },
      orderBy: { remindAt: 'asc' },
      take: 25,
    });
    const panel = card({
      tone: 'brand',
      emoji: 'calendar',
      title: `Przypomnienia (${list.length})`,
      description:
        list
          .map(
            (r) =>
              `**${discordTime(r.remindAt, 'f')}** (${discordTime(r.remindAt, 'R')})\n-# ${truncate(r.content.replace(/\n/g, ' '), 90)}`,
          )
          .join('\n') || 'Brak aktywnych przypomnień. Ustaw: `/przypomnij`.',
      timestamp: false,
    });
    if (list.length) {
      panel.select(
        new StringSelectMenuBuilder()
          .setCustomId('reminder:delete')
          .setPlaceholder('Usuń przypomnienia…')
          .setMinValues(1)
          .setMaxValues(list.length)
          .addOptions(
            list.map((r) =>
              new StringSelectMenuOptionBuilder()
                .setValue(String(r.id))
                .setLabel(truncate(r.content.replace(/\n/g, ' '), 100)),
            ),
          ),
      );
    }
    return interaction.reply(v2(panel, { ephemeral: true }));
  },
});

async function ownReminder(id: number, userId: string) {
  const r = await prisma.reminder.findUnique({ where: { id } });
  if (!r || r.userId !== userId) throw new UserError('To przypomnienie już nie istnieje.');
  return r;
}

export const remindersModule = defineModule({
  name: 'reminders',
  description: 'Przypomnienia w DM (/przypomnij)',
  commands: [remindCommand, listCommand],
  jobs: [defineJob({ name: 'deliver', intervalMs: 60_000, runOnStart: true, run: deliverDue })],
  components: [
    defineComponent({
      id: 'reminder:snooze',
      type: 'dmButton',
      async run(interaction, args) {
        const r = await ownReminder(Number(args[0]), interaction.user.id);
        let when: Date;
        if (args[1] === 'tomorrow') {
          const z = zonedParts(new Date());
          when = zonedDate(z.year, z.month, z.day + 1, 9, 0);
        } else when = new Date(Date.now() + Number(args[1]) * 60_000);
        await prisma.reminder.update({ where: { id: r.id }, data: { remindAt: when, sent: false } });
        await interaction.update(
          v2Message(
            card({
              tone: 'info',
              emoji: 'calendar',
              title: 'Odłożono',
              description: `${quote(truncate(r.content, 300))}\nPrzypomnę ${discordTime(when, 'R')} (${discordTime(when, 'f')}).`,
              timestamp: false,
            }),
          ),
        );
      },
    }),
    defineComponent({
      id: 'reminder:done',
      type: 'dmButton',
      async run(interaction, args) {
        const r = await ownReminder(Number(args[0]), interaction.user.id);
        await prisma.reminder.delete({ where: { id: r.id } });
        await interaction.update(
          v2Message(
            card({
              tone: 'success',
              emoji: 'order_complete',
              title: 'Zrobione!',
              description: `~~${truncate(r.content, 300)}~~`,
              timestamp: false,
            }),
          ),
        );
      },
    }),
    defineComponent({
      id: 'reminder:delete',
      type: 'select',
      async run(interaction) {
        const { count } = await prisma.reminder.deleteMany({
          where: { id: { in: interaction.values.map(Number) }, userId: interaction.user.id },
        });
        await interaction.update(
          v2Message(card({ tone: 'success', title: `Usunięto przypomnienia: ${count}`, timestamp: false })),
        );
      },
    }),
  ],
});
