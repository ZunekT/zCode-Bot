import {
  ChannelType,
  OverwriteType,
  PermissionFlagsBits,
  type CategoryChannel,
  type Guild,
  type OverwriteResolvable,
  type TextChannel,
} from 'discord.js';
import type { GuildConfig, Ticket } from '../../../generated/prisma/client.js';
import type { ZxClient } from '../../../client.js';
import { DiscordLimits } from '../../../config/constants.js';
import { getSendableChannel } from '../../../core/channels.js';
import type { Panel } from '../../../ui/builders/container.js';
import { v2Message } from '../../../ui/builders/payload.js';

const P = PermissionFlagsBits;

const MEMBER_ALLOW = [
  P.ViewChannel,
  P.SendMessages,
  P.ReadMessageHistory,
  P.AttachFiles,
  P.EmbedLinks,
  P.AddReactions,
];
const STAFF_ALLOW = [...MEMBER_ALLOW, P.ManageMessages];
const BOT_ALLOW = [...STAFF_ALLOW, P.ManageChannels];

/**
 * Uprawnienia kanału ticketu.
 * active = klient i dodane osoby widzą kanał; archived = tylko obsługa (bez pisania).
 */
export function ticketOverwrites(
  guild: Guild,
  ticket: Pick<Ticket, 'userId' | 'participants'>,
  config: GuildConfig,
  mode: 'active' | 'archived',
): OverwriteResolvable[] {
  const me = guild.members.me!;
  const overwrites: OverwriteResolvable[] = [
    { id: guild.roles.everyone.id, deny: [P.ViewChannel], type: OverwriteType.Role },
    { id: me.id, allow: BOT_ALLOW, type: OverwriteType.Member },
  ];

  const staffRoles = [config.staffRoleId, config.adminRoleId].filter(
    (r): r is string => !!r && guild.roles.cache.has(r),
  );
  for (const roleId of new Set(staffRoles)) {
    overwrites.push(
      mode === 'active'
        ? { id: roleId, allow: STAFF_ALLOW, type: OverwriteType.Role }
        : {
            id: roleId,
            allow: [P.ViewChannel, P.ReadMessageHistory],
            deny: [P.SendMessages],
            type: OverwriteType.Role,
          },
    );
  }

  if (mode === 'active') {
    for (const userId of new Set([ticket.userId, ...ticket.participants])) {
      overwrites.push({ id: userId, allow: MEMBER_ALLOW, type: OverwriteType.Member });
    }
  }
  return overwrites;
}

export async function getCategory(guild: Guild, id: string | null): Promise<CategoryChannel | null> {
  if (!id) return null;
  const channel = guild.channels.cache.get(id) ?? (await guild.channels.fetch(id).catch(() => null));
  return channel?.type === ChannelType.GuildCategory ? channel : null;
}

export const hasRoom = (category: CategoryChannel) =>
  category.children.cache.size < DiscordLimits.channelsPerCategory;

export async function getTicketTextChannel(client: ZxClient, ticket: Ticket): Promise<TextChannel | null> {
  if (!ticket.channelId) return null;
  const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
  return channel?.type === ChannelType.GuildText ? channel : null;
}

/** Wysyła wpis na kanał logów (jeśli ustawiony). */
export async function logTicket(client: ZxClient, config: GuildConfig, panel: Panel): Promise<void> {
  const channel = await getSendableChannel(client, config.logChannelId);
  await channel?.send(v2Message(panel)).catch(() => undefined);
}
