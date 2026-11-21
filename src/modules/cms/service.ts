import { createHash, createHmac, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';
import type { CmsSite, Prisma } from '../../generated/prisma/client.js';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { UserError } from '../../core/errors.js';
import { createLogger } from '../../utils/logger.js';
import { inspectImage } from './images.js';
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
    data: { name, ownerId, url, keyHash: `pending-${randomBytes(8).toString('hex')}`, keyPrefix: '' },
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

export async function deliverContent(site: CmsSite, base: string) {
  const content = mergeDefaults(asSchema(site), asContent(site));
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
  await prisma.cmsSite.update({ where: { id: site.id }, data: { lastFetchAt: new Date() } }).catch(() => undefined);
  return { revision: site.revision, updatedAt: site.updatedAt.toISOString(), content: expand(content) };
}

export function canEditSite(site: CmsSite, userId: string, admin: boolean) {
  return admin || site.ownerId === userId;
}

export async function siteForUser(id: number, userId: string, admin: boolean) {
  const site = Number.isInteger(id) ? await prisma.cmsSite.findUnique({ where: { id } }) : null;
  if (!site || !canEditSite(site, userId, admin)) return null;
  return site;
}

export async function listSites(userId: string, admin: boolean) {
  const sites = await prisma.cmsSite.findMany({
    where: admin ? {} : { ownerId: userId },
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { assets: true } } },
  });
  return sites.map((s) => ({
    id: s.id,
    name: s.name,
    url: s.url,
    ownerId: s.ownerId,
    revision: s.revision,
    updatedAt: s.updatedAt.toISOString(),
    connected: !!s.schemaAt,
    sections: asSchema(s).sections.length,
    lastFetchAt: s.lastFetchAt?.toISOString() ?? null,
    assets: s._count.assets,
  }));
}

export async function editorData(site: CmsSite) {
  const [assets, versions] = await Promise.all([
    prisma.cmsAsset.findMany({
      where: { siteId: site.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, contentType: true, size: true, width: true, height: true, createdAt: true },
    }),
    prisma.cmsVersion.findMany({ where: { siteId: site.id }, orderBy: { revision: 'desc' }, take: KEEP_VERSIONS }),
  ]);
  return {
    site: { id: site.id, name: site.name, url: site.url, revision: site.revision, updatedAt: site.updatedAt.toISOString(), connected: !!site.schemaAt, webhook: !!site.webhookUrl },
    schema: asSchema(site),
    content: mergeDefaults(asSchema(site), asContent(site)),
    assets: assets.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
    versions: versions.map((v) => ({ revision: v.revision, authorId: v.authorId, createdAt: v.createdAt.toISOString(), content: v.content })),
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

export async function notifySite(siteId: number, revision: number): Promise<boolean> {
  const site = await prisma.cmsSite.findUnique({ where: { id: siteId } });
  if (!site?.webhookUrl) return false;
  const body = JSON.stringify({ event: 'content.updated', siteId, revision });
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
