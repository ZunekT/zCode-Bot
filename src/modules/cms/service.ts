import { createHash, createHmac, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';
import { Prisma, type CmsSite } from '../../generated/prisma/client.js';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { UserError } from '../../core/errors.js';
import { createLogger } from '../../utils/logger.js';
import { inspectImage } from './images.js';
import { listMembers, type SiteAccess } from './access.js';
import { publicState, readAnnouncement, readMaintenance, readRedirects } from './state.js';
import {
  assetIds,
  mergeDefaults,
  sanitizeSchema,
  schemaHash,
  validateContent,
  type CmsContent,
  type CmsSchema,
} from './schema.js';

const log = createLogger('cms');

export const CMS_KEY_RE = /^zxs_\d+_[a-f0-9]{48}$/;
export const MAX_ASSET_BYTES = 4 * 1024 * 1024;
export const MAX_SITE_BYTES = 150 * 1024 * 1024;
export const MAX_ASSETS = 400;
const KEEP_VERSIONS = 30;

export const hashCmsKey = (key: string) => createHash('sha256').update(key).digest('hex');

export function generateCmsKey(id: number) {
  const key = `zxs_${id}_${randomBytes(24).toString('hex')}`;
  return { key, hash: hashCmsKey(key), prefix: key.slice(0, key.indexOf('_', 4) + 5) };
}

export async function createSite(name: string, ownerId: string, url: string | null) {
  const temp = await prisma.cmsSite.create({
    data: {
      name,
      ownerId,
      url,
      keyHash: `pending-${randomBytes(8).toString('hex')}`,
      keyPrefix: '',
      previewToken: randomBytes(24).toString('hex'),
      trackId: randomBytes(8).toString('hex'),
    },
  });
  const k = generateCmsKey(temp.id);
  const site = await prisma.cmsSite.update({ where: { id: temp.id }, data: { keyHash: k.hash, keyPrefix: k.prefix } });
  return { site, key: k.key };
}

export async function rotateKey(id: number) {
  const k = generateCmsKey(id);
  await prisma.cmsSite.update({ where: { id }, data: { keyHash: k.hash, keyPrefix: k.prefix } });
  return k.key;
}

export async function authenticateSite(key: string | undefined): Promise<CmsSite | null> {
  if (!key || !CMS_KEY_RE.test(key)) return null;
  const site = await prisma.cmsSite.findUnique({ where: { keyHash: hashCmsKey(key) } });
  return site && site.id === Number(key.split('_')[1]) ? site : null;
}

function safeWebhook(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new UserError('Nieprawidłowy adres webhooka.');
  }
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const local = host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || isIP(host) !== 0;
  if (env.NODE_ENV === 'production' && (u.protocol !== 'https:' || local))
    throw new UserError('Webhook musi być publicznym adresem https://.');
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new UserError('Webhook musi być adresem http(s).');
  if (u.username || u.password) throw new UserError('Adres webhooka nie może zawierać loginu ani hasła.');
  return u.toString().slice(0, 500);
}

export async function registerSchema(site: CmsSite, body: { schema?: unknown; webhookUrl?: unknown; url?: unknown }) {
  const { schema, warnings } = sanitizeSchema(body.schema);
  const hash = schemaHash(schema);
  const webhookUrl = body.webhookUrl === undefined ? site.webhookUrl : safeWebhook(body.webhookUrl);
  if (hash !== site.schemaHash || webhookUrl !== site.webhookUrl) {
    await prisma.cmsSite.update({
      where: { id: site.id },
      data: { schema: schema as unknown as Prisma.InputJsonValue, schemaHash: hash, schemaAt: new Date(), webhookUrl },
    });
  }
  return { hash, warnings };
}

const asSchema = (site: CmsSite) => site.schema as unknown as CmsSchema;
const asContent = (site: CmsSite) => (site.content ?? {}) as CmsContent;

export function assetUrl(base: string, siteId: number, id: string, ext: string) {
  return `${base.replace(/\/$/, '')}/cms/v1/assets/${siteId}/${id}.${ext}`;
}

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

