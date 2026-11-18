import { SlashCommandBuilder } from 'discord.js';
import { prisma } from '../../db/prisma.js';
import { audit } from '../../core/audit.js';
import { getSendableChannel } from '../../core/channels.js';
import { UserError } from '../../core/errors.js';
import { defineCommand, defineComponent, defineModule } from '../../core/types.js';
import { Form } from '../../ui/builders/modal.js';
import { v2, v2Message } from '../../ui/builders/payload.js';
import { card, stars } from '../../ui/components/card.js';
import { formatOrderId, truncate } from '../../utils/format.js';
import { publicReviewCard, reviewRequestPanel, reviewStats, sendForApproval } from './service.js';

const reviewCommand = defineCommand({
  data: new SlashCommandBuilder()
    .setName('opinia')
    .setDescription('Wystaw opinię o zakończonym zleceniu')
    .addStringOption((o) =>
      o
        .setName('zlecenie')
        .setDescription('Twoje zakończone zlecenie')
        .setRequired(true)
        .setAutocomplete(true),
    ),
  cooldown: 10,

  async autocomplete(interaction) {
    const orders = await prisma.order.findMany({
      where: { userId: interaction.user.id, status: 'COMPLETED', review: null },
      orderBy: { completedAt: 'desc' },
      take: 25,
    });
    await interaction.respond(
      orders.map((o) => ({
        name: truncate(`${formatOrderId(o.id)} – ${o.title}`, 100),
        value: String(o.id),
      })),
    );
  },

  async run(interaction) {
    const id = Number(interaction.options.getString('zlecenie', true));
    const order = Number.isSafeInteger(id)
      ? await prisma.order.findUnique({ where: { id }, include: { review: true } })
      : null;
    if (!order || order.userId !== interaction.user.id)
      throw new UserError('Nie znaleziono Twojego zlecenia.');
    if (order.status !== 'COMPLETED') throw new UserError('Opinię można wystawić po zakończeniu zlecenia.');
    if (order.review) throw new UserError('To zlecenie ma już Twoją opinię. Dziękujemy!', 'Już ocenione');
    return interaction.reply(v2(reviewRequestPanel(order), { ephemeral: true }));
  },
});

