import type { GuildConfig } from '../../generated/prisma/client.js';
import type { EmojiName } from '../../ui/emojis.js';

type Keys<T, V> = { [K in keyof T]: T[K] extends V ? K : never }[keyof T];
type IdField = Keys<GuildConfig, string | null>;

export interface SettingDef {
  field: IdField;
  label: string;
  emoji: EmojiName;
}

export const CHANNEL_SETTINGS = {
  logi: { field: 'logChannelId', label: 'Logi ticketów', emoji: 'database' },
  audyt: { field: 'auditChannelId', label: 'Audyt (akcje adminów)', emoji: 'shield_check' },
  ogloszenia: { field: 'announcementChannelId', label: 'Ogłoszenia', emoji: 'announcement' },
  changelog: { field: 'changelogChannelId', label: 'Changelog', emoji: 'git_branch' },
  opinie: { field: 'reviewChannelId', label: 'Opinie', emoji: 'star' },
  alerty: { field: 'staffAlertChannelId', label: 'Alerty dla obsługi', emoji: 'notification' },
  transkrypty: { field: 'transcriptChannelId', label: 'Transkrypty ticketów', emoji: 'documentation' },
} as const satisfies Record<string, SettingDef>;

export const CATEGORY_SETTINGS = {
  tickety: { field: 'ticketCategoryId', label: 'Kategoria ticketów', emoji: 'ticket' },
  archiwum: { field: 'archiveCategoryId', label: 'Archiwum ticketów', emoji: 'package' },
} as const satisfies Record<string, SettingDef>;

export const ROLE_SETTINGS = {
  obsluga: { field: 'staffRoleId', label: 'Obsługa', emoji: 'support' },
  admin: { field: 'adminRoleId', label: 'Administracja', emoji: 'crown' },
  klient: { field: 'clientRoleId', label: 'Klient', emoji: 'client_badge' },
  staly_klient: { field: 'loyalClientRoleId', label: 'Stały klient', emoji: 'client_crown' },
  zweryfikowany: { field: 'verifiedRoleId', label: 'Zweryfikowany', emoji: 'verified' },
  niezweryfikowany: { field: 'unverifiedRoleId', label: 'Niezweryfikowany (opcjonalna)', emoji: 'shield_x' },
} as const satisfies Record<string, SettingDef>;

export type ChannelSettingKey = keyof typeof CHANNEL_SETTINGS;
export type CategorySettingKey = keyof typeof CATEGORY_SETTINGS;
export type RoleSettingKey = keyof typeof ROLE_SETTINGS;

export function choicesOf(defs: Record<string, SettingDef>) {
  return Object.entries(defs).map(([value, def]) => ({ name: def.label, value }));
}
