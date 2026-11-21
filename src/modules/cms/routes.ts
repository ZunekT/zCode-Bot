import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { CmsSite } from '../../generated/prisma/client.js';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { UserError } from '../../core/errors.js';
import { createLogger } from '../../utils/logger.js';
import { authenticateSite, deliverContent, registerSchema } from './service.js';
import { publicState } from './state.js';
import { recordHit, TRACKER_JS } from './stats.js';

const log = createLogger('cms:http');
const FILE_RE = /^([a-f0-9]{24})\.(png|jpg|webp|gif)$/;

declare module 'fastify' {
  interface FastifyRequest {
    cmsSite?: CmsSite;
  }
}

const baseUrl = (request: FastifyRequest) => env.PUBLIC_URL ?? `${request.protocol}://${request.host}`;

function fail(reply: FastifyReply, err: unknown) {
  if (err instanceof UserError) return reply.code(400).send({ error: err.message });
  log.error('Błąd API CMS', err);
  return reply.code(500).send({ error: 'Błąd serwera' });
}

const trackCache = new Map<string, { at: number; site: { id: number; url: string | null } | null }>();

async function siteByTrack(trackId: string) {
  const hit = trackCache.get(trackId);
  if (hit && Date.now() - hit.at < 60_000) return hit.site;
  const site = await prisma.cmsSite.findUnique({ where: { trackId }, select: { id: true, url: true } });
  if (trackCache.size > 2000) trackCache.clear();
  trackCache.set(trackId, { at: Date.now(), site });
  return site;
}

export async function cmsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/cms/v1/t.js', async (_request, reply) =>
    reply
      .header('content-type', 'application/javascript; charset=utf-8')
      .header('cache-control', 'public, max-age=86400')
      .header('cross-origin-resource-policy', 'cross-origin')
      .header('access-control-allow-origin', '*')
      .send(TRACKER_JS),
  );

  app.options('/cms/v1/hit', async (_request, reply) =>
    reply.header('access-control-allow-origin', '*').header('access-control-allow-methods', 'POST').header('access-control-allow-headers', 'content-type').code(204).send(),
  );

  app.post('/cms/v1/hit', { bodyLimit: 4096 }, async (request, reply) => {
    reply.header('access-control-allow-origin', '*');
    try {
      const raw = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
      const b = (raw ?? {}) as { t?: unknown; p?: unknown; r?: unknown };
      if (typeof b.t === 'string' && /^[a-f0-9]{16}$/.test(b.t)) {
        const site = await siteByTrack(b.t);
        if (site) await recordHit(site, { path: b.p, referrer: b.r, ip: request.ip, ua: String(request.headers['user-agent'] ?? '') });
      }
    } catch {}
    return reply.code(204).send();
  });

  app.get('/cms/v1/assets/:siteId/:file', async (request, reply) => {
    const { siteId, file } = request.params as { siteId: string; file: string };
    const m = FILE_RE.exec(file);
    const id = Number(siteId);
    if (!m || !Number.isInteger(id)) return reply.code(404).send({ error: 'Nie znaleziono' });
    const asset = await prisma.cmsAsset.findFirst({ where: { id: m[1], siteId: id }, select: { data: true, contentType: true } });
    if (!asset) return reply.code(404).send({ error: 'Nie znaleziono' });
    return reply
      .header('content-type', asset.contentType)
      .header('cache-control', 'public, max-age=31536000, immutable')
      .header('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox")
      .header('cross-origin-resource-policy', 'cross-origin')
      .header('access-control-allow-origin', '*')
      .send(Buffer.from(asset.data));
  });

  await app.register(async (secured) => {
    secured.addHook('preHandler', async (request, reply) => {
      const auth = request.headers.authorization;
      const site = await authenticateSite(auth?.startsWith('Bearer ') ? auth.slice(7).trim() : undefined);
      if (!site) return reply.code(401).send({ error: 'Nieprawidłowy klucz strony zxCode' });
      request.cmsSite = site;
    });

    secured.get('/cms/v1/content', async (request, reply) => {
      try {
        const site = request.cmsSite!;
        const q = request.query as { since?: string; draft?: string };
        const draft = q.draft === '1';
        const since = Number(q.since);
        if (!draft && Number.isInteger(since) && since === site.revision) return reply.code(304).send();
        return await deliverContent(site, baseUrl(request), draft);
      } catch (err) {
        return fail(reply, err);
      }
    });

    secured.get('/cms/v1/state', async (request) => publicState(request.cmsSite!));

    secured.put('/cms/v1/schema', async (request, reply) => {
      try {
        return await registerSchema(request.cmsSite!, (request.body ?? {}) as { schema?: unknown; webhookUrl?: unknown });
      } catch (err) {
        return fail(reply, err);
      }
    });
  });
}
