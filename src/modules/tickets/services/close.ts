import { AttachmentBuilder, FileBuilder, type Guild } from 'discord.js';
import type { Ticket } from '../../../generated/prisma/client.js';
import type { ZxClient } from '../../../client.js';
import { env } from '../../../config/env.js';
import { prisma } from '../../../db/prisma.js';
import { getSendableChannel } from '../../../core/channels.js';
import { getConfig } from '../../../core/config-service.js';
import { UserError } from '../../../core/errors.js';
import { Panel } from '../../../ui/builders/container.js';
import { linkButton } from '../../../ui/builders/buttons.js';
import { v2Message } from '../../../ui/builders/payload.js';
import { formatDuration, padNumber } from '../../../utils/format.js';
import { withLock } from '../../../utils/locks.js';
import { createLogger } from '../../../utils/logger.js';
import { CATEGORIES, LIMITS } from '../constants.js';
import { closedDmPanel, closedPanel, ticketNo } from '../panels.js';
import { getCategory, getTicketTextChannel, hasRoom, logTicket, ticketOverwrites } from './channel.js';
import { refreshControlPanel } from './control.js';
import { isActive, ticketChannels } from './store.js';
import { fetchAllMessages, renderTranscript } from './transcript.js';

const log = createLogger('tickets:close');

export interface CloseOptions {
  closedBy: string;
  reason?: string | null;
}

export interface CloseResult {
  ticket: Ticket;
  archived: boolean;
  transcriptUrl: string | null;
}

/**
 * Zamyka ticket: transkrypt → kanał transkryptów, DM do klienta z oceną,
 * kanał do archiwum (albo usunięcie, gdy archiwum nie ma lub jest pełne).
 */
export async function closeTicket(
  client: ZxClient,
  ticketId: number,
  opts: CloseOptions,
): Promise<CloseResult> {
  const result = await withLock(
    `ticket:${ticketId}`,
    async () => {
      const current = await prisma.ticket.findUnique({ where: { id: ticketId } });
      if (!current) throw new UserError('Ten ticket nie istnieje.');
      if (!isActive(current)) throw new UserError('Ten ticket jest już zamknięty.');

      const config = await getConfig();
      const channel = await getTicketTextChannel(client, current);
      const closedAt = new Date();

      let ticket = await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          status: 'CLOSED',
          closedAt,
          closedBy: opts.closedBy,
          closeReason: opts.reason?.slice(0, 500) || null,
        },
      });
      if (current.channelId) ticketChannels.delete(current.channelId);

      // Kanał usunięty ręcznie – zostaje tylko zapis w bazie.
      if (!channel) {
        ticket = await prisma.ticket.update({ where: { id: ticketId }, data: { channelId: null } });
        return { ticket, archived: false, transcriptUrl: null };
      }

      // ── Transkrypt ──
      const fileName = `ticket-${padNumber(ticket.id)}.html`;
      let transcript: Buffer | null = null;
      try {
        const owner = await client.users.fetch(ticket.userId).catch(() => null);
        transcript = renderTranscript(ticket, channel, await fetchAllMessages(channel), owner?.username);
      } catch (err) {
        log.error(`Nie udało się wygenerować transkryptu ticketu #${ticket.id}`, err);
      }

      let transcriptUrl: string | null = null;
      const def = CATEGORIES[ticket.category];
      const summary = () =>
        new Panel({ tone: 'neutral' })
          .title(def.emoji, `Ticket ${ticketNo(ticket.id)} • ${def.label}`, 3)
          .fields({
            Klient: `<@${ticket.userId}>`,
            Temat: ticket.subject,
            Obsługa: ticket.claimedBy ? `<@${ticket.claimedBy}>` : null,
            Zamknął: `<@${opts.closedBy}>`,
            Powód: ticket.closeReason,
            'Czas trwania': formatDuration(closedAt.getTime() - ticket.openedAt.getTime()),
          });

      const transcriptChannel = await getSendableChannel(
        client,
        config.transcriptChannelId ?? config.logChannelId,
      );
      if (transcript && transcriptChannel) {
        const panel = summary();
        panel.container.addFileComponents(new FileBuilder().setURL(`attachment://${fileName}`));
        const msg = await transcriptChannel
          .send(v2Message(panel, { files: [new AttachmentBuilder(transcript, { name: fileName })] }))
          .catch((err) => log.warn('Nie udało się wysłać transkryptu', err));
        if (msg) transcriptUrl = msg.url;
      }

      ticket = await prisma.ticket.update({ where: { id: ticketId }, data: { transcriptUrl } });

      // ── DM do klienta: podsumowanie, transkrypt i ocena ──
      try {
        const user = await client.users.fetch(ticket.userId);
        const panel = closedDmPanel(ticket, channel.guild.name);
        const files = transcript ? [new AttachmentBuilder(transcript, { name: fileName })] : [];
        if (transcript)
          panel.container.addFileComponents(new FileBuilder().setURL(`attachment://${fileName}`));
        await user.send(v2Message(panel, { files }));
      } catch {
        log.debug(`Nie można wysłać DM do ${ticket.userId} (zablokowane wiadomości prywatne)`);
      }

      // ── Archiwum albo usunięcie ──
      const archive = await getCategory(channel.guild, config.archiveCategoryId);
      const archived = !!archive && hasRoom(archive);

      if (archived) {
        await channel.edit({
          parent: archive.id,
          lockPermissions: false,
          permissionOverwrites: ticketOverwrites(channel.guild, ticket, config, 'archived'),
          reason: `Zamknięcie ticketu ${ticketNo(ticket.id)}`,
        });
        ticket = await prisma.ticket.update({ where: { id: ticketId }, data: { status: 'ARCHIVED' } });
        await channel.send(v2Message(closedPanel(ticket, { archived: true, transcriptUrl })));
      } else {
        await channel.send(v2Message(closedPanel(ticket, { archived: false }))).catch(() => undefined);
        ticket = await prisma.ticket.update({ where: { id: ticketId }, data: { channelId: null } });
        setTimeout(() => {
          channel.delete(`Zamknięcie ticketu ${ticketNo(ticket.id)}`).catch(() => undefined);
        }, LIMITS.deleteDelaySeconds * 1000);
      }

      const logPanel = summary();
      if (transcriptUrl) logPanel.buttons(linkButton(transcriptUrl, 'Transkrypt', 'documentation'));
      await logTicket(client, config, logPanel.footer(archived ? 'Kanał w archiwum' : 'Kanał usunięty'));

      return { ticket, archived, transcriptUrl };
    },
    60,
  );

  if (!result) throw new UserError('Ten ticket jest właśnie zamykany.');
  return result;
}

