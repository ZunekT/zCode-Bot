import { SlashCommandBuilder } from 'discord.js';
import { prisma } from '../../../db/prisma.js';
import { defineCommand } from '../../../core/types.js';
import { Panel } from '../../../ui/builders/container.js';
import { v2 } from '../../../ui/builders/payload.js';
import { success } from '../../../ui/components/notice.js';
import { discordTime } from '../../../utils/format.js';
import { ticketNo } from '../panels.js';
import { requireTicketChannel } from '../services/store.js';

export const noteCommand = defineCommand({
  data: new SlashCommandBuilder()
    .setName('notatka')
    .setDescription('[Obsługa] Notatki wewnętrzne ticketu (klient ich nie widzi)')
    .addSubcommand((s) =>
      s
        .setName('dodaj')
        .setDescription('Dodaj notatkę do tego ticketu')
        .addStringOption((o) =>
          o.setName('tresc').setDescription('Treść notatki').setRequired(true).setMaxLength(1000),
        ),
    )
    .addSubcommand((s) => s.setName('lista').setDescription('Pokaż notatki tego ticketu')),
  access: 'staff',

  async run(interaction) {
    const ticket = await requireTicketChannel(interaction.channelId);

    if (interaction.options.getSubcommand() === 'dodaj') {
      const content = interaction.options.getString('tresc', true);
      await prisma.ticketNote.create({
        data: { ticketId: ticket.id, authorId: interaction.user.id, content },
      });
      return interaction.reply(success('Notatka zapisana', 'Widzi ją tylko obsługa (`/notatka lista`).'));
    }

    const notes = await prisma.ticketNote.findMany({
      where: { ticketId: ticket.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const panel = new Panel({ tone: 'neutral' })
      .title('documentation', `Notatki • ticket ${ticketNo(ticket.id)}`, 3)
      .text(
        notes
          .map(
            (n) =>
              `<@${n.authorId}> • ${discordTime(n.createdAt, 'R')}\n> ${n.content.replace(/\n/g, '\n> ')}`,
          )
          .join('\n\n') || 'Brak notatek.',
      );
    return interaction.reply(v2(panel, { ephemeral: true }));
  },
});
