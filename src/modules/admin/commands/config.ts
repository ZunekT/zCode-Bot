import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { audit } from '../../../core/audit.js';
import { getConfig, updateConfig } from '../../../core/config-service.js';
import { UserError } from '../../../core/errors.js';
import { defineCommand } from '../../../core/types.js';
import { v2 } from '../../../ui/builders/payload.js';
import { success } from '../../../ui/components/notice.js';
import { DiscordLimits } from '../../../config/constants.js';
import { configPanel } from '../panel.js';
import { paymentDetailsModal } from '../modals.js';
import {
  CATEGORY_SETTINGS,
  CHANNEL_SETTINGS,
  ROLE_SETTINGS,
  choicesOf,
  type CategorySettingKey,
  type ChannelSettingKey,
  type RoleSettingKey,
} from '../settings.js';

const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Konfiguracja bota zxCode')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((s) => s.setName('pokaz').setDescription('Pokaż aktualną konfigurację'))
  .addSubcommand((s) =>
    s
      .setName('kanal')
      .setDescription('Ustaw kanał dla funkcji bota')
      .addStringOption((o) =>
        o
          .setName('typ')
          .setDescription('Do czego służy kanał')
          .setRequired(true)
          .addChoices(...choicesOf(CHANNEL_SETTINGS)),
      )
      .addChannelOption((o) =>
        o
          .setName('kanal')
          .setDescription('Kanał (puste = wyczyść)')
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('kategoria')
      .setDescription('Ustaw kategorię ticketów lub archiwum')
      .addStringOption((o) =>
        o
          .setName('typ')
          .setDescription('Którą kategorię ustawić')
          .setRequired(true)
          .addChoices(...choicesOf(CATEGORY_SETTINGS)),
      )
      .addChannelOption((o) =>
        o
          .setName('kategoria')
          .setDescription('Kategoria (puste = wyczyść)')
          .addChannelTypes(ChannelType.GuildCategory),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('rola')
      .setDescription('Ustaw rolę używaną przez bota')
      .addStringOption((o) =>
        o
          .setName('typ')
          .setDescription('Funkcja roli')
          .setRequired(true)
          .addChoices(...choicesOf(ROLE_SETTINGS)),
      )
      .addRoleOption((o) => o.setName('rola').setDescription('Rola (puste = wyczyść)')),
  )
  .addSubcommand((s) =>
    s
      .setName('tickety')
      .setDescription('Ustawienia czasowe ticketów')
      .addIntegerOption((o) =>
        o
          .setName('auto_zamkniecie')
          .setDescription('Po ilu godzinach bez odpowiedzi zamknąć ticket')
          .setMinValue(1)
          .setMaxValue(720),
      )
      .addIntegerOption((o) =>
        o
          .setName('sla')
          .setDescription('Po ilu godzinach oczekiwania klienta pingować obsługę')
          .setMinValue(1)
          .setMaxValue(168),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('modul')
      .setDescription('Włącz lub wyłącz moduł')
      .addStringOption((o) =>
        o.setName('nazwa').setDescription('Nazwa modułu').setRequired(true).setAutocomplete(true),
      )
      .addBooleanOption((o) =>
        o.setName('wlaczony').setDescription('Czy moduł ma działać').setRequired(true),
      ),
  )
  .addSubcommand((s) =>
    s.setName('platnosci').setDescription('Ustaw dane do przelewu pokazywane na proformie'),
  );

export const configCommand = defineCommand({
  data,
  access: 'admin',
  allowInMaintenance: true,

  async autocomplete(interaction, { client }) {
    const focused = interaction.options.getFocused().toLowerCase();
    const choices = [...client.modules.values()]
      .filter((m) => m.toggleable !== false && m.name.includes(focused))
      .slice(0, 25)
      .map((m) => ({ name: `${m.name} – ${m.description}`.slice(0, 100), value: m.name }));
    await interaction.respond(choices);
  },

  async run(interaction, { client, config }) {
    const sub = interaction.options.getSubcommand();
    const actorId = interaction.user.id;

    switch (sub) {
      case 'pokaz':
        return interaction.reply(v2(configPanel(client, config), { ephemeral: true }));

      case 'kanal': {
        const key = interaction.options.getString('typ', true) as ChannelSettingKey;
        const def = CHANNEL_SETTINGS[key];
        const channel = interaction.options.getChannel('kanal');
        if (channel) {
          const me = interaction.guild.members.me;
          const perms = me && 'permissionsFor' in channel ? channel.permissionsFor(me) : null;
          if (!perms?.has(['ViewChannel', 'SendMessages'])) {
            throw new UserError(`Bot nie ma uprawnień do wysyłania wiadomości na ${channel}.`);
          }
        }
        await updateConfig({ [def.field]: channel?.id ?? null });
        await audit(client, {
          action: 'config.channel',
          actorId,
          targetId: channel?.id,
          summary: `**${def.label}** → ${channel ? `<#${channel.id}>` : '`wyczyszczono`'}`,
        });
        return interaction.reply(
          success('Zapisano', `**${def.label}:** ${channel ? `<#${channel.id}>` : 'wyczyszczono'}`),
        );
      }

      case 'kategoria': {
        const key = interaction.options.getString('typ', true) as CategorySettingKey;
        const def = CATEGORY_SETTINGS[key];
        const category = interaction.options.getChannel('kategoria', false, [ChannelType.GuildCategory]);
        if (category) {
          const me = interaction.guild.members.me;
          if (!me || !category.permissionsFor(me).has(['ViewChannel', 'ManageChannels'])) {
            throw new UserError(
              `Bot potrzebuje uprawnień **Wyświetlanie kanałów** i **Zarządzanie kanałami** w kategorii **${category.name}**.`,
            );
          }
        }
        await updateConfig({ [def.field]: category?.id ?? null });
        await audit(client, {
          action: 'config.category',
          actorId,
          targetId: category?.id,
          summary: `**${def.label}** → ${category ? `**${category.name}**` : '`wyczyszczono`'}`,
        });
        const note =
          key === 'tickety' && category
            ? `\n-# Limit Discorda: ${DiscordLimits.channelsPerCategory} kanałów w kategorii – zamknięte tickety trafią do archiwum.`
            : '';
        return interaction.reply(
          success('Zapisano', `**${def.label}:** ${category ? category.name : 'wyczyszczono'}${note}`),
        );
      }

      case 'rola': {
        const key = interaction.options.getString('typ', true) as RoleSettingKey;
        const def = ROLE_SETTINGS[key];
        const role = interaction.options.getRole('rola');
        if (role) {
          const me = interaction.guild.members.me;
          const managedByBot = ['klient', 'staly_klient', 'zweryfikowany'].includes(key);
          if (managedByBot && me && role.position >= me.roles.highest.position) {
            throw new UserError(
              `Rola ${role} jest wyżej niż rola bota – bot nie będzie mógł jej nadawać. Przesuń rolę bota wyżej.`,
            );
          }
          if (role.managed) throw new UserError('Nie można użyć roli zarządzanej przez integrację.');
        }
        await updateConfig({ [def.field]: role?.id ?? null });
        await audit(client, {
          action: 'config.role',
          actorId,
          targetId: role?.id,
          summary: `**${def.label}** → ${role ? `<@&${role.id}>` : '`wyczyszczono`'}`,
        });
        return interaction.reply(
          success('Zapisano', `**${def.label}:** ${role ? `<@&${role.id}>` : 'wyczyszczono'}`),
        );
      }

      case 'tickety': {
        const autoClose = interaction.options.getInteger('auto_zamkniecie');
        const sla = interaction.options.getInteger('sla');
        if (autoClose === null && sla === null) throw new UserError('Podaj przynajmniej jedną wartość.');
        const updated = await updateConfig({
          ...(autoClose !== null && { ticketAutoCloseHours: autoClose }),
          ...(sla !== null && { ticketSlaHours: sla }),
        });
        await audit(client, {
          action: 'config.tickets',
          actorId,
          summary: `Auto-zamknięcie: **${updated.ticketAutoCloseHours} h**, SLA: **${updated.ticketSlaHours} h**`,
        });
        return interaction.reply(
          success(
            'Zapisano',
            `Auto-zamknięcie po **${updated.ticketAutoCloseHours} h**, alert SLA po **${updated.ticketSlaHours} h**.`,
          ),
        );
      }

      case 'modul': {
        const name = interaction.options.getString('nazwa', true);
        const enabled = interaction.options.getBoolean('wlaczony', true);
        const module = client.modules.get(name);
        if (!module || module.toggleable === false)
          throw new UserError(`Nie ma modułu \`${name}\`, który można przełączyć.`);
        const current = await getConfig();
        const modules = { ...((current.modules ?? {}) as Record<string, boolean>), [name]: enabled };
        await updateConfig({ modules });
        await audit(client, {
          action: 'config.module',
          actorId,
          summary: `Moduł \`${name}\` → ${enabled ? '🟢 włączony' : '🔴 wyłączony'}`,
        });
        return interaction.reply(
          success('Zapisano', `Moduł \`${name}\` jest teraz ${enabled ? '**włączony**' : '**wyłączony**'}.`),
        );
      }

      case 'platnosci':
        return interaction.showModal(paymentDetailsModal(config.paymentDetails));
    }
  },
});
