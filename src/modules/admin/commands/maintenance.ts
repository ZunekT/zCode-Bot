import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { audit } from '../../../core/audit.js';
import { updateConfig } from '../../../core/config-service.js';
import { defineCommand } from '../../../core/types.js';
import { success, warning } from '../../../ui/components/notice.js';

export const maintenanceCommand = defineCommand({
  data: new SlashCommandBuilder()
    .setName('serwis')
    .setDescription('Tryb serwisowy – blokuje bota dla wszystkich poza administracją')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName('wlacz')
        .setDescription('Włącz tryb serwisowy')
        .addStringOption((o) =>
          o.setName('komunikat').setDescription('Co zobaczą użytkownicy').setMaxLength(300),
        ),
    )
    .addSubcommand((s) => s.setName('wylacz').setDescription('Wyłącz tryb serwisowy')),
  access: 'admin',
  allowInMaintenance: true,

  async run(interaction, { client }) {
    const enable = interaction.options.getSubcommand() === 'wlacz';
    const message = interaction.options.getString('komunikat');

    await updateConfig({ maintenance: enable, maintenanceMessage: enable ? message : null });
    await audit(client, {
      action: enable ? 'maintenance.on' : 'maintenance.off',
      actorId: interaction.user.id,
      summary: enable
        ? `Tryb serwisowy **włączony**${message ? `: ${message}` : ''}`
        : 'Tryb serwisowy **wyłączony**',
    });

    return interaction.reply(
      enable
        ? warning('Tryb serwisowy włączony', message ?? 'Użytkownicy zobaczą domyślny komunikat o przerwie.')
        : success('Tryb serwisowy wyłączony', 'Bot znowu działa dla wszystkich.'),
    );
  },
});