export async function deliverContent(site: CmsSite, base: string, draft = false) {
  const content = mergeDefaults(asSchema(site), draft && site.draft ? (site.draft as CmsContent) : asContent(site));
  const ids = [...assetIds(content)];
  const assets = ids.length
    ? await prisma.cmsAsset.findMany({ where: { siteId: site.id, id: { in: ids } }, select: { id: true, contentType: true, width: true, height: true } })
    : [];
  const map = new Map(assets.map((a) => [a.id, a]));
  const expand = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(expand);
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if (typeof o.id === 'string' && 'alt' in o && Object.keys(o).length === 2) {
        const a = map.get(o.id);
        return a ? { url: assetUrl(base, site.id, a.id, EXT[a.contentType] ?? 'bin'), alt: o.alt, width: a.width, height: a.height } : null;
      }
      return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, expand(x)]));
    }
    return v;
  };
  if (!draft) await prisma.cmsSite.update({ where: { id: site.id }, data: { lastFetchAt: new Date() } }).catch(() => undefined);
  return { revision: site.revision, draft: draft && !!site.draft, updatedAt: site.updatedAt.toISOString(), content: expand(content), state: publicState(site) };
}

export async function listSites(userId: string) {
  const sites = await prisma.cmsSite.findMany({
    where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    orderBy: [{ isSelf: 'desc' }, { createdAt: 'asc' }],
    include: { _count: { select: { assets: true } } },
  });
  return sites.map((s) => ({
    id: s.id,
    name: s.name,
    url: s.url,
    shared: s.ownerId !== userId,
    isSelf: s.isSelf,
    revision: s.revision,
    updatedAt: s.updatedAt.toISOString(),
    connected: !!s.schemaAt,
    sections: asSchema(s).sections.length,
    hasDraft: !!s.draft,
    maintenance: readMaintenance(s).enabled,
    assets: s._count.assets,
  }));
}

export async function editorData(a: SiteAccess) {
  const site = a.site;
  const [assets, versions, members] = await Promise.all([
    prisma.cmsAsset.findMany({
      where: { siteId: site.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, contentType: true, size: true, width: true, height: true, createdAt: true },
    }),
    prisma.cmsVersion.findMany({ where: { siteId: site.id }, orderBy: { revision: 'desc' }, take: KEEP_VERSIONS }),
    a.perms.has('access') ? listMembers(site.id) : Promise.resolve(null),
  ]);
  const schema = asSchema(site);
  return {
    site: {
      id: site.id,
      name: site.name,
      url: site.url,
      ownerId: site.ownerId,
      isSelf: site.isSelf,
      revision: site.revision,
      updatedAt: site.updatedAt.toISOString(),
      connected: !!site.schemaAt,
      webhook: !!site.webhookUrl,
      trackId: site.trackId,
      previewToken: a.perms.has('content') || a.perms.has('maintenance') ? site.previewToken : null,
    },
    me: { owner: a.owner, perms: [...a.perms], sections: a.sections },
    schema,
    content: mergeDefaults(schema, asContent(site)),
    draft: site.draft ? mergeDefaults(schema, site.draft as CmsContent) : null,
    draftAt: site.draftAt?.toISOString() ?? null,
    scheduledAt: site.scheduledAt?.toISOString() ?? null,
    announcement: readAnnouncement(site),
    maintenance: readMaintenance(site),
    redirects: readRedirects(site),
    members,
    assets: assets.map((x) => ({ ...x, createdAt: x.createdAt.toISOString() })),
    versions: versions.map((v) => ({ revision: v.revision, authorId: v.authorId, createdAt: v.createdAt.toISOString(), content: v.content })),
  };
}

async function knownAssets(siteId: number) {
  return new Set((await prisma.cmsAsset.findMany({ where: { siteId }, select: { id: true } })).map((x) => x.id));
}

function scoped(a: SiteAccess, base: CmsContent, input: unknown): unknown {
  if (!a.sections || !input || typeof input !== 'object') return input;
  const out: CmsContent = { ...base };
  for (const key of a.sections) if (key in (input as CmsContent)) out[key] = (input as CmsContent)[key]!;
  return out;
}

export async function saveDraft(a: SiteAccess, input: unknown) {
  const site = a.site;
  const base = mergeDefaults(asSchema(site), (site.draft as CmsContent | null) ?? asContent(site));
  const known = await knownAssets(site.id);
  const content = validateContent(asSchema(site), scoped(a, base, input), (id) => known.has(id));
  await prisma.cmsSite.update({
    where: { id: site.id },
    data: { draft: content as unknown as Prisma.InputJsonValue, draftAt: new Date(), draftBy: a.userId },
  });
  return { draftAt: new Date().toISOString() };
}

