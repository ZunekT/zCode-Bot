import Fastify, { type FastifyInstance } from 'fastify';
import type { ZxClient } from '../client.js';
import { env } from '../config/env.js';
import { createLogger } from '../utils/logger.js';
import { githubRoutes } from './routes/github.js';
import { heartbeatRoutes } from './routes/heartbeat.js';

const log = createLogger('http');

export async function startHttpServer(client: ZxClient): Promise<FastifyInstance> {
  const app = Fastify({ logger: false, bodyLimit: 5 * 1024 * 1024 });

  app.get('/health', async () => ({
    status: client.isReady() ? 'ok' : 'starting',
    uptime: Math.round(process.uptime()),
    ping: client.ws.ping,
  }));

  await app.register(githubRoutes);
  await app.register(heartbeatRoutes);

  await app.listen({ port: env.HTTP_PORT, host: '0.0.0.0' });
  log.info(`Serwer HTTP nasłuchuje na porcie ${env.HTTP_PORT}`);
  return app;
}
