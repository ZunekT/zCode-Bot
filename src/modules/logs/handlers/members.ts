import type { GuildMember, PartialGuildMember, VoiceState } from 'discord.js';
import type { ZxClient } from '../../../client.js';
import { getConfig } from '../../../core/config-service.js';
import { card } from '../../../ui/components/card.js';
import { discordTime, formatDuration, truncate } from '../../../utils/format.js';
import { isIgnored, sendLog } from '../service.js';

const DAY = 86_400_000;
const NEW_ACCOUNT_DAYS = 7;

export async function onMemberAdd(client: ZxClient, member: GuildMember): Promise<void> {
  const age = Date.now() - member.user.createdTimestamp;
  const fresh = age < NEW_ACCOUNT_DAYS * DAY;
  await sendLog(
    client,
    'members',
    card({
      tone: fresh ? 'warning' : 'success',
      emoji: 'user_add',
      title: member.user.bot ? 'Dodano bota' : 'Nowy członek',
      description: `<@${member.id}> dołączył(a) do serwera${fresh ? `\n**Uwaga:** nowe konto, założone ${formatDuration(age)} temu` : ''}`,
      thumbnail: member.displayAvatarURL({ size: 128 }),
      fields: [
        { emoji: 'user', label: 'Użytkownik', value: `${member.user.username} (\`${member.id}\`)` },
        {
          emoji: 'calendar',
          label: 'Konto założone',
          value: `${discordTime(member.user.createdAt, 'D')} (${discordTime(member.user.createdAt, 'R')})`,
        },
        { emoji: 'users', label: 'Członek nr', value: String(member.guild.memberCount) },
      ],
    }),
  );
}

export async function onMemberRemove(
  client: ZxClient,
  member: GuildMember | PartialGuildMember,
): Promise<void> {
  const roles = member.roles?.cache
    .filter((r) => r.id !== member.guild.id)
    .sort((a, b) => b.position - a.position)
    .map((r) => `<@&${r.id}>`);
  await sendLog(
    client,
    'members',
    card({
      tone: 'neutral',
      emoji: 'user_remove',
      title: 'Członek opuścił serwer',
      description: `<@${member.id}> (${member.user?.username ?? 'nieznany'})`,
      thumbnail: member.user?.displayAvatarURL({ size: 128 }),
      fields: [
        {
          emoji: 'calendar',
          label: 'Na serwerze od',
          value: member.joinedAt
            ? `${discordTime(member.joinedAt, 'D')} (${formatDuration(Date.now() - member.joinedAt.getTime())})`
            : null,
        },
        { emoji: 'crown', label: 'Role', value: roles?.length ? truncate(roles.join(' '), 900) : null },
        { emoji: 'users', label: 'Zostało członków', value: String(member.guild.memberCount) },
      ],
      footer: `ID: ${member.id}`,
    }),
  );
}

export async function onMemberUpdate(
  client: ZxClient,
  before: GuildMember | PartialGuildMember,
  after: GuildMember,
): Promise<void> {
  const was = before.premiumSince;
  const is = after.premiumSince;
  if (before.partial || !!was === !!is) return;
  await sendLog(
    client,
    'members',
    card({
      tone: is ? 'brand' : 'neutral',
      emoji: 'rocket',
      title: is ? 'Nowy boost serwera!' : 'Boost zakończony',
      description: is
        ? `<@${after.id}> wspiera serwer boostem. Dziękujemy!`
        : `<@${after.id}> przestał(a) boostować serwer.`,
      thumbnail: after.displayAvatarURL({ size: 128 }),
      fields: [
        { emoji: 'star', label: 'Boosty serwera', value: String(after.guild.premiumSubscriptionCount ?? 0) },
      ],
    }),
  );
}

export async function onVoiceStateUpdate(
  client: ZxClient,
  before: VoiceState,
  after: VoiceState,
): Promise<void> {
  if (before.channelId === after.channelId) return;
  const member = after.member ?? before.member;
  if (!member || member.user.bot) return;
  const config = await getConfig();
  if (isIgnored(config, after.channel ?? before.channel)) return;

  const kind = !before.channelId ? 'join' : !after.channelId ? 'leave' : 'move';
  const meta = {
    join: {
      tone: 'success',
      title: 'Dołączenie do kanału głosowego',
      text: `<@${member.id}> → <#${after.channelId}>`,
    },
    leave: {
      tone: 'neutral',
      title: 'Wyjście z kanału głosowego',
      text: `<@${member.id}> opuścił(a) <#${before.channelId}>`,
    },
    move: {
      tone: 'info',
      title: 'Zmiana kanału głosowego',
      text: `<@${member.id}>: <#${before.channelId}> → <#${after.channelId}>`,
    },
  } as const;

  await sendLog(
    client,
    'voice',
    card({
      tone: meta[kind].tone,
      emoji: 'notification',
      title: meta[kind].title,
      description: meta[kind].text,
      thumbnail: member.displayAvatarURL({ size: 128 }),
      footer: `ID: ${member.id}`,
    }),
  );
}
