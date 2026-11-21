import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ZxClient } from '../client.js';
import { audit } from '../core/audit.js';
import { UserError } from '../core/errors.js';
import { prisma } from '../db/prisma.js';
import { createLogger } from '../utils/logger.js';
import { CmsForbidden, need, removeMember, setMember, siteAccess, type CmsPerm, type SiteAccess } from '../modules/cms/access.js';
import * as biz from '../modules/cms/business.js';
import { ContentInvalid } from '../modules/cms/schema.js';
import {
  addAsset,
  cancelSchedule,
  deliverContent,
  discardDraft,
  editorData,
  exportSite,
  listSites,
  notifySite,
  publish,
  registerSchema,
  removeAsset,
  rotatePreviewToken,
  saveDraft,
  schedule,
  selfSite,
} from '../modules/cms/service.js';
import { publicState, saveAnnouncement, saveMaintenance, saveRedirects } from '../modules/cms/state.js';
import { recordHit, siteStats } from '../modules/cms/stats.js';
import { person } from './admin-more.js';
import { invalidatePublicSite } from './public-site.js';

const log = createLogger('http:cms');
const FILE_RE = /^([a-f0-9]{24})\.(png|jpg|webp|gif)$/;

function fail(reply: FastifyReply, err: unknown) {
  if (err instanceof ContentInvalid) return reply.code(400).send({ error: 'Popraw zaznaczone pola.', errors: err.errors });
  if (err instanceof CmsForbidden) return reply.code(403).send({ error: err.message });
  if (err instanceof UserError) return reply.code(400).send({ error: err.message });
  log.error('Błąd wewnętrznego API CMS', err);
  return reply.code(500).send({ error: 'Błąd serwera' });
}

const params = (p: unknown) => {
  const { userId, siteId, assetId, id } = p as { userId: string; siteId?: string; assetId?: string; id?: string };
  if (!/^\d{17,20}$/.test(userId)) throw new UserError('Nieprawidłowy użytkownik.');
  return { userId, siteId: Number(siteId), assetId: assetId ?? '', id: Number(id), rawId: id ?? '' };
};

const body = (b: unknown) => (b && typeof b === 'object' && !Array.isArray(b) ? (b as Record<string, unknown>) : {});

