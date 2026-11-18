import type { FastifyInstance } from 'fastify';
import type { ZxClient } from '../client.js';
import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('http:site');

/**
 * Publiczne dane dla strony zxcode.pl (wizytówka): statystyki, oferta, portfolio, opinie, FAQ.
 * Tylko to, co i tak jest publiczne na serwerze Discord – bez kwot zleceń i danych klientów
 * (z opinii: nick i avatar autora, jak na kanale opinii).
 */

const CACHE_MS = 5 * 60_000;
let cache: { at: number; data: unknown } | null = null;

const users = new Map<string, { name: string; avatar: string | null; at: number }>();
async function author(client: ZxClient, userId: string) {
  const hit = users.get(userId);
  if (hit && Date.now() - hit.at < 24 * 3600_000) return hit;
  const u = await client.users.fetch(userId).catch(() => null);
  const value = {
    name: u?.globalName ?? u?.username ?? 'Klient zxCode',
    avatar: u?.displayAvatarURL({ size: 128, extension: 'png' }) ?? null,
    at: Date.now(),
  };
  users.set(userId, value);
  return value;
}

async function build(client: ZxClient) {
  const [completed, clients, ratingAgg, reviews, packages, items, portfolio, faq, monitored] =
    await Promise.all([
      prisma.order.count({ where: { status: 'COMPLETED' } }),
      prisma.order.findMany({
        where: { status: { in: ['COMPLETED', 'DELIVERED'] } },
        distinct: ['userId'],
        select: { userId: true },
      }),
      prisma.review.aggregate({ where: { approved: true }, _avg: { rating: true }, _count: true }),
      prisma.review.findMany({ where: { approved: true }, orderBy: { createdAt: 'desc' }, take: 18 }),
      prisma.pricingPackage.findMany({ orderBy: [{ position: 'asc' }, { price: 'asc' }] }),
      prisma.pricingItem.findMany({ where: { active: true }, orderBy: { price: 'asc' } }),
      prisma.portfolioItem.findMany({
        orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
        include: { images: { select: { id: true }, orderBy: { position: 'asc' } } },
      }),
      prisma.faqArticle.findMany({ orderBy: { createdAt: 'asc' }, take: 8 }),
      prisma.monitoredBot.findMany({ select: { online: true, checksOk: true, checksTotal: true } }),
    ]);

  const guild = client.guilds.cache.get(env.GUILD_ID);
  const totals = monitored.reduce((a, b) => ({ ok: a.ok + b.checksOk, all: a.all + b.checksTotal }), {
    ok: 0,
    all: 0,
  });

  return {
    stats: {
      ordersCompleted: completed,
      clients: clients.length,
      rating: ratingAgg._count ? Math.round((ratingAgg._avg.rating ?? 0) * 100) / 100 : null,
      reviews: ratingAgg._count,
      members: guild?.memberCount ?? null,
      botsMonitored: monitored.length,
      uptime: totals.all ? Math.round((totals.ok / totals.all) * 10000) / 100 : null,
    },
    packages: packages.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: Number(p.price),
      features: p.features,
    })),
    addons: items.map((i) => ({
      id: i.id,
      label: i.label,
      description: i.description,
      price: Number(i.price),
    })),
    portfolio: portfolio.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      technologies: p.technologies,
      url: p.url && /^https?:\/\//.test(p.url) ? p.url : null,
      images: p.images.map((i) => i.id),
    })),
    reviews: await Promise.all(
      reviews.map(async (r) => {
        const a = await author(client, r.userId);
        return {
          id: r.id,
          rating: r.rating,
          content: r.content,
          createdAt: r.createdAt,
          author: a.name,
          avatar: a.avatar,
        };
      }),
    ),
    faq: faq.map((f) => ({ id: f.id, question: f.title, answer: f.content })),
  };
}

export function publicSiteRoutes(app: FastifyInstance, client: ZxClient) {
  app.get('/internal/public/site', async (_request, reply) => {
    try {
      if (!cache || Date.now() - cache.at > CACHE_MS) cache = { at: Date.now(), data: await build(client) };
      return cache.data;
    } catch (err) {
      log.error('Dane strony', err);
      return reply.code(500).send({ error: 'Błąd serwera' });
    }
  });

  /** Zdjęcie z portfolio (bajty z bazy). */
  app.get('/internal/public/portfolio/images/:id', async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    if (!Number.isSafeInteger(id)) return reply.code(404).send({ error: 'Nie znaleziono.' });
    const img = await prisma.portfolioImage.findUnique({
      where: { id },
      select: { data: true, contentType: true },
    });
    if (!img || !/^image\/(png|jpeg|gif|webp)$/.test(img.contentType))
      return reply.code(404).send({ error: 'Nie znaleziono.' });
    return reply
      .header('content-type', img.contentType)
      .header('cache-control', 'public, max-age=86400')
      .send(Buffer.from(img.data));
  });
}
