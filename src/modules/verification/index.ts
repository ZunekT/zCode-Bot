import {
  ChannelType,
  GuildMember,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ModalSubmitInteraction,
} from 'discord.js';
import type { ZxClient } from '../../client.js';
import { prisma } from '../../db/prisma.js';
import { audit } from '../../core/audit.js';
import { getConfig, updateConfig } from '../../core/config-service.js';
import { UserError } from '../../core/errors.js';
import { isAdmin, isStaff } from '../../core/permissions.js';
import { defineCommand, defineComponent, defineEvent, defineModule } from '../../core/types.js';
import { bannerFile } from '../../ui/assets.js';
import { Form } from '../../ui/builders/modal.js';
import { v2, v2Message } from '../../ui/builders/payload.js';
import { card, codeBlock } from '../../ui/components/card.js';
import { e } from '../../ui/emojis.js';
import { createLogger } from '../../utils/logger.js';
import { MODE_LABELS, captchaPayloadParts, verificationPanel, verifiedCard } from './panels.js';
import {
  assertCanVerify,
  checkCaptcha,
  grantAccess,
  isVerified,
  issueCaptcha,
  trackJoin,
} from './service.js';

const log = createLogger('verification');
const DAY = 86_400_000;

function settingsCard(config: Awaited<ReturnType<typeof getConfig>>, title = 'Ustawienia weryfikacji') {
  return card({
    tone: config.verificationLockdown ? 'error' : 'brand',
    emoji: 'shield_check',
    title,
    description: config.verificationLockdown
      ? `${e('shield_x')} **Weryfikacja jest WSTRZYMANA** (blokada antyrajdowa)`
      : undefined,
    fields: [
      {
        emoji: 'lock',
        label: 'Tryb',
        value: MODE_LABELS[config.verificationMode] ?? config.verificationMode,
      },
      {
        emoji: 'verified',
        label: 'Rola po weryfikacji',
        value: config.verifiedRoleId ? `<@&${config.verifiedRoleId}>` : '`nie ustawiono`',
      },
      {
        emoji: 'user',
        label: 'Rola przed weryfikacją',
        value: config.unverifiedRoleId ? `<@&${config.unverifiedRoleId}>` : '`brak`',
      },
      {
        emoji: 'calendar',
        label: 'Min. wiek konta',
        value: config.verificationMinAccountAgeDays
          ? `${config.verificationMinAccountAgeDays} dni`
          : 'bez limitu',
      },
      {
        emoji: 'shield_x',
        label: 'Ochrona przed rajdem',
        value: config.antiRaidEnabled
          ? `włączona · ${config.antiRaidJoins} wejść / ${config.antiRaidSeconds} s`
          : 'wyłączona',
      },
    ],
    timestamp: false,
  });
}