export function cmsInternalRoutes(app: FastifyInstance, client: ZxClient) {
  const people = async (ids: Iterable<string>) => {
    const list = await Promise.all([...new Set(ids)].filter((id) => /^\d{17,20}$/.test(id)).slice(0, 60).map((id) => person(client, id)));
    return Object.fromEntries(list.map((p) => [p.id, p]));
  };
  const withPeople = async <T extends { userId: string }>(members: T[]) => ({ members, people: await people(members.map((m) => m.userId)) });

  const base = '/internal/users/:userId/cms';

  const route = (
    method: 'get' | 'put' | 'post' | 'delete',
    path: string,
    perm: CmsPerm | null,
    fn: (a: SiteAccess, req: { body: unknown; query: Record<string, string>; params: ReturnType<typeof params> }) => Promise<unknown>,
    opts: { bodyLimit?: number; self?: boolean } = {},
  ) => {
    app[method](`${base}/:siteId${path}`, opts.bodyLimit ? { bodyLimit: opts.bodyLimit } : {}, async (request, reply) => {
      try {
        const p = params(request.params);
        const a = await siteAccess(client, p.siteId, p.userId);
        if (!a || (opts.self && !a.site.isSelf)) return reply.code(404).send({ error: 'Nie znaleziono strony.' });
        if (perm) need(a, perm);
        const result = await fn(a, { body: request.body, query: (request.query ?? {}) as Record<string, string>, params: p });
        if (opts.self && method !== 'get') invalidatePublicSite();
        return result;
      } catch (err) {
        return fail(reply, err);
      }
    });
  };

  const logChange = (a: SiteAccess, what: string) =>
    audit(client, { action: 'cms.content', actorId: a.userId, summary: `Panel WWW: ${what} – strona ${a.site.name}` });

  app.get(base, async (request, reply) => {
    try {
      const { userId } = params(request.params);
      return { sites: await listSites(userId) };
    } catch (err) {
      return fail(reply, err);
    }
  });

  route('get', '', null, async (a) => {
    const data = await editorData(a);
    const ids = [a.site.ownerId, ...data.versions.map((v) => v.authorId), ...(data.members ?? []).map((m) => m.userId)];
    return { ...data, people: await people(ids) };
  });

  route('put', '/draft', 'content', async (a, r) => saveDraft(a, body(r.body).content));
  route('delete', '/draft', 'content', async (a) => {
    await discardDraft(a);
    return { ok: true };
  });

  route('post', '/publish', 'publish', async (a, r) => {
    const b = body(r.body);
    if (b.content !== undefined) need(a, 'content');
    const result = await publish(a, b.content, typeof b.revision === 'number' ? b.revision : undefined);
    await logChange(a, `publikacja treści (wersja ${result.revision})`);
    return result;
  });
  route('put', '/content', 'publish', async (a, r) => {
    need(a, 'content');
    const b = body(r.body);
    const result = await publish(a, b.content ?? null, typeof b.revision === 'number' ? b.revision : undefined);
    await logChange(a, `publikacja treści (wersja ${result.revision})`);
    return result;
  });
  route('post', '/schedule', 'publish', async (a, r) => {
    const b = body(r.body);
    if (b.content !== undefined) need(a, 'content');
    const result = await schedule(a, b.content, b.at);
    await logChange(a, `zaplanowana publikacja na ${result.scheduledAt}`);
    return result;
  });
  route('delete', '/schedule', 'publish', async (a) => {
    await cancelSchedule(a);
    return { ok: true };
  });

  route('post', '/assets', 'content', async (a, r) => {
    const b = body(r.body);
    if (typeof b.data !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(b.data)) throw new UserError('Nieprawidłowy plik.');
    return addAsset(a.site, typeof b.name === 'string' ? b.name : '', Buffer.from(b.data, 'base64'));
  }, { bodyLimit: 7 * 1024 * 1024 });
  app.get(`${base}/:siteId/assets/:assetId`, async (request, reply) => {
    try {
      const p = params(request.params);
      const a = await siteAccess(client, p.siteId, p.userId);
      if (!a) return reply.code(404).send({ error: 'Nie znaleziono.' });
      const asset = await prisma.cmsAsset.findFirst({ where: { id: p.assetId, siteId: a.site.id }, select: { data: true, contentType: true } });
      if (!asset) return reply.code(404).send({ error: 'Nie znaleziono.' });
      return reply.header('content-type', asset.contentType).send(Buffer.from(asset.data));
    } catch (err) {
      return fail(reply, err);
    }
  });
  route('delete', '/assets/:assetId', 'content', async (a, r) => {
    await removeAsset(a.site, r.params.assetId);
    return { ok: true };
  });

  route('post', '/refresh', 'publish', async (a) => ({ ok: await notifySite(a.site.id, a.site.revision) }));
  route('post', '/preview-token', 'content', async (a) => ({ previewToken: await rotatePreviewToken(a.site.id) }));

  const stateChanged = async (a: SiteAccess, what: string, site: { id: number; stateRev: number }) => {
    void notifySite(site.id, site.stateRev, 'state.updated');
    await logChange(a, what);
  };
  route('put', '/announcement', 'announcement', async (a, r) => {
    const site = await saveAnnouncement(a.site, body(r.body));
    await stateChanged(a, 'zmiana ogłoszenia', site);
    return { ok: true, stateRev: site.stateRev };
  });
  route('put', '/maintenance', 'maintenance', async (a, r) => {
    const site = await saveMaintenance(a.site, body(r.body));
    await stateChanged(a, `przerwa techniczna ${(site.maintenance as { enabled?: boolean }).enabled ? 'włączona' : 'wyłączona'}`, site);
    return { ok: true, stateRev: site.stateRev };
  });
  route('put', '/redirects', 'redirects', async (a, r) => {
    const site = await saveRedirects(a.site, body(r.body).redirects);
    await stateChanged(a, 'zmiana przekierowań', site);
    return { ok: true, stateRev: site.stateRev };
  });

  route('get', '/stats', 'stats', async (a, r) => siteStats(a.site.id, Number(r.query.days) || 30));
  route('get', '/export', 'content', async (a) => exportSite(a, ''));

  route('put', '/members/:id', 'access', async (a, r) => {
    return withPeople(await setMember(a, r.params.rawId, body(r.body)));
  });
  route('delete', '/members/:id', null, async (a, r) => withPeople(await removeMember(a, r.params.rawId)));

  route('get', '/pricing', 'content', () => biz.pricingData(), { self: true });
  route('post', '/pricing/packages', 'content', (_a, r) => biz.savePackage(null, body(r.body)), { self: true });
  route('put', '/pricing/packages/:id', 'content', (_a, r) => biz.savePackage(r.params.id, body(r.body)), { self: true });
  route('delete', '/pricing/packages/:id', 'content', (_a, r) => biz.deletePackage(r.params.id), { self: true });
  route('post', '/pricing/addons', 'content', (_a, r) => biz.saveAddon(null, body(r.body)), { self: true });
  route('put', '/pricing/addons/:id', 'content', (_a, r) => biz.saveAddon(r.params.id, body(r.body)), { self: true });
  route('delete', '/pricing/addons/:id', 'content', (_a, r) => biz.deleteAddon(r.params.id), { self: true });
  route('get', '/portfolio', 'content', () => biz.portfolioData(), { self: true });
  route('post', '/portfolio', 'content', (_a, r) => biz.savePortfolio(null, body(r.body)), { self: true });
  route('put', '/portfolio/:id', 'content', (_a, r) => biz.savePortfolio(r.params.id, body(r.body)), { self: true });
  route('delete', '/portfolio/:id', 'content', (_a, r) => biz.deletePortfolio(r.params.id), { self: true });
  route(
    'post',
    '/portfolio/:id/images',
    'content',
    (_a, r) => {
      const b = body(r.body);
      if (typeof b.data !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(b.data)) throw new UserError('Nieprawidłowy plik.');
      return biz.addPortfolioImage(r.params.id, Buffer.from(b.data, 'base64'));
    },
    { self: true, bodyLimit: 7 * 1024 * 1024 },
  );
  route('delete', '/portfolio-images/:id', 'content', (_a, r) => biz.deletePortfolioImage(r.params.id), { self: true });
  const reviewsOut = async (list: Awaited<ReturnType<typeof biz.reviewsData>>) => ({ reviews: list, people: await people(list.map((r) => r.userId)) });
  route('get', '/reviews', 'content', async () => reviewsOut(await biz.reviewsData()), { self: true });
  route('put', '/reviews/:id', 'content', async (a, r) => reviewsOut(await biz.setReviewApproved(r.params.id, body(r.body).approved === true, a.userId)), { self: true });
  route('delete', '/reviews/:id', 'content', async (_a, r) => reviewsOut(await biz.deleteReview(r.params.id)), { self: true });

  app.get('/internal/cms/self/content', async (request, reply) => {
    try {
      const site = await selfSite();
      if (!site) return reply.code(404).send({ error: 'Brak strony zxcode.pl w CMS.' });
      return await deliverContent(site, '', (request.query as { draft?: string }).draft === '1');
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.put('/internal/cms/self/schema', async (request, reply) => {
    try {
      const site = await selfSite();
      if (!site) return reply.code(404).send({ error: 'Brak strony zxcode.pl w CMS.' });
      return await registerSchema(site, { schema: body(request.body).schema });
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.get('/internal/cms/self/state', async (request, reply) => {
    try {
      const site = await selfSite();
      if (!site) return { stateRev: 0, announcement: null, maintenance: null, redirects: [], bypass: '' };
      const user = (request.query as { user?: string }).user;
      const state = publicState(site);
      let editor = false;
      if (user && /^\d{17,20}$/.test(user)) editor = !!(await siteAccess(client, site.id, user));
      return { ...state, editor, previewToken: undefined };
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.post('/internal/cms/self/hit', async (request, reply) => {
    try {
      const site = await selfSite();
      const b = body(request.body);
      if (site && typeof b.ip === 'string' && typeof b.ua === 'string')
        await recordHit(site, { path: b.path, referrer: b.referrer, ip: b.ip, ua: b.ua });
      return { ok: true };
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.get('/internal/cms/self/preview', async (request) => {
    const site = await selfSite();
    const token = (request.query as { token?: string }).token;
    return { ok: !!site && typeof token === 'string' && token.length > 20 && token === site.previewToken };
  });

  app.get('/internal/cms/assets/:siteId/:file', async (request, reply) => {
    const { siteId, file } = request.params as { siteId: string; file: string };
    const m = FILE_RE.exec(file);
    if (!m || !Number.isInteger(Number(siteId))) return reply.code(404).send({ error: 'Nie znaleziono' });
    const asset = await prisma.cmsAsset.findFirst({ where: { id: m[1], siteId: Number(siteId) }, select: { data: true, contentType: true } });
    if (!asset) return reply.code(404).send({ error: 'Nie znaleziono' });
    return reply.header('content-type', asset.contentType).send(Buffer.from(asset.data));
  });
}
