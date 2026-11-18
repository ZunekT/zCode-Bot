import type { GuildMember } from 'discord.js';
import type { GuildConfig, VerificationResult } from '../../generated/prisma/client.js';
import type { ZxClient } from '../../client.js';
import { prisma } from '../../db/prisma.js';
import { redis } from '../../db/redis.js';
import { getSendableChannel } from '../../core/channels.js';
import { updateConfig } from '../../core/config-service.js';
import { UserError } from '../../core/errors.js';
import { button } from '../../ui/builders/buttons.js';
import { v2Message } from '../../ui/builders/payload.js';
import { card } from '../../ui/components/card.js';
import { discordTime, formatDuration } from '../../utils/format.js';
import { createLogger } from '../../utils/logger.js';
import { sendLog } from '../logs/service.js';
import { randomCode } from './captcha.js';

const log = createLogger('verification');
const DAY = 86_400_000;

export const CAPTCHA_TTL = 300; // s
export const MAX_ATTEMPTS = 3;
export const FAIL_BLOCK = 10 * 60; // s

const keys = {
  captcha: (userId: string) => `zx:captcha:${userId}`,
  block: (userId: string) => `zx:verify:block:${userId}`,
};

export const isVerified = (member: GuildMember, config: GuildConfig) =>
  !!config.verifiedRoleId && member.roles.cache.has(config.verifiedRoleId);

export async function recordEvent(userId: string, result: VerificationResult): Promise<void> {
  await prisma.verificationEvent.create({ data: { userId, result } }).catch(() => undefined);
}

/**
 * Sprawdzenia przed weryfikacją. Rzuca UserError z czytelnym powodem.
 * Zapisuje zablokowane próby, żeby były widoczne w statystykach.
 */
export async function assertCanVerify(
  client: ZxClient,
  member: GuildMember,
  config: GuildConfig,
): Promise<void> {
  if (!config.verifiedRoleId) {
    throw new UserError(
      'Weryfikacja nie jest skonfigurowana – administracja musi ustawić rolę: `/config rola typ:Zweryfikowany`.',
    );
  }
  if (isVerified(member, config)) throw new UserError('Masz już dostęp do serwera. 🎉', 'Już zweryfikowano');

  if (config.verificationLockdown) {
    await recordEvent(member.id, 'BLOCKED_LOCKDOWN');
    throw new UserError(
      'Weryfikacja jest chwilowo wstrzymana (ochrona przed rajdem). Spróbuj ponownie za kilka minut.',
      'Weryfikacja wstrzymana',
    );
  }

  const blockedFor = await redis.ttl(keys.block(member.id));
  if (blockedFor > 0) {
    throw new UserError(
      `Za dużo błędnych prób. Spróbuj ponownie za **${Math.ceil(blockedFor / 60)} min**.`,
      'Chwila przerwy',
    );
  }

  const minAge = config.verificationMinAccountAgeDays;
  const age = Date.now() - member.user.createdTimestamp;
  if (minAge > 0 && age < minAge * DAY) {
    await recordEvent(member.id, 'BLOCKED_AGE');
    const allowedAt = new Date(member.user.createdTimestamp + minAge * DAY);
    await sendLog(
      client,
      'members',
      card({
        tone: 'warning',
        emoji: 'shield_x',
        title: 'Weryfikacja odrzucona – zbyt nowe konto',
        thumbnail: member.displayAvatarURL({ size: 128 }),
        fields: [
          { emoji: 'user', label: 'Użytkownik', value: `<@${member.id}> (${member.user.username})` },
          { emoji: 'calendar', label: 'Wiek konta', value: formatDuration(age) },
          { emoji: 'lock', label: 'Wymagane', value: `${minAge} dni` },
        ],
      }),
    );
    throw new UserError(
      `Twoje konto jest zbyt nowe. Weryfikacja będzie możliwa ${discordTime(allowedAt, 'R')}.`,
      'Konto zbyt nowe',
    );
  }
}

/** Nowy kod captcha dla użytkownika (zachowuje licznik prób). */
export async function issueCaptcha(userId: string): Promise<string> {
  const code = randomCode();
  const prev = await redis.hget(keys.captcha(userId), 'attempts');
  await redis
    .multi()
    .hset(keys.captcha(userId), { code, attempts: prev ?? '0' })
    .expire(keys.captcha(userId), CAPTCHA_TTL)
    .exec();
  return code;
}

export type CheckResult =
  | { ok: true }
  | { ok: false; reason: 'expired' }
  | { ok: false; reason: 'wrong'; left: number }
  | { ok: false; reason: 'blocked' };

