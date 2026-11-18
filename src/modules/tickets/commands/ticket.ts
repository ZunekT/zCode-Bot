import { ChannelType, SlashCommandBuilder } from 'discord.js';
import type { TicketPriority } from '../../../generated/prisma/client.js';
import { prisma } from '../../../db/prisma.js';
import { audit } from '../../../core/audit.js';
import { UserError } from '../../../core/errors.js';
import { isAdmin } from '../../../core/permissions.js';
import { defineCommand } from '../../../core/types.js';
import { bannerFile } from '../../../ui/assets.js';
import { Panel } from '../../../ui/builders/container.js';
import { v2, v2Message } from '../../../ui/builders/payload.js';
import { success } from '../../../ui/components/notice.js';
import { e } from '../../../ui/emojis.js';
import { discordTime } from '../../../utils/format.js';
import { ACTIVE_STATUSES, CATEGORIES, PRIORITIES } from '../constants.js';
import { closeReasonModal } from '../components.js';
import { publicPanel, ticketNo } from '../panels.js';
import { addParticipants, removeParticipant, setPriority } from '../services/actions.js';
import { closeTicket } from '../services/close.js';
import { refreshControlPanel } from '../services/control.js';
import { canClose, requireStaffMember, requireTicketChannel } from '../services/store.js';
import { PERIODS, ticketStatsPanel, type PeriodKey } from '../stats.js';

const PRIORITY_ORDER: Record<TicketPriority, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };

