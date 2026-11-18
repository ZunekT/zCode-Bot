import type { GuildMember } from 'discord.js';
import type { GuildConfig, Ticket } from '../../../generated/prisma/client.js';
import { prisma } from '../../../db/prisma.js';
import { UserError } from '../../../core/errors.js';
import { isStaff } from '../../../core/permissions.js';
import { ACTIVE_STATUSES } from '../constants.js';

/**
 * Mapa kanał → ticket dla aktywnych ticketów, żeby event messageCreate
 * nie pytał bazy przy każdej wiadomości na serwerze.
 */
const activeChannels = new Map<string, number>();

export const ticketChannels = {
  set: (channelId: string, ticketId: number) => activeChannels.set(channelId, ticketId),
  delete: (channelId: string) => activeChannels.delete(channelId),
  get: (channelId: string) => activeChannels.get(channelId),
  ids: () => [...activeChannels.keys()],
  async load(): Promise<number> {
    const rows = await prisma.ticket.findMany({
      where: { status: { in: ACTIVE_STATUSES }, channelId: { not: null } },
      select: { id: true, channelId: true },
    });
    activeChannels.clear();
    for (const r of rows) if (r.channelId) activeChannels.set(r.channelId, r.id);
    return rows.length;
  },
};

export async function getTicket(id: number): Promise<Ticket> {
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) throw new UserError('Ten ticket nie istnieje.');
  return ticket;
}

/** Ticket powiązany z kanałem, w którym użyto komendy. */
export async function requireTicketChannel(channelId: string | null): Promise<Ticket> {
  const ticket = channelId ? await prisma.ticket.findUnique({ where: { channelId } }) : null;
  if (!ticket) throw new UserError('Tej komendy można użyć tylko w kanale ticketu.');
  return ticket;
}

export const isActive = (t: Ticket) => ACTIVE_STATUSES.includes(t.status);

/** Właściciel lub osoba dodana do ticketu. */
export const isParticipant = (t: Ticket, userId: string) =>
  t.userId === userId || t.participants.includes(userId);

/** Właściciel albo obsługa – może zamknąć ticket. */
export function canClose(t: Ticket, member: GuildMember, config: GuildConfig): boolean {
  return t.userId === member.id || isStaff(member, config);
}

export function requireStaffMember(member: GuildMember, config: GuildConfig): void {
  if (!isStaff(member, config))
    throw new UserError('Ta akcja jest dostępna tylko dla obsługi.', 'Brak uprawnień');
}
