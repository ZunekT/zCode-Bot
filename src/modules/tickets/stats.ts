import type { Ticket } from '../../generated/prisma/client.js';
import { prisma } from '../../db/prisma.js';
import { Panel } from '../../ui/builders/container.js';
import { e } from '../../ui/emojis.js';
import { formatDuration } from '../../utils/format.js';
import { ACTIVE_STATUSES, CATEGORIES, CATEGORY_KEYS } from './constants.js';

export const PERIODS = {
  '7d': { label: 'ostatnie 7 dni', days: 7 },
  '30d': { label: 'ostatnie 30 dni', days: 30 },
  '90d': { label: 'ostatnie 90 dni', days: 90 },
  all: { label: 'od początku', days: null },
} as const;

export type PeriodKey = keyof typeof PERIODS;

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const stars = (n: number | null) => (n === null ? '—' : `${n.toFixed(2)} ⭐`);

export async function ticketStatsPanel(period: PeriodKey): Promise<Panel> {
  const { label, days } = PERIODS[period];
  const since = days ? new Date(Date.now() - days * 86_400_000) : undefined;

  const [tickets, openNow] = await Promise.all([
    prisma.ticket.findMany({ where: since ? { openedAt: { gte: since } } : {} }),
    prisma.ticket.count({ where: { status: { in: ACTIVE_STATUSES } } }),
  ]);

  const closed = tickets.filter((t) => t.closedAt);
  const ratings = tickets.map((t) => t.rating).filter((r): r is number => r !== null);
  const firstResponse = tickets
    .filter((t) => t.firstStaffReplyAt)
    .map((t) => t.firstStaffReplyAt!.getTime() - t.openedAt.getTime());
  const resolution = closed.map((t) => t.closedAt!.getTime() - t.openedAt.getTime());

  const byCategory = CATEGORY_KEYS.map((c) => {
    const n = tickets.filter((t) => t.category === c).length;
    return n ? `${e(CATEGORIES[c].emoji)} ${CATEGORIES[c].label}: **${n}**` : null;
  }).filter(Boolean);

  // Ranking obsługi wg przejętych ticketów
  const staff = new Map<string, Ticket[]>();
  for (const t of tickets) if (t.claimedBy) staff.set(t.claimedBy, [...(staff.get(t.claimedBy) ?? []), t]);
  const ranking = [...staff.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10)
    .map(([id, ts], i) => {
      const r = avg(ts.map((t) => t.rating).filter((x): x is number => x !== null));
      return `**${i + 1}.** <@${id}> – ${ts.length} ticketów • ${stars(r)}`;
    });

  const avgFirst = avg(firstResponse);
  const avgResolution = avg(resolution);

  return new Panel({ tone: 'brand' })
    .title('checklist', `Statystyki ticketów • ${label}`)
    .list([
      { emoji: 'ticket', label: 'Utworzone:', value: String(tickets.length) },
      { emoji: 'lock', label: 'Zamknięte:', value: String(closed.length) },
      { emoji: 'unlock', label: 'Otwarte teraz:', value: String(openNow) },
      {
        emoji: 'lightning',
        label: 'Średni czas 1. odpowiedzi:',
        value: avgFirst === null ? '—' : formatDuration(avgFirst),
      },
      {
        emoji: 'calendar',
        label: 'Średni czas rozwiązania:',
        value: avgResolution === null ? '—' : formatDuration(avgResolution),
      },
      { emoji: 'star', label: 'Średnia ocena:', value: `${stars(avg(ratings))} (${ratings.length} ocen)` },
    ])
    .separator()
    .title('cube', 'Kategorie', 3)
    .text(byCategory.join('\n') || 'Brak ticketów w tym okresie.')
    .separator()
    .title('users', 'Obsługa', 3)
    .text(ranking.join('\n') || 'Nikt jeszcze nie przejął ticketu.');
}
