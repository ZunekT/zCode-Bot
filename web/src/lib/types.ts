export type FieldType = 'boolean' | 'text' | 'textarea' | 'number' | 'select' | 'channel' | 'role' | 'color';
export type ChannelKind = 'text' | 'voice' | 'category' | 'announcement' | 'forum' | 'stage' | 'other';

export interface SchemaField {
  key: string;
  type: FieldType;
  label: string;
  description?: string;
  default?: unknown;
  required?: boolean;
  multiple?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  integer?: boolean;
  options?: { value: string; label: string }[];
  channelTypes?: ChannelKind[];
}

export interface SchemaModule {
  key: string;
  label: string;
  description?: string;
  toggle?: boolean;
  defaultEnabled?: boolean;
  fields: SchemaField[];
}

export interface BotSchema {
  modules: SchemaModule[];
}

export interface PublicBot {
  id: number;
  name: string;
  keyPrefix: string;
  appId: string | null;
  username: string | null;
  avatarUrl: string | null;
  sdkVersion: string | null;
  botVersion: string | null;
  connected: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  guildCount?: number;
}

export interface Presence {
  status: 'online' | 'idle' | 'dnd' | 'invisible';
  activity: { type: 'playing' | 'watching' | 'listening' | 'competing' | 'custom'; text: string } | null;
}

export interface Profile {
  presence?: Presence;
  request?: { username?: string; avatar?: string } | null;
  lastResult?: { revision: number; ok: boolean; error?: string; at: string };
}

export interface BotDetails {
  bot: PublicBot;
  schema: BotSchema;
  commands: { name: string; description: string }[];
  guilds: { id: string; name: string; icon: string | null }[];
  profile: Profile;
  profileRevision: number;
  monitoring: { online: boolean; uptime: string; lastDownAt: string | null; version: string | null } | null;
}

export interface GuildChannel {
  id: string;
  name: string;
  type: ChannelKind;
  parentId?: string | null;
  position?: number;
}

export interface GuildRole {
  id: string;
  name: string;
  color?: number;
  position?: number;
  managed?: boolean;
}

export type ConfigValues = Record<string, Record<string, unknown>>;
export type Permissions = Record<string, { roles: string[] }>;

export interface GuildSettings {
  guild: { id: string; name: string; icon: string | null; channels: GuildChannel[]; roles: GuildRole[] };
  values: ConfigValues;
  permissions: Permissions;
  revision: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface ValidationError {
  path: string;
  message: string;
}
