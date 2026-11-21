import { PermissionFlagsBits, type Guild, type GuildMember, type User } from 'discord.js';
import type { GuildConfig, ModAction, ModCase } from '../../generated/prisma/client.js';
import type { ZxClient } from '../../client.js';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { getSendableChannel } from '../../core/channels.js';
import { getConfig } from '../../core/config-service.js';
import { UserError } from '../../core/errors.js';
import { isAdmin } from '../../core/permissions.js';
import type { Panel } from '../../ui/builders/container.js';
import { v2Message } from '../../ui/builders/payload.js';
import { card, quote } from '../../ui/components/card.js';
import type { EmojiName } from '../../ui/emojis.js';
import type { ToneName } from '../../ui/theme.js';
import { discordTime, formatDuration, truncate } from '../../utils/format.js';
import { createLogger } from '../../utils/logger.js';
import { sendLog } from '../logs/service.js';

const log = createLogger('moderation');

export const MAX_TIMEOUT_MS = 28 * 86_400_000;
export const MAX_TEMPBAN_MS = 365 * 86_400_000;

export const ACTIONS: Record<ModAction, { label: string; emoji: EmojiName; tone: ToneName }> = {
  WARN: { label: 'Ostrzeżenie', emoji: 'notification', tone: 'warning' },
  NOTE: { label: 'Notatka', emoji: 'documentation', tone: 'neutral' },
  TIMEOUT: { label: 'Wyciszenie', emoji: 'lock', tone: 'warning' },
  UNTIMEOUT: { label: 'Zdjęcie wyciszenia', emoji: 'unlock', tone: 'success' },
  KICK: { label: 'Wyrzucenie', emoji: 'user_remove', tone: 'error' },
  SOFTBAN: { label: 'Softban', emoji: 'shield_x', tone: 'error' },
  BAN: { label: 'Ban', emoji: 'shield_x', tone: 'error' },
  UNBAN: { label: 'Odbanowanie', emoji: 'shield_check', tone: 'success' },
};

const NOTIFIED: ModAction[] = ['WARN', 'TIMEOUT', 'UNTIMEOUT', 'KICK', 'SOFTBAN', 'BAN'];
const BAN_LEVEL: ModAction[] = ['BAN', 'SOFTBAN', 'UNBAN'];

export const durationOf = (c: ModCase) => (c.durationMs === null ? null : Number(c.durationMs));

export function canBan(member: GuildMember, config: GuildConfig): boolean {
  return isAdmin(member, config) || member.permissions.has(PermissionFlagsBits.BanMembers);
}

export function assertTarget(actor: GuildMember, target: GuildMember, auto = false): void {
  const guild = target.guild;
  const me = guild.members.me;
  if (!auto && target.id === actor.id) throw new UserError('Nie możesz moderować samego siebie.');
  if (target.id === guild.ownerId) throw new UserError('Nie można ukarać właściciela serwera.');
  if (me && target.id === me.id) throw new UserError('Nie mogę ukarać samego siebie.');
  if (!auto && actor.id !== guild.ownerId && target.roles.highest.comparePositionTo(actor.roles.highest) >= 0)
    throw new UserError('Ta osoba ma rolę równą lub wyższą od Twojej.');
  if (me && target.roles.highest.comparePositionTo(me.roles.highest) >= 0)
    throw new UserError('Rola bota jest niżej niż najwyższa rola tej osoby. Przesuń rolę bota wyżej w ustawieniach serwera.');
}

const auditReason = (actor: User, reason: string | null) =>
  truncate(`${actor.username}: ${reason ?? 'brak powodu'}`, 500);