export async function discardDraft(a: SiteAccess) {
  await prisma.cmsSite.update({ where: { id: a.site.id }, data: { draft: Prisma.DbNull, draftAt: null, draftBy: null, scheduledAt: null, scheduledBy: null } });
}

export async function publish(a: SiteAccess, input: unknown, revision?: number) {
  const site = a.site;
  const source = input !== undefined ? input : site.draft;
  if (!source) throw new UserError('Nie ma zmian do opublikowania.');
  const base = mergeDefaults(asSchema(site), asContent(site));
  const result = await saveContent(site, scoped(a, base, source), a.userId, revision);
  await prisma.cmsSite.update({ where: { id: site.id }, data: { draft: Prisma.DbNull, draftAt: null, draftBy: null, scheduledAt: null, scheduledBy: null } });
  return result;
}

export async function schedule(a: SiteAccess, input: unknown, at: unknown) {
  const when = new Date(String(at));
  if (Number.isNaN(when.getTime())) throw new UserError('Nieprawidłowa data publikacji.');
  if (when.getTime() < Date.now() + 60_000) throw new UserError('Data publikacji musi być co najmniej minutę w przyszłości.');
  if (when.getTime() > Date.now() + 366 * 86_400_000) throw new UserError('Publikację można zaplanować maksymalnie rok do przodu.');
  if (input !== undefined) await saveDraft(a, input);
  const fresh = await prisma.cmsSite.findUniqueOrThrow({ where: { id: a.site.id } });
  if (!fresh.draft) throw new UserError('Nie ma zmian do opublikowania.');
  await prisma.cmsSite.update({ where: { id: a.site.id }, data: { scheduledAt: when, scheduledBy: a.userId } });
  return { scheduledAt: when.toISOString() };
}

export async function cancelSchedule(a: SiteAccess) {
  await prisma.cmsSite.update({ where: { id: a.site.id }, data: { scheduledAt: null, scheduledBy: null } });
}

export async function publishDue(): Promise<void> {
  const due = await prisma.cmsSite.findMany({ where: { scheduledAt: { lte: new Date() } }, take: 20 });
  for (const site of due) {
    try {
      const claimed = await prisma.cmsSite.updateMany({ where: { id: site.id, scheduledAt: site.scheduledAt }, data: { scheduledAt: null } });
      if (!claimed.count || !site.draft) continue;
      await saveContent(site, site.draft, site.scheduledBy ?? site.ownerId);
      await prisma.cmsSite.update({ where: { id: site.id }, data: { draft: Prisma.DbNull, draftAt: null, draftBy: null, scheduledBy: null } });
      log.info(`Zaplanowana publikacja strony #${site.id} wykonana`);
    } catch (err) {
      log.warn(`Zaplanowana publikacja strony #${site.id} nie powiodła się`, err);
    }
  }
}

export async function rotatePreviewToken(siteId: number) {
  const token = randomBytes(24).toString('hex');
  await prisma.cmsSite.update({ where: { id: siteId }, data: { previewToken: token, stateRev: { increment: 1 } } });
  void notifySite(siteId, 0, 'state.updated');
  return token;
}

export async function exportSite(a: SiteAccess, base: string) {
  const site = a.site;
  const assets = await prisma.cmsAsset.findMany({ where: { siteId: site.id }, select: { id: true, name: true, contentType: true, size: true, width: true, height: true, createdAt: true } });
  return {
    format: 'zxcode-cms-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    site: { name: site.name, url: site.url, revision: site.revision },
    schema: asSchema(site),
    content: mergeDefaults(asSchema(site), asContent(site)),
    draft: site.draft ?? null,
    announcement: readAnnouncement(site),
    maintenance: readMaintenance(site),
    redirects: readRedirects(site),
    assets: assets.map((x) => ({ ...x, createdAt: x.createdAt.toISOString(), url: assetUrl(base, site.id, x.id, EXT[x.contentType] ?? 'bin') })),
  };
}

