import type { Prisma } from '../generated/prisma/client.js';
import type { ZxClient } from '../client.js';
import { prisma } from '../db/prisma.js';
import { Panel } from '../ui/builders/container.js';
import { v2Message } from '../ui/builders/payload.js';
import { discordTime } from '../utils/format.js';
import { createLogger } from '../utils/logger.js';
import { getConfig } from './config-service.js';

const log = createLogger('audit');

export interface AuditEntry {
  action: string;
  actorId: string;
  targetId?: string;
  /** Krótki opis do kanału audytu. */
  summary: string;
  details?: Prisma.InputJsonValue;
}

/** Zapisuje akcję administracyjną w bazie i wysyła ją na kanał audytu (jeśli ustawiony). */
export async function audit(client: ZxClient, entry: AuditEntry): Promise<void> {
  try {
    const row = await prisma.auditLog.create({
      data: {
        action: entry.action,
        actorId: entry.actorId,
        targetId: entry.targetId,
        // Opis zapisujemy też w bazie – dziennik zmian na stronie.
        details: {
          summary: entry.summary,
          ...(entry.details && typeof entry.details === 'object' && !Array.isArray(entry.details) ? entry.details : {}),
        } as Prisma.InputJsonValue,
      },
    });

    const config = await getConfig();
    if (!config.auditChannelId) return;
    const channel = await client.channels.fetch(config.auditChannelId).catch(() => null);
    if (!channel?.isSendable()) return;

    const panel = new Panel({ tone: 'brand' })
      .title('database', `Audyt • ${entry.action}`, 3)
      .text(entry.summary)
      .footer(`#${row.id} • <@${entry.actorId}> • ${discordTime(row.createdAt, 'f')}`);
    await channel.send(v2Message(panel));
  } catch (err) {
    log.error('Nie udało się zapisać wpisu audytu', err);
  }
}
