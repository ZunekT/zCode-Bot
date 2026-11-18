import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db/prisma.js';

export async function heartbeatRoutes(app: FastifyInstance): Promise<void> {
  const handler = async (
    request: { params: unknown; query: unknown },
    reply: { code: (c: number) => { send: (b: unknown) => unknown } },
  ) => {
    const { token } = request.params as { token: string };
    if (!/^[a-f0-9]{48}$/.test(token)) return reply.code(404).send({ error: 'Nieznany token' });
    const version = (request.query as { version?: string }).version?.slice(0, 40);
    const { count } = await prisma.monitoredBot.updateMany({
      where: { heartbeatToken: token },
      data: { lastHeartbeatAt: new Date(), ...(version && { version }) },
    });
    return count ? reply.code(200).send({ ok: true }) : reply.code(404).send({ error: 'Nieznany token' });
  };
  app.get('/heartbeat/:token', handler);
  app.post('/heartbeat/:token', handler);
}
