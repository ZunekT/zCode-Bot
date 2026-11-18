import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { env } from '../../config/env.js';
import { createLogger } from '../../utils/logger.js';
import { githubEvents, type GithubEventMap } from '../github-events.js';

const log = createLogger('http:github');

function verifySignature(rawBody: Buffer, signature: string | undefined): boolean {
  if (!env.GITHUB_WEBHOOK_SECRET || !signature?.startsWith('sha256=')) return false;
  const expected = Buffer.from(
    `sha256=${createHmac('sha256', env.GITHUB_WEBHOOK_SECRET).update(rawBody).digest('hex')}`,
  );
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function githubRoutes(app: FastifyInstance): Promise<void> {
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => done(null, body));

  app.post('/webhooks/github', async (request, reply) => {
    if (!env.GITHUB_WEBHOOK_SECRET)
      return reply.code(503).send({ error: 'Webhook GitHuba nie jest skonfigurowany' });

    const raw = request.body as Buffer;
    if (!verifySignature(raw, request.headers['x-hub-signature-256'] as string | undefined)) {
      log.warn('Odrzucono webhook z nieprawidłowym podpisem');
      return reply.code(401).send({ error: 'Nieprawidłowy podpis' });
    }

    const event = request.headers['x-github-event'] as string | undefined;
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(raw.toString('utf8')) as Record<string, unknown>;
    } catch {
      return reply.code(400).send({ error: 'Nieprawidłowy JSON' });
    }

    log.info(`Webhook GitHuba: ${event}`);
    if (event && event in ({ release: 1, push: 1, issues: 1, ping: 1 } as const)) {
      githubEvents.emit(event as keyof GithubEventMap, payload);
    }
    return reply.code(202).send({ ok: true });
  });
}
