import type { EventEmitter } from 'node:events';
import type { ChatInputCommandInteraction, Client, GuildMember } from 'discord.js';

export type ChannelKind = 'text' | 'voice' | 'category' | 'announcement' | 'forum' | 'stage';

interface BaseField<T> {
  label: string;
  description?: string;
  default?: T;
  required?: boolean;
}

export interface FieldDef {
  readonly __zxField: true;
  type: 'boolean' | 'text' | 'textarea' | 'number' | 'select' | 'channel' | 'role' | 'color';
}

export declare const field: {
  toggle(o: BaseField<boolean>): FieldDef;
  text(o: BaseField<string> & { maxLength?: number }): FieldDef;
  textarea(o: BaseField<string> & { maxLength?: number }): FieldDef;
  number(o: BaseField<number> & { min?: number; max?: number; integer?: boolean }): FieldDef;
  select(o: BaseField<string | string[]> & { options: (string | { value: string; label: string })[]; multiple?: boolean }): FieldDef;
  channel(o: BaseField<string | string[]> & { types?: ChannelKind[]; multiple?: boolean }): FieldDef;
  role(o: BaseField<string | string[]> & { multiple?: boolean }): FieldDef;
  color(o: BaseField<string>): FieldDef;
};

export interface ModuleDef {
  label: string;
  description?: string;
  toggle?: boolean;
  defaultEnabled?: boolean;
  fields: Record<string, FieldDef>;
}

export interface ZxCodeOptions {
  key?: string;
  url?: string;
  version?: string;
  modules?: Record<string, ModuleDef>;
  commands?: (string | { name: string; description?: string })[];
  presence?: boolean;
  denyMessage?: string;
  cacheFile?: string | false;
  debug?: boolean;
}

export interface ChangeEvent {
  guildId: string;
  module: string;
  values: Record<string, unknown>;
  previous: Record<string, unknown>;
}

export declare class ZxCode extends EventEmitter {
  readonly connected: boolean;
  get<T = unknown>(guildId: string, path: string): T;
  module<T extends Record<string, unknown> = Record<string, unknown>>(guildId: string, module: string): T & { enabled?: boolean };
  enabled(guildId: string, module: string): boolean;
  can(member: GuildMember | null | undefined, commandName: string): boolean;
  guard(interaction: ChatInputCommandInteraction, message?: string): Promise<boolean>;
  set(guildId: string, values: Record<string, Record<string, unknown>>): Promise<{ revision: number }>;
  stop(): void;

  on(event: 'change', listener: (e: ChangeEvent) => void): this;
  on(event: 'permissions', listener: (e: { guildId: string; permissions: Record<string, { roles: string[] }> }) => void): this;
  on(event: 'profile', listener: (profile: unknown) => void): this;
  on(event: 'ready' | 'connected' | 'disconnected' | 'revoked', listener: () => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
}

export declare function zxcode(client: Client, options?: ZxCodeOptions): ZxCode;
export declare const SDK_VERSION: string;
export default zxcode;
