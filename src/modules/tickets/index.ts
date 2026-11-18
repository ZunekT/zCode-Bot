import { DiscordAPIError, RESTJSONErrorCodes } from 'discord.js';
import { prisma } from '../../db/prisma.js';
import { defineEvent, defineModule } from '../../core/types.js';
import { createLogger } from '../../utils/logger.js';
import { noteCommand } from './commands/notes.js';
import { replyCommand, templateCommand, templateSaveComponent } from './commands/templates.js';
import { ticketCommand } from './commands/ticket.js';
import { ticketComponents } from './components.js';
import { ticketJobs } from './jobs.js';
import { trackTicketMessage } from './services/activity.js';
import { onTicketChannelDeleted } from './services/close.js';
import { refreshControlPanel } from './services/control.js';
import { ticketChannels } from './services/store.js';

const log = createLogger('tickets');

export const ticketsModule = defineModule({
  name: 'tickets',
  description: 'Tickety: zamówienia, wsparcie, współpraca, pytania, reklamacje',
  commands: [ticketCommand, templateCommand, replyCommand, noteCommand],
  components: [...ticketComponents, templateSaveComponent],
  jobs: ticketJobs,
  events: [
    defineEvent({ event: 'messageCreate', run: (_client, message) => trackTicketMessage(message) }),
    defineEvent({
      event: 'channelDelete',
      run: async (_client, channel) => {
        if (!channel.isDMBased()) await onTicketChannelDeleted(channel.id);
      },
    }),
  ],

  async onReady(client) {
    const withChannel = await prisma.ticket.findMany({
      where: { channelId: { not: null } },
      select: { channelId: true },
    });
    let orphaned = 0;
    for (const { channelId } of withChannel) {
      const missing = await client.channels.fetch(channelId!).then(
        () => false,
        (err: unknown) => err instanceof DiscordAPIError && err.code === RESTJSONErrorCodes.UnknownChannel,
      );
      if (missing) {
        await onTicketChannelDeleted(channelId!);
        orphaned++;
      }
    }
    const active = await ticketChannels.load();

    const tickets = await prisma.ticket.findMany({ where: { channelId: { in: ticketChannels.ids() } } });
    for (const t of tickets) await refreshControlPanel(client, t);
    log.info(`Aktywne tickety: ${active}${orphaned ? `, zamknięto ${orphaned} z usuniętym kanałem` : ''}`);
  },
});
