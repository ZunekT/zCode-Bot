import { PermissionFlagsBits, type GuildMember } from 'discord.js';
import type { GuildConfig } from '../generated/prisma/client.js';
import type { AccessLevel } from './types.js';

export function isAdmin(member: GuildMember, config: GuildConfig): boolean {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  return !!config.adminRoleId && member.roles.cache.has(config.adminRoleId);
}

export function isStaff(member: GuildMember, config: GuildConfig): boolean {
  if (isAdmin(member, config)) return true;
  return !!config.staffRoleId && member.roles.cache.has(config.staffRoleId);
}

export function hasAccess(
  member: GuildMember,
  config: GuildConfig,
  level: AccessLevel = 'everyone',
): boolean {
  if (level === 'everyone') return true;
  if (level === 'staff') return isStaff(member, config);
  return isAdmin(member, config);
}

export const accessLabel: Record<AccessLevel, string> = {
  everyone: 'wszyscy',
  staff: 'obsługa',
  admin: 'administracja',
};
