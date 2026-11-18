import { GuildMember, StringSelectMenuBuilder, UserSelectMenuBuilder } from 'discord.js';
import type { TicketCategory, TicketPriority } from '../../generated/prisma/client.js';
import { prisma } from '../../db/prisma.js';
import { getSendableChannel } from '../../core/channels.js';
import { UserError } from '../../core/errors.js';
import { isStaff } from '../../core/permissions.js';
import { defineComponent } from '../../core/types.js';
import type { ComponentHandler } from '../../core/types.js';
import { Panel } from '../../ui/builders/container.js';
import { button } from '../../ui/builders/buttons.js';
import { Form } from '../../ui/builders/modal.js';
import { v2, v2Message } from '../../ui/builders/payload.js';
import { checkCooldown } from '../../utils/locks.js';
import { CATEGORIES, LIMITS, PRIORITIES } from './constants.js';
import { ticketForm } from './forms.js';
import { controlPanel, ratedDmPanel, ticketNo } from './panels.js';
import { addParticipants, channelNotice, keepOpen, setPriority, toggleClaim } from './services/actions.js';
import { getTicketTextChannel, logTicket } from './services/channel.js';
import { closeTicket, deleteTicketChannel, reopenTicket } from './services/close.js';
import { refreshControlPanel } from './services/control.js';
import { assertCanOpen, createTicket } from './services/create.js';
import { canClose, getTicket } from './services/store.js';

const ticketId = (args: string[]) => {
  const id = Number(args[0]);
  if (!Number.isSafeInteger(id) || id <= 0) throw new UserError('Nieprawidłowy ticket.');
  return id;
};

const asCategory = (value: string | undefined): TicketCategory => {
  if (!value || !(value in CATEGORIES)) throw new UserError('Nieznana kategoria ticketu.');
  return value as TicketCategory;
};

export function closeReasonModal(id: number) {
  return new Form(`ticket:closeSubmit:${id}`, `Zamknięcie ticketu ${ticketNo(id)}`)
    .text({
      id: 'reason',
      label: 'Powód zamknięcia',
      description: 'Zobaczy go klient w podsumowaniu (opcjonalnie)',
      required: false,
      max: 300,
      placeholder: 'np. Sprawa rozwiązana',
    })
    .build();
}

