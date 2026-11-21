import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ZxClient } from '../client.js';
import { audit } from '../core/audit.js';
import { UserError } from '../core/errors.js';
import { createLogger } from '../utils/logger.js';
import { accessOf } from '../modules/site/admins.js';
import { ContentInvalid } from '../modules/cms/schema.js';
import {
  addAsset,
  editorData,
  listSites,
  notifySite,
  removeAsset,
  saveContent,
  siteForUser,
} from '../modules/cms/service.js';
import { prisma } from '../db/prisma.js';

const log = createLogger('http:cms');

function fail(reply: FastifyReply, err: unknown) {
  if (err instanceof ContentInvalid) return reply.code(400).send({ error: 'Popraw zaznaczone pola.', errors: err.errors });
  if (err instanceof UserError) return reply.code(400).send({ error: err.message });
  log.error('Błąd wewnętrznego API CMS', err);
  return reply.code(500).send({ error: 'Błąd serwera' });
}

const params = (p: unknown) => {
  const { userId, siteId, assetId } = p as { userId: string; siteId?: string; assetId?: string };
  if (!/^\d{17,20}$/.test(userId)) throw new UserError('Nieprawidłowy użytkownik.');
  return { userId, siteId: Number(siteId), assetId: assetId ?? '' };
};

export function cmsInternalRoutes(app: FastifyInstance, client: ZxClient) {
  const base = '/internal/users/:userId/cms';

  const load = async (raw: unknown, reply: FastifyReply) => {
    const p = params(raw);
    const { admin } = await accessOf(client, p.userId);
    const site = await siteForUser(p.siteId, p.userId, admin);
    if (!site) {
      reply.code(404).send({ error: 'Nie znaleziono strony.' });
      return null;
    }
    return { ...p, site, admin };
  };

  app.get(base, async (request, reply) => {
    try {
      const { userId } = params(request.params);
      return { sites: await listSites(userId, false) };
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.get(`${base}/:siteId`, async (request, reply) => {
    try {
      const ctx = await load(request.params, reply);
      if (!ctx) return;
      return await editorData(ctx.site);
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.put(`${base}/:siteId/content`, async (request, reply) => {
    try {
      const ctx = await load(request.params, reply);
      if (!ctx) return;
      const body = (request.body ?? {}) as { content?: unknown; revision?: unknown };
      const result = await saveContent(ctx.site, body.content, ctx.userId, typeof body.revision === 'number' ? body.revision : undefined);
      await audit(client, {
        action: 'cms.content',
        actorId: ctx.userId,
        summary: `Panel WWW: zmiana treści strony ${ctx.site.name} (wersja ${result.revision})`,
      });
      return result;
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.post(`${base}/:siteId/assets`, { bodyLimit: 7 * 1024 * 1024 }, async (request, reply) => {
    try {
      const ctx = await load(request.params, reply);
      if (!ctx) return;
      const body = (request.body ?? {}) as { name?: unknown; data?: unknown };
      if (typeof body.data !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(body.data)) throw new UserError('Nieprawidłowy plik.');
      return await addAsset(ctx.site, typeof body.name === 'string' ? body.name : '', Buffer.from(body.data, 'base64'));
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.get(`${base}/:siteId/assets/:assetId`, async (request, reply) => {
    try {
      const ctx = await load(request.params, reply);
      if (!ctx) return;
      const asset = await prisma.cmsAsset.findFirst({ where: { id: ctx.assetId, siteId: ctx.site.id }, select: { data: true, contentType: true } });
      if (!asset) return reply.code(404).send({ error: 'Nie znaleziono.' });
      return reply.header('content-type', asset.contentType).send(Buffer.from(asset.data));
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.delete(`${base}/:siteId/assets/:assetId`, async (request, reply) => {
    try {
      const ctx = await load(request.params, reply);
      if (!ctx) return;
      await removeAsset(ctx.site, ctx.assetId);
      return { ok: true };
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.post(`${base}/:siteId/refresh`, async (request, reply) => {
    try {
      const ctx = await load(request.params, reply);
      if (!ctx) return;
      return { ok: await notifySite(ctx.site.id, ctx.site.revision) };
    } catch (err) {
      return fail(reply, err);
    }
  });
}
