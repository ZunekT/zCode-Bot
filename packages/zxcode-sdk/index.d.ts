import type { EventEmitter } from 'node:events';
import type { ChatInputCommandInteraction, Client, GuildMember } from 'discord.js';

export type ChannelKind = 'text' | 'voice' | 'category' | 'announcement' | 'forum' | 'stage';

interface BaseField<T> {
  /** Nazwa pola w panelu. */
  label: string;
  /** Podpowiedź pod polem w panelu. */
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
  /** Nazwa modułu w panelu. */
  label: string;
  description?: string;
  /** Moduł ma przełącznik włącz/wyłącz. */
  toggle?: boolean;
  /** Stan przełącznika, gdy nic nie ustawiono (domyślnie true). */
  defaultEnabled?: boolean;
  fields: Record<string, FieldDef>;
}

export interface ZxCodeOptions {
  /** Klucz z /sdk dodaj. Domyślnie process.env.ZXCODE_KEY. */
  key?: string;
  /** Adres serwera zxCode. Domyślnie process.env.ZXCODE_URL albo https://bot.zxcode.pl. */
  url?: string;
  /** Wersja bota (na tablicy statusu). Domyślnie z package.json. */
  version?: string;
  /** Moduły i ich ustawienia edytowane w panelu. */
  modules?: Record<string, ModuleDef>;
  /** Dodatkowe komendy do uprawnień (oprócz zarejestrowanych w Discordzie). */
  commands?: (string | { name: string; description?: string })[];
  /** Czy stosować status/aktywność ustawione w panelu (domyślnie true). */
  presence?: boolean;
  /** Komunikat przy braku uprawnień w zx.guard(). */
  denyMessage?: string;
  /** Plik z ostatnimi ustawieniami (offline). false = wyłącz. */
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
  /** Wartość ustawienia: zx.get(guildId, 'tickety.kanal'). */
  get<T = unknown>(guildId: string, path: string): T;
  /** Wszystkie ustawienia modułu z wartościami domyślnymi. */
  module<T extends Record<string, unknown> = Record<string, unknown>>(guildId: string, module: string): T & { enabled?: boolean };
  /** Czy moduł jest włączony na serwerze. */
  enabled(guildId: string, module: string): boolean;
  /** Czy członek może użyć komendy (uprawnienia z panelu). */
  can(member: GuildMember | null | undefined, commandName: string): boolean;
  /** Sprawdza uprawnienia i odpowiada prywatnie przy braku dostępu. */
  guard(interaction: ChatInputCommandInteraction, message?: string): Promise<boolean>;
  /** Zgłasza ustawienia od strony bota (pokażą się w panelu). */
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
