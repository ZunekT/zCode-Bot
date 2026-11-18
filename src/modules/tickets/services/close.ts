import { AttachmentBuilder, FileBuilder, type Guild } from 'discord.js';
import type { Ticket } from '../../../generated/prisma/client.js';
import type { ZxClient } from '../../../client.js';
import { env } from '../../../config/env.js';
import { prisma } from '../../../db/prisma.js';
import { getSendableChannel } from '../../../core/channels.js';
import { getConfig } from '../../../core/config-service.js';
import { UserError } from '../../../core/errors.js';
import { linkButton } from '../../../ui/builders/buttons.js';
import { v2Message } from '../../../ui/builders/payload.js';
import { card } from '../../../ui/components/card.js';
import { padNumber } from '../../../utils/format.js';
import { withLock } from '../../../utils/locks.js';
import { createLogger } from '../../../utils/logger.js';
import { LIMITS } from '../constants.js';
import { closeSummaryCard, closedDmPanel, closedPanel, ticketNo } from '../panels.js';
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

      let ticket = await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
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

      const owner = await client.users.fetch(ticket.userId).catch(() => null);
      const ownerAvatar = owner?.displayAvatarURL({ size: 128 });

      // ── Transkrypt ──
      const fileName = `ticket-${padNumber(ticket.id)}.html`;
      let transcript: Buffer | null = null;
      try {
        transcript = renderTranscript(ticket, channel, await fetchAllMessages(channel), owner?.username);
      } catch (err) {
        log.error(`Nie udało się wygenerować transkryptu ticketu #${ticket.id}`, err);
      }
      const transcriptFile = () =>
        transcript ? [new AttachmentBuilder(transcript, { name: fileName })] : [];
      const withFile = <T extends { container: { addFileComponents: (...c: FileBuilder[]) => unknown } }>(
        panel: T,
      ) => {
        if (transcript)
          panel.container.addFileComponents(new FileBuilder().setURL(`attachment://${fileName}`));
        return panel;
      };

      let transcriptUrl: string | null = null;
      const transcriptChannel = await getSendableChannel(
        client,
        config.transcriptChannelId ?? config.logChannelId,
      );
      if (transcript && transcriptChannel) {
        const msg = await transcriptChannel
          .send(v2Message(withFile(closeSummaryCard(ticket, ownerAvatar)), { files: transcriptFile() }))
          .catch((err) => log.warn('Nie udało się wysłać transkryptu', err));
        if (msg) transcriptUrl = msg.url;
      }
      ticket = await prisma.ticket.update({ where: { id: ticketId }, data: { transcriptUrl } });

      // ── DM do klienta: karta z oceną + osobno transkrypt ──
      // Osobne wiadomości, żeby kartę oceny dało się później edytować bez ruszania załącznika.
      if (owner) {
        try {
          await owner.send(v2Message(closedDmPanel(ticket, channel.guild.name)));
          if (transcript) {
            const filePanel = card({
              tone: 'neutral',
              emoji: 'documentation',
              title: `Zapis rozmowy • ticket ${ticketNo(ticket.id)}`,
              description: 'Otwórz plik w przeglądarce, żeby zobaczyć całą rozmowę.',
              timestamp: false,
            });
            await owner.send(v2Message(withFile(filePanel), { files: transcriptFile() }));
          }
        } catch {
          log.debug(`Nie można wysłać DM do ${ticket.userId} (zablokowane wiadomości prywatne)`);
        }
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

      const logPanel = closeSummaryCard(ticket, ownerAvatar);
      if (transcriptUrl) logPanel.buttons(linkButton(transcriptUrl, 'Transkrypt', 'documentation'));
      await logTicket(client, config, logPanel.footer(archived ? 'Kanał w archiwum' : 'Kanał usunięty'));

      return { ticket, archived, transcriptUrl };
    },
    60,
  );

  if (!result) throw new UserError('Ten ticket jest właśnie zamykany.');
  return result;
}

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
      card({
        tone: 'info',
        emoji: 'unlock',
        title: `Ticket ${ticketNo(ticketId)} ponownie otwarty`,
        fields: [
          { emoji: 'user_crown', label: 'Otworzył(a)', value: `<@${staffId}>` },
          { emoji: 'ticket', label: 'Kanał', value: `<#${channel.id}>` },
        ],
      }),
    );
    return reopened;
  });
  if (!result) throw new UserError('Ten ticket jest właśnie zmieniany – spróbuj za chwilę.');
  return result;
}

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
