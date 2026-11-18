import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import type { BotModule, Command, ComponentHandler } from './core/types.js';
import { createLogger } from './utils/logger.js';

export class ZxClient extends Client {
  readonly modules = new Collection<string, BotModule>();
  readonly commands = new Collection<string, { command: Command; module: BotModule }>();
  readonly components = new Collection<string, { handler: ComponentHandler; module: BotModule }>();
  readonly log = createLogger('client');
  readonly startedAt = new Date();

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildScheduledEvents,
        GatewayIntentBits.DirectMessages,
      ],
      partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
      allowedMentions: { parse: [], repliedUser: false },
    });
  }
}
