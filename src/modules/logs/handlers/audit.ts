import { AuditLogEvent, type Guild, type GuildAuditLogsEntry } from 'discord.js';
import type { ZxClient } from '../../../client.js';
import { getConfig } from '../../../core/config-service.js';
import { card, change } from '../../../ui/components/card.js';
import type { EmojiName } from '../../../ui/emojis.js';
import type { ToneName } from '../../../ui/theme.js';
import { discordTime, formatDuration, truncate } from '../../../utils/format.js';
import { permissionDiff } from '../../../utils/permissions-pl.js';
import { sendLog } from '../service.js';
import type { LogType } from '../types.js';

type TargetKind = 'channel' | 'role' | 'user' | 'invite' | 'webhook' | 'emoji' | 'sticker' | 'guild' | 'none';

interface ActionMeta {
  type: LogType;
  title: string;
  emoji: EmojiName;
  tone: ToneName;
  target: TargetKind;
}

const A = AuditLogEvent;

/** Obsługiwane zdarzenia dziennika. Reszta jest pomijana. */
const ACTIONS: Partial<Record<AuditLogEvent, ActionMeta>> = {
  [A.GuildUpdate]: {
    type: 'server',
    title: 'Zmieniono ustawienia serwera',
    emoji: 'server',
    tone: 'warning',
    target: 'guild',
  },
  [A.ChannelCreate]: {
    type: 'channels',
    title: 'Utworzono kanał',
    emoji: 'documentation',
    tone: 'success',
    target: 'channel',
  },
  [A.ChannelUpdate]: {
    type: 'channels',
    title: 'Zmieniono kanał',
    emoji: 'documentation',
    tone: 'warning',
    target: 'channel',
  },
  [A.ChannelDelete]: {
    type: 'channels',
    title: 'Usunięto kanał',
    emoji: 'documentation',
    tone: 'error',
    target: 'channel',
  },
  [A.ChannelOverwriteCreate]: {
    type: 'channels',
    title: 'Dodano uprawnienia kanału',
    emoji: 'lock',
    tone: 'info',
    target: 'channel',
  },
  [A.ChannelOverwriteUpdate]: {
    type: 'channels',
    title: 'Zmieniono uprawnienia kanału',
    emoji: 'lock',
    tone: 'warning',
    target: 'channel',
  },
  [A.ChannelOverwriteDelete]: {
    type: 'channels',
    title: 'Usunięto uprawnienia kanału',
    emoji: 'unlock',
    tone: 'error',
    target: 'channel',
  },
  [A.ThreadCreate]: {
    type: 'channels',
    title: 'Utworzono wątek',
    emoji: 'discord',
    tone: 'success',
    target: 'channel',
  },
  [A.ThreadUpdate]: {
    type: 'channels',
    title: 'Zmieniono wątek',
    emoji: 'discord',
    tone: 'warning',
    target: 'channel',
  },
  [A.ThreadDelete]: {
    type: 'channels',
    title: 'Usunięto wątek',
    emoji: 'discord',
    tone: 'error',
    target: 'channel',
  },
  [A.MemberKick]: {
    type: 'moderation',
    title: 'Wyrzucono członka',
    emoji: 'user_remove',
    tone: 'error',
    target: 'user',
  },
  [A.MemberPrune]: {
    type: 'moderation',
    title: 'Czystka nieaktywnych członków',
    emoji: 'users',
    tone: 'error',
    target: 'none',
  },
  [A.MemberBanAdd]: {
    type: 'moderation',
    title: 'Zbanowano członka',
    emoji: 'shield_x',
    tone: 'error',
    target: 'user',
  },
  [A.MemberBanRemove]: {
    type: 'moderation',
    title: 'Odbanowano członka',
    emoji: 'shield_check',
    tone: 'success',
    target: 'user',
  },
  [A.MemberUpdate]: {
    type: 'members',
    title: 'Zmieniono członka',
    emoji: 'user',
    tone: 'info',
    target: 'user',
  },
  [A.MemberRoleUpdate]: {
    type: 'members',
    title: 'Zmieniono role członka',
    emoji: 'crown',
    tone: 'info',
    target: 'user',
  },
  [A.MemberMove]: {
    type: 'voice',
    title: 'Przeniesiono członków (głos)',
    emoji: 'notification',
    tone: 'warning',
    target: 'none',
  },
  [A.MemberDisconnect]: {
    type: 'voice',
    title: 'Rozłączono członków (głos)',
    emoji: 'notification',
    tone: 'warning',
    target: 'none',
  },
  [A.BotAdd]: { type: 'server', title: 'Dodano bota', emoji: 'bot', tone: 'warning', target: 'user' },
  [A.RoleCreate]: { type: 'roles', title: 'Utworzono rolę', emoji: 'crown', tone: 'success', target: 'role' },
  [A.RoleUpdate]: { type: 'roles', title: 'Zmieniono rolę', emoji: 'crown', tone: 'warning', target: 'role' },
  [A.RoleDelete]: { type: 'roles', title: 'Usunięto rolę', emoji: 'crown', tone: 'error', target: 'role' },
  [A.InviteCreate]: {
    type: 'server',
    title: 'Utworzono zaproszenie',
    emoji: 'user_add',
    tone: 'info',
    target: 'invite',
  },
  [A.InviteDelete]: {
    type: 'server',
    title: 'Usunięto zaproszenie',
    emoji: 'user_remove',
    tone: 'neutral',
    target: 'invite',
  },
  [A.WebhookCreate]: {
    type: 'server',
    title: 'Utworzono webhook',
    emoji: 'code',
    tone: 'warning',
    target: 'webhook',
  },
  [A.WebhookUpdate]: {
    type: 'server',
    title: 'Zmieniono webhook',
    emoji: 'code',
    tone: 'warning',
    target: 'webhook',
  },
  [A.WebhookDelete]: {
    type: 'server',
    title: 'Usunięto webhook',
    emoji: 'code',
    tone: 'neutral',
    target: 'webhook',
  },
  [A.EmojiCreate]: {
    type: 'server',
    title: 'Dodano emotkę',
    emoji: 'star',
    tone: 'success',
    target: 'emoji',
  },
  [A.EmojiUpdate]: {
    type: 'server',
    title: 'Zmieniono emotkę',
    emoji: 'star',
    tone: 'warning',
    target: 'emoji',
  },
  [A.EmojiDelete]: {
    type: 'server',
    title: 'Usunięto emotkę',
    emoji: 'star',
    tone: 'neutral',
    target: 'emoji',
  },
  [A.StickerCreate]: {
    type: 'server',
    title: 'Dodano naklejkę',
    emoji: 'gift',
    tone: 'success',
    target: 'sticker',
  },
  [A.StickerUpdate]: {
    type: 'server',
    title: 'Zmieniono naklejkę',
    emoji: 'gift',
    tone: 'warning',
    target: 'sticker',
  },
  [A.StickerDelete]: {
    type: 'server',
    title: 'Usunięto naklejkę',
    emoji: 'gift',
    tone: 'neutral',
    target: 'sticker',
  },
  [A.MessagePin]: {
    type: 'messages',
    title: 'Przypięto wiadomość',
    emoji: 'notification',
    tone: 'info',
    target: 'user',
  },
  [A.MessageUnpin]: {
    type: 'messages',
    title: 'Odpięto wiadomość',
    emoji: 'notification',
    tone: 'neutral',
    target: 'user',
  },
  [A.AutoModerationBlockMessage]: {
    type: 'moderation',
    title: 'AutoMod zablokował wiadomość',
    emoji: 'shield_check',
    tone: 'warning',
    target: 'user',
  },
  [A.AutoModerationUserCommunicationDisabled]: {
    type: 'moderation',
    title: 'AutoMod wyciszył członka',
    emoji: 'shield_check',
    tone: 'error',
    target: 'user',
  },
};

