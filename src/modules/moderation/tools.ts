import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type GuildTextBasedChannel,
  type Message,
  type NewsChannel,
  type TextChannel,
} from 'discord.js';
import { UserError } from '../../core/errors.js';
import { defineCommand } from '../../core/types.js';
import { v2, v2Message } from '../../ui/builders/payload.js';
import { card, quote } from '../../ui/components/card.js';
import { formatDuration, truncate } from '../../utils/format.js';

const LOCKABLE = [ChannelType.GuildText, ChannelType.GuildAnnouncement] as const;
const LOCK_PERMS = ['SendMessages', 'SendMessagesInThreads', 'CreatePublicThreads', 'AddReactions'] as const;

function lockable(channel: unknown): TextChannel | NewsChannel {
  const ch = channel as { type?: ChannelType } | null;
  if (!ch || !LOCKABLE.includes(ch.type as (typeof LOCKABLE)[number]))
    throw new UserError('To działa tylko na kanałach tekstowych i ogłoszeń.');
  return channel as TextChannel | NewsChannel;
}

const purge = defineCommand({
  data: new SlashCommandBuilder()
    .setName('wyczysc')
    .setDescription('Usuń ostatnie wiadomości na tym kanale (do 14 dni wstecz)')
    .addIntegerOption((o) => o.setName('ilosc').setDescription('Ile wiadomości (1–100)').setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption((o) => o.setName('uzytkownik').setDescription('Tylko wiadomości tej osoby'))
    .addStringOption((o) => o.setName('zawiera').setDescription('Tylko wiadomości zawierające tekst').setMaxLength(100))
    .addBooleanOption((o) => o.setName('boty').setDescription('Tylko wiadomości botów'))
    .addBooleanOption((o) => o.setName('linki').setDescription('Tylko wiadomości z linkami lub zaproszeniami'))
    .addBooleanOption((o) => o.setName('zalaczniki').setDescription('Tylko wiadomości z załącznikami')),
  access: 'staff',
  cooldown: 5,
  async run(i) {
    const channel = i.channel as GuildTextBasedChannel | null;
    if (!channel || !('bulkDelete' in channel)) throw new UserError('Na tym kanale nie da się czyścić wiadomości.');
    if (!channel.permissionsFor(i.guild.members.me!)?.has(PermissionFlagsBits.ManageMessages))
      throw new UserError('Bot nie ma uprawnienia „Zarządzanie wiadomościami” na tym kanale.');

    const amount = i.options.getInteger('ilosc', true);
    const user = i.options.getUser('uzytkownik');
    const contains = i.options.getString('zawiera')?.toLowerCase();
    const bots = i.options.getBoolean('boty');
    const links = i.options.getBoolean('linki');
    const files = i.options.getBoolean('zalaczniki');
    const filtered = !!(user || contains || bots || links || files);

    await i.deferReply({ flags: ['Ephemeral'] });
    const fetched = await channel.messages.fetch({ limit: 100 });
    const cutoff = Date.now() - 14 * 86_400_000 + 60_000;
    const matches = (m: Message) =>
      !m.pinned &&
      m.createdTimestamp > cutoff &&
      (!user || m.author.id === user.id) &&
      (!bots || m.author.bot) &&
      (!contains || m.content.toLowerCase().includes(contains)) &&
      (!links || /(https?:\/\/|discord\.gg\/|discord\.com\/invite\/)/i.test(m.content)) &&
      (!files || m.attachments.size > 0);
    const targets = [...fetched.values()].filter(matches).slice(0, amount);
    if (!targets.length)
      return i.editReply(v2Message(card({ tone: 'warning', title: 'Nic do usunięcia', description: 'Brak pasujących wiadomości z ostatnich 14 dni (przypięte są pomijane).', timestamp: false })));

    const deleted = await channel.bulkDelete(targets, true);
    return i.editReply(
      v2Message(
        card({
          tone: 'success',
          emoji: 'tools',
          title: `Usunięte wiadomości: ${deleted.size}`,
          description: filtered ? `Przejrzano ${fetched.size} ostatnich wiadomości z filtrami.` : undefined,
          timestamp: false,
        }),
      ),
    );
  },
});

const slowmode = defineCommand({
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Ustaw tryb powolny na kanale')
    .addIntegerOption((o) =>
      o.setName('sekundy').setDescription('Odstęp między wiadomościami (0 = wyłącz, maks. 21600)').setRequired(true).setMinValue(0).setMaxValue(21_600),
    )
    .addChannelOption((o) => o.setName('kanal').setDescription('Domyślnie ten kanał').addChannelTypes(...LOCKABLE)),
  access: 'staff',
  async run(i) {
    const channel = lockable(i.options.getChannel('kanal') ?? i.channel);
    const seconds = i.options.getInteger('sekundy', true);
    await channel.setRateLimitPerUser(seconds, `${i.user.username}: slowmode`);
    return i.reply(
      v2(
        card({
          tone: seconds ? 'info' : 'success',
          emoji: 'calendar',
          title: seconds ? 'Tryb powolny włączony' : 'Tryb powolny wyłączony',
          description: seconds ? `${channel}: jedna wiadomość co **${formatDuration(seconds * 1000)}**.` : `${channel}: bez ograniczeń.`,
          timestamp: false,
        }),
        { ephemeral: true },
      ),
    );
  },
});

const lock = defineCommand({
  data: new SlashCommandBuilder()
    .setName('zablokuj')
    .setDescription('Zablokuj pisanie na kanale (obsługa nadal może pisać)')
    .addChannelOption((o) => o.setName('kanal').setDescription('Domyślnie ten kanał').addChannelTypes(...LOCKABLE))
    .addStringOption((o) => o.setName('powod').setDescription('Powód widoczny na kanale').setMaxLength(500)),
  access: 'staff',
  async run(i, { config }) {
    const channel = lockable(i.options.getChannel('kanal') ?? i.channel);
    const reason = i.options.getString('powod');
    const everyone = i.guild.roles.everyone;
    if (channel.permissionOverwrites.cache.get(everyone.id)?.deny.has(PermissionFlagsBits.SendMessages))
      throw new UserError(`${channel} jest już zablokowany.`);
    const why = `${i.user.username}: blokada kanału`;
    if (config.staffRoleId)
      await channel.permissionOverwrites.edit(config.staffRoleId, { SendMessages: true, SendMessagesInThreads: true }, { reason: why });
    await channel.permissionOverwrites.edit(everyone, Object.fromEntries(LOCK_PERMS.map((p) => [p, false])), { reason: why });
    await channel
      .send(v2Message(card({ tone: 'warning', emoji: 'lock', title: 'Kanał zablokowany', description: reason ? quote(truncate(reason, 500)) : 'Pisanie jest chwilowo wyłączone.', timestamp: false })))
      .catch(() => undefined);
    return i.reply(v2(card({ tone: 'success', emoji: 'lock', title: 'Zablokowano', description: `${channel}`, timestamp: false }), { ephemeral: true }));
  },
});

const unlock = defineCommand({
  data: new SlashCommandBuilder()
    .setName('odblokuj')
    .setDescription('Przywróć pisanie na kanale')
    .addChannelOption((o) => o.setName('kanal').setDescription('Domyślnie ten kanał').addChannelTypes(...LOCKABLE)),
  access: 'staff',
  async run(i, { config }) {
    const channel = lockable(i.options.getChannel('kanal') ?? i.channel);
    const everyone = i.guild.roles.everyone;
    if (!channel.permissionOverwrites.cache.get(everyone.id)?.deny.has(PermissionFlagsBits.SendMessages))
      throw new UserError(`${channel} nie jest zablokowany.`);
    const why = `${i.user.username}: odblokowanie kanału`;
    await channel.permissionOverwrites.edit(everyone, Object.fromEntries(LOCK_PERMS.map((p) => [p, null])), { reason: why });
    if (config.staffRoleId && channel.permissionOverwrites.cache.has(config.staffRoleId))
      await channel.permissionOverwrites.edit(config.staffRoleId, { SendMessages: null, SendMessagesInThreads: null }, { reason: why });
    await channel
      .send(v2Message(card({ tone: 'success', emoji: 'unlock', title: 'Kanał odblokowany', description: 'Można znów pisać.', timestamp: false })))
      .catch(() => undefined);
    return i.reply(v2(card({ tone: 'success', emoji: 'unlock', title: 'Odblokowano', description: `${channel}`, timestamp: false }), { ephemeral: true }));
  },
});

export const toolCommands = [purge, slowmode, lock, unlock];
