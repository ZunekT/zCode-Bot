import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { SdkBot } from '../../generated/prisma/client.js';
import { UserError } from '../../core/errors.js';
import { createLogger } from '../../utils/logger.js';
import { sdkHub } from './hub.js';
import { ValidationFailed, authenticate, heartbeat, hello, profileResult, setConfig, setConnected, syncGuilds, type HelloPayload } from './service.js';

const log = createLogger('sdk:http');

declare module 'fastify' {
  interface FastifyRequest {
    sdkBot?: SdkBot;
  }
}

/** Wspólna obsługa błędów: błędy walidacji -> 400 z listą pól, reszta -> 500. */
export function sendError(reply: FastifyReply, err: unknown) {
  if (err instanceof ValidationFailed) return reply.code(400).send({ error: 'validation', errors: err.errors });
  if (err instanceof UserError) return reply.code(400).send({ error: err.message });
  log.error('Błąd API SDK', err);
  return reply.code(500).send({ error: 'Błąd serwera' });
}

/**
 * Publiczne API dla botów z zxcode-sdk (https://bot.zxcode.pl/sdk/v1/…).
 * Uwierzytelnienie: nagłówek „Authorization: Bearer zxk_…”.
 */
export async function sdkRoutes(app: FastifyInstance): Promise<void> {
  const keepAlive = setInterval(() => sdkHub.keepAlive(), 25_000);
  keepAlive.unref();
  app.addHook('onClose', async () => clearInterval(keepAlive));

  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = request.headers.authorization;
    const bot = await authenticate(auth?.startsWith('Bearer ') ? auth.slice(7).trim() : undefined);
    if (!bot) return reply.code(401).send({ error: 'Nieprawidłowy klucz zxCode SDK' });
    request.sdkBot = bot;
  });

  app.post('/sdk/v1/hello', async (request, reply) => {
    try {
      return await hello(request.sdkBot!, (request.body ?? {}) as HelloPayload);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post('/sdk/v1/guilds', async (request, reply) => {
    try {
      await syncGuilds(request.sdkBot!, (request.body ?? {}) as { guilds?: unknown[]; removed?: unknown[] });
      return { ok: true };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post('/sdk/v1/heartbeat', async (request, reply) => {
    try {
      await heartbeat(request.sdkBot!, (request.body ?? {}) as { version?: string });
      return { ok: true };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post('/sdk/v1/profile/result', async (request, reply) => {
    try {
      await profileResult(request.sdkBot!, (request.body ?? {}) as { revision?: number; ok?: boolean; error?: string });
      return { ok: true };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  /** Bot zgłasza własne ustawienia (np. zmienione komendą na Discordzie). */
  app.put('/sdk/v1/config/:guildId', async (request, reply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const body = (request.body ?? {}) as { values?: unknown; permissions?: unknown };
      const saved = await setConfig(request.sdkBot!.id, guildId, body, `bot:${request.sdkBot!.id}`);
      return { revision: saved.revision };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  /** Strumień zdarzeń (SSE): zmiany ustawień i profilu na żywo. */
  app.get('/sdk/v1/events', async (request, reply) => {
    const bot = request.sdkBot!;
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    res.write('retry: 5000\n\n');
    sdkHub.addStream(bot.id, res);
    await setConnected(bot.id, true);
    log.info(`Bot #${bot.id} (${bot.name}) połączony`);

    request.raw.on('close', () => {
      const still = sdkHub.removeStream(bot.id, res);
      if (!still) {
        void setConnected(bot.id, false);
        log.info(`Bot #${bot.id} (${bot.name}) rozłączony`);
      }
    });
  });
}
