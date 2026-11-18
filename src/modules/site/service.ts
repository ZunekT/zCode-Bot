import type { Prisma } from '../../generated/prisma/client.js';
import { UserError } from '../../core/errors.js';
import { prisma } from '../../db/prisma.js';

const KEY = 'access';
const MAX_PREVIEW = 50;

export interface SiteAccess {
  launched: boolean;
  previewUsers: string[];
}

let cache: { at: number; value: SiteAccess } | null = null;
const CACHE_MS = 10_000;

export async function getAccess(): Promise<SiteAccess> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const row = await prisma.siteSetting.findUnique({ where: { key: KEY } });
  const v = (row?.value ?? {}) as Partial<SiteAccess>;
  const value: SiteAccess = {
    launched: v.launched === true,
    previewUsers: Array.isArray(v.previewUsers) ? v.previewUsers.filter((x) => /^\d{17,20}$/.test(x)) : [],
  };
  cache = { at: Date.now(), value };
  return value;
}

export async function setAccess(patch: Partial<SiteAccess>, updatedBy: string): Promise<SiteAccess> {
  const current = await getAccess();
  const next: SiteAccess = { ...current };
  if (patch.launched !== undefined) {
    if (typeof patch.launched !== 'boolean') throw new UserError('Nieprawidłowa wartość „launched”.');
    next.launched = patch.launched;
  }
  if (patch.previewUsers !== undefined) {
    if (
      !Array.isArray(patch.previewUsers) ||
      patch.previewUsers.some((x) => typeof x !== 'string' || !/^\d{17,20}$/.test(x))
    ) {
      throw new UserError('Lista podglądu: same ID użytkowników Discord.');
    }
    next.previewUsers = [...new Set(patch.previewUsers)];
    if (next.previewUsers.length > MAX_PREVIEW)
      throw new UserError(`Maksymalnie ${MAX_PREVIEW} osób z podglądem.`);
  }
  await prisma.siteSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: next as unknown as Prisma.InputJsonValue, updatedBy },
    update: { value: next as unknown as Prisma.InputJsonValue, updatedBy },
  });
  cache = { at: Date.now(), value: next };
  return next;
}