const KEY_LABELS: Record<string, string> = {
  name: 'Nazwa',
  topic: 'Temat',
  nsfw: 'NSFW',
  rate_limit_per_user: 'Tryb powolny',
  bitrate: 'Bitrate',
  user_limit: 'Limit osób',
  position: 'Pozycja',
  permissions: 'Uprawnienia',
  allow: 'Zezwolono',
  deny: 'Zabroniono',
  color: 'Kolor',
  hoist: 'Wyświetlana osobno',
  mentionable: 'Można wzmiankować',
  nick: 'Pseudonim',
  communication_disabled_until: 'Wyciszenie do',
  deaf: 'Ogłuszony (serwer)',
  mute: 'Wyciszony (serwer)',
  icon_hash: 'Ikona',
  banner_hash: 'Baner',
  splash_hash: 'Tło zaproszenia',
  avatar_hash: 'Avatar',
  description: 'Opis',
  vanity_url_code: 'Własny link',
  verification_level: 'Poziom weryfikacji',
  explicit_content_filter: 'Filtr treści',
  default_message_notifications: 'Domyślne powiadomienia',
  afk_channel_id: 'Kanał AFK',
  afk_timeout: 'Czas AFK',
  system_channel_id: 'Kanał systemowy',
  rules_channel_id: 'Kanał zasad',
  public_updates_channel_id: 'Kanał aktualizacji',
  channel_id: 'Kanał',
  max_uses: 'Maks. użyć',
  max_age: 'Ważność',
  code: 'Kod',
  temporary: 'Tymczasowe członkostwo',
  archived: 'Zarchiwizowany',
  locked: 'Zablokowany',
  auto_archive_duration: 'Auto-archiwizacja',
  default_auto_archive_duration: 'Domyślna auto-archiwizacja',
  type: 'Typ',
  tags: 'Tagi',
  unicode_emoji: 'Emotka roli',
  $add: 'Nadane role',
  $remove: 'Odebrane role',
};

