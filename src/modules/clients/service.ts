import type { ZxClient } from '../../client.js';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { getConfig } from '../../core/config-service.js';
import { card } from '../../ui/components/card.js';
import { createLogger } from '../../utils/logger.js';
import { sendLog } from '../logs/service.js';
import { LOYAL_CLIENT_ORDERS } from '../orders/constants.js';

const log = createLogger('clients');

export const BADGES = {
  client: { label: 'Klient', icon: '🎖️' },
  loyal: { label: 'Stały klient', icon: '👑' },
  reviewer: { label: 'Recenzent', icon: '⭐' },
} as const;

export type BadgeKey = keyof typeof BADGES;

/**
 * Po zakończeniu zlecenia: rola „Klient” (1+ zleceń) i „Stały klient” (LOYAL_CLIENT_ORDERS+),
 * odznaki w profilu. Zwraca listę nowo nadanych ról (do powiadomienia).
 */
export async function syncClientRoles(client: ZxClient, userId: string): Promise<string[]> {
  const config = await getConfig();
  const [completed, reviews] = await Promise.all([
    prisma.order.count({ where: { userId, status: 'COMPLETED' } }),
    prisma.review.count({ where: { userId, approved: true } }),
  ]);

  const badges: BadgeKey[] = [];
  if (completed >= 1) badges.push('client');
  if (completed >= LOYAL_CLIENT_ORDERS) badges.push('loyal');
  if (reviews >= 1) badges.push('reviewer');
  await prisma.clientProfile.upsert({ where: { userId }, create: { userId, badges }, update: { badges } });

  const guild = await client.guilds.fetch(env.GUILD_ID).catch(() => null);
  const member = await guild?.members.fetch(userId).catch(() => null);
  if (!member) return [];

  const wanted = [
    completed >= 1 ? config.clientRoleId : null,
    completed >= LOYAL_CLIENT_ORDERS ? config.loyalClientRoleId : null,
  ].filter((r): r is string => !!r && !member.roles.cache.has(r));

  const granted: string[] = [];
  for (const roleId of wanted) {
    try {
      await member.roles.add(roleId, `Zakończone zlecenia: ${completed}`);
      granted.push(roleId);
    } catch (err) {
      log.warn(`Nie udało się nadać roli ${roleId} dla ${userId}`, err);
    }
  }

  if (granted.length) {
    await sendLog(
      client,
      'members',
      card({
        tone: 'client',
        emoji: completed >= LOYAL_CLIENT_ORDERS ? 'client_crown' : 'client_badge',
        title: completed >= LOYAL_CLIENT_ORDERS ? 'Nowy stały klient!' : 'Nowy klient',
        thumbnail: member.displayAvatarURL({ size: 128 }),
        fields: [
          { emoji: 'user', label: 'Użytkownik', value: `<@${userId}>` },
          { emoji: 'crown', label: 'Nadane role', value: granted.map((r) => `<@&${r}>`).join(' ') },
          { emoji: 'order_complete', label: 'Zakończone zlecenia', value: String(completed) },
        ],
      }),
    );
  }
  return granted;
}
