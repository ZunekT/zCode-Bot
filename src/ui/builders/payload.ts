import type { AttachmentBuilder, ContainerBuilder, MessageMentionOptions } from 'discord.js';
import type { Panel } from './container.js';

type V2Component = ContainerBuilder | Panel;

export interface V2Options {
  ephemeral?: boolean;
  files?: AttachmentBuilder[];
  /** Domyślnie wzmianki są wyłączone – bot nie pinguje przypadkiem. */
  allowedMentions?: MessageMentionOptions;
}

export type V2Flag = 'IsComponentsV2' | 'Ephemeral';

interface BasePayload {
  components: ContainerBuilder[];
  files?: AttachmentBuilder[];
  allowedMentions: MessageMentionOptions;
}

/** Odpowiedź na interakcję (może być ephemeral). */
export interface V2Payload extends BasePayload {
  flags: readonly V2Flag[];
}

/** Wiadomość na kanał / edycja wiadomości (bez Ephemeral). */
export interface V2MessagePayload extends BasePayload {
  flags: readonly ['IsComponentsV2'];
}

function base(components: V2Component | V2Component[], options: V2Options): BasePayload {
  const list = (Array.isArray(components) ? components : [components]).map((c) =>
    'container' in c ? c.build() : c,
  );
  const payload: BasePayload = {
    components: list,
    allowedMentions: options.allowedMentions ?? { parse: [] },
  };
  if (options.files?.length) payload.files = options.files;
  return payload;
}

/**
 * Odpowiedź Components v2 na interakcję (reply / followUp).
 * Uwaga: wiadomość z flagą IsComponentsV2 nie może mieć `content` ani `embeds`.
 */
export function v2(components: V2Component | V2Component[], options: V2Options = {}): V2Payload {
  return {
    ...base(components, options),
    flags: options.ephemeral ? ['IsComponentsV2', 'Ephemeral'] : ['IsComponentsV2'],
  };
}

/** Wiadomość Components v2 na kanał, do edycji (message.edit, interaction.update/editReply) lub w DM. */
export function v2Message(
  components: V2Component | V2Component[],
  options: Omit<V2Options, 'ephemeral'> = {},
): V2MessagePayload {
  return { ...base(components, options), flags: ['IsComponentsV2'] };
}