export const ticketComponents: ComponentHandler[] = [
  // ── Otwieranie ──
  defineComponent({
    id: 'ticket:open',
    type: 'button',
    async run(interaction, args, { config }) {
      const category = asCategory(args[0]);
      await assertCanOpen(interaction.member, category, config);
      await interaction.showModal(ticketForm(category));
    },
  }),

  defineComponent({
    id: 'ticket:create',
    type: 'modal',
    async run(interaction, args, { client, config }) {
      const category = asCategory(args[0]);
      const left = await checkCooldown('ticket:create', interaction.user.id, LIMITS.createCooldown);
      if (left > 0) throw new UserError(`Nowy ticket możesz utworzyć za **${left}s**.`, 'Zwolnij trochę');
      await createTicket(client, interaction, category, config);
    },
  }),

  // ── Panel sterowania ──
  defineComponent({
    id: 'ticket:claim',
    type: 'button',
    access: 'staff',
    async run(interaction, args, { client, config }) {
      const ticket = await toggleClaim(client, ticketId(args), interaction.member, config);
      const user = await client.users.fetch(ticket.userId);
      await interaction.update(
        v2Message(
          controlPanel(ticket, {
            avatarUrl: user.displayAvatarURL({ size: 128 }),
            staffRoleId: config.staffRoleId,
          }),
        ),
      );
    },
  }),

  defineComponent({
    id: 'ticket:priority',
    type: 'button',
    access: 'staff',
    async run(interaction, args) {
      const ticket = await getTicket(ticketId(args));
      const menu = new StringSelectMenuBuilder()
        .setCustomId(`ticket:setPriority:${ticket.id}`)
        .setPlaceholder('Wybierz priorytet')
        .addOptions(
          (Object.keys(PRIORITIES) as TicketPriority[]).map((p) => ({
            value: p,
            label: PRIORITIES[p].label,
            emoji: { name: PRIORITIES[p].icon },
            default: p === ticket.priority,
          })),
        );
      await interaction.reply(
        v2(
          new Panel({ tone: 'info' })
            .title('lightning', `Priorytet ticketu ${ticketNo(ticket.id)}`, 3)
            .select(menu),
          {
            ephemeral: true,
          },
        ),
      );
    },
  }),

  defineComponent({
    id: 'ticket:setPriority',
    type: 'select',
    access: 'staff',
    async run(interaction, args, { client }) {
      const value = interaction.values[0] as TicketPriority | undefined;
      if (!value || !(value in PRIORITIES)) throw new UserError('Nieznany priorytet.');
      const ticket = await setPriority(client, ticketId(args), value, interaction.user.id);
      await refreshControlPanel(client, ticket);
      await interaction.update(
        v2Message(
          new Panel({ tone: 'success' }).text(
            `Priorytet: ${PRIORITIES[value].icon} **${PRIORITIES[value].label}**`,
          ),
        ),
      );
    },
  }),

  defineComponent({
    id: 'ticket:add',
    type: 'button',
    access: 'staff',
    async run(interaction, args) {
      const id = ticketId(args);
      const menu = new UserSelectMenuBuilder()
        .setCustomId(`ticket:addUser:${id}`)
        .setPlaceholder('Wybierz osoby do dodania')
        .setMinValues(1)
        .setMaxValues(5);
      await interaction.reply(
        v2(
          new Panel({ tone: 'info' })
            .title('user_add', `Dodaj osoby do ticketu ${ticketNo(id)}`, 3)
            .select(menu),
          {
            ephemeral: true,
          },
        ),
      );
    },
  }),

  defineComponent({
    id: 'ticket:addUser',
    type: 'select',
    access: 'staff',
    async run(interaction, args, { client, config }) {
      if (!interaction.isUserSelectMenu()) return;
      const members = [...interaction.members.values()].filter(
        (m): m is GuildMember => m instanceof GuildMember,
      );
      const added = await addParticipants(client, ticketId(args), members, interaction.user.id, config);
      await interaction.update(
        v2Message(new Panel({ tone: 'success' }).text(`Dodano: ${added.map((id) => `<@${id}>`).join(', ')}`)),
      );
    },
  }),

  // ── Zamykanie ──
  defineComponent({
    id: 'ticket:close',
    type: 'button',
    async run(interaction, args, { config }) {
      const ticket = await getTicket(ticketId(args));
      if (!canClose(ticket, interaction.member, config))
        throw new UserError('Nie możesz zamknąć tego ticketu.');
      await interaction.showModal(closeReasonModal(ticket.id));
    },
  }),

  defineComponent({
    id: 'ticket:closeSubmit',
    type: 'modal',
    async run(interaction, args, { client, config }) {
      const id = ticketId(args);
      const ticket = await getTicket(id);
      if (!canClose(ticket, interaction.member, config))
        throw new UserError('Nie możesz zamknąć tego ticketu.');
      const reason = interaction.fields.getTextInputValue('reason').trim() || null;

      await interaction.deferReply({ flags: ['Ephemeral'] });
      const result = await closeTicket(client, id, { closedBy: interaction.user.id, reason });
      await interaction
        .editReply(
          v2Message(
            new Panel({ tone: 'success' }).text(
              `🔒 Ticket ${ticketNo(id)} zamknięty${result.archived ? ' i przeniesiony do archiwum' : ''}.`,
            ),
          ),
        )
        .catch(() => undefined); // kanał mógł już zniknąć
    },
  }),

  defineComponent({
    id: 'ticket:keepOpen',
    type: 'button',
    async run(interaction, args, { config }) {
      const ticket = await getTicket(ticketId(args));
      if (ticket.userId !== interaction.user.id && !isStaff(interaction.member, config)) {
        throw new UserError('Tylko autor ticketu może to potwierdzić.');
      }
      await keepOpen(ticket.id);
      await interaction.update(
        v2Message(
          new Panel({ tone: 'success' }).text(
            `✅ <@${interaction.user.id}> potwierdził(a), że sprawa jest aktualna.`,
          ),
        ),
      );
    },
  }),

  // ── Archiwum ──
  defineComponent({
    id: 'ticket:reopen',
    type: 'button',
    access: 'staff',
    async run(interaction, args, { client }) {
      await interaction.deferUpdate();
      const ticket = await reopenTicket(client, interaction.guild, ticketId(args), interaction.user.id);
      await interaction.editReply(
        v2Message(
          new Panel({ tone: 'success' }).text(
            `🔓 <@${interaction.user.id}> ponownie otworzył(a) ticket ${ticketNo(ticket.id)}.`,
          ),
        ),
      );
      await channelNotice(
        await getTicketTextChannel(client, ticket),
        `<@${ticket.userId}>, Twój ticket jest znowu otwarty.`,
        'info',
        [ticket.userId],
      );
    },
  }),

  defineComponent({
    id: 'ticket:delete',
    type: 'button',
    access: 'staff',
    async run(interaction, args) {
      const id = ticketId(args);
      await interaction.reply(
        v2(
          new Panel({ tone: 'error' })
            .text(`Na pewno usunąć kanał ticketu ${ticketNo(id)}? Transkrypt i zapis w bazie zostaną.`)
            .buttons(
              button(`ticket:deleteConfirm:${id}`, 'Usuń kanał', { style: 'danger', emoji: 'shield_x' }),
            ),
          { ephemeral: true },
        ),
      );
    },
  }),

  defineComponent({
    id: 'ticket:deleteConfirm',
    type: 'button',
    access: 'staff',
    async run(interaction, args, { client }) {
      await interaction.update(v2Message(new Panel({ tone: 'neutral' }).text('🗑️ Usuwam kanał…')));
      await deleteTicketChannel(client, ticketId(args), interaction.user.id);
    },
  }),

  // ── Ocena w DM ──
  defineComponent({
    id: 'ticket:rate',
    type: 'dmButton',
    async run(interaction, args) {
      const id = ticketId(args);
      const rating = Number(args[1]);
      if (!(rating >= 1 && rating <= 5)) throw new UserError('Nieprawidłowa ocena.');
      const ticket = await getTicket(id);
      if (ticket.userId !== interaction.user.id) throw new UserError('Ocenić może tylko autor ticketu.');
      if (ticket.rating)
        throw new UserError(
          `Ten ticket został już oceniony na ${'⭐'.repeat(ticket.rating)}.`,
          'Już ocenione',
        );

      await interaction.showModal(
        new Form(`ticket:rateSubmit:${id}:${rating}`, `Ocena: ${'⭐'.repeat(rating)}`)
          .text({
            id: 'comment',
            label: 'Komentarz (opcjonalnie)',
            description: 'Co poszło dobrze, a co możemy poprawić?',
            paragraph: true,
            required: false,
            max: 1000,
          })
          .build(),
      );
    },
  }),

  defineComponent({
    id: 'ticket:rateSubmit',
    type: 'dmModal',
    async run(interaction, args, { client, config }) {
      const id = ticketId(args);
      const rating = Number(args[1]);
      if (!(rating >= 1 && rating <= 5)) throw new UserError('Nieprawidłowa ocena.');

      const ticket = await getTicket(id);
      if (ticket.userId !== interaction.user.id) throw new UserError('Ocenić może tylko autor ticketu.');
      const comment = interaction.fields.getTextInputValue('comment').trim() || null;

      // updateMany z warunkiem rating=null – druga ocena (np. podwójne kliknięcie) niczego nie nadpisze.
      const { count } = await prisma.ticket.updateMany({
        where: { id, rating: null },
        data: { rating, ratingComment: comment },
      });
      if (count === 0) throw new UserError('Ten ticket został już oceniony.', 'Już ocenione');

      const rated = { ...ticket, rating, ratingComment: comment };
      await interaction.reply(v2(ratedDmPanel(rated)));

      const panel = new Panel({ tone: rating <= 2 ? 'warning' : 'success' })
        .title('star', `Ocena ticketu ${ticketNo(id)}: ${'⭐'.repeat(rating)}`, 3)
        .text(
          `<@${ticket.userId}>${ticket.claimedBy ? ` • obsługa: <@${ticket.claimedBy}>` : ''}` +
            (comment ? `\n> ${comment.replace(/\n/g, '\n> ')}` : ''),
        );
      await logTicket(client, config, panel);
      if (rating <= 2) {
        const alerts = await getSendableChannel(client, config.staffAlertChannelId);
        await alerts?.send(v2Message(panel)).catch(() => undefined);
      }
    },
  }),
];
