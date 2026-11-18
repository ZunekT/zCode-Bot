import type { ZxClient } from '../client.js';
import { createLogger } from '../utils/logger.js';
import { getConfig, isModuleEnabled } from './config-service.js';
import type { BotModule } from './types.js';

const log = createLogger('scheduler');
const timers: NodeJS.Timeout[] = [];

export function startScheduler(client: ZxClient, modules: BotModule[]): void {
  for (const module of modules) {
    for (const job of module.jobs ?? []) {
      let running = false;
      const tick = async () => {
        if (running) return;
        running = true;
        try {
          const config = await getConfig();
          if (module.toggleable !== false && !isModuleEnabled(config, module.name)) return;
          await job.run(client);
        } catch (err) {
          log.error(`Zadanie ${module.name}/${job.name} zakończyło się błędem`, err);
        } finally {
          running = false;
        }
      };
      timers.push(setInterval(tick, job.intervalMs));
      if (job.runOnStart) void tick();
      log.info(`Zadanie ${module.name}/${job.name} co ${Math.round(job.intervalMs / 1000)}s`);
    }
  }
}

export function stopScheduler(): void {
  for (const t of timers) clearInterval(t);
  timers.length = 0;
}
