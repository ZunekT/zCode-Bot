import { StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import type { Order, Review } from '../../generated/prisma/client.js';
import type { ZxClient } from '../../client.js';
import { prisma } from '../../db/prisma.js';
import { getSendableChannel } from '../../core/channels.js';
import { getConfig } from '../../core/config-service.js';
import { button } from '../../ui/builders/buttons.js';
import { v2Message } from '../../ui/builders/payload.js';
import { card, quote, stars, RATING_LABELS } from '../../ui/components/card.js';
import { emojiComponent } from '../../ui/emojis.js';
import { formatOrderId, truncate } from '../../utils/format.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('reviews');

export function ratingSelect(orderId: number): StringSelectMenuBuilder {
  return new StringSelectMenuBuilder()
    .setCustomId(`review:rate:${orderId}`)
    .setPlaceholder('Wybierz ocenę…')
    .addOptions(
      [5, 4, 3, 2, 1].map((n) =>
        new StringSelectMenuOptionBuilder()
          .setValue(String(n))
          .setLabel(`${RATING_LABELS[n]} · ${n}/5`)
          .setEmoji(emojiComponent('star')),
      ),
    );
}

export function reviewRequestPanel(order: Pick<Order, 'id' | 'title'>) {
  return card({
    tone: 'brand',
    emoji: 'star',
    title: `Jak oceniasz zlecenie ${formatOrderId(order.id)}?`,
    description: `**${order.title}**\nTwoja opinia pojawi się na kanale opinii (po krótkiej weryfikacji) i pomoże innym w wyborze. Dziękujemy!`,
    timestamp: false,
  }).select(ratingSelect(order.id));
}

/** Prośba o opinię w DM po zakończeniu zlecenia. */
export async function requestReview(client: ZxClient, order: Order): Promise<void> {
  const existing = await prisma.review.findUnique({ where: { orderId: order.id } });
  if (existing) return;
  try {
    const user = await client.users.fetch(order.userId);
    await user.send(v2Message(reviewRequestPanel(order)));
  } catch {
    log.debug(`Nie można wysłać prośby o opinię do ${order.userId}`);
  }
}

/** Publiczna karta opinii (kanał opinii). */
export function publicReviewCard(
  review: Review,
  order: Pick<Order, 'id' | 'title'> | null,
  avatarUrl?: string,
) {
  return card({
    tone: review.rating >= 4 ? 'success' : review.rating === 3 ? 'warning' : 'neutral',
    emoji: 'star',
    title: order ? order.title : 'Opinia klienta',
    description: stars(review.rating),
    thumbnail: avatarUrl,
    body: quote(truncate(review.content, 1500)),
    fields: [
      {
        emoji: 'verified',
        label: 'Zweryfikowany klient',
        value: `<@${review.userId}>${order ? ` • ${formatOrderId(order.id)}` : ''}`,
      },
    ],
  });
}

/** Karta do akceptacji przez obsługę. */
export function approvalCard(review: Review, order: Pick<Order, 'id' | 'title'> | null, avatarUrl?: string) {
  return card({
    tone: 'warning',
    emoji: 'star',
    title: `Nowa opinia do akceptacji${order ? ` • ${formatOrderId(order.id)}` : ''}`,
    description: stars(review.rating),
    thumbnail: avatarUrl,
    fields: [
      { emoji: 'user', label: 'Klient', value: `<@${review.userId}>` },
      { emoji: 'package', label: 'Projekt', value: order?.title },
    ],
    body: quote(truncate(review.content, 1500)),
  }).buttons(
    button(`review:approve:${review.id}`, 'Opublikuj', { style: 'success', emoji: 'verified' }),
    button(`review:reject:${review.id}`, 'Odrzuć', { style: 'danger', emoji: 'shield_x' }),
  );
}

export async function sendForApproval(
  client: ZxClient,
  review: Review,
  order: Order | null,
  avatarUrl?: string,
) {
  const config = await getConfig();
  const target =
    (await getSendableChannel(client, config.staffAlertChannelId)) ??
    (await getSendableChannel(client, config.logChannelId));
  await target
    ?.send(v2Message(approvalCard(review, order, avatarUrl)))
    .catch((err) => log.warn('Nie udało się wysłać opinii do akceptacji', err));
}

/** Średnia i liczba zatwierdzonych opinii (np. do stopki cennika). */
export async function reviewStats(): Promise<{ avg: number | null; count: number }> {
  const agg = await prisma.review.aggregate({
    where: { approved: true },
    _avg: { rating: true },
    _count: true,
  });
  return { avg: agg._avg.rating, count: agg._count };
}