export function caseCard(c: ModCase, opts: { title?: string } = {}): Panel {
  const a = ACTIONS[c.action];
  const duration = durationOf(c);
  return card({
    tone: c.revokedAt ? 'neutral' : a.tone,
    emoji: a.emoji,
    title: opts.title ?? `Sprawa #${c.id} · ${a.label}${c.revokedAt ? ' (cofnięta)' : ''}`,
    fields: [
      { emoji: 'user', label: 'Użytkownik', value: `<@${c.userId}>${c.userTag ? ` · ${c.userTag}` : ''} · \`${c.userId}\`` },
      { emoji: 'shield_check', label: 'Moderator', value: c.auto ? 'automatycznie' : `<@${c.moderatorId}>` },
      { emoji: 'documentation', label: 'Powód', value: c.reason ? truncate(c.reason, 900) : 'brak' },
      { emoji: 'calendar', label: 'Czas', value: duration ? formatDuration(duration) : null },
      { emoji: 'calendar', label: 'Wygasa', value: c.expiresAt ? `${discordTime(c.expiresAt, 'f')} (${discordTime(c.expiresAt, 'R')})` : null },
      {
        emoji: 'unlock',
        label: 'Cofnięta',
        value: c.revokedAt
          ? `${discordTime(c.revokedAt, 'R')} przez <@${c.revokedById}>${c.revokeReason ? ` · ${truncate(c.revokeReason, 200)}` : ''}`
          : null,
      },
    ],
    footer: discordTime(c.createdAt, 'f'),
    timestamp: false,
  });
}

export async function logCase(client: ZxClient, c: ModCase, title?: string): Promise<void> {
  const config = await getConfig();
  const panel = caseCard(c, { title });
  if (config.modLogChannelId) {
    const channel = await getSendableChannel(client, config.modLogChannelId);
    if (channel) {
      await channel.send(v2Message(panel)).catch((err) => log.warn('Nie wysłano logu sprawy', err));
      return;
    }
  }
  await sendLog(client, 'moderation', panel);
}

async function notify(user: User, guild: Guild, c: ModCase, config: GuildConfig): Promise<boolean> {
  if (!config.modDmUsers || !NOTIFIED.includes(c.action) || user.bot) return false;
  const a = ACTIONS[c.action];
  const duration = durationOf(c);
  const panel = card({
    tone: a.tone,
    emoji: a.emoji,
    title: `${a.label} · ${guild.name}`,
    description: c.reason ? quote(truncate(c.reason, 1500)) : 'Bez podanego powodu.',
    fields: [
      { emoji: 'calendar', label: 'Czas', value: duration ? formatDuration(duration) : null },
      { emoji: 'calendar', label: 'Do', value: c.expiresAt ? discordTime(c.expiresAt, 'f') : null },
    ],
    body: config.modAppealText && c.action !== 'UNTIMEOUT' ? truncate(config.modAppealText, 1000) : undefined,
    footer: `Sprawa #${c.id}`,
    timestamp: false,
  });
  return user.send(v2Message(panel)).then(
    () => true,
    () => false,
  );
}

export async function activeWarns(userId: string, config: GuildConfig): Promise<number> {
  return prisma.modCase.count({
    where: {
      userId,
      action: 'WARN',
      active: true,
      ...(config.warnExpireDays > 0 && {
        createdAt: { gte: new Date(Date.now() - config.warnExpireDays * 86_400_000) },
      }),
    },
  });
}

export interface PunishInput {
  client: ZxClient;
  config: GuildConfig;
  guild: Guild;
  actor: GuildMember;
  user: User;
  action: ModAction;
  reason: string | null;
  durationMs?: number | null;
  deleteSeconds?: number;
  auto?: boolean;
}

export interface PunishResult {
  case: ModCase;
  dmSent: boolean;
  escalation: PunishResult | null;
}