/** Sprawdza wpisany kod. Po MAX_ATTEMPTS błędach blokuje na FAIL_BLOCK sekund. */
export async function checkCaptcha(userId: string, input: string): Promise<CheckResult> {
  const key = keys.captcha(userId);
  const data = await redis.hgetall(key);
  if (!data.code) return { ok: false, reason: 'expired' };

  if (input.trim().toUpperCase().replace(/\s+/g, '') === data.code) {
    await redis.del(key);
    return { ok: true };
  }

  const attempts = await redis.hincrby(key, 'attempts', 1);
  if (attempts >= MAX_ATTEMPTS) {
    await redis.multi().del(key).set(keys.block(userId), '1', 'EX', FAIL_BLOCK).exec();
    await recordEvent(userId, 'FAILED');
    return { ok: false, reason: 'blocked' };
  }
  return { ok: false, reason: 'wrong', left: MAX_ATTEMPTS - attempts };
}

/** Nadaje rolę zweryfikowanego (i zdejmuje „niezweryfikowany”). */
export async function grantAccess(
  client: ZxClient,
  member: GuildMember,
  config: GuildConfig,
  opts: { manualBy?: string } = {},
): Promise<void> {
  if (!config.verifiedRoleId) throw new UserError('Brak ustawionej roli zweryfikowanego.');
  try {
    await member.roles.add(
      config.verifiedRoleId,
      opts.manualBy ? `Ręczna weryfikacja przez ${opts.manualBy}` : 'Weryfikacja',
    );
    if (config.unverifiedRoleId && member.roles.cache.has(config.unverifiedRoleId)) {
      await member.roles.remove(config.unverifiedRoleId, 'Weryfikacja');
    }
  } catch (err) {
    log.error(`Nie udało się nadać roli ${member.id}`, err);
    throw new UserError(
      'Nie mogę nadać roli – rola bota musi być wyżej niż rola zweryfikowanego. Daj znać administracji.',
    );
  }
  await redis.del(keys.captcha(member.id), keys.block(member.id));
  await recordEvent(member.id, opts.manualBy ? 'MANUAL' : 'PASSED');

  const age = Date.now() - member.user.createdTimestamp;
  await sendLog(
    client,
    'members',
    card({
      tone: 'success',
      emoji: 'verified',
      title: opts.manualBy ? 'Ręczna weryfikacja' : 'Członek zweryfikowany',
      thumbnail: member.displayAvatarURL({ size: 128 }),
      fields: [
        { emoji: 'user', label: 'Użytkownik', value: `<@${member.id}> (${member.user.username})` },
        {
          emoji: 'user_crown',
          label: 'Zweryfikował(a)',
          value: opts.manualBy ? `<@${opts.manualBy}>` : null,
        },
        { emoji: 'calendar', label: 'Wiek konta', value: formatDuration(age) },
        {
          emoji: 'lightning',
          label: 'Czas od wejścia',
          value: member.joinedAt ? formatDuration(Date.now() - member.joinedAt.getTime()) : null,
        },
      ],
    }),
  );
}

// ───────────────────────────── Ochrona przed rajdem ─────────────────────────────

const recentJoins: number[] = [];

/**
 * Liczy wejścia w oknie czasowym. Po przekroczeniu progu włącza blokadę weryfikacji
 * i wysyła alert do obsługi z przyciskiem odblokowania.
 */
export async function trackJoin(client: ZxClient, config: GuildConfig): Promise<void> {
  if (!config.antiRaidEnabled || config.verificationLockdown) return;
  const now = Date.now();
  recentJoins.push(now);
  const windowStart = now - config.antiRaidSeconds * 1000;
  while (recentJoins.length && recentJoins[0]! < windowStart) recentJoins.shift();
  if (recentJoins.length < config.antiRaidJoins) return;

  const joins = recentJoins.length;
  recentJoins.length = 0;
  await updateConfig({ verificationLockdown: true });
  log.warn(`Wykryto rajd: ${joins} wejść w ${config.antiRaidSeconds}s – weryfikacja wstrzymana`);

  const panel = card({
    tone: 'error',
    emoji: 'shield_x',
    title: 'Wykryto możliwy rajd!',
    description:
      `${config.staffRoleId ? `<@&${config.staffRoleId}> ` : ''}**${joins} wejść** w ciągu **${config.antiRaidSeconds} s**.\n` +
      'Weryfikacja została **automatycznie wstrzymana** – nowe osoby nie dostaną dostępu, dopóki jej nie odblokujesz.',
    fields: [
      {
        emoji: 'users',
        label: 'Członków serwera',
        value: String((await client.guilds.fetch(config.guildId)).memberCount),
      },
    ],
  }).buttons(button('verify:unlock', 'Odblokuj weryfikację', { style: 'success', emoji: 'unlock' }));

  const alerts = await getSendableChannel(client, config.staffAlertChannelId);
  await alerts
    ?.send({
      ...v2Message(panel),
      allowedMentions: { roles: config.staffRoleId ? [config.staffRoleId] : [] },
    })
    .catch(() => undefined);
  await sendLog(client, 'moderation', panel);
}

/** Do testów. */
export const _resetRaidCounter = () => (recentJoins.length = 0);
