import type { ZxClient } from '../../client.js';
import { prisma } from '../../db/prisma.js';
import { getSendableChannel } from '../../core/channels.js';
import { getConfig } from '../../core/config-service.js';
import { defineJob } from '../../core/types.js';
import { v2Message } from '../../ui/builders/payload.js';
import { createLogger } from '../../utils/logger.js';
import { ACTIVE_STATUSES, CHECK_INTERVAL_MS, LIMITS } from './constants.js';
import { closeWarningPanel, slaAlertPanel } from './panels.js';
import { getTicketTextChannel } from './services/channel.js';
import { closeTicket } from './services/close.js';

const log = createLogger('tickets:jobs');
const HOUR = 3_600_000;

async function checkSla(client: ZxClient) {
  const config = await getConfig();
  const now = Date.now();
  const candidates = await prisma.ticket.findMany({
    where: {
      status: { in: ACTIVE_STATUSES },
      channelId: { not: null },
      slaAlertedAt: null,
      lastClientMsgAt: { lt: new Date(now - config.ticketSlaHours * HOUR) },
    },
  });

  for (const ticket of candidates) {
    const clientAt = ticket.lastClientMsgAt!;
    if (ticket.lastStaffMsgAt && ticket.lastStaffMsgAt >= clientAt) continue; // obsługa już odpisała

    const target =
      (await getSendableChannel(client, config.staffAlertChannelId)) ??
      (await getTicketTextChannel(client, ticket));
    if (!target) continue;

    await target
      .send({
        ...v2Message(slaAlertPanel(ticket, config.staffRoleId, now - clientAt.getTime())),
        allowedMentions: { roles: config.staffRoleId ? [config.staffRoleId] : [] },
      })
      .catch((err) => log.warn(`Alert SLA dla #${ticket.id} nieudany`, err));
    await prisma.ticket.update({ where: { id: ticket.id }, data: { slaAlertedAt: new Date() } });
  }
}

async function checkAutoClose(client: ZxClient) {
  const config = await getConfig();
  const now = Date.now();
  const idleMs = config.ticketAutoCloseHours * HOUR;
  const warnMs = Math.min(LIMITS.closeWarningHours, config.ticketAutoCloseHours) * HOUR;

  const candidates = await prisma.ticket.findMany({
    where: { status: { in: ACTIVE_STATUSES }, channelId: { not: null }, lastStaffMsgAt: { not: null } },
  });

  for (const ticket of candidates) {
    const staffAt = ticket.lastStaffMsgAt!.getTime();
    if (ticket.lastClientMsgAt && ticket.lastClientMsgAt.getTime() > staffAt) continue; // czeka obsługa, nie klient

    if (!ticket.closeWarnedAt) {
      if (now - staffAt < idleMs) continue;
      const channel = await getTicketTextChannel(client, ticket);
      if (!channel) continue;
      await channel
        .send({
          ...v2Message(closeWarningPanel(ticket, new Date(now + warnMs))),
          allowedMentions: { users: [ticket.userId] },
        })
        .catch(() => undefined);
      await prisma.ticket.update({ where: { id: ticket.id }, data: { closeWarnedAt: new Date() } });
      continue;
    }

    if (now - ticket.closeWarnedAt.getTime() >= warnMs) {
      try {
        await closeTicket(client, ticket.id, {
          closedBy: client.user!.id,
          reason: 'Automatyczne zamknięcie – brak odpowiedzi klienta',
        });
      } catch (err) {
        log.warn(`Auto-zamknięcie #${ticket.id} nieudane`, err);
      }
    }
  }
}

export const ticketJobs = [
  defineJob({ name: 'sla', intervalMs: CHECK_INTERVAL_MS, run: checkSla }),
  defineJob({ name: 'auto-close', intervalMs: CHECK_INTERVAL_MS, run: checkAutoClose }),
];