/** Przywraca zarchiwizowany ticket do kategorii ticketów. */
export async function reopenTicket(
  client: ZxClient,
  guild: Guild,
  ticketId: number,
  staffId: string,
): Promise<Ticket> {
  const result = await withLock(`ticket:${ticketId}`, async () => {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket || ticket.status !== 'ARCHIVED')
      throw new UserError('Można ponownie otworzyć tylko zarchiwizowany ticket.');
    const channel = await getTicketTextChannel(client, ticket);
    if (!channel) throw new UserError('Kanał tego ticketu już nie istnieje.');

    const config = await getConfig();
    const parent = await getCategory(guild, config.ticketCategoryId);
    if (!parent || !hasRoom(parent)) throw new UserError('Kategoria ticketów jest pełna albo nieustawiona.');

    await channel.edit({
      parent: parent.id,
      lockPermissions: false,
      permissionOverwrites: ticketOverwrites(guild, ticket, config, 'active'),
      reason: `Ponowne otwarcie ticketu ${ticketNo(ticket.id)}`,
    });

    const now = new Date();
    const reopened = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: ticket.claimedBy ? 'CLAIMED' : 'OPEN',
        closedAt: null,
        closedBy: null,
        closeReason: null,
        closeWarnedAt: null,
        slaAlertedAt: null,
        lastActivityAt: now,
        lastStaffMsgAt: now,
      },
    });
    ticketChannels.set(channel.id, reopened.id);
    await refreshControlPanel(client, reopened);
    await logTicket(
      client,
      config,
      new Panel({ tone: 'info' }).text(
        `🔓 Ticket ${ticketNo(ticketId)} ponownie otwarty przez <@${staffId}> • <#${channel.id}>`,
      ),
    );
    return reopened;
  });
  if (!result) throw new UserError('Ten ticket jest właśnie zmieniany – spróbuj za chwilę.');
  return result;
}

/** Usuwa kanał zarchiwizowanego ticketu (zapis w bazie i transkrypt zostają). */
export async function deleteTicketChannel(
  client: ZxClient,
  ticketId: number,
  staffId: string,
): Promise<void> {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket || isActive(ticket)) throw new UserError('Najpierw zamknij ticket.');
  const channel = await getTicketTextChannel(client, ticket);
  await prisma.ticket.update({ where: { id: ticketId }, data: { status: 'CLOSED', channelId: null } });
  await channel?.delete(`Usunięcie ticketu ${ticketNo(ticketId)} przez ${staffId}`);
}

/** Wywoływane, gdy kanał ticketu zostanie usunięty ręcznie. */
export async function onTicketChannelDeleted(channelId: string): Promise<void> {
  ticketChannels.delete(channelId);
  const ticket = await prisma.ticket.findUnique({ where: { channelId } });
  if (!ticket) return;
  await prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      channelId: null,
      status: 'CLOSED',
      closedAt: ticket.closedAt ?? new Date(),
      closeReason: ticket.closeReason ?? 'Kanał usunięty ręcznie',
      closedBy: ticket.closedBy ?? env.DISCORD_CLIENT_ID,
    },
  });
}
