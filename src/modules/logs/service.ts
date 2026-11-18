import type { AttachmentBuilder, GuildBasedChannel } from 'discord.js';
import type { GuildConfig } from '../../generated/prisma/client.js';
import type { ZxClient } from '../../client.js';
import { getSendableChannel } from '../../core/channels.js';
import { getConfig, isModuleEnabled } from '../../core/config-service.js';
import type { Panel } from '../../ui/builders/container.js';
import { v2Message } from '../../ui/builders/payload.js';
import { createLogger } from '../../utils/logger.js';
import type { LogType } from './types.js';

const log = createLogger('logs');

export function logChannelsOf(config: GuildConfig): Partial<Record<LogType, string>> {
  return (config.logChannels ?? {}) as Partial<Record<LogType, string>>;
}

export function isIgnored(config: GuildConfig, channel: GuildBasedChannel | null | undefined): boolean {
  if (!channel) return false;
  const ignored = config.logIgnoredChannels;
  if (!ignored.length) return false;
  const ids = [channel.id, channel.parentId, channel.isThread() ? channel.parent?.parentId : null];
  return ids.some((id) => !!id && ignored.includes(id));
}

export function isLogChannel(config: GuildConfig, channelId: string | null | undefined): boolean {
  return !!channelId && Object.values(logChannelsOf(config)).includes(channelId);
}

export async function sendLog(
  client: ZxClient,
  type: LogType,
  panel: Panel,
  files?: AttachmentBuilder[],
): Promise<void> {
  try {
    const config = await getConfig();
    if (!isModuleEnabled(config, 'logs')) return;
    const channelId = logChannelsOf(config)[type];
    if (!channelId) return;
    const channel = await getSendableChannel(client, channelId);
    await channel?.send(v2Message(panel, { files }));
  } catch (err) {
    log.warn(`Nie udało się wysłać logu (${type})`, err);
  }
}
