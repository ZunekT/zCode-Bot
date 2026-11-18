import type {
  AnySelectMenuInteraction,
  AutocompleteInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  ClientEvents,
  MessageContextMenuCommandInteraction,
  ModalSubmitInteraction,
  RESTPostAPIApplicationCommandsJSONBody,
  UserContextMenuCommandInteraction,
} from 'discord.js';
import type { GuildConfig } from '../generated/prisma/client.js';
import type { ZxClient } from '../client.js';

/** Kto może użyć komendy / przycisku. */
export type AccessLevel = 'everyone' | 'staff' | 'admin';

export interface Context {
  client: ZxClient;
  config: GuildConfig;
}

interface CommandBase {
  data: { name: string; toJSON(): RESTPostAPIApplicationCommandsJSONBody };
  access?: AccessLevel;
  /** Cooldown w sekundach (per użytkownik). */
  cooldown?: number;
  /** Czy działa w trybie serwisowym (domyślnie tylko dla adminów). */
  allowInMaintenance?: boolean;
}

export interface SlashCommand extends CommandBase {
  kind?: 'slash';
  run(interaction: ChatInputCommandInteraction<'cached'>, ctx: Context): Promise<unknown>;
  autocomplete?(interaction: AutocompleteInteraction<'cached'>, ctx: Context): Promise<unknown>;
}

export interface UserContextCommand extends CommandBase {
  kind: 'user';
  run(interaction: UserContextMenuCommandInteraction<'cached'>, ctx: Context): Promise<unknown>;
}

export interface MessageContextCommand extends CommandBase {
  kind: 'message';
  run(interaction: MessageContextMenuCommandInteraction<'cached'>, ctx: Context): Promise<unknown>;
}

export type Command = SlashCommand | UserContextCommand | MessageContextCommand;

/**
 * Handler komponentów. customId ma format `modul:akcja:arg1:arg2…`,
 * a `id` handlera to `modul:akcja`. Argumenty trafiają do `args`.
 */
interface ComponentBase {
  id: string;
  access?: AccessLevel;
  allowInMaintenance?: boolean;
}

export interface ButtonHandler extends ComponentBase {
  type: 'button';
  run(interaction: ButtonInteraction<'cached'>, args: string[], ctx: Context): Promise<unknown>;
}

export interface SelectHandler extends ComponentBase {
  type: 'select';
  run(interaction: AnySelectMenuInteraction<'cached'>, args: string[], ctx: Context): Promise<unknown>;
}

export interface ModalHandler extends ComponentBase {
  type: 'modal';
  run(interaction: ModalSubmitInteraction<'cached'>, args: string[], ctx: Context): Promise<unknown>;
}

export type ComponentHandler = ButtonHandler | SelectHandler | ModalHandler;

export interface EventHandler<K extends keyof ClientEvents = keyof ClientEvents> {
  event: K;
  once?: boolean;
  run(client: ZxClient, ...args: ClientEvents[K]): Promise<unknown> | unknown;
}

export type AnyEventHandler = { [K in keyof ClientEvents]: EventHandler<K> }[keyof ClientEvents];

export interface ScheduledJob {
  name: string;
  /** Co ile ms uruchamiać. */
  intervalMs: number;
  /** Uruchom od razu po starcie. */
  runOnStart?: boolean;
  run(client: ZxClient): Promise<unknown>;
}

export interface BotModule {
  name: string;
  /** Opis widoczny w /config moduly. */
  description: string;
  /** Czy moduł można wyłączyć w /config (core/admin nie). */
  toggleable?: boolean;
  commands?: Command[];
  components?: ComponentHandler[];
  events?: AnyEventHandler[];
  jobs?: ScheduledJob[];
  onReady?(client: ZxClient): Promise<void>;
}

/** Helpery dające inferencję typów przy definiowaniu. */
export const defineModule = (m: BotModule) => m;
export const defineCommand = (c: SlashCommand) => c;
export const defineComponent = <T extends ComponentHandler>(c: T) => c;
export const defineEvent = <K extends keyof ClientEvents>(e: EventHandler<K>) =>
  e as unknown as AnyEventHandler;
export const defineJob = (j: ScheduledJob) => j;
