import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { CmsSite } from '../../generated/prisma/client.js';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { UserError } from '../../core/errors.js';
import { createLogger } from '../../utils/logger.js';
import { authenticateSite, deliverContent, registerSchema } from './service.js';

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

export async function cmsRoutes(app: FastifyInstance): Promise<void> {
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
        const since = Number((request.query as { since?: string }).since);
        if (Number.isInteger(since) && since === site.revision) return reply.code(304).send();
        return await deliverContent(site, baseUrl(request));
      } catch (err) {
        return fail(reply, err);
      }
    });

    secured.put('/cms/v1/schema', async (request, reply) => {
      try {
        return await registerSchema(request.cmsSite!, (request.body ?? {}) as { schema?: unknown; webhookUrl?: unknown });
      } catch (err) {
        return fail(reply, err);
      }
    });
  });
}
