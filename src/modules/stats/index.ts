import { AttachmentBuilder, SlashCommandBuilder } from 'discord.js';
import type { ZxClient } from '../../client.js';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { redis } from '../../db/redis.js';
import { isAdmin } from '../../core/permissions.js';
import { defineCommand, defineEvent, defineJob, defineModule } from '../../core/types.js';
import { v2 } from '../../ui/builders/payload.js';
import { card } from '../../ui/components/card.js';
import { e } from '../../ui/emojis.js';
import { formatDuration, formatMoney } from '../../utils/format.js';
import { createLogger } from '../../utils/logger.js';
import { dayKey } from '../../utils/time.js';
import { ACTIVE_ORDER_STATUSES } from '../orders/constants.js';
import { totalsOf } from '../orders/panels.js';
import { barChart, sparkline } from './chart.js';

const log = createLogger('stats');
const DAY = 86_400_000;
const key = (day: string) => `zx:stats:${day}`;

async function bump(field: 'messages' | 'joins' | 'leaves') {
  const k = key(dayKey());
  await redis
    .multi()
    .hincrby(k, field, 1)
    .expire(k, 3 * 86_400)
    .exec();
}

/** Przepisuje liczniki dzisiaj/wczoraj z Redis do bazy (Redis jest źródłem dla bieżących dni). */
async function flush(client: ZxClient) {
  const guild = client.guilds.cache.get(env.GUILD_ID);
  for (const day of [dayKey(new Date(Date.now() - DAY)), dayKey()]) {
    const h = await redis.hgetall(key(day));
    if (!Object.keys(h).length && day !== dayKey()) continue;
    const data = {
      messages: Number(h.messages ?? 0),
      joins: Number(h.joins ?? 0),
      leaves: Number(h.leaves ?? 0),
    };
    await prisma.dailyStat.upsert({
      where: { date: day },
      create: { date: day, ...data, members: guild?.memberCount ?? 0 },
      update: { ...data, ...(day === dayKey() && guild ? { members: guild.memberCount } : {}) },
    });
  }
}

function lastDays(days: number): string[] {
  return Array.from({ length: days }, (_, i) => dayKey(new Date(Date.now() - (days - 1 - i) * DAY)));
}

const PERIODS = { '7': 7, '14': 14, '30': 30, '90': 90 } as const;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

