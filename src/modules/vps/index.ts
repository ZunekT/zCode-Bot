import { SlashCommandBuilder, type ButtonInteraction, type ChatInputCommandInteraction } from 'discord.js';
import { audit } from '../../core/audit.js';
import { UserError } from '../../core/errors.js';
import { defineCommand, defineComponent, defineJob, defineModule } from '../../core/types.js';
import { button } from '../../ui/builders/buttons.js';
import { v2, v2Message } from '../../ui/builders/payload.js';
import { card } from '../../ui/components/card.js';
import { MathostError, mathost, mathostEnabled, vpsId } from './mathost.js';
import { checkVps, isOwner, snapshot, vpsCard } from './service.js';

/** Karta stanu z przyciskami (restart i kopia tylko dla właściciela – sprawdzane przy kliknięciu). */
async function statusPayload() {
  const s = await snapshot();
  return vpsCard(s).buttons(
    button('vps:refresh', 'Odśwież', { emoji: 'tools' }),
    button('vps:backup', 'Kopia zapasowa', { emoji: 'database' }),
    button('vps:reboot', 'Restart VPS', { style: 'danger', emoji: 'lightning' }),
  );
}

function asUserError(err: unknown): never {
  if (err instanceof MathostError) throw new UserError(err.message);
  throw err;
}

async function requireOwner(interaction: ChatInputCommandInteraction | ButtonInteraction) {
  if (!(await isOwner(interaction.client as never, interaction.user.id))) {
    throw new UserError('Restart i kopie zapasowe VPS może wykonać tylko właściciel zxCode.');
  }
}

const confirmCard = (kind: 'reboot' | 'backup') =>
  kind === 'reboot'
    ? card({
        tone: 'warning',
        emoji: 'lightning',
        title: 'Zrestartować VPS?',
        description:
          'Bot zxCode, strona zxcode.pl i baza danych będą niedostępne przez **1–2 minuty**. Wszystko uruchomi się samo po starcie systemu.',
        timestamp: false,
      }).buttons(
        button('vps:rebootYes', 'Tak, zrestartuj', { style: 'danger', emoji: 'lightning' }),
        button('vps:cancel', 'Anuluj'),
      )
    : card({
        tone: 'info',
        emoji: 'database',
        title: 'Zrobić kopię zapasową VPS?',
        description:
          'Mathost wykona kopię całego dysku. Serwer działa w tym czasie normalnie; kopia pojawi się na liście po kilku minutach.',
        timestamp: false,
      }).buttons(
        button('vps:backupYes', 'Zrób kopię', { style: 'success', emoji: 'database' }),
        button('vps:cancel', 'Anuluj'),
      );

const vpsCommand = defineCommand({
  data: new SlashCommandBuilder()
    .setName('vps')
    .setDescription('[Admin] Serwer VPS, na którym działa bot (Mathost)')
    .addSubcommand((s) => s.setName('status').setDescription('Stan VPS: CPU, RAM, dysk, ważność, kopie'))
    .addSubcommand((s) => s.setName('restart').setDescription('Restart VPS (bot wróci za 1–2 min)'))
    .addSubcommand((s) => s.setName('kopia').setDescription('Kopia zapasowa całego VPS')),
  access: 'admin',
  allowInMaintenance: true,
  async run(interaction) {
    if (!mathostEnabled()) {
      throw new UserError(
        'Zarządzanie VPS jest wyłączone – dodaj MATHOST_API_KEY do .env (bash docker/setup-panel.sh).',
      );
    }
    const sub = interaction.options.getSubcommand();
    if (sub === 'status') {
      await interaction.deferReply({ flags: ['Ephemeral'] });
      const panel = await statusPayload().catch(asUserError);
      return interaction.editReply(v2Message(panel));
    }
    await requireOwner(interaction);
    return interaction.reply(v2(confirmCard(sub === 'restart' ? 'reboot' : 'backup'), { ephemeral: true }));
  },
});

export const vpsModule = defineModule({
  name: 'vps',
  description: 'Zarządzanie VPS w Mathost: stan, restart, kopie zapasowe, alerty',
  toggleable: false,
  commands: [vpsCommand],
  components: [
    defineComponent({
      id: 'vps:refresh',
      type: 'button',
      access: 'admin',
      allowInMaintenance: true,
      async run(interaction) {
        await interaction.deferUpdate();
        const panel = await statusPayload().catch(asUserError);
        return interaction.editReply(v2Message(panel));
      },
    }),
    defineComponent({
      id: 'vps:reboot',
      type: 'button',
      access: 'admin',
      allowInMaintenance: true,
      async run(interaction) {
        await requireOwner(interaction);
        return interaction.reply(v2(confirmCard('reboot'), { ephemeral: true }));
      },
    }),
    defineComponent({
      id: 'vps:backup',
      type: 'button',
      access: 'admin',
      allowInMaintenance: true,
      async run(interaction) {
        await requireOwner(interaction);
        return interaction.reply(v2(confirmCard('backup'), { ephemeral: true }));
      },
    }),
    defineComponent({
      id: 'vps:cancel',
      type: 'button',
      access: 'admin',
      allowInMaintenance: true,
      async run(interaction) {
        return interaction.update(v2Message(card({ tone: 'info', title: 'Anulowano', timestamp: false })));
      },
    }),
    defineComponent({
      id: 'vps:rebootYes',
      type: 'button',
      access: 'admin',
      allowInMaintenance: true,
      async run(interaction, _args, { client }) {
        await requireOwner(interaction);
        // Najpierw odpowiedź i audyt – po restarcie bot przez chwilę nie będzie działał.
        await interaction.update(
          v2Message(
            card({
              tone: 'warning',
              emoji: 'lightning',
              title: 'Restartuję VPS…',
              description: 'Bot wróci za 1–2 minuty.',
            }),
          ),
        );
        await audit(client, {
          action: 'vps.reboot',
          actorId: interaction.user.id,
          summary: 'Restart VPS (Mathost)',
        });
        await mathost.reboot(await vpsId()).catch(async (err) => {
          await interaction.editReply(
            v2Message(
              card({ tone: 'error', title: 'Restart nie powiódł się', description: (err as Error).message }),
            ),
          );
        });
      },
    }),
    defineComponent({
      id: 'vps:backupYes',
      type: 'button',
      access: 'admin',
      allowInMaintenance: true,
      async run(interaction, _args, { client }) {
        await requireOwner(interaction);
        await interaction.deferUpdate();
        await mathost.createBackup(await vpsId()).catch(asUserError);
        await audit(client, {
          action: 'vps.backup',
          actorId: interaction.user.id,
          summary: 'Kopia zapasowa VPS (Mathost)',
        });
        return interaction.editReply(
          v2Message(
            card({
              tone: 'success',
              emoji: 'database',
              title: 'Kopia zapasowa zlecona',
              description: 'Pojawi się w `/vps status` po kilku minutach.',
            }),
          ),
        );
      },
    }),
  ],
  jobs: [
    defineJob({
      name: 'vps-check',
      intervalMs: 5 * 60_000,
      async run(client) {
        if (mathostEnabled()) await checkVps(client);
      },
    }),
  ],
});
