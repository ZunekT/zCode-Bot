import { randomInt } from 'node:crypto';
import type { Guild, GuildMember } from 'discord.js';
import type { Giveaway, GuildConfig } from '../../generated/prisma/client.js';
import type { ZxClient } from '../../client.js';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { getSendableChannel } from '../../core/channels.js';
import { isStaff } from '../../core/permissions.js';
import { button } from '../../ui/builders/buttons.js';
import { v2Message } from '../../ui/builders/payload.js';
import { card, quote } from '../../ui/components/card.js';
import { e } from '../../ui/emojis.js';
import { discordTime, truncate } from '../../utils/format.js';
import { createLogger } from '../../utils/logger.js';
import { cancelRefresh, scheduleRefresh } from '../../utils/refresh.js';

const log = createLogger('giveaways');

export function canManage(member: GuildMember, config: GuildConfig): boolean {
  return isStaff(member, config) || (!!config.giveawayManagerRoleId && member.roles.cache.has(config.giveawayManagerRoleId));
}

const mentions = (ids: string[]) => ids.map((id) => `<@${id}>`).join(', ');

export function giveawayPanel(g: Giveaway, entries: number, pingRoleId?: string | null) {
  const finished = g.ended || g.cancelled;
  const requirements = [
    g.requiredRoleId && `rola <@&${g.requiredRoleId}>`,
    g.minAccountDays > 0 && `konto starsze niż ${g.minAccountDays} dni`,
  ].filter(Boolean);
  const panel = card({
    tone: g.cancelled ? 'neutral' : finished ? 'success' : 'brand',
    emoji: 'gift',
    title: `${truncate(g.prize, 200)}${g.cancelled ? ' · anulowany' : g.ended ? ' · zakończony' : ''}`,
    description: g.description ? quote(truncate(g.description, 1000)) : undefined,
    fields: [
      {
        emoji: 'calendar',
        label: finished ? 'Zakończony' : 'Koniec',
        value: `${discordTime(g.endsAt, 'f')}${finished ? '' : ` (${discordTime(g.endsAt, 'R')})`}`,
      },
      { emoji: 'star', label: 'Zwycięzcy', value: String(g.winners) },
      { emoji: 'users', label: 'Uczestnicy', value: String(entries) },
      { emoji: 'user_crown', label: 'Organizator', value: `<@${g.hostId}>` },
      { emoji: 'shield_check', label: 'Wymagania', value: requirements.length ? requirements.join(', ') : null },
    ],
    body: g.ended
      ? g.winnerIds.length
        ? `${e('crown')} **Wygrywa:** ${mentions(g.winnerIds)}`
        : 'Nikt nie spełnił warunków – brak zwycięzców.'
      : undefined,
    footer: `Giveaway #${g.id}`,
    timestamp: false,
  });
  if (!finished) {
    if (pingRoleId) panel.footer(`<@&${pingRoleId}>`);
    panel.buttons(
      button(`giveaway:join:${g.id}`, 'Dołącz', { style: 'primary', emoji: 'gift' }),
      button(`giveaway:info:${g.id}`, 'Szanse', { emoji: 'star' }),
    );
  }
  return panel;
}

export async function refreshMessage(client: ZxClient, id: number): Promise<void> {
  const g = await prisma.giveaway.findUnique({ where: { id } });
  if (!g?.messageId) return;
  const channel = await getSendableChannel(client, g.channelId);
  if (!channel || !('messages' in channel)) return;
  const message = await channel.messages.fetch(g.messageId).catch(() => null);
  if (!message) return;
  const entries = await prisma.giveawayEntry.count({ where: { giveawayId: id } });
  await message.edit(v2Message(giveawayPanel(g, entries)));
}

export const queueRefresh = (client: ZxClient, id: number) =>
  scheduleRefresh(`giveaway:${id}`, () => refreshMessage(client, id));