const verifyCommand = defineCommand({
  data: new SlashCommandBuilder()
    .setName('weryfikacja')
    .setDescription('Weryfikacja nowych członków')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand((s) =>
      s
        .setName('panel')
        .setDescription('[Admin] Wyślij panel weryfikacji')
        .addChannelOption((o) =>
          o
            .setName('kanal')
            .setDescription('Gdzie wysłać (domyślnie tutaj)')
            .addChannelTypes(ChannelType.GuildText),
        )
        .addChannelOption((o) =>
          o
            .setName('regulamin')
            .setDescription('Kanał z pełnym regulaminem')
            .addChannelTypes(ChannelType.GuildText),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('ustawienia')
        .setDescription('[Admin] Tryb, wiek konta, ochrona przed rajdem')
        .addStringOption((o) =>
          o
            .setName('tryb')
            .setDescription('Sposób weryfikacji')
            .addChoices(
              { name: 'Captcha (kod z obrazka)', value: 'captcha' },
              { name: 'Jedno kliknięcie', value: 'button' },
            ),
        )
        .addIntegerOption((o) =>
          o
            .setName('min_wiek_konta')
            .setDescription('Minimalny wiek konta w dniach (0 = bez limitu)')
            .setMinValue(0)
            .setMaxValue(365),
        )
        .addBooleanOption((o) => o.setName('antyrajd').setDescription('Automatyczna blokada przy fali wejść'))
        .addIntegerOption((o) =>
          o
            .setName('antyrajd_limit')
            .setDescription('Ile wejść uruchamia blokadę')
            .setMinValue(3)
            .setMaxValue(100),
        )
        .addIntegerOption((o) =>
          o.setName('antyrajd_sekundy').setDescription('W ciągu ilu sekund').setMinValue(5).setMaxValue(600),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('blokada')
        .setDescription('[Admin] Wstrzymaj lub wznów weryfikację')
        .addBooleanOption((o) =>
          o.setName('wlaczona').setDescription('Czy weryfikacja ma być wstrzymana').setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('zweryfikuj')
        .setDescription('[Obsługa] Zweryfikuj kogoś ręcznie')
        .addUserOption((o) => o.setName('uzytkownik').setDescription('Kogo').setRequired(true)),
    )
    .addSubcommand((s) => s.setName('statystyki').setDescription('[Obsługa] Statystyki weryfikacji')),
  allowInMaintenance: true,

  async run(interaction, { client, config }) {
    const sub = interaction.options.getSubcommand();
    const member = interaction.member;
    const adminOnly = ['panel', 'ustawienia', 'blokada'].includes(sub);
    if (adminOnly ? !isAdmin(member, config) : !isStaff(member, config)) {
      throw new UserError(
        `Ta komenda jest dostępna tylko dla ${adminOnly ? 'administracji' : 'obsługi'}.`,
        'Brak uprawnień',
      );
    }

    switch (sub) {
      case 'panel': {
        if (!config.verifiedRoleId)
          throw new UserError('Najpierw ustaw rolę: `/config rola typ:Zweryfikowany`.');
        const target =
          interaction.options.getChannel('kanal', false, [ChannelType.GuildText]) ?? interaction.channel;
        if (!target?.isSendable()) throw new UserError('Nie mogę pisać na tym kanale.');
        const rules = interaction.options.getChannel('regulamin');
        const msg = await target.send(
          v2Message(verificationPanel(config, rules?.id), { files: [bannerFile()] }),
        );
        await audit(client, {
          action: 'verification.panel',
          actorId: member.id,
          targetId: msg.channelId,
          summary: `Panel weryfikacji wysłany na <#${msg.channelId}>`,
        });
        return interaction.reply(
          v2(
            card({
              tone: 'success',
              title: 'Panel weryfikacji wysłany',
              description: `<#${msg.channelId}>`,
              timestamp: false,
            }),
            { ephemeral: true },
          ),
        );
      }

      case 'ustawienia': {
        const mode = interaction.options.getString('tryb');
        const minAge = interaction.options.getInteger('min_wiek_konta');
        const antiRaid = interaction.options.getBoolean('antyrajd');
        const limit = interaction.options.getInteger('antyrajd_limit');
        const seconds = interaction.options.getInteger('antyrajd_sekundy');
        const changed = [mode, minAge, antiRaid, limit, seconds].some((v) => v !== null);
        const updated = changed
          ? await updateConfig({
              ...(mode !== null && { verificationMode: mode }),
              ...(minAge !== null && { verificationMinAccountAgeDays: minAge }),
              ...(antiRaid !== null && { antiRaidEnabled: antiRaid }),
              ...(limit !== null && { antiRaidJoins: limit }),
              ...(seconds !== null && { antiRaidSeconds: seconds }),
            })
          : config;
        if (changed)
          await audit(client, {
            action: 'verification.settings',
            actorId: member.id,
            summary: 'Zmieniono ustawienia weryfikacji',
          });
        return interaction.reply(
          v2(settingsCard(updated, changed ? 'Zapisano ustawienia weryfikacji' : undefined), {
            ephemeral: true,
          }),
        );
      }

      case 'blokada': {
        const on = interaction.options.getBoolean('wlaczona', true);
        const updated = await updateConfig({ verificationLockdown: on });
        await audit(client, {
          action: on ? 'verification.lock' : 'verification.unlock',
          actorId: member.id,
          summary: on ? 'Weryfikacja **wstrzymana**' : 'Weryfikacja **wznowiona**',
        });
        return interaction.reply(
          v2(settingsCard(updated, on ? 'Weryfikacja wstrzymana' : 'Weryfikacja wznowiona'), {
            ephemeral: true,
          }),
        );
      }

      case 'zweryfikuj': {
        const target = interaction.options.getMember('uzytkownik');
        if (!(target instanceof GuildMember)) throw new UserError('Tej osoby nie ma na serwerze.');
        if (isVerified(target, config)) throw new UserError(`<@${target.id}> jest już zweryfikowany(a).`);
        await grantAccess(client, target, config, { manualBy: member.id });
        return interaction.reply(
          v2(
            card({
              tone: 'success',
              emoji: 'verified',
              title: 'Zweryfikowano ręcznie',
              description: `<@${target.id}> ma teraz dostęp do serwera.`,
              timestamp: false,
            }),
            {
              ephemeral: true,
            },
          ),
        );
      }

      case 'statystyki': {
        const since = (days: number) => new Date(Date.now() - days * DAY);
        const count = async (days: number) => {
          const rows = await prisma.verificationEvent.groupBy({
            by: ['result'],
            where: { createdAt: { gte: since(days) } },
            _count: true,
          });
          const get = (r: string) => rows.find((x) => x.result === r)?._count ?? 0;
          return [get('PASSED') + get('MANUAL'), get('FAILED'), get('BLOCKED_AGE'), get('BLOCKED_LOCKDOWN')];
        };
        const head = ['', 'OK', 'Błąd', 'Wiek', 'Blok.'];
        const rows = [
          ['Dziś', ...(await count(1))],
          ['7 dni', ...(await count(7))],
          ['30 dni', ...(await count(30))],
        ].map((r) => r.map(String));
        const table = [head, ...rows]
          .map((r) => r.map((c, i) => (i === 0 ? c.padEnd(8) : c.padStart(6))).join(''))
          .join('\n');
        const panel = settingsCard(config, 'Weryfikacja • statystyki')
          .separator()
          .text(codeBlock(table))
          .footer(
            'OK – zweryfikowani · Błąd – nieudane captche · Wiek – zbyt nowe konta · Blok. – blokada antyrajdowa',
          );
        return interaction.reply(v2(panel, { ephemeral: true }));
      }
    }
  },
});

async function finish(interaction: ModalSubmitInteraction<'cached'>, client: ZxClient) {
  const config = await getConfig();
  await grantAccess(client, interaction.member, config);
  const payload = { ...v2Message(verifiedCard(interaction.guild.name)), attachments: [] };
  if (interaction.isFromMessage()) await interaction.update(payload);
  else await interaction.reply(v2(verifiedCard(interaction.guild.name), { ephemeral: true }));
}

export const verificationModule = defineModule({
  name: 'verification',
  description: 'Weryfikacja nowych członków (captcha, wiek konta, ochrona przed rajdem)',
  commands: [verifyCommand],
  components: [
    defineComponent({
      id: 'verify:start',
      type: 'button',
      async run(interaction, _args, { client, config }) {
        await assertCanVerify(client, interaction.member, config);
        if (config.verificationMode === 'button') {
          await grantAccess(client, interaction.member, config);
          return interaction.reply(v2(verifiedCard(interaction.guild.name), { ephemeral: true }));
        }
        const { panel, files } = captchaPayloadParts(await issueCaptcha(interaction.user.id));
        return interaction.reply(v2(panel, { ephemeral: true, files }));
      },
    }),
    defineComponent({
      id: 'verify:refresh',
      type: 'button',
      async run(interaction, _args, { client, config }) {
        await assertCanVerify(client, interaction.member, config);
        const { panel, files } = captchaPayloadParts(await issueCaptcha(interaction.user.id));
        return interaction.update({ ...v2Message(panel, { files }), attachments: [] });
      },
    }),
    defineComponent({
      id: 'verify:enter',
      type: 'button',
      async run(interaction) {
        return interaction.showModal(
          new Form('verify:submit', 'Weryfikacja')
            .info('Wpisz kod widoczny na obrazku. Wielkość liter nie ma znaczenia.')
            .text({ id: 'code', label: 'Kod z obrazka', min: 4, max: 10, placeholder: 'np. AC3K7' })
            .build(),
        );
      },
    }),
    defineComponent({
      id: 'verify:submit',
      type: 'modal',
      async run(interaction, _args, { client, config }) {
        await assertCanVerify(client, interaction.member, config);
        const result = await checkCaptcha(interaction.user.id, interaction.fields.getTextInputValue('code'));
        if (result.ok) return finish(interaction, client);

        if (result.reason === 'blocked') {
          const blocked = card({
            tone: 'error',
            emoji: 'shield_x',
            title: 'Za dużo błędnych prób',
            description:
              'Spróbuj ponownie za **10 minut**. Jeśli masz problem z odczytaniem kodu, napisz do administracji.',
            timestamp: false,
          });
          if (interaction.isFromMessage())
            return interaction.update({ ...v2Message(blocked), attachments: [] });
          return interaction.reply(v2(blocked, { ephemeral: true }));
        }

        // Błędny lub wygasły kod – zawsze nowy obrazek (utrudnia zgadywanie).
        const warning =
          result.reason === 'expired'
            ? `${e('calendar')} Kod wygasł – oto nowy.`
            : `${e('shield_x')} **Zły kod.** Zostało prób: **${result.left}**. Oto nowy obrazek.`;
        const { panel, files } = captchaPayloadParts(await issueCaptcha(interaction.user.id), { warning });
        if (interaction.isFromMessage())
          return interaction.update({ ...v2Message(panel, { files }), attachments: [] });
        return interaction.reply(v2(panel, { ephemeral: true, files }));
      },
    }),
    defineComponent({
      id: 'verify:unlock',
      type: 'button',
      access: 'admin',
      allowInMaintenance: true,
      async run(interaction, _args, { client }) {
        await updateConfig({ verificationLockdown: false });
        await audit(client, {
          action: 'verification.unlock',
          actorId: interaction.user.id,
          summary: 'Weryfikacja **wznowiona** po alercie rajdu',
        });
        return interaction.update(
          v2Message(
            card({
              tone: 'success',
              emoji: 'unlock',
              title: 'Weryfikacja odblokowana',
              description: `Odblokował(a): <@${interaction.user.id}>`,
              thumbnail: interaction.member.displayAvatarURL({ size: 128 }),
            }),
          ),
        );
      },
    }),
  ],
  events: [
    defineEvent({
      event: 'guildMemberAdd',
      async run(client, member) {
        if (member.user.bot) return;
        const config = await getConfig();
        if (config.unverifiedRoleId) {
          await member.roles
            .add(config.unverifiedRoleId, 'Nowy członek – przed weryfikacją')
            .catch((err) => log.warn('Nie udało się nadać roli niezweryfikowanego', err));
        }
        await trackJoin(client, config);
      },
    }),
  ],
});
