import { OverwriteType, type GuildMember, type TextChannel } from 'discord.js';
import type { GuildConfig, Ticket, TicketPriority } from '../../../generated/prisma/client.js';
import type { ZxClient } from '../../../client.js';
import { prisma } from '../../../db/prisma.js';
import { UserError } from '../../../core/errors.js';
import { isAdmin, isStaff } from '../../../core/permissions.js';
import type { Panel } from '../../../ui/builders/container.js';
import { v2Message } from '../../../ui/builders/payload.js';
import { card, change } from '../../../ui/components/card.js';
import { checkCooldown, withLock } from '../../../utils/locks.js';
import { PRIORITIES, REMIND_COOLDOWN, STATUS_LABELS } from '../constants.js';
import { ticketNo } from '../panels.js';
import { getTicketTextChannel, logTicket } from './channel.js';
import { isActive } from './store.js';

const avatar = (m: GuildMember) => m.displayAvatarURL({ size: 128 });
const prio = (p: TicketPriority) => `\`${PRIORITIES[p].label}\``;

export async function channelNotice(
  channel: TextChannel | null,
  panel: Panel,
  mentionUsers: string[] = [],
): Promise<void> {
  await channel
    ?.send({ ...v2Message(panel), allowedMentions: { users: mentionUsers } })
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
        card({
          tone: 'warning',
          emoji: 'user_remove',
          title: 'Ticket zwolniony',
          description: `<@${member.id}> oddał(a) sprawę – zajmie się nią kolejna osoba z obsługi.`,
          thumbnail: avatar(member),
          fields: [
            {
              emoji: 'notification',
              label: 'Status',
              value: change(STATUS_LABELS[ticket.status], STATUS_LABELS.OPEN),
            },
          ],
        }),
      );
      return updated;
    }

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: { claimedBy: member.id, status: 'CLAIMED' },
    });
    await channelNotice(
      channel,
      card({
        tone: 'success',
        emoji: 'user_crown',
        title: 'Ticket przejęty',
        description: `<@${ticket.userId}>, Twoją sprawą zajmie się **${member.displayName}** (<@${member.id}>).`,
        thumbnail: avatar(member),
        fields: [
          {
            emoji: 'notification',
            label: 'Status',
            value: change(STATUS_LABELS[ticket.status], STATUS_LABELS.CLAIMED),
          },
        ],
      }),
      [ticket.userId],
    );
    await logTicket(
      client,
      config,
      card({
        tone: 'info',
        emoji: 'user_crown',
        title: `Ticket ${ticketNo(ticketId)} przejęty`,
        thumbnail: avatar(member),
        fields: [
          { emoji: 'user_crown', label: 'Obsługa', value: `<@${member.id}>` },
          { emoji: 'ticket', label: 'Kanał', value: `<#${ticket.channelId}>` },
        ],
      }),
    );
    return updated;
  });
}

export async function setPriority(
  client: ZxClient,
  ticketId: number,
  priority: TicketPriority,
  actor: GuildMember,
): Promise<Ticket> {
  return locked(ticketId, async () => {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    assertActive(ticket);
    if (ticket.priority === priority) return ticket;
    const updated = await prisma.ticket.update({ where: { id: ticketId }, data: { priority } });
    const up = Object.keys(PRIORITIES).indexOf(priority) > Object.keys(PRIORITIES).indexOf(ticket.priority);
    await channelNotice(
      await getTicketTextChannel(client, ticket),
      card({
        tone: priority === 'URGENT' ? 'error' : up ? 'warning' : 'info',
        emoji: 'lightning',
        title: up ? 'Priorytet podniesiony' : 'Priorytet obniżony',
        thumbnail: avatar(actor),
        fields: [
          { emoji: 'lightning', label: 'Priorytet', value: change(prio(ticket.priority), prio(priority)) },
          { emoji: 'user', label: 'Zmienił(a)', value: `<@${actor.id}>` },
        ],
      }),
    );
    return updated;
  });
}

export async function addParticipants(
  client: ZxClient,
  ticketId: number,
  members: GuildMember[],
  actor: GuildMember,
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
      card({
        tone: 'info',
        emoji: 'user_add',
        title: ids.length > 1 ? 'Nowe osoby w tickecie' : 'Nowa osoba w tickecie',
        description: `${ids.map((id) => `<@${id}>`).join(', ')} – witaj! Masz teraz dostęp do tej rozmowy.`,
        thumbnail: ids.length === 1 ? avatar(toAdd[0]!) : undefined,
        fields: [{ emoji: 'user', label: 'Dodał(a)', value: `<@${actor.id}>` }],
      }),
      ids,
    );
    return ids;
  });
}

export async function removeParticipant(
  client: ZxClient,
  ticketId: number,
  userId: string,
  actor: GuildMember,
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
    await channelNotice(
      channel,
      card({
        tone: 'neutral',
        emoji: 'user_remove',
        title: 'Osoba usunięta z ticketu',
        description: `<@${userId}> nie ma już dostępu do tej rozmowy.`,
        fields: [{ emoji: 'user', label: 'Usunął(a)', value: `<@${actor.id}>` }],
      }),
    );
  });
}

export async function remindClient(client: ZxClient, ticketId: number, actor: GuildMember): Promise<void> {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  assertActive(ticket);
  const left = await checkCooldown('ticket:remind', String(ticketId), REMIND_COOLDOWN);
  if (left > 0)
    throw new UserError(
      `Przypomnienie można wysłać ponownie za **${Math.ceil(left / 60)} min**.`,
      'Za wcześnie',
    );
  await channelNotice(
    await getTicketTextChannel(client, ticket),
    card({
      tone: 'warning',
      emoji: 'notification',
      title: 'Czekamy na Twoją odpowiedź',
      description: `<@${ticket.userId}>, **${actor.displayName}** prosi o odpowiedź w tym tickecie. Daj znać, czy sprawa jest nadal aktualna!`,
      thumbnail: avatar(actor),
    }),
    [ticket.userId],
  );
}

export async function addNote(ticketId: number, authorId: string, content: string): Promise<void> {
  await prisma.ticketNote.create({ data: { ticketId, authorId, content: content.slice(0, 1000) } });
}

export async function keepOpen(ticketId: number): Promise<void> {
  const now = new Date();
  await prisma.ticket.update({
    where: { id: ticketId },
    data: { closeWarnedAt: null, lastActivityAt: now, lastClientMsgAt: now },
  });
}
