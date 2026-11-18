import { REST, Routes, type RESTPostAPIApplicationCommandsJSONBody } from 'discord.js';
import { env } from '../config/env.js';
import { createLogger } from '../utils/logger.js';
import type { BotModule } from './types.js';

const log = createLogger('registry');

export function collectCommandData(modules: BotModule[]): RESTPostAPIApplicationCommandsJSONBody[] {
  return modules.flatMap((m) => (m.commands ?? []).map((c) => c.data.toJSON()));
}

export async function deployGuildCommands(modules: BotModule[]): Promise<number> {
  const body = collectCommandData(modules);
  const rest = new REST().setToken(env.DISCORD_TOKEN);
  await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.GUILD_ID), { body });
  log.info(`Zarejestrowano ${body.length} komend na serwerze ${env.GUILD_ID}`);
  return body.length;
}
