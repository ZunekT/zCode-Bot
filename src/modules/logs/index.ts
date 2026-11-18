import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { audit } from '../../core/audit.js';
import { getConfig, updateConfig } from '../../core/config-service.js';
import { UserError } from '../../core/errors.js';
import { defineCommand, defineComponent, defineEvent, defineModule } from '../../core/types.js';
import { v2, v2Message } from '../../ui/builders/payload.js';
import { card } from '../../ui/components/card.js';
import { e } from '../../ui/emojis.js';
import { onAuditLogEntry } from './handlers/audit.js';
import { onMemberAdd, onMemberRemove, onMemberUpdate, onVoiceStateUpdate } from './handlers/members.js';
import { onMessageBulkDelete, onMessageDelete, onMessageUpdate } from './handlers/messages.js';
import { channelPicker, logsPanel } from './panel.js';
import { logChannelsOf, sendLog } from './service.js';
import { LOG_TYPES, LOG_TYPE_KEYS, isLogType, type LogType } from './types.js';

const parseType = (v: string | undefined): LogType | 'all' => {
  if (v === 'all' || isLogType(v)) return v;
  throw new UserError('Nieznany typ logów.');
};

const logsCommand = defineCommand({
  data: new SlashCommandBuilder()
    .setName('logi')
    .setDescription('[Admin] Logi serwera')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) => s.setName('konfiguracja').setDescription('Ustaw kanały logów'))
    .addSubcommand((s) =>
      s.setName('test').setDescription('Wyślij testowy wpis na każdy ustawiony kanał logów'),
    ),
  access: 'admin',
  allowInMaintenance: true,

  async run(interaction, { client, config }) {
    if (interaction.options.getSubcommand() === 'konfiguracja') {
      return interaction.reply(v2(logsPanel(config), { ephemeral: true }));
    }

    const channels = logChannelsOf(config);
    const active = LOG_TYPE_KEYS.filter((t) => channels[t]);
    if (!active.length)
      throw new UserError('Żaden typ logów nie ma kanału. Ustaw je w `/logi konfiguracja`.');
    for (const t of active) {
      await sendLog(
        client,
        t,
        card({
          tone: 'brand',
          emoji: LOG_TYPES[t].emoji,
          title: `Test logów: ${LOG_TYPES[t].label}`,
          description: `Ten kanał odbiera logi typu **${LOG_TYPES[t].label}**.`,
          fields: [{ emoji: 'user', label: 'Test wysłał(a)', value: `<@${interaction.user.id}>` }],
        }),
      );
    }
    return interaction.reply(
      v2(
        card({
          tone: 'success',
          title: 'Wysłano testowe wpisy',
          description: active
            .map((t) => `${e(LOG_TYPES[t].emoji)} ${LOG_TYPES[t].label} → <#${channels[t]}>`)
            .join('\n'),
          timestamp: false,
        }),
        { ephemeral: true },
      ),
    );
  },
});

