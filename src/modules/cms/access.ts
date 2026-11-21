import type { CmsSite } from '../../generated/prisma/client.js';
import type { ZxClient } from '../../client.js';
import { prisma } from '../../db/prisma.js';
import { UserError } from '../../core/errors.js';
import { accessOf } from '../site/admins.js';

export const CMS_PERMS = ['content', 'publish', 'announcement', 'maintenance', 'redirects', 'stats', 'access'] as const;
export type CmsPerm = (typeof CMS_PERMS)[number];

export const PERM_LABELS: Record<CmsPerm, string> = {
  content: 'Edycja treści i zdjęć',
  publish: 'Publikowanie zmian',
  announcement: 'Ogłoszenia',
  maintenance: 'Przerwa techniczna',
  redirects: 'Przekierowania',
  stats: 'Statystyki',
  access: 'Zarządzanie dostępem',
};

export interface SiteAccess {
  site: CmsSite;
  userId: string;
  owner: boolean;
  perms: Set<CmsPerm>;
  sections: string[] | null;
}

export class CmsForbidden extends Error {}

export async function siteAccess(client: ZxClient, siteId: number, userId: string): Promise<SiteAccess | null> {
  if (!Number.isInteger(siteId) || siteId <= 0) return null;
  const site = await prisma.cmsSite.findUnique({ where: { id: siteId } });
  if (!site) return null;
  const full = { site, userId, owner: true, perms: new Set<CmsPerm>(CMS_PERMS), sections: null };
  if (site.ownerId === userId) return full;
  const { owner, admin } = await accessOf(client, userId);
  if (site.isSelf ? owner : admin) return full;
  const member = await prisma.cmsSiteMember.findUnique({ where: { siteId_userId: { siteId, userId } } });
  if (!member) return null;
  return {
    site,
    userId,
    owner: false,
    perms: new Set(member.permissions.filter((p): p is CmsPerm => (CMS_PERMS as readonly string[]).includes(p))),
    sections: member.sections.length ? member.sections : null,
  };
}

export function need(a: SiteAccess, perm: CmsPerm): void {
  if (!a.perms.has(perm)) throw new CmsForbidden('Nie masz uprawnień do tej akcji.');
}

export function canSection(a: SiteAccess, section: string): boolean {
  return !a.sections || a.sections.includes(section);
}

export async function listMembers(siteId: number) {
  const rows = await prisma.cmsSiteMember.findMany({ where: { siteId }, orderBy: { createdAt: 'asc' } });
  return rows.map((m) => ({ userId: m.userId, permissions: m.permissions, sections: m.sections, addedBy: m.addedBy, createdAt: m.createdAt.toISOString() }));
}

export async function setMember(a: SiteAccess, targetId: string, input: { permissions?: unknown; sections?: unknown }) {
  need(a, 'access');
  if (!/^\d{17,20}$/.test(targetId)) throw new UserError('Nieprawidłowe ID użytkownika Discord.');
  if (targetId === a.site.ownerId) throw new UserError('Właściciel strony ma zawsze pełny dostęp.');
  if (targetId === a.userId) throw new UserError('Nie możesz zmieniać własnych uprawnień.');
  const perms = Array.isArray(input.permissions)
    ? [...new Set(input.permissions.filter((p): p is CmsPerm => typeof p === 'string' && (CMS_PERMS as readonly string[]).includes(p)))]
    : [];
  if (!perms.length) throw new UserError('Wybierz co najmniej jedno uprawnienie.');
  const beyond = perms.filter((p) => !a.perms.has(p));
  if (beyond.length) throw new CmsForbidden('Możesz nadać tylko uprawnienia, które sam masz.');
  const known = new Set(((a.site.schema as { sections?: { key: string }[] })?.sections ?? []).map((s) => s.key));
  let sections = Array.isArray(input.sections) ? [...new Set(input.sections.filter((s): s is string => typeof s === 'string' && known.has(s)))] : [];
  if (a.sections) {
    if (!sections.length) sections = [...a.sections];
    if (sections.some((s) => !a.sections!.includes(s))) throw new CmsForbidden('Możesz nadać dostęp tylko do sekcji, które sam edytujesz.');
  }
  const existing = await prisma.cmsSiteMember.findUnique({ where: { siteId_userId: { siteId: a.site.id, userId: targetId } } });
  if (existing && !a.owner && existing.permissions.some((p) => !a.perms.has(p as CmsPerm)))
    throw new CmsForbidden('Ta osoba ma uprawnienia większe niż Twoje – zmienić je może tylko właściciel.');
  if (!existing && (await prisma.cmsSiteMember.count({ where: { siteId: a.site.id } })) >= 25) throw new UserError('Maksymalnie 25 osób z dostępem.');
  await prisma.cmsSiteMember.upsert({
    where: { siteId_userId: { siteId: a.site.id, userId: targetId } },
    create: { siteId: a.site.id, userId: targetId, permissions: perms, sections, addedBy: a.userId },
    update: { permissions: perms, sections },
  });
  return listMembers(a.site.id);
}

export async function removeMember(a: SiteAccess, targetId: string) {
  if (targetId !== a.userId) {
    need(a, 'access');
    const existing = await prisma.cmsSiteMember.findUnique({ where: { siteId_userId: { siteId: a.site.id, userId: targetId } } });
    if (existing && !a.owner && existing.permissions.some((p) => !a.perms.has(p as CmsPerm)))
      throw new CmsForbidden('Tę osobę może usunąć tylko właściciel.');
  }
  await prisma.cmsSiteMember.deleteMany({ where: { siteId: a.site.id, userId: targetId } });
  return listMembers(a.site.id);
}