export async function saveContent(site: CmsSite, input: unknown, authorId: string, expectedRevision?: number) {
  if (expectedRevision !== undefined && expectedRevision !== site.revision)
    throw new UserError('Ktoś w międzyczasie zmienił treść. Odśwież stronę, żeby zobaczyć najnowszą wersję.');
  const known = new Set((await prisma.cmsAsset.findMany({ where: { siteId: site.id }, select: { id: true } })).map((a) => a.id));
  const content = validateContent(asSchema(site), input, (id) => known.has(id));
  const { count } = await prisma.cmsSite.updateMany({
    where: { id: site.id, revision: site.revision },
    data: { content: content as unknown as Prisma.InputJsonValue, revision: { increment: 1 } },
  });
  if (!count) throw new UserError('Ktoś w międzyczasie zmienił treść. Odśwież stronę, żeby zobaczyć najnowszą wersję.');
  const revision = site.revision + 1;
  await prisma.cmsVersion.create({ data: { siteId: site.id, revision, content: content as unknown as Prisma.InputJsonValue, authorId } });
  const old = await prisma.cmsVersion.findMany({ where: { siteId: site.id }, orderBy: { revision: 'desc' }, skip: KEEP_VERSIONS, select: { id: true } });
  if (old.length) await prisma.cmsVersion.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  void notifySite(site.id, revision);
  return { revision };
}

export async function addAsset(site: CmsSite, name: string, data: Buffer) {
  if (!data.length) throw new UserError('Pusty plik.');
  if (data.length > MAX_ASSET_BYTES) throw new UserError('Zdjęcie może mieć maksymalnie 4 MB.');
  const info = inspectImage(data);
  if (!info) throw new UserError('Obsługiwane formaty: PNG, JPG, WebP, GIF.');
  const agg = await prisma.cmsAsset.aggregate({ where: { siteId: site.id }, _sum: { size: true }, _count: true });
  if (agg._count >= MAX_ASSETS) throw new UserError(`Limit ${MAX_ASSETS} zdjęć na stronę.`);
  if ((agg._sum.size ?? 0) + data.length > MAX_SITE_BYTES) throw new UserError('Brak miejsca na zdjęcia tej strony (limit 150 MB).');
  const clean = name.replace(/[^\p{L}\p{N}._ -]/gu, '').trim().slice(0, 100) || `zdjecie.${info.ext}`;
  const asset = await prisma.cmsAsset.create({
    data: { id: randomBytes(12).toString('hex'), siteId: site.id, name: clean, contentType: info.type, size: data.length, width: info.width, height: info.height, data: new Uint8Array(data) },
    select: { id: true, name: true, contentType: true, size: true, width: true, height: true, createdAt: true },
  });
  return { ...asset, createdAt: asset.createdAt.toISOString() };
}

export async function removeAsset(site: CmsSite, assetId: string) {
  if (assetIds(site.content).has(assetId)) throw new UserError('To zdjęcie jest używane na stronie. Najpierw usuń je z treści i zapisz.');
  const { count } = await prisma.cmsAsset.deleteMany({ where: { id: assetId, siteId: site.id } });
  if (!count) throw new UserError('Nie ma takiego zdjęcia.');
}

export function signPayload(keyHash: string, timestamp: string, body: string) {
  return `sha256=${createHmac('sha256', keyHash).update(`${timestamp}.${body}`).digest('hex')}`;
}

export async function notifySite(siteId: number, revision: number, event: 'content.updated' | 'state.updated' = 'content.updated'): Promise<boolean> {
  const site = await prisma.cmsSite.findUnique({ where: { id: siteId } });
  if (!site?.webhookUrl) return false;
  const body = JSON.stringify({ event, siteId, revision });
  const ts = String(Math.floor(Date.now() / 1000));
  try {
    const res = await fetch(site.webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-zxcode-timestamp': ts, 'x-zxcode-signature': signPayload(site.keyHash, ts, body), 'user-agent': 'zxCode-CMS/1.0' },
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) log.warn(`Webhook strony #${siteId} odpowiedział ${res.status}`);
    return res.ok;
  } catch (err) {
    log.warn(`Webhook strony #${siteId} niedostępny`, err);
    return false;
  }
}

export async function ensureSelfSite(ownerId: string | null): Promise<CmsSite | null> {
  const existing = await prisma.cmsSite.findFirst({ where: { isSelf: true } });
  if (existing) {
    if (ownerId && existing.ownerId !== ownerId) return prisma.cmsSite.update({ where: { id: existing.id }, data: { ownerId } });
    return existing;
  }
  if (!ownerId) return null;
  const { site } = await createSite('zxcode.pl', ownerId, 'https://zxcode.pl');
  return prisma.cmsSite.update({ where: { id: site.id }, data: { isSelf: true } });
}

export const selfSite = () => prisma.cmsSite.findFirst({ where: { isSelf: true } });