export const ticketCommand = defineCommand({
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Tickety zxCode')
    .addSubcommand((s) =>
      s
        .setName('panel')
        .setDescription('[Admin] Wyślij panel otwierania ticketów')
        .addChannelOption((o) =>
          o
            .setName('kanal')
            .setDescription('Gdzie wysłać (domyślnie tutaj)')
            .addChannelTypes(ChannelType.GuildText),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('zamknij')
        .setDescription('Zamknij ten ticket')
        .addStringOption((o) => o.setName('powod').setDescription('Powód zamknięcia').setMaxLength(300)),
    )
    .addSubcommand((s) =>
      s
        .setName('dodaj')
        .setDescription('[Obsługa] Dodaj osobę do ticketu')
        .addUserOption((o) => o.setName('uzytkownik').setDescription('Kogo dodać').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('usun')
        .setDescription('[Obsługa] Usuń osobę z ticketu')
        .addUserOption((o) => o.setName('uzytkownik').setDescription('Kogo usunąć').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('priorytet')
        .setDescription('[Obsługa] Ustaw priorytet ticketu')
        .addStringOption((o) =>
          o
            .setName('poziom')
            .setDescription('Priorytet')
            .setRequired(true)
            .addChoices(
              ...(Object.keys(PRIORITIES) as TicketPriority[]).map((p) => ({
                name: `${PRIORITIES[p].icon} ${PRIORITIES[p].label}`,
                value: p,
              })),
            ),
        ),
    )
    .addSubcommand((s) => s.setName('lista').setDescription('[Obsługa] Otwarte tickety'))
    .addSubcommand((s) =>
      s
        .setName('statystyki')
        .setDescription('[Obsługa] Statystyki ticketów')
        .addStringOption((o) =>
          o
            .setName('okres')
            .setDescription('Zakres czasu')
            .addChoices(...Object.entries(PERIODS).map(([value, p]) => ({ name: p.label, value }))),
        ),
    ),

  async run(interaction, { client, config }) {
    const sub = interaction.options.getSubcommand();
    const member = interaction.member;

    switch (sub) {
      case 'panel': {
        if (!isAdmin(member, config))
          throw new UserError('Panel może wysłać tylko administracja.', 'Brak uprawnień');
        const target =
          interaction.options.getChannel('kanal', false, [ChannelType.GuildText]) ?? interaction.channel;
        if (!target?.isSendable()) throw new UserError('Nie mogę pisać na tym kanale.');
        const msg = await target.send(v2Message(publicPanel(), { files: [bannerFile()] }));
        await audit(client, {
          action: 'tickets.panel',
          actorId: member.id,
          targetId: msg.channelId,
          summary: `Panel ticketów wysłany na <#${msg.channelId}>`,
        });
        return interaction.reply(success('Panel wysłany', `Panel ticketów jest na <#${msg.channelId}>.`));
      }

      case 'zamknij': {
        const ticket = await requireTicketChannel(interaction.channelId);
        if (!canClose(ticket, member, config)) throw new UserError('Nie możesz zamknąć tego ticketu.');
        const reason = interaction.options.getString('powod');
        if (!reason) return interaction.showModal(closeReasonModal(ticket.id));
        await interaction.deferReply({ flags: ['Ephemeral'] });
        await closeTicket(client, ticket.id, { closedBy: member.id, reason });
        return interaction
          .editReply(
            v2Message(new Panel({ tone: 'success' }).text(`🔒 Ticket ${ticketNo(ticket.id)} zamknięty.`)),
          )
          .catch(() => undefined);
      }

      case 'dodaj': {
        requireStaffMember(member, config);
        const ticket = await requireTicketChannel(interaction.channelId);
        const target = interaction.options.getMember('uzytkownik');
        if (!target) throw new UserError('Tej osoby nie ma na serwerze.');
        await addParticipants(client, ticket.id, [target], member.id, config);
        return interaction.reply(success('Dodano', `<@${target.id}> ma teraz dostęp do ticketu.`));
      }

      case 'usun': {
        requireStaffMember(member, config);
        const ticket = await requireTicketChannel(interaction.channelId);
        const user = interaction.options.getUser('uzytkownik', true);
        await removeParticipant(client, ticket.id, user.id, member.id);
        return interaction.reply(success('Usunięto', `<@${user.id}> nie ma już dostępu do ticketu.`));
      }

      case 'priorytet': {
        requireStaffMember(member, config);
        const ticket = await requireTicketChannel(interaction.channelId);
        const priority = interaction.options.getString('poziom', true) as TicketPriority;
        const updated = await setPriority(client, ticket.id, priority, member.id);
        await refreshControlPanel(client, updated);
        return interaction.reply(
          success('Zapisano', `Priorytet: ${PRIORITIES[priority].icon} **${PRIORITIES[priority].label}**`),
        );
      }

      case 'lista': {
        requireStaffMember(member, config);
        const tickets = await prisma.ticket.findMany({ where: { status: { in: ACTIVE_STATUSES } } });
        tickets.sort(
          (a, b) =>
            PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
            a.openedAt.getTime() - b.openedAt.getTime(),
        );

        const waiting = (t: (typeof tickets)[number]) =>
          t.lastClientMsgAt && (!t.lastStaffMsgAt || t.lastClientMsgAt > t.lastStaffMsgAt);
        const lines = tickets
          .slice(0, 25)
          .map(
            (t) =>
              `${PRIORITIES[t.priority].icon} ${e(CATEGORIES[t.category].emoji)} **${ticketNo(t.id)}** <#${t.channelId}> • <@${t.userId}>` +
              ` • ${t.claimedBy ? `<@${t.claimedBy}>` : '**wolny**'}` +
              (waiting(t) ? ` • ⏳ czeka od ${discordTime(t.lastClientMsgAt!, 'R')}` : ''),
          );

        const panel = new Panel({ tone: 'brand' })
          .title('ticket', `Otwarte tickety (${tickets.length})`)
          .text(lines.join('\n') || 'Brak otwartych ticketów 🎉');
        if (tickets.length > 25) panel.footer(`Pokazano 25 z ${tickets.length}`);
        return interaction.reply(v2(panel, { ephemeral: true }));
      }

      case 'statystyki': {
        requireStaffMember(member, config);
        const period = (interaction.options.getString('okres') ?? '30d') as PeriodKey;
        return interaction.reply(v2(await ticketStatsPanel(period), { ephemeral: true }));
      }
    }
  },
});
