import { ButtonBuilder, ButtonStyle } from 'discord.js';
import { emojiComponent, type EmojiName } from '../emojis.js';

type Style = 'primary' | 'secondary' | 'success' | 'danger';

const styles: Record<Style, ButtonStyle> = {
  primary: ButtonStyle.Primary,
  secondary: ButtonStyle.Secondary,
  success: ButtonStyle.Success,
  danger: ButtonStyle.Danger,
};

/** button('ticket:close:42', 'Zamknij', { style: 'danger', emoji: 'lock' }) */
export function button(
  customId: string,
  label: string,
  opts: { style?: Style; emoji?: EmojiName; disabled?: boolean } = {},
): ButtonBuilder {
  const b = new ButtonBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(styles[opts.style ?? 'secondary']);
  if (opts.emoji) b.setEmoji(emojiComponent(opts.emoji));
  if (opts.disabled) b.setDisabled(true);
  return b;
}

export function linkButton(url: string, label: string, emoji?: EmojiName): ButtonBuilder {
  const b = new ButtonBuilder().setURL(url).setLabel(label).setStyle(ButtonStyle.Link);
  if (emoji) b.setEmoji(emojiComponent(emoji));
  return b;
}
