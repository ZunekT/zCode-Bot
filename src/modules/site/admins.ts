import type { GuildMember } from 'discord.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { ZxClient } from '../../client.js';
import { env } from '../../config/env.js';
import { UserError } from '../../core/errors.js';
import { prisma } from '../../db/prisma.js';

// Administratorzy zxCode (poza właścicielem): osoby dodane po ID i wszyscy z wybranymi rolami Discorda.
// Mają dostęp do Administracji na stronie i uprawnienia administracyjne w bocie.

const KEY = 'admins';
const MAX = 50;
const SNOWFLAKE = /^\d{17,20}$/;

export interface Admins {
  users: string[];
  roles: string[];
}

let current: Admins = { users: [], roles: [] };
let loaded = false;

export async function loadAdmins(): Promise<Admins> {
  const row = await prisma.siteSetting.findUnique({ where: { key: KEY } });
  const v = (row?.value ?? {}) as Partial<Admins>;
  current = {
    users: Array.isArray(v.users) ? v.users.filter((x) => SNOWFLAKE.test(x)) : [],
    roles: Array.isArray(v.roles) ? v.roles.filter((x) => SNOWFLAKE.test(x)) : [],
  };
  loaded = true;
  return current;
}

export async function getAdmins(): Promise<Admins> {
  return loaded ? current : loadAdmins();
}

export function adminsSync(): Admins {
  return current;
}

export async function setAdmins(patch: Partial<Admins>, updatedBy: string): Promise<Admins> {
  const base = await getAdmins();
  const clean = (list: unknown, what: string) => {
    if (!Array.isArray(list) || list.some((x) => typeof x !== 'string' || !SNOWFLAKE.test(x))) {
      throw new UserError(`${what}: same ID Discord.`);
    }
    const out = [...new Set(list as string[])];
    if (out.length > MAX) throw new UserError(`${what}: maksymalnie ${MAX}.`);
    return out;
  };
  const next: Admins = {
    users: patch.users !== undefined ? clean(patch.users, 'Osoby') : base.users,
    roles: patch.roles !== undefined ? clean(patch.roles, 'Role') : base.roles,
  };
  await prisma.siteSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: next as unknown as Prisma.InputJsonValue, updatedBy },
    update: { value: next as unknown as Prisma.InputJsonValue, updatedBy },
  });
  current = next;
  memberCache.clear();
  return next;
}

export async function isOwner(client: ZxClient, userId: string): Promise<boolean> {
  if (env.OWNER_ID) return userId === env.OWNER_ID;
  const guild = client.guilds.cache.get(env.GUILD_ID);
  return !!guild && guild.ownerId === userId;
}

export function memberIsSiteAdmin(member: Pick<GuildMember, 'id' | 'roles'>): boolean {
  const a = current;
  return a.users.includes(member.id) || a.roles.some((r) => member.roles.cache.has(r));
}

const memberCache = new Map<string, { at: number; admin: boolean }>();

export async function isSiteAdmin(client: ZxClient, userId: string): Promise<boolean> {
  const a = await getAdmins();
  if (a.users.includes(userId)) return true;
  if (!a.roles.length) return false;
  const hit = memberCache.get(userId);
  if (hit && Date.now() - hit.at < 60_000) return hit.admin;
  const guild = client.guilds.cache.get(env.GUILD_ID);
  const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
  const admin = !!member && a.roles.some((r) => member.roles.cache.has(r));
  memberCache.set(userId, { at: Date.now(), admin });
  return admin;
}

export async function accessOf(
  client: ZxClient,
  userId: string,
): Promise<{ owner: boolean; admin: boolean }> {
  const owner = await isOwner(client, userId);
  return { owner, admin: owner || (await isSiteAdmin(client, userId)) };
}
