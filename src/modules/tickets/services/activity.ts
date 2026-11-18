import type { Message } from 'discord.js';
import { prisma } from '../../../db/prisma.js';
import { getConfig } from '../../../core/config-service.js';
import { isStaff } from '../../../core/permissions.js';
import { ticketChannels } from './store.js';

export async function recordStaffActivity(ticketId: number, at = new Date()): Promise<void> {
  await prisma.$transaction([
    prisma.ticket.update({
      where: { id: ticketId },
      data: { lastStaffMsgAt: at, lastActivityAt: at, slaAlertedAt: null, closeWarnedAt: null },
    }),
    prisma.ticket.updateMany({
      where: { id: ticketId, firstStaffReplyAt: null },
      data: { firstStaffReplyAt: at },
    }),
  ]);
}

export async function recordClientActivity(ticketId: number, at = new Date()): Promise<void> {
  await prisma.ticket.update({
    where: { id: ticketId },
    data: { lastClientMsgAt: at, lastActivityAt: at, closeWarnedAt: null },
  });
}

export async function trackTicketMessage(message: Message): Promise<void> {
  if (message.author.bot || !message.inGuild()) return;
  const ticketId = ticketChannels.get(message.channelId);
  if (!ticketId) return;

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { userId: true } });
  if (!ticket) return;

  const config = await getConfig();
  const member = message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
  const staff = message.author.id !== ticket.userId && !!member && isStaff(member, config);

  if (staff) await recordStaffActivity(ticketId, message.createdAt);
  else await recordClientActivity(ticketId, message.createdAt);
}