/** Klucze pomijane – techniczne albo bez wartości dla człowieka. */
const SKIP_KEYS = new Set([
  'id',
  'flags',
  'guild_id',
  'available',
  'inviter_id',
  'uses',
  'application_id',
  'available_tags',
  'permission_overwrites',
]);

function plain(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? '✅ tak' : '❌ nie';
  if (key === 'color' && typeof value === 'number') return `\`#${value.toString(16).padStart(6, '0')}\``;
  if (key.endsWith('channel_id') && typeof value === 'string') return `<#${value}>`;
  if (key === 'communication_disabled_until' && typeof value === 'string')
    return discordTime(new Date(value), 'f');
  if (key === 'rate_limit_per_user' && typeof value === 'number') return value ? `${value} s` : 'wyłączony';
  if ((key === 'max_age' || key === 'afk_timeout') && typeof value === 'number')
    return value ? formatDuration(value * 1000) : 'bez limitu';
  if (key.endsWith('_hash')) return 'nowa grafika';
  if (key === '$add' || key === '$remove') {
    return (value as { id: string }[]).map((r) => `<@&${r.id}>`).join(' ');
  }
  if (typeof value === 'object') return `\`${truncate(JSON.stringify(value), 150)}\``;
  return truncate(String(value), 200);
}

function formatChange(c: { key: string; old?: unknown; new?: unknown }): string | null {
  if (SKIP_KEYS.has(c.key)) return null;
  const label = KEY_LABELS[c.key] ?? c.key;

  if (c.key === 'permissions' || c.key === 'allow' || c.key === 'deny') {
    // Dziennik podaje uprawnienia jako liczbę w stringu.
    const bits = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? BigInt(v) : 0n);
    const { added, removed } = permissionDiff(bits(c.old), bits(c.new));
    if (!added.length && !removed.length) return null;
    return `**${label}:**${added.length ? `\n➕ ${added.join(', ')}` : ''}${removed.length ? `\n➖ ${removed.join(', ')}` : ''}`;
  }
  if (c.key === '$add' || c.key === '$remove') return `**${label}:** ${plain(c.key, c.new)}`;
  if (c.old === undefined) return `**${label}:** ${plain(c.key, c.new)}`;
  if (c.new === undefined) return `**${label}:** ~~${plain(c.key, c.old)}~~`;
  return `**${label}:** ${change(plain(c.key, c.old), plain(c.key, c.new))}`;
}

const prop = (obj: unknown, key: string): unknown =>
  obj && typeof obj === 'object' && key in obj ? (obj as Record<string, unknown>)[key] : undefined;

function targetText(entry: GuildAuditLogsEntry, kind: TargetKind, guild: Guild): string | null {
  const id = entry.targetId;
  const nameFromChanges = entry.changes.find((c) => c.key === 'name');
  const name = (prop(entry.target, 'name') ?? nameFromChanges?.new ?? nameFromChanges?.old) as
    string | undefined;
  const deleted = [A.ChannelDelete, A.RoleDelete, A.ThreadDelete].includes(entry.action);

  switch (kind) {
    case 'channel':
      return deleted ? `#${name ?? id}` : `<#${id}>${name ? ` (${name})` : ''}`;
    case 'role':
      return deleted ? `@${name ?? id}` : `<@&${id}>`;
    case 'user': {
      const username = prop(entry.target, 'username') as string | undefined;
      return id ? `<@${id}>${username ? ` (${username})` : ''}` : null;
    }
    case 'invite': {
      const code = (prop(entry.target, 'code') ??
        entry.changes.find((c) => c.key === 'code')?.new ??
        entry.changes.find((c) => c.key === 'code')?.old) as string | undefined;
      return code ? `\`discord.gg/${code}\`` : null;
    }
    case 'webhook':
    case 'sticker':
      return name ? `**${name}**` : id;
    case 'emoji':
      return name ? `:${name}:` : id;
    case 'guild':
      return guild.name;
    case 'none':
      return null;
  }
}

