import type { SendableChannels } from 'discord.js';
import type { ZxClient } from '../client.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('channels');

export async function getSendableChannel(
  client: ZxClient,
  channelId: string | null | undefined,
): Promise<SendableChannels | null> {
  if (!channelId) return null;
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isSendable()) {
    log.warn(`Kanał ${channelId} jest niedostępny dla bota`);
    return null;
  }
  return channel;
}