async function eligible(guild: Guild, g: Giveaway, userIds: string[]): Promise<string[]> {
  if (!userIds.length) return [];
  const members = await guild.members.fetch({ user: userIds }).catch(() => null);
  if (!members) return [];
  return userIds.filter((id) => {
    const m = members.get(id);
    if (!m || m.user.bot) return false;
    if (g.requiredRoleId && !m.roles.cache.has(g.requiredRoleId)) return false;
    if (g.minAccountDays > 0 && Date.now() - m.user.createdTimestamp < g.minAccountDays * 86_400_000) return false;
    return true;
  });
}

function pick(pool: string[], count: number): string[] {
  const list = [...pool];
  for (let i = list.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [list[i], list[j]] = [list[j]!, list[i]!];
  }
  return list.slice(0, count);
}

async function drawWinners(client: ZxClient, g: Giveaway, count: number, exclude: string[] = []): Promise<string[]> {
  const guild = await client.guilds.fetch(env.GUILD_ID).catch(() => null);
  if (!guild) return [];
  const entries = await prisma.giveawayEntry.findMany({ where: { giveawayId: g.id }, select: { userId: true } });
  const pool = entries.map((x) => x.userId).filter((id) => !exclude.includes(id));
  const winners: string[] = [];
  for (const chunk of chunked(pick(pool, pool.length), 100)) {
    winners.push(...(await eligible(guild, g, chunk)));
    if (winners.length >= count) break;
  }
  return winners.slice(0, count);
}

function chunked<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function announce(client: ZxClient, g: Giveaway, winners: string[], reroll: boolean): Promise<void> {
  const channel = await getSendableChannel(client, g.channelId);
  if (!channel) return;
  const panel = card({
    tone: winners.length ? 'success' : 'warning',
    emoji: 'gift',
    title: reroll ? 'Ponowne losowanie' : 'Wyniki giveawaya',
    description: winners.length
      ? `Gratulacje ${mentions(winners)}! Wygrana: **${truncate(g.prize, 200)}**.\nOdbiór nagrody: napisz do <@${g.hostId}>.`
      : `Brak uczestników spełniających warunki – **${truncate(g.prize, 200)}** nie trafia do nikogo.`,
    footer: `Giveaway #${g.id}`,
    timestamp: false,
  });
  await channel
    .send({
      ...v2Message(panel, { allowedMentions: { users: winners } }),
      ...(g.messageId && { reply: { messageReference: g.messageId, failIfNotExists: false } }),
    })
    .catch((err) => log.warn(`Nie ogłoszono wyników giveawaya #${g.id}`, err));
}

export async function finish(client: ZxClient, id: number): Promise<Giveaway | null> {
  const { count } = await prisma.giveaway.updateMany({ where: { id, ended: false, cancelled: false }, data: { ended: true } });
  if (!count) return null;
  cancelRefresh(`giveaway:${id}`);
  const g = (await prisma.giveaway.findUnique({ where: { id } }))!;
  const winners = await drawWinners(client, g, g.winners);
  const done = await prisma.giveaway.update({ where: { id }, data: { winnerIds: winners, endsAt: g.endsAt > new Date() ? new Date() : g.endsAt } });
  await refreshMessage(client, id).catch(() => undefined);
  await announce(client, done, winners, false);
  return done;
}

export async function reroll(client: ZxClient, g: Giveaway, count: number): Promise<string[]> {
  const winners = await drawWinners(client, g, count, g.winnerIds);
  if (winners.length) {
    await prisma.giveaway.update({ where: { id: g.id }, data: { winnerIds: [...g.winnerIds, ...winners] } });
    await refreshMessage(client, g.id).catch(() => undefined);
  }
  await announce(client, g, winners, true);
  return winners;
}

export async function finishDue(client: ZxClient): Promise<void> {
  const due = await prisma.giveaway.findMany({
    where: { ended: false, cancelled: false, endsAt: { lte: new Date() } },
    select: { id: true },
    take: 10,
  });
  for (const { id } of due) await finish(client, id).catch((err) => log.error(`Giveaway #${id}`, err));
}
