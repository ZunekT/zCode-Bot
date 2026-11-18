import type { Ticket } from '../../generated/prisma/client.js';
import { prisma } from '../../db/prisma.js';
import { Panel } from '../../ui/builders/container.js';
import { tableBlock } from '../../ui/components/card.js';
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
const stars = (n: number | null) => (n === null ? '—' : `${n.toFixed(2)} / 5`);

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

  const catRows = CATEGORY_KEYS.map(
    (c) => [CATEGORIES[c].label, String(tickets.filter((t) => t.category === c).length)] as [string, string],
  ).filter(([, n]) => n !== '0');

  return new Panel({ tone: 'brand' })
    .title('checklist', `Statystyki ticketów • ${label}`)
    .text(
      tableBlock([
        ['Utworzone', String(tickets.length)],
        ['Zamknięte', String(closed.length)],
        ['Otwarte teraz', String(openNow)],
        ['Śr. 1. odpowiedź', avgFirst === null ? '—' : formatDuration(avgFirst)],
        ['Śr. rozwiązanie', avgResolution === null ? '—' : formatDuration(avgResolution)],
        ['Śr. ocena', `${stars(avg(ratings))} (${ratings.length})`],
      ]),
    )
    .text('### Kategorie\n' + (catRows.length ? tableBlock(catRows) : '-# Brak ticketów w tym okresie.'))
    .separator()
    .text('### Obsługa\n' + (ranking.join('\n') || '-# Nikt jeszcze nie przejął ticketu.'));
}