export const logsModule = defineModule({
  name: 'logs',
  description: 'Logi serwera: wiadomości, członkowie, moderacja, kanały, role',
  commands: [logsCommand],
  components: [
    defineComponent({
      id: 'logs:type',
      type: 'select',
      access: 'admin',
      allowInMaintenance: true,
      async run(interaction, _args, { config }) {
        await interaction.update(v2Message(channelPicker(config, parseType(interaction.values[0]))));
      },
    }),
    defineComponent({
      id: 'logs:set',
      type: 'select',
      access: 'admin',
      allowInMaintenance: true,
      async run(interaction, args, { client, config }) {
        if (!interaction.isChannelSelectMenu()) return;
        const type = parseType(args[0]);
        const channel = interaction.channels.first();
        if (!channel || !('permissionsFor' in channel) || channel.type === ChannelType.GuildCategory) {
          throw new UserError('Wybierz kanał tekstowy.');
        }
        const me = interaction.guild.members.me;
        if (
          !me ||
          !channel.permissionsFor(me)?.has(['ViewChannel', 'SendMessages', 'AttachFiles', 'EmbedLinks'])
        ) {
          throw new UserError(
            `Bot nie może pisać na <#${channel.id}> (potrzebne: wysyłanie wiadomości i załączanie plików).`,
          );
        }

        const channels = { ...logChannelsOf(config) };
        for (const t of type === 'all' ? LOG_TYPE_KEYS : [type]) channels[t] = channel.id;
        const updated = await updateConfig({ logChannels: channels as Prisma.InputJsonValue });
        const label = type === 'all' ? 'Wszystkie typy' : LOG_TYPES[type].label;
        await audit(client, {
          action: 'logs.channel',
          actorId: interaction.user.id,
          targetId: channel.id,
          summary: `Logi **${label}** → <#${channel.id}>`,
        });
        await interaction.update(v2Message(logsPanel(updated, `Zapisano: **${label}** → <#${channel.id}>`)));
      },
    }),
    defineComponent({
      id: 'logs:off',
      type: 'button',
      access: 'admin',
      allowInMaintenance: true,
      async run(interaction, args, { client, config }) {
        const type = parseType(args[0]);
        const channels = { ...logChannelsOf(config) };
        for (const t of type === 'all' ? LOG_TYPE_KEYS : [type]) delete channels[t];
        const updated = await updateConfig({ logChannels: channels as Prisma.InputJsonValue });
        const label = type === 'all' ? 'Wszystkie typy' : LOG_TYPES[type].label;
        await audit(client, {
          action: 'logs.off',
          actorId: interaction.user.id,
          summary: `Wyłączono logi: **${label}**`,
        });
        await interaction.update(v2Message(logsPanel(updated, `${e('shield_x')} Wyłączono: **${label}**`)));
      },
    }),
    defineComponent({
      id: 'logs:back',
      type: 'button',
      access: 'admin',
      allowInMaintenance: true,
      async run(interaction) {
        await interaction.update(v2Message(logsPanel(await getConfig())));
      },
    }),
    defineComponent({
      id: 'logs:ignore',
      type: 'select',
      access: 'admin',
      allowInMaintenance: true,
      async run(interaction, _args, { client }) {
        const ids = [...interaction.values];
        const updated = await updateConfig({ logIgnoredChannels: ids });
        await audit(client, {
          action: 'logs.ignore',
          actorId: interaction.user.id,
          summary: `Ignorowane w logach: ${ids.length ? ids.map((id) => `<#${id}>`).join(' ') : 'brak'}`,
        });
        await interaction.update(
          v2Message(logsPanel(updated, `${e('order_complete')} Zapisano ignorowane kanały (${ids.length}).`)),
        );
      },
    }),
  ],
  events: [
    defineEvent({ event: 'messageDelete', run: (client, m) => onMessageDelete(client, m) }),
    defineEvent({
      event: 'messageUpdate',
      run: (client, before, after) => onMessageUpdate(client, before, after),
    }),
    defineEvent({
      event: 'messageDeleteBulk',
      run: (client, messages, channel) => onMessageBulkDelete(client, messages, channel.id),
    }),
    defineEvent({ event: 'guildMemberAdd', run: (client, m) => onMemberAdd(client, m) }),
    defineEvent({ event: 'guildMemberRemove', run: (client, m) => onMemberRemove(client, m) }),
    defineEvent({
      event: 'guildMemberUpdate',
      run: (client, before, after) => onMemberUpdate(client, before, after),
    }),
    defineEvent({
      event: 'voiceStateUpdate',
      run: (client, before, after) => onVoiceStateUpdate(client, before, after),
    }),
    defineEvent({
      event: 'guildAuditLogEntryCreate',
      run: (client, entry, guild) => onAuditLogEntry(client, entry, guild),
    }),
  ],
});