export async function punish(input: PunishInput): Promise<PunishResult> {
  const { client, config, guild, actor, user, action, auto = false } = input;
  const reason = input.reason?.trim() || null;
  if (!auto && !reason && config.modRequireReason && action !== 'NOTE')
    throw new UserError('Podaj powód – wymagają tego ustawienia moderacji.');
  if (action === 'NOTE' && !reason) throw new UserError('Notatka nie może być pusta.');
  if (!auto && BAN_LEVEL.includes(action) && !canBan(actor, config))
    throw new UserError('Bany wymagają administracji albo uprawnienia „Banowanie członków”.');

  const member = await guild.members.fetch(user.id).catch(() => null);
  const needsMember: ModAction[] = ['WARN', 'TIMEOUT', 'UNTIMEOUT', 'KICK'];
  if (needsMember.includes(action) && !member) throw new UserError('Tej osoby nie ma na serwerze.');
  if (member && action !== 'UNBAN' && action !== 'NOTE') assertTarget(actor, member, auto);
  if (!auto && action === 'NOTE' && user.id === actor.id) throw new UserError('Nie możesz dodać notatki samemu sobie.');

  let durationMs = input.durationMs ?? null;
  let expiresAt: Date | null = null;

  if (action === 'TIMEOUT') {
    if (!durationMs) throw new UserError('Podaj czas wyciszenia.');
    if (durationMs < 60_000 || durationMs > MAX_TIMEOUT_MS) throw new UserError('Wyciszenie: od 1 minuty do 28 dni.');
    if (!member!.moderatable) throw new UserError('Bot nie może wyciszyć tej osoby (brak uprawnień lub za niska rola).');
    expiresAt = new Date(Date.now() + durationMs);
  } else if (action === 'UNTIMEOUT') {
    if (!member!.isCommunicationDisabled()) throw new UserError('Ta osoba nie jest wyciszona.');
    if (!member!.moderatable) throw new UserError('Bot nie może zdjąć wyciszenia tej osobie.');
  } else if (action === 'KICK') {
    if (!member!.kickable) throw new UserError('Bot nie może wyrzucić tej osoby (brak uprawnień lub za niska rola).');
  } else if (action === 'BAN' || action === 'SOFTBAN') {
    if (member && !member.bannable) throw new UserError('Bot nie może zbanować tej osoby (brak uprawnień lub za niska rola).');
    const existing = await guild.bans.fetch({ user: user.id, force: true }).catch(() => null);
    if (existing) throw new UserError('Ta osoba ma już bana.');
    if (action === 'BAN' && durationMs) {
      if (durationMs < 60_000 || durationMs > MAX_TEMPBAN_MS) throw new UserError('Ban czasowy: od 1 minuty do 365 dni.');
      expiresAt = new Date(Date.now() + durationMs);
    }
    if (action === 'SOFTBAN') durationMs = null;
  } else if (action === 'UNBAN') {
    const existing = await guild.bans.fetch({ user: user.id, force: true }).catch(() => null);
    if (!existing) throw new UserError('Ta osoba nie ma bana.');
  } else {
    durationMs = null;
  }

  const c = await prisma.modCase.create({
    data: {
      action,
      userId: user.id,
      userTag: user.username,
      moderatorId: actor.id,
      reason,
      durationMs: durationMs === null ? null : BigInt(durationMs),
      expiresAt,
      auto,
      active: action !== 'UNBAN' && action !== 'UNTIMEOUT',
    },
  });

  const notifyFirst = action === 'KICK' || action === 'BAN' || action === 'SOFTBAN';
  let dmSent = notifyFirst ? await notify(user, guild, c, config) : false;
  const why = auditReason(actor.user, reason);

  try {
    if (action === 'TIMEOUT') await member!.timeout(durationMs!, why);
    else if (action === 'UNTIMEOUT') await member!.timeout(null, why);
    else if (action === 'KICK') await member!.kick(why);
    else if (action === 'BAN') await guild.bans.create(user.id, { reason: why, deleteMessageSeconds: input.deleteSeconds ?? 0 });
    else if (action === 'SOFTBAN') {
      await guild.bans.create(user.id, { reason: why, deleteMessageSeconds: input.deleteSeconds ?? 86_400 });
      await guild.bans.remove(user.id, 'Softban – czyszczenie wiadomości');
    } else if (action === 'UNBAN') {
      await guild.bans.remove(user.id, why);
      await prisma.modCase.updateMany({ where: { userId: user.id, action: 'BAN', active: true }, data: { active: false } });
    }
  } catch (err) {
    await prisma.modCase.delete({ where: { id: c.id } }).catch(() => undefined);
    log.warn(`Akcja ${action} na ${user.id} nie powiodła się`, err);
    throw new UserError('Discord odrzucił tę akcję. Sprawdź uprawnienia i pozycję roli bota.');
  }

  if (!notifyFirst) dmSent = await notify(user, guild, c, config);
  if (action !== 'NOTE') await logCase(client, c);

  let escalation: PunishResult | null = null;
  if (action === 'WARN') escalation = await escalate(input, c).catch((err) => {
    log.warn('Automatyczna kara nie powiodła się', err);
    return null;
  });

  return { case: c, dmSent, escalation };
}

