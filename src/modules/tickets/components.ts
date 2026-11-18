import {
  GuildMember,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  UserSelectMenuBuilder,
  type AnySelectMenuInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js';
import type { GuildConfig, TicketCategory, TicketPriority } from '../../generated/prisma/client.js';
import type { ZxClient } from '../../client.js';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { getSendableChannel } from '../../core/channels.js';
import { UserError } from '../../core/errors.js';
import { isStaff } from '../../core/permissions.js';
import { defineComponent, type ComponentHandler } from '../../core/types.js';
import { bannerFile } from '../../ui/assets.js';
import { button } from '../../ui/builders/buttons.js';
import { Form } from '../../ui/builders/modal.js';
import { v2, v2Message } from '../../ui/builders/payload.js';
import { card } from '../../ui/components/card.js';
import { success } from '../../ui/components/notice.js';
import { emojiComponent } from '../../ui/emojis.js';
import { checkCooldown } from '../../utils/locks.js';
import { createLogger } from '../../utils/logger.js';
import { CATEGORIES, CONTROL_ACTIONS, LIMITS, PRIORITIES, type ControlAction } from './constants.js';
import { orderCreateModal } from '../orders/forms.js';
import { ticketForm } from './forms.js';
import { closedDmPanel, publicPanel, ratedDmPanel, ratingLogCard, ticketNo } from './panels.js';
import {
  addNote,
  addParticipants,
  channelNotice,
  keepOpen,
  remindClient,
  removeParticipant,
  setPriority,
  toggleClaim,
} from './services/actions.js';
import { getTicketTextChannel, logTicket } from './services/channel.js';
import { closeTicket, deleteTicketChannel, reopenTicket } from './services/close.js';
import { controlPayload, refreshControlPanel } from './services/control.js';
import { assertCanOpen, createTicket } from './services/create.js';
import { canClose, getTicket } from './services/store.js';

const log = createLogger('tickets:ui');

const ticketId = (args: string[]) => {
  const id = Number(args[0]);
  if (!Number.isSafeInteger(id) || id <= 0) throw new UserError('Nieprawidłowy ticket.');
  return id;
};

const asCategory = (value: string | undefined): TicketCategory => {
  if (!value || !(value in CATEGORIES)) throw new UserError('Nieznana kategoria ticketu.');
  return value as TicketCategory;
};

export function publicPanelPayload() {
  return { ...v2Message(publicPanel(), { files: [bannerFile()] }), attachments: [] };
}

async function resetPublicPanel(interaction: AnySelectMenuInteraction) {
  await interaction.message
    .edit(publicPanelPayload())
    .catch((err) => log.warn('Reset panelu ticketów nieudany', err));
}

export function closeReasonModal(id: number) {
  return new Form(`ticket:closeSubmit:${id}`, `Zamknięcie ticketu ${ticketNo(id)}`)
    .info('Klient dostanie podsumowanie z transkryptem i prośbą o ocenę.')
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

function noteModal(id: number) {
  return new Form(`ticket:noteSubmit:${id}`, `Notatka • ticket ${ticketNo(id)}`)
    .info('Notatkę widzi tylko obsługa (`/notatka lista`). Klient jej nie zobaczy.')
    .text({ id: 'content', label: 'Treść notatki', paragraph: true, max: 1000 })
    .build();
}

const ephemeralPicker = (
  title: string,
  emoji: Parameters<typeof card>[0]['emoji'],
  menu: StringSelectMenuBuilder | UserSelectMenuBuilder,
) => v2(card({ tone: 'info', emoji, title, timestamp: false }).select(menu), { ephemeral: true });

async function runAction(
  interaction: StringSelectMenuInteraction<'cached'>,
  action: ControlAction,
  id: number,
  client: ZxClient,
  config: GuildConfig,
): Promise<'updated' | 'replied'> {
  const member = interaction.member;
  const def = CONTROL_ACTIONS[action];
  if (def.staff && !isStaff(member, config)) {
    throw new UserError(`**${def.label}** jest dostępne tylko dla obsługi.`, 'Brak uprawnień');
  }

  switch (action) {
    case 'claim':
    case 'unclaim': {
      const ticket = await toggleClaim(client, id, member, config);
      await interaction.update(await controlPayload(client, ticket));
      return 'updated';
    }

    case 'priority': {
      const ticket = await getTicket(id);
      const menu = new StringSelectMenuBuilder()
        .setCustomId(`ticket:setPriority:${id}`)
        .setPlaceholder('Wybierz priorytet…')
        .addOptions(
          (Object.keys(PRIORITIES) as TicketPriority[]).map((p) =>
            new StringSelectMenuOptionBuilder()
              .setValue(p)
              .setLabel(PRIORITIES[p].label)
              .setEmoji(emojiComponent(PRIORITIES[p].emoji))
              .setDefault(p === ticket.priority),
          ),
        );
      await interaction.reply(ephemeralPicker(`Priorytet ticketu ${ticketNo(id)}`, 'lightning', menu));
      return 'replied';
    }

    case 'add': {
      const menu = new UserSelectMenuBuilder()
        .setCustomId(`ticket:addUser:${id}`)
        .setPlaceholder('Wybierz osoby…')
        .setMinValues(1)
        .setMaxValues(5);
      await interaction.reply(ephemeralPicker(`Dodaj osoby do ticketu ${ticketNo(id)}`, 'user_add', menu));
      return 'replied';
    }

    case 'remove': {
      const ticket = await getTicket(id);
      if (!ticket.participants.length) throw new UserError('Nikt nie został dodany do tego ticketu.');
      const names = await Promise.all(
        ticket.participants.map(async (uid) => {
          const m = await interaction.guild.members.fetch(uid).catch(() => null);
          return { uid, name: m?.displayName ?? uid };
        }),
      );
      const menu = new StringSelectMenuBuilder()
        .setCustomId(`ticket:removeUser:${id}`)
        .setPlaceholder('Kogo usunąć?')
        .addOptions(
          names
            .slice(0, 25)
            .map((n) =>
              new StringSelectMenuOptionBuilder()
                .setValue(n.uid)
                .setLabel(n.name.slice(0, 100))
                .setEmoji(emojiComponent('user_remove')),
            ),
        );
      await interaction.reply(ephemeralPicker(`Usuń osobę z ticketu ${ticketNo(id)}`, 'user_remove', menu));
      return 'replied';
    }

    case 'note':
      await interaction.showModal(noteModal(id));
      return 'replied';

    case 'order': {
      const ticket = await getTicket(id);
      if (ticket.orderId) throw new UserError('Ten ticket ma już zlecenie – zobacz przypięty panel.');
      await interaction.showModal(orderCreateModal(ticket));
      return 'replied';
    }

    case 'remind':
      await remindClient(client, id, member);
      await interaction.reply(
        success('Przypomnienie wysłane', 'Klient dostał wzmiankę z prośbą o odpowiedź.'),
      );
      return 'replied';

    case 'close': {
      const ticket = await getTicket(id);
      if (!canClose(ticket, member, config)) throw new UserError('Nie możesz zamknąć tego ticketu.');
      await interaction.showModal(closeReasonModal(id));
      return 'replied';
    }
  }
}

export const ticketComponents: ComponentHandler[] = [
  // ── Panel pomocy: wybór kategorii ──
  defineComponent({
    id: 'ticket:category',
    type: 'select',
    async run(interaction, _args, { config }) {
      try {
        const category = asCategory(interaction.values[0]);
        await assertCanOpen(interaction.member, category, config);
        await interaction.showModal(ticketForm(category));
      } finally {
        // W tle – odpowiedź (modal albo komunikat o błędzie) musi zdążyć w 3 s.
        void resetPublicPanel(interaction);
      }
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

  // ── Panel ticketu: menu akcji ──
  defineComponent({
    id: 'ticket:action',
    type: 'select',
    async run(interaction, args, { client, config }) {
      if (!interaction.isStringSelectMenu()) return;
      const id = ticketId(args);
      const action = interaction.values[0] as ControlAction | undefined;
      let result: 'updated' | 'replied' | 'failed' = 'failed';
      try {
        if (!action || !(action in CONTROL_ACTIONS)) throw new UserError('Nieznana akcja.');
        result = await runAction(interaction, action, id, client, config);
      } finally {
        // Reset menu w tle (gdy nie zrobiliśmy już interaction.update z nowym panelem).
        if (result !== 'updated') {
          void prisma.ticket
            .findUnique({ where: { id } })
            .then((ticket) => ticket && refreshControlPanel(client, ticket))
            .catch(() => undefined);
        }
      }
    },
  }),

  defineComponent({
    id: 'ticket:setPriority',
    type: 'select',
    access: 'staff',
    async run(interaction, args, { client }) {
      const value = interaction.values[0] as TicketPriority | undefined;
      if (!value || !(value in PRIORITIES)) throw new UserError('Nieznany priorytet.');
      const ticket = await setPriority(client, ticketId(args), value, interaction.member);
      await refreshControlPanel(client, ticket);
      await interaction.update(
        v2Message(
          card({
            tone: 'success',
            title: 'Priorytet zmieniony',
            description: `Nowy priorytet: \`${PRIORITIES[value].label}\``,
            timestamp: false,
          }),
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
      const id = ticketId(args);
      const added = await addParticipants(client, id, members, interaction.member, config);
      await refreshControlPanel(client, await getTicket(id));
      await interaction.update(
        v2Message(
          card({
            tone: 'success',
            emoji: 'user_add',
            title: 'Dodano do ticketu',
            description: added.map((u) => `<@${u}>`).join(', '),
            timestamp: false,
          }),
        ),
      );
    },
  }),

  defineComponent({
    id: 'ticket:removeUser',
    type: 'select',
    access: 'staff',
    async run(interaction, args, { client }) {
      const userId = interaction.values[0];
      if (!userId) return;
      const id = ticketId(args);
      await removeParticipant(client, id, userId, interaction.member);
      await refreshControlPanel(client, await getTicket(id));
      await interaction.update(
        v2Message(
          card({
            tone: 'success',
            emoji: 'user_remove',
            title: 'Usunięto z ticketu',
            description: `<@${userId}>`,
            timestamp: false,
          }),
        ),
      );
    },
  }),

  defineComponent({
    id: 'ticket:noteSubmit',
    type: 'modal',
    access: 'staff',
    async run(interaction, args) {
      const content = interaction.fields.getTextInputValue('content').trim();
      if (!content) throw new UserError('Notatka nie może być pusta.');
      await addNote(ticketId(args), interaction.user.id, content);
      await interaction.reply(success('Notatka zapisana', 'Widzi ją tylko obsługa – `/notatka lista`.'));
    },
  }),

  // ── Zamykanie ──
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
            card({
              tone: 'success',
              emoji: 'lock',
              title: `Ticket ${ticketNo(id)} zamknięty`,
              description: result.archived
                ? 'Kanał przeniesiony do archiwum.'
                : 'Kanał zostanie usunięty za chwilę.',
              timestamp: false,
            }),
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
          card({
            tone: 'success',
            emoji: 'unlock',
            title: 'Ticket pozostaje otwarty',
            description: `<@${interaction.user.id}> potwierdził(a), że sprawa jest nadal aktualna.`,
          }),
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
          card({
            tone: 'success',
            emoji: 'unlock',
            title: `Ticket ${ticketNo(ticket.id)} ponownie otwarty`,
            description: `Otworzył(a): <@${interaction.user.id}>`,
            thumbnail: interaction.member.displayAvatarURL({ size: 128 }),
          }),
        ),
      );
      await channelNotice(
        await getTicketTextChannel(client, ticket),
        card({
          tone: 'info',
          emoji: 'unlock',
          title: 'Wracamy do rozmowy',
          description: `<@${ticket.userId}>, Twój ticket jest znowu otwarty.`,
        }),
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
          card({
            tone: 'error',
            emoji: 'shield_x',
            title: `Usunąć kanał ticketu ${ticketNo(id)}?`,
            description: 'Transkrypt i zapis w bazie zostaną. Tej operacji nie da się cofnąć.',
            timestamp: false,
          }).buttons(
            button(`ticket:deleteConfirm:${id}`, 'Tak, usuń kanał', { style: 'danger', emoji: 'shield_x' }),
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
      await interaction.update(
        v2Message(card({ tone: 'neutral', emoji: 'shield_x', title: 'Usuwam kanał…', timestamp: false })),
      );
      await deleteTicketChannel(client, ticketId(args), interaction.user.id);
    },
  }),

  // ── Ocena w DM ──
  defineComponent({
    id: 'ticket:rate',
    type: 'dmSelect',
    async run(interaction, args, { client }) {
      const id = ticketId(args);
      const rating = Number(interaction.values[0]);
      const ticket = await getTicket(id);
      if (ticket.userId !== interaction.user.id) throw new UserError('Ocenić może tylko autor ticketu.');
      if (ticket.rating) {
        await interaction.update(v2Message(ratedDmPanel(ticket)));
        return;
      }
      if (!(rating >= 1 && rating <= 5)) throw new UserError('Nieprawidłowa ocena.');

      await interaction.showModal(
        new Form(`ticket:rateSubmit:${id}:${rating}`, `Twoja ocena: ${rating}/5`)
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
      // Reset menu – gdyby klient zamknął okienko, może wybrać ocenę jeszcze raz.
      const guildName = client.guilds.cache.get(env.GUILD_ID)?.name ?? 'zxCode';
      await interaction.message.edit(v2Message(closedDmPanel(ticket, guildName))).catch(() => undefined);
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

      // updateMany z warunkiem rating=null – druga ocena (np. podwójne wysłanie) niczego nie nadpisze.
      const { count } = await prisma.ticket.updateMany({
        where: { id, rating: null },
        data: { rating, ratingComment: comment },
      });
      if (count === 0) throw new UserError('Ten ticket został już oceniony.', 'Już ocenione');

      const rated = { ...ticket, rating, ratingComment: comment };
      if (interaction.isFromMessage()) await interaction.update(v2Message(ratedDmPanel(rated)));
      else await interaction.reply(v2(ratedDmPanel(rated)));

      const panel = ratingLogCard(rated, interaction.user.displayAvatarURL({ size: 128 }));
      await logTicket(client, config, panel);
      if (rating <= 2) {
        const alerts = await getSendableChannel(client, config.staffAlertChannelId);
        await alerts?.send(v2Message(panel)).catch(() => undefined);
      }
    },
  }),
];
