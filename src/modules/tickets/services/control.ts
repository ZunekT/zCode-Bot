import type { Ticket } from '../../../generated/prisma/client.js';
import type { ZxClient } from '../../../client.js';
import { getConfig } from '../../../core/config-service.js';
import { v2Message } from '../../../ui/builders/payload.js';
import { createLogger } from '../../../utils/logger.js';
import { controlPanel } from '../panels.js';
import { getTicketTextChannel } from './channel.js';

const log = createLogger('tickets:control');

/** Odświeża panel sterowania w kanale ticketu (status, priorytet, obsługa). */
export async function refreshControlPanel(client: ZxClient, ticket: Ticket): Promise<void> {
  if (!ticket.controlMessageId) return;
  const channel = await getTicketTextChannel(client, ticket);
  if (!channel) return;
  try {
    const [config, user] = await Promise.all([getConfig(), client.users.fetch(ticket.userId)]);
    const message = await channel.messages.fetch(ticket.controlMessageId);
    await message.edit(
      v2Message(
        controlPanel(ticket, {
          avatarUrl: user.displayAvatarURL({ size: 128 }),
          staffRoleId: config.staffRoleId,
        }),
      ),
    );
  } catch (err) {
    log.warn(`Nie udało się odświeżyć panelu ticketu #${ticket.id}`, err);
  }
}
