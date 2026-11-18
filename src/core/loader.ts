import type { ZxClient } from '../client.js';
import { createLogger } from '../utils/logger.js';
import type { BotModule } from './types.js';

const log = createLogger('loader');

export function loadModules(client: ZxClient, modules: BotModule[]): void {
  for (const module of modules) {
    if (client.modules.has(module.name))
      throw new Error(`Moduł "${module.name}" jest zarejestrowany dwa razy`);
    client.modules.set(module.name, module);

    for (const command of module.commands ?? []) {
      const name = command.data.name;
      if (client.commands.has(name)) throw new Error(`Komenda "${name}" istnieje już w innym module`);
      client.commands.set(name, { command, module });
    }

    for (const handler of module.components ?? []) {
      if (handler.id.split(':').length !== 2) {
        throw new Error(`Handler "${handler.id}" musi mieć format "modul:akcja"`);
      }
      if (client.components.has(handler.id)) throw new Error(`Handler "${handler.id}" jest zdublowany`);
      client.components.set(handler.id, { handler, module });
    }

    for (const ev of module.events ?? []) {
      const listener = async (...args: unknown[]) => {
        try {
          await (ev.run as (c: ZxClient, ...a: unknown[]) => unknown)(client, ...args);
        } catch (err) {
          log.error(`Błąd w evencie ${ev.event} (moduł ${module.name})`, err);
        }
      };
      if (ev.once) client.once(ev.event, listener);
      else client.on(ev.event, listener);
    }

    log.info(
      `Moduł ${module.name}: ${module.commands?.length ?? 0} komend, ` +
        `${module.components?.length ?? 0} komponentów, ${module.events?.length ?? 0} eventów, ${module.jobs?.length ?? 0} zadań`,
    );
  }
}