function extraFields(
  entry: GuildAuditLogsEntry,
  guildId: string,
): { emoji: EmojiName; label: string; value: string }[] {
  const extra = entry.extra as unknown;
  const out: { emoji: EmojiName; label: string; value: string }[] = [];
  const channel = prop(extra, 'channel');
  const channelId = (prop(channel, 'id') ?? prop(extra, 'channelId')) as string | undefined;
  if (channelId) out.push({ emoji: 'discord', label: 'Kanał', value: `<#${channelId}>` });
  const count = prop(extra, 'count');
  if (typeof count === 'number') out.push({ emoji: 'users', label: 'Liczba osób', value: String(count) });
  const removed = prop(extra, 'removed');
  if (typeof removed === 'number')
    out.push({
      emoji: 'users',
      label: 'Usunięto',
      value: `${removed} (nieaktywni ${prop(extra, 'days')} dni)`,
    });
  const rule = prop(extra, 'autoModerationRuleName');
  if (typeof rule === 'string') out.push({ emoji: 'checklist', label: 'Reguła AutoMod', value: rule });
  const messageId = prop(extra, 'messageId');
  if (typeof messageId === 'string' && channelId) {
    out.push({
      emoji: 'discord',
      label: 'Wiadomość',
      value: `https://discord.com/channels/${guildId}/${channelId}/${messageId}`,
    });
  }
  return out;
}

export async function onAuditLogEntry(
  client: ZxClient,
  entry: GuildAuditLogsEntry,
  guild: Guild,
): Promise<void> {
  const meta = ACTIONS[entry.action];
  if (!meta) return;
  // Akcje samego bota (kanały ticketów, rola po weryfikacji…) bot loguje sam – tu by dublowały.
  if (entry.executorId && entry.executorId === client.user?.id) return;

  const config = await getConfig();
  if (meta.target === 'channel' && entry.targetId && config.logIgnoredChannels.includes(entry.targetId))
    return;

  let type = meta.type;
  let title = meta.title;
  let tone = meta.tone;
  let emoji = meta.emoji;
  let changes = entry.changes;

  // Zmiana członka: wyciszenie (timeout) i wyciszenie/ogłuszenie serwerowe to moderacja.
  if (entry.action === A.MemberUpdate) {
    const timeout = changes.find((c) => c.key === 'communication_disabled_until');
    if (timeout) {
      type = 'moderation';
      emoji = 'lock';
      const until = timeout.new as string | undefined;
      title =
        until && new Date(until).getTime() > Date.now() ? 'Wyciszono członka (timeout)' : 'Zdjęto wyciszenie';
      tone = until ? 'error' : 'success';
      changes = [timeout];
    } else if (changes.some((c) => c.key === 'mute' || c.key === 'deaf')) {
      type = 'moderation';
      title = 'Wyciszenie / ogłuszenie na kanałach głosowych';
    } else if (changes.some((c) => c.key === 'nick')) {
      title = 'Zmiana pseudonimu';
      emoji = 'user';
    }
  }
  if (entry.action === A.MemberRoleUpdate) {
    const added = changes.some((c) => c.key === '$add');
    const removed = changes.some((c) => c.key === '$remove');
    title =
      added && !removed ? 'Nadano rolę' : removed && !added ? 'Odebrano rolę' : 'Zmieniono role członka';
    tone = added && !removed ? 'success' : removed && !added ? 'warning' : 'info';
  }

  const executor = entry.executorId ? await client.users.fetch(entry.executorId).catch(() => null) : null;
  const targetUser =
    meta.target === 'user' && entry.targetId
      ? await client.users.fetch(entry.targetId).catch(() => null)
      : null;
  const lines = changes.map(formatChange).filter((l): l is string => !!l);

  await sendLog(
    client,
    type,
    card({
      tone,
      emoji,
      title,
      thumbnail:
        (type === 'moderation' ? targetUser : executor)?.displayAvatarURL({ size: 128 }) ?? undefined,
      fields: [
        {
          emoji: 'user_crown',
          label: 'Wykonał(a)',
          value: executor ? `<@${executor.id}> (${executor.username})` : 'nieznany',
        },
        { emoji: 'cube', label: 'Cel', value: targetText(entry, meta.target, guild) },
        ...extraFields(entry, guild.id),
        { emoji: 'documentation', label: 'Powód', value: entry.reason ? truncate(entry.reason, 300) : null },
      ],
      body: lines.length ? truncate(lines.join('\n'), 1800) : undefined,
      footer: entry.targetId ? `ID celu: ${entry.targetId}` : undefined,
    }),
  );
}
