import {
  AttachmentBuilder,
  FileBuilder,
  type Collection,
  type Message,
  type OmitPartialGroupDMChannel,
  type PartialMessage,
  type ReadonlyCollection,
  type Snowflake,
} from 'discord.js';
import type { ZxClient } from '../../../client.js';
import { getConfig } from '../../../core/config-service.js';
import { linkButton } from '../../../ui/builders/buttons.js';
import { card, codeBlock, diffBlock } from '../../../ui/components/card.js';
import { discordTime, truncate } from '../../../utils/format.js';
import { isIgnored, isLogChannel, sendLog } from '../service.js';

type AnyMessage = OmitPartialGroupDMChannel<Message | PartialMessage>;

async function shouldSkip(message: AnyMessage): Promise<boolean> {
  if (!message.inGuild()) return true;
  if (message.author?.bot || message.webhookId) return true;
  const config = await getConfig();
  return isIgnored(config, message.channel) || isLogChannel(config, message.channelId);
}

function attachmentsText(message: AnyMessage): string | null {
  if (!message.attachments.size) return null;
  return message.attachments.map((a) => `[${truncate(a.name, 60)}](${a.url})`).join(', ');
}

export async function onMessageDelete(client: ZxClient, message: AnyMessage): Promise<void> {
  if (await shouldSkip(message)) return;
  const known = !message.partial;
  const author = message.author;

  await sendLog(
    client,
    'messages',
    card({
      tone: 'error',
      emoji: 'shield_x',
      title: 'Wiadomość usunięta',
      thumbnail: author?.displayAvatarURL({ size: 128 }),
      fields: [
        {
          emoji: 'user',
          label: 'Autor',
          value: author ? `<@${author.id}> (${author.username})` : 'nieznany',
        },
        { emoji: 'discord', label: 'Kanał', value: `<#${message.channelId}>` },
        { emoji: 'calendar', label: 'Wysłana', value: discordTime(message.createdAt, 'R') },
        { emoji: 'cloud_upload', label: 'Załączniki', value: attachmentsText(message) },
      ],
      body: known
        ? message.content
          ? codeBlock(truncate(message.content, 1800))
          : '-# (bez treści tekstowej)'
        : '-# Treść niedostępna – wiadomość wysłana przed uruchomieniem bota',
      footer: `ID wiadomości: ${message.id}`,
    }),
  );
}

export async function onMessageUpdate(
  client: ZxClient,
  before: AnyMessage,
  after: AnyMessage,
): Promise<void> {
  if (await shouldSkip(after)) return;
  if (after.partial) after = await after.fetch().catch(() => after);
  if (!before.partial && before.content === after.content) return;
  const author = after.author;

  await sendLog(
    client,
    'messages',
    card({
      tone: 'warning',
      emoji: 'code_file',
      title: 'Wiadomość edytowana',
      thumbnail: author?.displayAvatarURL({ size: 128 }),
      fields: [
        {
          emoji: 'user',
          label: 'Autor',
          value: author ? `<@${author.id}> (${author.username})` : 'nieznany',
        },
        { emoji: 'discord', label: 'Kanał', value: `<#${after.channelId}>` },
      ],
      body: before.partial
        ? `-# Poprzednia treść niedostępna (sprzed uruchomienia bota)\n${diffBlock([['+', truncate(after.content ?? '', 1500)]])}`
        : diffBlock([
            ['-', truncate(before.content || '(pusto)', 900)],
            ['+', truncate(after.content || '(pusto)', 900)],
          ]),
      footer: `ID wiadomości: ${after.id}`,
    }).buttons(linkButton(after.url, 'Przejdź do wiadomości', 'discord')),
  );
}

export async function onMessageBulkDelete(
  client: ZxClient,
  messages: ReadonlyCollection<Snowflake, AnyMessage> | Collection<Snowflake, AnyMessage>,
  channelId: string,
): Promise<void> {
  const config = await getConfig();
  const first = messages.first();
  if (!first?.inGuild() || isIgnored(config, first.channel) || isLogChannel(config, channelId)) return;

  const sorted = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const lines = sorted.map((m) => {
    const time = m.createdAt.toISOString().replace('T', ' ').slice(0, 19);
    const who = m.author ? `${m.author.username} (${m.author.id})` : 'nieznany';
    const text = m.partial ? '[treść niedostępna]' : m.content || '[bez treści]';
    const files = m.attachments.size ? ` [załączniki: ${m.attachments.map((a) => a.url).join(' ')}]` : '';
    return `[${time}] ${who}: ${text}${files}`;
  });
  const name = `usuniete-${channelId}-${Date.now()}.txt`;

  const panel = card({
    tone: 'error',
    emoji: 'shield_x',
    title: `Masowe usunięcie: ${messages.size} wiadomości`,
    fields: [
      { emoji: 'discord', label: 'Kanał', value: `<#${channelId}>` },
      { emoji: 'users', label: 'Autorzy', value: String(new Set(sorted.map((m) => m.author?.id)).size) },
    ],
  });
  panel.container.addFileComponents(new FileBuilder().setURL(`attachment://${name}`));
  await sendLog(client, 'messages', panel, [
    new AttachmentBuilder(Buffer.from(lines.join('\n'), 'utf8'), { name }),
  ]);
}
