import {
  FileUploadBuilder,
  LabelBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  type ChannelType,
} from 'discord.js';
import { emojiComponent, type EmojiName } from '../emojis.js';

export class Form {
  readonly modal: ModalBuilder;
  private count = 0;

  constructor(customId: string, title: string) {
    this.modal = new ModalBuilder().setCustomId(customId).setTitle(title.slice(0, 45));
  }

  private push(label: LabelBuilder) {
    if (this.count >= 5) throw new Error('Modal może mieć maksymalnie 5 pól');
    this.count++;
    this.modal.addLabelComponents(label);
    return this;
  }

  private label(label: string, description?: string) {
    const l = new LabelBuilder().setLabel(label.slice(0, 45));
    if (description) l.setDescription(description.slice(0, 100));
    return l;
  }

  info(content: string): this {
    this.modal.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
    return this;
  }

  text(opts: {
    id: string;
    label: string;
    description?: string;
    paragraph?: boolean;
    required?: boolean;
    placeholder?: string;
    value?: string;
    min?: number;
    max?: number;
  }): this {
    const input = new TextInputBuilder()
      .setCustomId(opts.id)
      .setStyle(opts.paragraph ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setRequired(opts.required ?? true);
    if (opts.placeholder) input.setPlaceholder(opts.placeholder.slice(0, 100));
    if (opts.value) input.setValue(opts.value.slice(0, opts.max ?? 4000));
    if (opts.min !== undefined) input.setMinLength(opts.min);
    if (opts.max !== undefined) input.setMaxLength(opts.max);
    return this.push(this.label(opts.label, opts.description).setTextInputComponent(input));
  }

  select(opts: {
    id: string;
    label: string;
    description?: string;
    required?: boolean;
    min?: number;
    max?: number;
    placeholder?: string;
    options: { value: string; label: string; description?: string; emoji?: EmojiName; default?: boolean }[];
  }): this {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(opts.id)
      .setRequired(opts.required ?? true)
      .addOptions(
        opts.options.map((o) => {
          const opt = new StringSelectMenuOptionBuilder().setValue(o.value).setLabel(o.label);
          if (o.description) opt.setDescription(o.description);
          if (o.emoji) opt.setEmoji(emojiComponent(o.emoji));
          if (o.default) opt.setDefault(true);
          return opt;
        }),
      );
    if (opts.placeholder) menu.setPlaceholder(opts.placeholder);
    if (opts.min !== undefined) menu.setMinValues(opts.min);
    if (opts.max !== undefined) menu.setMaxValues(opts.max);
    return this.push(this.label(opts.label, opts.description).setStringSelectMenuComponent(menu));
  }

  channel(opts: {
    id: string;
    label: string;
    description?: string;
    types?: ChannelType[];
    required?: boolean;
  }): this {
    const menu = new ChannelSelectMenuBuilder().setCustomId(opts.id).setRequired(opts.required ?? true);
    if (opts.types) menu.setChannelTypes(...opts.types);
    return this.push(this.label(opts.label, opts.description).setChannelSelectMenuComponent(menu));
  }

  role(opts: { id: string; label: string; description?: string; required?: boolean }): this {
    const menu = new RoleSelectMenuBuilder().setCustomId(opts.id).setRequired(opts.required ?? true);
    return this.push(this.label(opts.label, opts.description).setRoleSelectMenuComponent(menu));
  }

  files(opts: { id: string; label: string; description?: string; required?: boolean; max?: number }): this {
    const upload = new FileUploadBuilder()
      .setCustomId(opts.id)
      .setRequired(opts.required ?? false)
      .setMaxValues(opts.max ?? 5);
    return this.push(this.label(opts.label, opts.description).setFileUploadComponent(upload));
  }

  build(): ModalBuilder {
    return this.modal;
  }
}
