import Fastify, { type FastifyInstance } from 'fastify';
import type { ZxClient } from '../client.js';
import { env } from '../config/env.js';
import { createLogger } from '../utils/logger.js';
import { githubRoutes } from './routes/github.js';
import { heartbeatRoutes } from './routes/heartbeat.js';
import { sdkRoutes } from '../modules/sdk/routes.js';

const log = createLogger('http');

const PRIVATE = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|::ffff:(127|10|192\.168|172\.(1[6-9]|2\d|3[01]))\.|f[cd])/;
const GUARDED = /^\/(sdk|heartbeat|webhooks)\//;

// Nieudane uwierzytelnienia (zły klucz SDK, token heartbeat, podpis webhooka): 30 na 10 min z jednego IP, potem blokada.
const authLimiter = (() => {
  const WINDOW = 10 * 60_000;
  const LIMIT = 30;
  const hits = new Map<string, { n: number; at: number }>();
  setInterval(() => {
    const now = Date.now();
    for (const [ip, h] of hits) if (now - h.at > WINDOW) hits.delete(ip);
  }, 60_000).unref();
  return {
    blocked(ip: string) {
      const h = hits.get(ip);
      return !!h && Date.now() - h.at < WINDOW && h.n >= LIMIT;
    },
    fail(ip: string) {
      const h = hits.get(ip);
      if (!h || Date.now() - h.at > WINDOW) hits.set(ip, { n: 1, at: Date.now() });
      else h.n++;
    },
  };
})();

export async function startHttpServer(client: ZxClient): Promise<FastifyInstance> {
  // Za Caddy: ufamy tylko adresom prywatnym (Caddy/docker), więc IP klienta to adres dopisany przez Caddy, nie z nagłówka klienta.
  const app = Fastify({ logger: false, bodyLimit: 5 * 1024 * 1024, trustProxy: (addr) => PRIVATE.test(addr) });

  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('cache-control', 'no-store');
    const group = GUARDED.exec(request.url)?.[1];
    if (group && authLimiter.blocked(`${group}:${request.ip}`)) {
      return reply.code(429).header('retry-after', '600').send({ error: 'Za dużo nieudanych prób. Spróbuj później.' });
    }
  });
  app.addHook('onResponse', async (request, reply) => {
    const group = GUARDED.exec(request.url)?.[1];
    const failed = reply.statusCode === 401 || reply.statusCode === 403 || (group === 'heartbeat' && reply.statusCode === 404);
    if (group && failed) authLimiter.fail(`${group}:${request.ip}`);
  });

  app.get('/health', async () => ({
    status: client.isReady() ? 'ok' : 'starting',
    uptime: Math.round(process.uptime()),
    ping: client.ws.ping,
  }));

  await app.register(githubRoutes);
  await app.register(heartbeatRoutes);
  await app.register(sdkRoutes);

  await app.listen({ port: env.HTTP_PORT, host: '0.0.0.0' });
  log.info(`Serwer HTTP nasłuchuje na porcie ${env.HTTP_PORT}`);
  return app;
}
