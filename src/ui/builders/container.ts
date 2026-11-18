import {
  ActionRowBuilder,
  type ButtonBuilder,
  ContainerBuilder,
  MediaGalleryBuilder,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  ThumbnailBuilder,
  type ChannelSelectMenuBuilder,
  type RoleSelectMenuBuilder,
  type StringSelectMenuBuilder,
  type UserSelectMenuBuilder,
} from 'discord.js';
import { DiscordLimits } from '../../config/constants.js';
import { truncate } from '../../utils/format.js';
import { e, type EmojiName } from '../emojis.js';
import { Tone, type ToneName } from '../theme.js';

type AnySelect =
  StringSelectMenuBuilder | UserSelectMenuBuilder | RoleSelectMenuBuilder | ChannelSelectMenuBuilder;

export interface PanelOptions {
  /** Ton komunikatu – ustawia kolor akcentu. */
  tone?: ToneName;
  /** Własny kolor akcentu (nadpisuje tone). */
  accent?: number;
  spoiler?: boolean;
}

/**
 * Fluent wrapper na ContainerBuilder (Components v2).
 *
 * new Panel({ tone: 'info' })
 *   .banner('attachment://banner.png')
 *   .title('ticket', 'Centrum pomocy')
 *   .text('Wybierz kategorię poniżej.')
 *   .separator()
 *   .select(menu)
 *   .footer('zxCode • Tickety')
 *   .build();
 */
export class Panel {
  readonly container: ContainerBuilder;

  constructor(options: PanelOptions = {}) {
    this.container = new ContainerBuilder();
    const accent = options.accent ?? (options.tone ? Tone[options.tone].color : undefined);
    if (accent !== undefined) this.container.setAccentColor(accent);
    if (options.spoiler) this.container.setSpoiler(true);
  }

  /** Nagłówek: "## <emoji> Tytuł" */
  title(emoji: EmojiName | null, title: string, level: 1 | 2 | 3 = 2): this {
    const prefix = '#'.repeat(level);
    return this.text(`${prefix} ${emoji ? `${e(emoji)} ` : ''}${title}`);
  }

  /** Blok markdown. Zbyt długi tekst jest przycinany do limitu Discorda. */
  text(content: string): this {
    this.container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(truncate(content, DiscordLimits.textDisplayLength)),
    );
    return this;
  }

  /** Lista punktów z emotką. */
  list(items: { emoji?: EmojiName; label: string; value?: string }[]): this {
    const lines = items.map(
      (i) => `${i.emoji ? `${e(i.emoji)} ` : '• '}**${i.label}**${i.value ? ` ${i.value}` : ''}`,
    );
    return this.text(lines.join('\n'));
  }

  /** Pola klucz-wartość ("**Status:** W realizacji"). */
  fields(fields: Record<string, string | number | null | undefined>): this {
    const lines = Object.entries(fields)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `**${k}:** ${v}`);
    return lines.length ? this.text(lines.join('\n')) : this;
  }

  separator(divider = true, spacing: 'small' | 'large' = 'small'): this {
    this.container.addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(divider)
        .setSpacing(spacing === 'large' ? SeparatorSpacingSize.Large : SeparatorSpacingSize.Small),
    );
    return this;
  }

  /** Sekcja z tekstem i miniaturką po prawej. */
  sectionWithThumbnail(content: string, imageUrl: string, description?: string): this {
    const thumb = new ThumbnailBuilder().setURL(imageUrl);
    if (description) thumb.setDescription(description);
    this.container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(truncate(content, DiscordLimits.textDisplayLength)),
        )
        .setThumbnailAccessory(thumb),
    );
    return this;
  }

  /** Sekcja z tekstem i przyciskiem po prawej. */
  sectionWithButton(content: string, button: ButtonBuilder): this {
    this.container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(truncate(content, DiscordLimits.textDisplayLength)),
        )
        .setButtonAccessory(button),
    );
    return this;
  }

  /** Obrazek na całą szerokość (URL albo attachment://plik.png). */
  banner(url: string, description?: string): this {
    return this.gallery([{ url, description }]);
  }

  gallery(items: { url: string; description?: string; spoiler?: boolean }[]): this {
    const gallery = new MediaGalleryBuilder();
    for (const item of items.slice(0, 10)) {
      gallery.addItems((i) => {
        i.setURL(item.url);
        if (item.description) i.setDescription(item.description);
        if (item.spoiler) i.setSpoiler(true);
        return i;
      });
    }
    this.container.addMediaGalleryComponents(gallery);
    return this;
  }

  /** Rząd przycisków (max 5). */
  buttons(...buttons: ButtonBuilder[]): this {
    if (buttons.length === 0) return this;
    this.container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(0, 5)),
    );
    return this;
  }

  /** Rząd z jednym select menu. */
  select(menu: AnySelect): this {
    this.container.addActionRowComponents(new ActionRowBuilder<AnySelect>().addComponents(menu));
    return this;
  }

  /** Mała stopka na dole panelu. */
  footer(content: string): this {
    return this.text(`-# ${content}`);
  }

  build(): ContainerBuilder {
    return this.container;
  }
}