async function escalate(input: PunishInput, warn: ModCase): Promise<PunishResult | null> {
  const { config, guild, user } = input;
  const count = await activeWarns(user.id, config);
  const me = guild.members.me;
  if (!me) return null;
  const base = { ...input, actor: me, auto: true, reason: `${count} aktywnych ostrzeżeń (ostatnie: sprawa #${warn.id})` };
  if (config.warnBanAt > 0 && count === config.warnBanAt) return punish({ ...base, action: 'BAN', durationMs: null });
  if (config.warnKickAt > 0 && count === config.warnKickAt) return punish({ ...base, action: 'KICK' });
  if (config.warnTimeoutAt > 0 && count === config.warnTimeoutAt)
    return punish({ ...base, action: 'TIMEOUT', durationMs: Math.min(config.warnTimeoutMinutes, 40_320) * 60_000 });
  return null;
}

export async function expireTempbans(client: ZxClient): Promise<void> {
  const due = await prisma.modCase.findMany({
    where: { action: 'BAN', active: true, expiresAt: { lte: new Date() } },
    take: 25,
  });
  if (!due.length) return;
  const guild = await client.guilds.fetch(env.GUILD_ID).catch(() => null);
  if (!guild) return;
  for (const c of due) {
    const { count } = await prisma.modCase.updateMany({ where: { id: c.id, active: true }, data: { active: false } });
    if (!count) continue;
    const removed = await guild.bans.remove(c.userId, `Koniec bana czasowego (sprawa #${c.id})`).then(
      () => true,
      () => false,
    );
    if (!removed) continue;
    const unban = await prisma.modCase.create({
      data: {
        action: 'UNBAN',
        userId: c.userId,
        userTag: c.userTag,
        moderatorId: client.user?.id ?? 'bot',
        reason: `Koniec bana czasowego (sprawa #${c.id})`,
        auto: true,
        active: false,
      },
    });
    await logCase(client, unban);
  }
}

export function caseLine(c: ModCase): string {
  const a = ACTIONS[c.action];
  const duration = durationOf(c);
  const text = `**#${c.id}** ${a.label}${duration ? ` (${formatDuration(duration)})` : ''} · ${discordTime(c.createdAt, 'R')}${c.auto ? ' · auto' : ''}\n-# ${c.reason ? truncate(c.reason.replace(/\n/g, ' '), 90) : 'bez powodu'}`;
  return c.revokedAt ? `~~${text.split('\n')[0]}~~ (cofnięta)\n${text.split('\n')[1]}` : text;
}

export function resultText(r: PunishResult, user: User): string {
  const a = ACTIONS[r.case.action];
  const lines = [`${a.label}: **${user.username}** · sprawa **#${r.case.id}**`];
  if (NOTIFIED.includes(r.case.action)) lines.push(r.dmSent ? '-# Powiadomienie wysłane w DM.' : '-# Nie udało się wysłać DM (zamknięte wiadomości).');
  if (r.escalation) {
    const e = ACTIONS[r.escalation.case.action];
    lines.push(`Automatyczna kara: **${e.label}**${durationOf(r.escalation.case) ? ` na ${formatDuration(durationOf(r.escalation.case)!)}` : ''} (sprawa #${r.escalation.case.id}).`);
  }
  return lines.join('\n');
}
