import type { GuildMember, Interaction } from 'discord.js';
import type { ZxClient } from '../client.js';
import { env } from '../config/env.js';
import { failure, warning } from '../ui/components/notice.js';
import { checkCooldown } from '../utils/locks.js';
import { createLogger } from '../utils/logger.js';
import { getConfig, isModuleEnabled } from './config-service.js';
import { handleInteractionError } from './errors.js';
import { accessLabel, hasAccess, isAdmin } from './permissions.js';
import type { AccessLevel, BotModule, ComponentHandler, Context, SlashCommand } from './types.js';

const log = createLogger('interactions');

/** Typ handlera -> rodzaj interakcji i czy działa w DM. */
const HANDLER_KINDS: Record<
  ComponentHandler['type'],
  { interaction: 'button' | 'select' | 'modal'; dm: boolean }
> = {
  button: { interaction: 'button', dm: false },
  select: { interaction: 'select', dm: false },
  modal: { interaction: 'modal', dm: false },
  dmButton: { interaction: 'button', dm: true },
  dmSelect: { interaction: 'select', dm: true },
  dmModal: { interaction: 'modal', dm: true },
};

/** Rozbija customId "ticket:close:42" -> { key: "ticket:close", args: ["42"] } */
export function parseCustomId(customId: string): { key: string; args: string[] } {
  const [module = '', action = '', ...args] = customId.split(':');
  return { key: `${module}:${action}`, args };
}

/**
 * Wspólne sprawdzenia: tylko nasz serwer, moduł włączony, tryb serwisowy, uprawnienia.
 * Zwraca kontekst albo null (wtedy odpowiedź została już wysłana).
 */
async function guard(
  interaction: Interaction,
  client: ZxClient,
  module: BotModule,
  access: AccessLevel | undefined,
  allowInMaintenance: boolean | undefined,
  allowDM = false,
): Promise<Context | null> {
  // Interakcje z DM (np. ocena ticketu) – tylko moduł i tryb serwisowy, bez uprawnień serwerowych.
  if (allowDM && !interaction.inGuild()) {
    const config = await getConfig(env.GUILD_ID);
    if (!isModuleEnabled(config, module.name) && module.toggleable !== false) return null;
    if (config.maintenance && !allowInMaintenance) {
      if (interaction.isRepliable()) {
        await interaction.reply(
          warning('Przerwa techniczna', config.maintenanceMessage ?? 'Trwają prace serwisowe.'),
        );
      }
      return null;
    }
    return { client, config };
  }

  if (!interaction.inCachedGuild() || interaction.guildId !== env.GUILD_ID) {
    if (interaction.isRepliable())
      await interaction.reply(failure('Niedostępne', 'Ten bot działa tylko na serwerze zxCode.'));
    return null;
  }

  const config = await getConfig(interaction.guildId);
  const member = interaction.member as GuildMember;
  const admin = isAdmin(member, config);

  if (!isModuleEnabled(config, module.name) && module.toggleable !== false) {
    if (interaction.isRepliable())
      await interaction.reply(warning('Moduł wyłączony', `Moduł **${module.name}** jest obecnie wyłączony.`));
    return null;
  }

  if (config.maintenance && !allowInMaintenance && !admin) {
    if (interaction.isRepliable()) {
      await interaction.reply(
        warning('Przerwa techniczna', config.maintenanceMessage ?? 'Trwają prace serwisowe. Wróć za chwilę!'),
      );
    }
    return null;
  }

  if (!hasAccess(member, config, access)) {
    if (interaction.isRepliable()) {
      await interaction.reply(
        failure(
          'Brak uprawnień',
          `Ta akcja jest dostępna tylko dla: **${accessLabel[access ?? 'everyone']}**.`,
        ),
      );
    }
    return null;
  }

  return { client, config };
}

export async function routeInteraction(client: ZxClient, interaction: Interaction): Promise<void> {
  // ── Autocomplete ──
  if (interaction.isAutocomplete()) {
    const entry = client.commands.get(interaction.commandName);
    if (!entry || entry.command.kind === 'user' || entry.command.kind === 'message') return;
    if (!entry.command.autocomplete || !interaction.inCachedGuild()) return;
    try {
      const config = await getConfig(interaction.guildId);
      await entry.command.autocomplete(interaction, { client, config });
    } catch (err) {
      log.error(`Autocomplete /${interaction.commandName}`, err);
    }
    return;
  }

  // ── Komendy (slash + context menu) ──
  if (interaction.isChatInputCommand() || interaction.isContextMenuCommand()) {
    const entry = client.commands.get(interaction.commandName);
    if (!entry) return;
    const { command, module } = entry;
    const where = `/${interaction.commandName}`;
    try {
      const ctx = await guard(interaction, client, module, command.access, command.allowInMaintenance);
      if (!ctx) return;

      if (command.cooldown) {
        const left = await checkCooldown(command.data.name, interaction.user.id, command.cooldown);
        if (left > 0) {
          await interaction.reply(
            warning('Zwolnij trochę', `Możesz użyć tej komendy ponownie za **${left}s**.`),
          );
          return;
        }
      }

      // Rodzaj interakcji i komendy są zgodne (nazwy komend są unikalne), więc rzutowanie jest bezpieczne.
      const kind = command.kind ?? 'slash';
      if (kind === 'slash' && interaction.isChatInputCommand())
        await (command as SlashCommand).run(interaction as never, ctx);
      else if (kind === 'user' && interaction.isUserContextMenuCommand())
        await command.run(interaction as never, ctx);
      else if (kind === 'message' && interaction.isMessageContextMenuCommand())
        await command.run(interaction as never, ctx);
    } catch (err) {
      await handleInteractionError(interaction, err, where);
    }
    return;
  }

  // ── Komponenty (przyciski, select menu, modale) ──
  if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) {
    const { key, args } = parseCustomId(interaction.customId);
    const entry = client.components.get(key);
    if (!entry) {
      log.debug(`Brak handlera dla customId "${interaction.customId}"`);
      return;
    }
    const { handler, module } = entry;
    const where = `komponent ${key}`;

    const kind = HANDLER_KINDS[handler.type];
    const typeMatches =
      (kind.interaction === 'button' && interaction.isButton()) ||
      (kind.interaction === 'select' && interaction.isAnySelectMenu()) ||
      (kind.interaction === 'modal' && interaction.isModalSubmit());
    if (!typeMatches) {
      log.warn(`Handler ${key} ma typ ${handler.type}, a przyszła inna interakcja`);
      return;
    }

    try {
      const dm = kind.dm;
      const access = 'access' in handler ? handler.access : undefined;
      const ctx = await guard(interaction, client, module, access, handler.allowInMaintenance, dm);
      if (!ctx) return;
      // Typ został sprawdzony wyżej (typeMatches).
      await handler.run(interaction as never, args, ctx);
    } catch (err) {
      await handleInteractionError(interaction, err, where);
    }
  }
}
