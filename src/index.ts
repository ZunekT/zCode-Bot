import { env } from './config/env.js';
import { ZxClient } from './client.js';
import { prisma } from './db/prisma.js';
import { redis } from './db/redis.js';
import { assertDatabaseUpToDate } from './core/db-check.js';
import { registerProcessErrorHandlers } from './core/errors.js';
import { routeInteraction } from './core/interactions.js';
import { loadModules } from './core/loader.js';
import { deployGuildCommands } from './core/registry.js';
import { startScheduler, stopScheduler } from './core/scheduler.js';
import { startHttpServer } from './http/server.js';
import { startInternalServer } from './http/internal.js';
import { modules } from './modules/index.js';
import { startSelfSdk } from './modules/sdk/self.js';
import { loadApplicationEmojis } from './ui/emojis.js';
import { logger } from './utils/logger.js';

async function main() {
  registerProcessErrorHandlers();
  logger.info(`Start zxCode Bot (${env.NODE_ENV})`);

  await prisma.$connect();
  await redis.connect();
  await assertDatabaseUpToDate();
  logger.info('Połączono z PostgreSQL i Redis');

  const client = new ZxClient();
  loadModules(client, modules);

  client.on('interactionCreate', (interaction) => void routeInteraction(client, interaction));

  client.once('clientReady', async (ready) => {
    await loadApplicationEmojis(ready);
    await deployGuildCommands(modules).catch((err) =>
      logger.error('Rejestracja komend nie powiodła się', err),
    );
    for (const module of modules) {
      await module.onReady?.(client).catch((err) => logger.error(`onReady modułu ${module.name}`, err));
    }
    startScheduler(client, modules);
    await startSelfSdk(client, modules).catch((err) => logger.error('Panel ustawień bota (SDK)', err));
    logger.info('Bot gotowy');
  });

  const http = await startHttpServer(client);
  const internal = await startInternalServer(client);
  await client.login(env.DISCORD_TOKEN);

  const shutdown = async (signal: string) => {
    logger.info(`Otrzymano ${signal}, zamykam…`);
    stopScheduler();
    await Promise.allSettled([
      http.close(),
      internal?.close(),
      client.destroy(),
      prisma.$disconnect(),
      redis.quit(),
    ]);
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('Krytyczny błąd przy starcie', err);
  process.exit(1);
});
