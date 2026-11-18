import { audit } from '../../core/audit.js';
import { getConfig, updateConfig } from '../../core/config-service.js';
import { defineComponent, defineModule } from '../../core/types.js';
import { v2Message } from '../../ui/builders/payload.js';
import { success } from '../../ui/components/notice.js';
import { configCommand } from './commands/config.js';
import { maintenanceCommand } from './commands/maintenance.js';
import { paymentDetailsModal } from './modals.js';
import { configPanel } from './panel.js';

export const adminModule = defineModule({
  name: 'admin',
  description: 'Konfiguracja bota i tryb serwisowy',
  toggleable: false,
  commands: [configCommand, maintenanceCommand],
  components: [
    defineComponent({
      id: 'config:refresh',
      type: 'button',
      access: 'admin',
      allowInMaintenance: true,
      async run(interaction, _args, { client }) {
        const config = await getConfig();
        return interaction.update(v2Message(configPanel(client, config)));
      },
    }),
    defineComponent({
      id: 'config:payments',
      type: 'button',
      access: 'admin',
      allowInMaintenance: true,
      async run(interaction, _args, { config }) {
        return interaction.showModal(paymentDetailsModal(config.paymentDetails));
      },
    }),
    defineComponent({
      id: 'config:paymentsSubmit',
      type: 'modal',
      access: 'admin',
      allowInMaintenance: true,
      async run(interaction, _args, { client }) {
        const details = interaction.fields.getTextInputValue('details').trim();
        await updateConfig({ paymentDetails: details || null });
        await audit(client, {
          action: 'config.payments',
          actorId: interaction.user.id,
          summary: 'Zaktualizowano dane do przelewu',
        });
        return interaction.reply(success('Zapisano dane do przelewu', `\`\`\`\n${details}\n\`\`\``));
      },
    }),
  ],
});