const statsCommand = defineCommand({
  data: new SlashCommandBuilder()
    .setName('statystyki')
    .setDescription('[Obsługa] Statystyki serwera i biznesu')
    .addStringOption((o) =>
      o
        .setName('okres')
        .setDescription('Zakres (domyślnie 14 dni)')
        .addChoices(...Object.keys(PERIODS).map((d) => ({ name: `ostatnie ${d} dni`, value: d }))),
    ),
  access: 'staff',
  cooldown: 5,

  async run(interaction, { client, config }) {
    await interaction.deferReply({ flags: ['Ephemeral'] });
    await flush(client);
    const days = PERIODS[(interaction.options.getString('okres') ?? '14') as keyof typeof PERIODS];
    const since = new Date(Date.now() - days * DAY);
    const keys = lastDays(days);
    const rows = await prisma.dailyStat.findMany({ where: { date: { in: keys } } });
    const byDay = new Map(rows.map((r) => [r.date, r]));
    const messages = keys.map((k) => byDay.get(k)?.messages ?? 0);
    const joins = keys.map((k) => byDay.get(k)?.joins ?? 0);
    const leaves = keys.map((k) => byDay.get(k)?.leaves ?? 0);
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

    const [
      ticketsOpened,
      ticketsClosed,
      ticketsOpen,
      ticketRows,
      ordersNew,
      ordersDone,
      activeOrders,
      payments,
      verifs,
      reviews,
    ] = await Promise.all([
      prisma.ticket.count({ where: { openedAt: { gte: since } } }),
      prisma.ticket.count({ where: { closedAt: { gte: since } } }),
      prisma.ticket.count({ where: { status: { in: ['OPEN', 'CLAIMED', 'WAITING_CLIENT'] } } }),
      prisma.ticket.findMany({
        where: { openedAt: { gte: since } },
        select: { openedAt: true, firstStaffReplyAt: true, rating: true },
      }),
      prisma.order.count({ where: { createdAt: { gte: since } } }),
      prisma.order.count({ where: { completedAt: { gte: since } } }),
      prisma.order.findMany({
        where: { status: { in: ACTIVE_ORDER_STATUSES } },
        include: { payments: true },
      }),
      prisma.payment.aggregate({ where: { paidAt: { gte: since } }, _sum: { amount: true }, _count: true }),
      prisma.verificationEvent.groupBy({
        by: ['result'],
        where: { createdAt: { gte: since } },
        _count: true,
      }),
      prisma.review.aggregate({ where: { approved: true }, _avg: { rating: true }, _count: true }),
    ]);

    const firstResp = avg(
      ticketRows
        .filter((t) => t.firstStaffReplyAt)
        .map((t) => t.firstStaffReplyAt!.getTime() - t.openedAt.getTime()),
    );
    const ratings = ticketRows.map((t) => t.rating).filter((r): r is number => r !== null);
    const receivables = activeOrders.reduce((s, o) => s + Math.max(0, totalsOf(o).due ?? 0), 0);
    const verif = (r: string) => verifs.find((v) => v.result === r)?._count ?? 0;
    const showMoney = isAdmin(interaction.member, config);
    const members = interaction.guild.memberCount;

    const panel = card({
      tone: 'brand',
      emoji: 'checklist',
      title: `Statystyki • ostatnie ${days} dni`,
      timestamp: true,
    })
      .text(
        `### ${e('users')} Społeczność\n` +
          `**Członkowie:** ${members} (${sum(joins) - sum(leaves) >= 0 ? '+' : ''}${sum(joins) - sum(leaves)}) • wejścia **${sum(joins)}**, wyjścia **${sum(leaves)}**\n` +
          `\`${sparkline(joins)}\` wejścia dziennie\n` +
          `**Wiadomości:** ${sum(messages).toLocaleString('pl-PL')} (śr. ${Math.round(sum(messages) / days)} / dzień)\n` +
          `\`${sparkline(messages)}\` wiadomości dziennie\n` +
          `**Weryfikacje:** ✅ ${verif('PASSED') + verif('MANUAL')} • ❌ ${verif('FAILED')} • ⛔ ${verif('BLOCKED_AGE') + verif('BLOCKED_LOCKDOWN')}`,
      )
      .banner('attachment://wykres.png', 'Wiadomości (słupki) i wejścia (linia) dziennie')
      .separator()
      .text(
        `### ${e('ticket')} Tickety\n` +
          `**Nowe:** ${ticketsOpened} • **zamknięte:** ${ticketsClosed} • **otwarte teraz:** ${ticketsOpen}\n` +
          `**Śr. czas 1. odpowiedzi:** ${firstResp === null ? '—' : formatDuration(firstResp)} • **ocena obsługi:** ${ratings.length ? `${avg(ratings)!.toFixed(2)} ⭐ (${ratings.length})` : '—'}`,
      )
      .separator()
      .text(
        `### ${e('package')} Zlecenia\n` +
          `**Nowe:** ${ordersNew} • **zakończone:** ${ordersDone} • **w toku:** ${activeOrders.length}\n` +
          (showMoney
            ? `**Wpłaty:** ${formatMoney(Number(payments._sum.amount ?? 0))} (${payments._count}) • **należności:** ${formatMoney(receivables)}\n`
            : '') +
          `**Opinie:** ${reviews._count ? `${(reviews._avg.rating ?? 0).toFixed(2)} ⭐ z ${reviews._count}` : '—'}`,
      );
    if (!showMoney) panel.footer('Kwoty widzi tylko administracja');

    const chart = new AttachmentBuilder(barChart(messages, joins), { name: 'wykres.png' });
    return interaction.editReply({ ...v2(panel, { files: [chart] }), flags: ['IsComponentsV2'] });
  },
});

export const statsModule = defineModule({
  name: 'stats',
  description: 'Statystyki serwera, ticketów i zleceń z wykresami',
  commands: [statsCommand],
  jobs: [defineJob({ name: 'flush', intervalMs: 10 * 60_000, run: flush })],
  events: [
    defineEvent({
      event: 'messageCreate',
      run: (_c, m) => {
        if (!m.author.bot && m.guildId === env.GUILD_ID)
          void bump('messages').catch((err) => log.debug('stat', err));
      },
    }),
    defineEvent({
      event: 'guildMemberAdd',
      run: (_c, m) => (m.guild.id === env.GUILD_ID ? bump('joins') : undefined),
    }),
    defineEvent({
      event: 'guildMemberRemove',
      run: (_c, m) => (m.guild.id === env.GUILD_ID ? bump('leaves') : undefined),
    }),
  ],
});