const reviewsCommand = defineCommand({
  data: new SlashCommandBuilder().setName('opinie').setDescription('Opinie naszych klientów'),
  cooldown: 5,
  async run(interaction) {
    const [{ avg, count }, latest] = await Promise.all([
      reviewStats(),
      prisma.review.findMany({
        where: { approved: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { order: true },
      }),
    ]);
    const panel = card({
      tone: 'brand',
      emoji: 'star',
      title: 'Opinie klientów zxCode',
      description: count
        ? `Średnia: ${stars(Math.round(avg ?? 0))} (**${(avg ?? 0).toFixed(2)}** z ${count} opinii)`
        : 'Nie mamy jeszcze opublikowanych opinii.',
      timestamp: false,
    });
    for (const r of latest) {
      panel
        .separator()
        .text(
          `${'⭐'.repeat(r.rating)} **${r.order?.title ?? 'Projekt'}** – <@${r.userId}>\n> ${truncate(r.content.replace(/\n/g, ' '), 250)}`,
        );
    }
    return interaction.reply(v2(panel, { ephemeral: true }));
  },
});

export const reviewsModule = defineModule({
  name: 'reviews',
  description: 'Opinie klientów po zakończonych zleceniach',
  commands: [reviewCommand, reviewsCommand],
  components: [
    defineComponent({
      id: 'review:rate',
      type: 'dmSelect',
      async run(interaction, args) {
        const orderId = Number(args[0]);
        const rating = Number(interaction.values[0]);
        const order = await prisma.order.findUnique({ where: { id: orderId }, include: { review: true } });
        if (!order || order.userId !== interaction.user.id)
          throw new UserError('To nie jest Twoje zlecenie.');
        if (order.review) throw new UserError('To zlecenie ma już Twoją opinię.', 'Już ocenione');
        if (!(rating >= 1 && rating <= 5)) throw new UserError('Nieprawidłowa ocena.');
        await interaction.showModal(
          new Form(
            `review:submit:${orderId}:${rating}`,
            `Opinia: ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`,
          )
            .info(`Zlecenie **${formatOrderId(orderId)}** – ${order.title}`)
            .text({
              id: 'content',
              label: 'Twoja opinia',
              description: 'Co Ci się podobało? Jak przebiegła współpraca?',
              paragraph: true,
              min: 10,
              max: 1000,
            })
            .build(),
        );
        // Reset menu, gdyby klient zamknął okienko.
        await interaction.message.edit(v2Message(reviewRequestPanel(order))).catch(() => undefined);
      },
    }),

    defineComponent({
      id: 'review:submit',
      type: 'dmModal',
      async run(interaction, args, { client }) {
        const orderId = Number(args[0]);
        const rating = Number(args[1]);
        const order = await prisma.order.findUnique({ where: { id: orderId } });
        if (!order || order.userId !== interaction.user.id || order.status !== 'COMPLETED')
          throw new UserError('Nie można ocenić tego zlecenia.');
        if (!(rating >= 1 && rating <= 5)) throw new UserError('Nieprawidłowa ocena.');
        const content = interaction.fields.getTextInputValue('content').trim();

        const review = await prisma.review
          .create({ data: { orderId, userId: interaction.user.id, rating, content } })
          .catch(() => null); // unikalne orderId – druga opinia się nie zapisze
        if (!review) throw new UserError('To zlecenie ma już Twoją opinię.', 'Już ocenione');

        const thanks = card({
          tone: 'success',
          emoji: 'order_complete',
          title: 'Dziękujemy za opinię!',
          description: `${stars(rating)}\nPo krótkiej weryfikacji pojawi się na kanale opinii.`,
          timestamp: false,
        });
        if (interaction.isFromMessage()) await interaction.update(v2Message(thanks));
        else await interaction.reply(v2(thanks, { ephemeral: interaction.inGuild() }));

        await sendForApproval(client, review, order, interaction.user.displayAvatarURL({ size: 128 }));
      },
    }),

    defineComponent({
      id: 'review:approve',
      type: 'button',
      access: 'staff',
      async run(interaction, args, { client, config }) {
        const review = await prisma.review.findUnique({
          where: { id: Number(args[0]) },
          include: { order: true },
        });
        if (!review) throw new UserError('Ta opinia nie istnieje.');
        if (review.reviewedAt) throw new UserError('Ta opinia została już rozpatrzona.');
        const channel = await getSendableChannel(client, config.reviewChannelId);
        if (!channel) throw new UserError('Ustaw kanał opinii: `/config kanal typ:Opinie`.');

        const user = await client.users.fetch(review.userId).catch(() => null);
        const avatar = user?.displayAvatarURL({ size: 128 });
        const msg = await channel.send(v2Message(publicReviewCard(review, review.order, avatar)));
        const updated = await prisma.review.update({
          where: { id: review.id },
          data: {
            approved: true,
            reviewedAt: new Date(),
            reviewedBy: interaction.user.id,
            messageId: msg.id,
          },
        });
        await audit(client, {
          action: 'review.approve',
          actorId: interaction.user.id,
          summary: `Opublikowano opinię ${'⭐'.repeat(review.rating)} od <@${review.userId}>`,
        });
        await interaction.update(
          v2Message(
            card({
              tone: 'success',
              emoji: 'verified',
              title: 'Opinia opublikowana',
              description: `${stars(updated.rating)} od <@${updated.userId}> • zatwierdził(a) <@${interaction.user.id}>`,
              body: `[Zobacz na kanale opinii](${msg.url})`,
            }),
          ),
        );
      },
    }),

    defineComponent({
      id: 'review:reject',
      type: 'button',
      access: 'staff',
      async run(interaction, args, { client }) {
        const review = await prisma.review.findUnique({ where: { id: Number(args[0]) } });
        if (!review) throw new UserError('Ta opinia nie istnieje.');
        if (review.reviewedAt) throw new UserError('Ta opinia została już rozpatrzona.');
        await prisma.review.update({
          where: { id: review.id },
          data: { approved: false, reviewedAt: new Date(), reviewedBy: interaction.user.id },
        });
        await audit(client, {
          action: 'review.reject',
          actorId: interaction.user.id,
          summary: `Odrzucono opinię od <@${review.userId}>`,
        });
        await interaction.update(
          v2Message(
            card({
              tone: 'neutral',
              emoji: 'shield_x',
              title: 'Opinia odrzucona',
              description: `${stars(review.rating)} od <@${review.userId}> • odrzucił(a) <@${interaction.user.id}>`,
              body: `> ${truncate(review.content, 500)}`,
            }),
          ),
        );
      },
    }),
  ],
});
