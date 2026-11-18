import type { Ticket } from '../../../generated/prisma/client.js';
import type { ZxClient } from '../../../client.js';
import { getConfig } from '../../../core/config-service.js';
import { v2Message } from '../../../ui/builders/payload.js';
import { createLogger } from '../../../utils/logger.js';
import { controlPanel } from '../panels.js';
import { getTicketTextChannel } from './channel.js';

const log = createLogger('tickets:control');

export async function controlPayload(client: ZxClient, ticket: Ticket) {
  const [config, user] = await Promise.all([getConfig(), client.users.fetch(ticket.userId)]);
  return v2Message(
    controlPanel(ticket, {
      avatarUrl: user.displayAvatarURL({ size: 128 }),
      staffRoleId: config.staffRoleId,
    }),
  );
}

export async function refreshControlPanel(client: ZxClient, ticket: Ticket): Promise<void> {
  if (!ticket.controlMessageId) return;
  const channel = await getTicketTextChannel(client, ticket);
  if (!channel) return;
  try {
    const message = await channel.messages.fetch(ticket.controlMessageId);
    await message.edit(await controlPayload(client, ticket));
  } catch (err) {
    log.warn(`Nie udało się odświeżyć panelu ticketu #${ticket.id}`, err);
  }
}
