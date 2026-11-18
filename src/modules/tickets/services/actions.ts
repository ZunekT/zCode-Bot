import { OverwriteType, type GuildMember, type TextChannel } from 'discord.js';
import type { GuildConfig, Ticket, TicketPriority } from '../../../generated/prisma/client.js';
import type { ZxClient } from '../../../client.js';
import { prisma } from '../../../db/prisma.js';
import { UserError } from '../../../core/errors.js';
import { isAdmin, isStaff } from '../../../core/permissions.js';
import { Panel } from '../../../ui/builders/container.js';
import { v2Message } from '../../../ui/builders/payload.js';
import type { ToneName } from '../../../ui/theme.js';
import { withLock } from '../../../utils/locks.js';
import { PRIORITIES } from '../constants.js';
import { ticketNo } from '../panels.js';
import { getTicketTextChannel, logTicket } from './channel.js';
import { isActive } from './store.js';

/** Krótka informacja w kanale ticketu („X przejął ticket”). */
export async function channelNotice(
  channel: TextChannel | null,
  text: string,
  tone: ToneName = 'info',
  mentionUsers: string[] = [],
): Promise<void> {
  await channel
    ?.send({ ...v2Message(new Panel({ tone }).text(text)), allowedMentions: { users: mentionUsers } })
    .catch(() => undefined);
}

async function locked<T>(ticketId: number, fn: () => Promise<T>): Promise<T> {
  const result = await withLock(`ticket:${ticketId}`, fn);
  if (result === null) throw new UserError('Ten ticket jest właśnie zmieniany – spróbuj za chwilę.');
  return result;
}

function assertActive(ticket: Ticket | null): asserts ticket is Ticket {
  if (!ticket) throw new UserError('Ten ticket nie istnieje.');
  if (!isActive(ticket)) throw new UserError('Ten ticket jest zamknięty.');
}

/** Przejmij / zwolnij ticket. Cudzy ticket może zwolnić tylko administracja. */
export async function toggleClaim(
  client: ZxClient,
  ticketId: number,
  member: GuildMember,
  config: GuildConfig,
): Promise<Ticket> {
  return locked(ticketId, async () => {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    assertActive(ticket);
    const channel = await getTicketTextChannel(client, ticket);

    if (ticket.claimedBy && ticket.claimedBy !== member.id && !isAdmin(member, config)) {
      throw new UserError(`Ticket prowadzi już <@${ticket.claimedBy}>.`, 'Ticket przejęty');
    }

    if (ticket.claimedBy) {
      const updated = await prisma.ticket.update({
        where: { id: ticketId },
        data: { claimedBy: null, status: 'OPEN' },
      });
      await channelNotice(
        channel,
        `👋 <@${member.id}> zwolnił(a) ticket – czeka na kolejną osobę z obsługi.`,
      );
      return updated;
    }

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: { claimedBy: member.id, status: 'CLAIMED' },
    });
    await channelNotice(
      channel,
      `🙋 <@${member.id}> zajmie się Twoją sprawą, <@${ticket.userId}>!`,
      'success',
      [ticket.userId],
    );
    await logTicket(
      client,
      config,
      new Panel({ tone: 'info' }).text(`🙋 <@${member.id}> przejął ticket ${ticketNo(ticketId)}`),
    );
    return updated;
  });
}

export async function setPriority(
  client: ZxClient,
  ticketId: number,
  priority: TicketPriority,
  actorId: string,
): Promise<Ticket> {
  return locked(ticketId, async () => {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    assertActive(ticket);
    if (ticket.priority === priority) return ticket;
    const updated = await prisma.ticket.update({ where: { id: ticketId }, data: { priority } });
    const p = PRIORITIES[priority];
    await channelNotice(
      await getTicketTextChannel(client, ticket),
      `${p.icon} <@${actorId}> ustawił(a) priorytet: **${p.label}**`,
    );
    return updated;
  });
}

export async function addParticipants(
  client: ZxClient,
  ticketId: number,
  members: GuildMember[],
  actorId: string,
  config: GuildConfig,
): Promise<string[]> {
  return locked(ticketId, async () => {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    assertActive(ticket);
    const channel = await getTicketTextChannel(client, ticket);
    if (!channel) throw new UserError('Kanał ticketu nie istnieje.');

    const toAdd = members.filter(
      (m) =>
        !m.user.bot && m.id !== ticket.userId && !ticket.participants.includes(m.id) && !isStaff(m, config),
    );
    if (!toAdd.length) throw new UserError('Wybrane osoby już mają dostęp (albo to boty / obsługa).');

    for (const m of toAdd) {
      await channel.permissionOverwrites.edit(
        m.id,
        {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          AttachFiles: true,
          EmbedLinks: true,
          AddReactions: true,
        },
        { type: OverwriteType.Member, reason: `Dodano do ticketu ${ticketNo(ticketId)}` },
      );
    }
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { participants: { push: toAdd.map((m) => m.id) } },
    });

    const ids = toAdd.map((m) => m.id);
    await channelNotice(
      channel,
      `➕ <@${actorId}> dodał(a) do ticketu: ${ids.map((id) => `<@${id}>`).join(', ')}`,
      'info',
      ids,
    );
    return ids;
  });
}

export async function removeParticipant(
  client: ZxClient,
  ticketId: number,
  userId: string,
  actorId: string,
): Promise<void> {
  await locked(ticketId, async () => {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    assertActive(ticket);
    if (userId === ticket.userId) throw new UserError('Nie można usunąć właściciela ticketu.');
    if (!ticket.participants.includes(userId)) throw new UserError('Ta osoba nie jest dodana do ticketu.');

    const channel = await getTicketTextChannel(client, ticket);
    await channel?.permissionOverwrites.delete(userId, `Usunięto z ticketu ${ticketNo(ticketId)}`);
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { participants: ticket.participants.filter((id) => id !== userId) },
    });
    await channelNotice(channel, `➖ <@${actorId}> usunął(a) z ticketu <@${userId}>`);
  });
}

/** Klient lub obsługa potwierdza, że sprawa jest aktualna – zeruje ostrzeżenie o auto-zamknięciu. */
export async function keepOpen(ticketId: number): Promise<void> {
  const now = new Date();
  await prisma.ticket.update({
    where: { id: ticketId },
    data: { closeWarnedAt: null, lastActivityAt: now, lastClientMsgAt: now },
  });
}
