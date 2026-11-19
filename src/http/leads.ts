import type { FastifyInstance, FastifyReply } from 'fastify';
import type { LeadStatus } from '../generated/prisma/client.js';
import type { ZxClient } from '../client.js';
import { audit } from '../core/audit.js';
import { UserError } from '../core/errors.js';
import { prisma } from '../db/prisma.js';
import { createLead, LEAD_STATUSES, LEAD_STATUS_KEYS, leadLabels } from '../modules/leads/service.js';
import { sendError } from '../modules/sdk/routes.js';

type Check = (params: unknown, reply: FastifyReply) => Promise<string | null>;

export function leadRoutes(app: FastifyInstance, client: ZxClient, adminCheck: Check) {
  app.post('/internal/public/leads', async (request, reply) => {
    try {
      const body = (request.body ?? {}) as Record<string, unknown>;
      const ipHash =
        typeof body.ipHash === 'string' && /^[a-f0-9]{16,64}$/.test(body.ipHash) ? body.ipHash : null;
      if (!ipHash) throw new UserError('Nieprawidłowe zapytanie.');
      return await createLead(client, body, ipHash);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  const base = '/internal/users/:userId/admin/leads';

  app.get(base, async (request, reply) => {
    try {
      if (!(await adminCheck(request.params, reply))) return;
      const q = request.query as { status?: string };
      const status = LEAD_STATUS_KEYS.includes(q.status as LeadStatus) ? (q.status as LeadStatus) : undefined;
      const [rows, counts] = await Promise.all([
        prisma.lead.findMany({
          where: status ? { status } : q.status === 'all' ? {} : { status: { in: ['NEW', 'CONTACTED'] } },
          orderBy: { createdAt: 'desc' },
          take: 200,
        }),
        prisma.lead.groupBy({ by: ['status'], _count: true }),
      ]);
      return {
        counts: Object.fromEntries(counts.map((c) => [c.status, c._count])),
        leads: rows.map((l) => ({
          id: l.id,
          name: l.name,
          email: l.email,
          company: l.company,
          ...leadLabels(l),
          status: l.status,
          statusLabel: LEAD_STATUSES[l.status],
          preview: l.description.slice(0, 140),
          createdAt: l.createdAt,
        })),
      };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get(`${base}/:id`, async (request, reply) => {
    try {
      if (!(await adminCheck(request.params, reply))) return;
      const id = Number((request.params as { id: string }).id);
      const l = Number.isSafeInteger(id) ? await prisma.lead.findUnique({ where: { id } }) : null;
      if (!l) return reply.code(404).send({ error: 'Nie znaleziono zapytania.' });
      return {
        id: l.id,
        name: l.name,
        email: l.email,
        company: l.company,
        website: l.website,
        discord: l.discord,
        description: l.description,
        note: l.note,
        ...leadLabels(l),
        status: l.status,
        statusLabel: LEAD_STATUSES[l.status],
        statuses: LEAD_STATUS_KEYS.map((s) => ({ value: s, label: LEAD_STATUSES[s] })),
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
      };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.patch(`${base}/:id`, async (request, reply) => {
    try {
      const userId = await adminCheck(request.params, reply);
      if (!userId) return;
      const id = Number((request.params as { id: string }).id);
      const b = (request.body ?? {}) as { status?: unknown; note?: unknown };
      const data: { status?: LeadStatus; note?: string | null } = {};
      if (b.status !== undefined) {
        if (!LEAD_STATUS_KEYS.includes(b.status as LeadStatus)) throw new UserError('Nieznany status.');
        data.status = b.status as LeadStatus;
      }
      if (b.note !== undefined) {
        if (b.note !== null && typeof b.note !== 'string') throw new UserError('Nieprawidłowa notatka.');
        data.note = typeof b.note === 'string' ? b.note.trim().slice(0, 2000) || null : null;
      }
      const l = Number.isSafeInteger(id) ? await prisma.lead.findUnique({ where: { id } }) : null;
      if (!l) return reply.code(404).send({ error: 'Nie znaleziono zapytania.' });
      const saved = await prisma.lead.update({ where: { id }, data });
      if (data.status && data.status !== l.status) {
        await audit(client, {
          action: 'lead.status',
          actorId: userId,
          summary: `Zapytanie #${id} (${l.name}): ${LEAD_STATUSES[l.status]} → ${LEAD_STATUSES[data.status]}`,
        });
      }
      return { status: saved.status, note: saved.note };
    } catch (err) {
      return sendError(reply, err);
    }
  });
}
