import {
  ChannelSelectMenuBuilder,
  ChannelType,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import type { GuildConfig } from '../../generated/prisma/client.js';
import { Panel } from '../../ui/builders/container.js';
import { button } from '../../ui/builders/buttons.js';
import { card } from '../../ui/components/card.js';
import { e, emojiComponent } from '../../ui/emojis.js';
import { logChannelsOf } from './service.js';
import { LOG_TYPES, LOG_TYPE_KEYS, type LogType } from './types.js';

export function logsPanel(config: GuildConfig, notice?: string): Panel {
  const channels = logChannelsOf(config);
  const active = LOG_TYPE_KEYS.filter((t) => channels[t]).length;

  const panel = new Panel({ tone: 'brand' }).title('database', 'Logi serwera');
  if (notice) panel.text(notice);
  panel
    .text(
      `Każdy typ logów może trafiać na osobny kanał. Typ bez kanału jest **wyłączony**.\n-# Aktywne: ${active}/${LOG_TYPE_KEYS.length}`,
    )
    .separator()
    .text(
      LOG_TYPE_KEYS.map((t) => {
        const def = LOG_TYPES[t];
        return `${e(def.emoji)} **${def.label}** → ${channels[t] ? `<#${channels[t]}>` : '`wyłączone`'}\n-# ${def.description}`;
      }).join('\n'),
    )
    .separator()
    .text(
      `${e('shield_x')} **Ignorowane kanały / kategorie:** ${
        config.logIgnoredChannels.length
          ? config.logIgnoredChannels.map((id) => `<#${id}>`).join(' ')
          : '`brak`'
      }`,
    )
    .select(
      new StringSelectMenuBuilder()
        .setCustomId('logs:type')
        .setPlaceholder('Wybierz typ logów do ustawienia…')
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setValue('all')
            .setLabel('Wszystkie typy naraz')
            .setDescription('Jeden kanał na wszystkie logi')
            .setEmoji(emojiComponent('database')),
          ...LOG_TYPE_KEYS.map((t) =>
            new StringSelectMenuOptionBuilder()
              .setValue(t)
              .setLabel(LOG_TYPES[t].label)
              .setDescription(LOG_TYPES[t].description.slice(0, 100))
              .setEmoji(emojiComponent(LOG_TYPES[t].emoji)),
          ),
        ),
    )
    .select(
      new ChannelSelectMenuBuilder()
        .setCustomId('logs:ignore')
        .setPlaceholder('Kanały i kategorie pomijane w logach…')
        .setChannelTypes(
          ChannelType.GuildText,
          ChannelType.GuildVoice,
          ChannelType.GuildCategory,
          ChannelType.GuildAnnouncement,
          ChannelType.GuildForum,
        )
        .setMinValues(0)
        .setMaxValues(25)
        .setDefaultChannels(config.logIgnoredChannels.slice(0, 25)),
    )
    .footer('Bot potrzebuje uprawnienia „Wyświetlanie dziennika zdarzeń”, żeby wiedzieć, kto wykonał akcję');
  return panel;
}

export function channelPicker(config: GuildConfig, type: LogType | 'all'): Panel {
  const current = type === 'all' ? undefined : logChannelsOf(config)[type];
  const def = type === 'all' ? null : LOG_TYPES[type];
  const select = new ChannelSelectMenuBuilder()
    .setCustomId(`logs:set:${type}`)
    .setPlaceholder('Wybierz kanał…')
    .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    .setMinValues(1)
    .setMaxValues(1);
  if (current) select.setDefaultChannels(current);

  return card({
    tone: 'info',
    emoji: def?.emoji ?? 'database',
    title: def ? `Kanał logów: ${def.label}` : 'Kanał dla wszystkich logów',
    description: def
      ? `${def.description}\nObecnie: ${current ? `<#${current}>` : '`wyłączone`'}`
      : 'Wszystkie typy logów trafią na wybrany kanał.',
    timestamp: false,
  })
    .select(select)
    .buttons(
      button('logs:back', 'Wróć', { emoji: 'checklist' }),
      button(`logs:off:${type}`, type === 'all' ? 'Wyłącz wszystkie' : 'Wyłącz ten typ', {
        style: 'danger',
        emoji: 'shield_x',
      }),
    );
}
