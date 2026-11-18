import { ChannelType, SlashCommandBuilder, type AutocompleteInteraction } from 'discord.js';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { audit } from '../../core/audit.js';
import { updateConfig } from '../../core/config-service.js';
import { UserError } from '../../core/errors.js';
import { isAdmin, isStaff } from '../../core/permissions.js';
import { defineCommand, defineJob, defineModule } from '../../core/types.js';
import { v2, v2Message } from '../../ui/builders/payload.js';
import { card, codeBlock } from '../../ui/components/card.js';
import { discordTime, truncate } from '../../utils/format.js';
import {
  MODES,
  checkBot,
  heartbeatUrl,
  newHeartbeatToken,
  refreshBoard,
  runChecks,
  statusBoard,
  uptime,
  type Mode,
} from './service.js';

async function botAutocomplete(interaction: AutocompleteInteraction) {
  const q = interaction.options.getFocused();
  const bots = await prisma.monitoredBot.findMany({
    where: { name: { contains: q, mode: 'insensitive' } },
    orderBy: { name: 'asc' },
    take: 25,
  });
  await interaction.respond(
    bots.map((b) => ({ name: `${b.name} (${b.online ? 'online' : 'offline'})`, value: b.name })),
  );
}

async function findBot(name: string) {
  const bot = await prisma.monitoredBot.findUnique({ where: { name } });
  if (!bot) throw new UserError(`Nie ma bota „${name}” w monitoringu.`);
  return bot;
}

const heartbeatHelp = (token: string) =>
  (env.PUBLIC_URL ? '' : '-# Ustaw `PUBLIC_URL` w .env, żeby link miał prawdziwy adres serwera.\n') +
  '**1.** W bocie klienta: `npm install zxcode-heartbeat`\n' +
  '**2.** Do `.env` bota klienta:\n' +
  codeBlock(`ZXCODE_HEARTBEAT_URL=${heartbeatUrl(token)}`, 'ini') +
  '\n**3.** Po utworzeniu klienta discord.js:\n' +
  codeBlock("const heartbeat = require('zxcode-heartbeat');\nheartbeat(client);", 'js') +
  '\n-# Bot zacznie się zgłaszać po zalogowaniu. Brak zgłoszenia przez 3 min = alert.';

const monitoringCommand = defineCommand({
  data: new SlashCommandBuilder()
    .setName('monitoring')
    .setDescription('[Obsługa] Monitoring botów klientów')
    .addSubcommand((s) =>
      s
        .setName('dodaj')
        .setDescription('Dodaj bota do monitoringu')
        .addStringOption((o) =>
          o.setName('nazwa').setDescription('Nazwa na tablicy statusu').setRequired(true).setMaxLength(40),
        )
        .addStringOption((o) =>
          o
            .setName('tryb')
            .setDescription('Jak sprawdzać')
            .setRequired(true)
            .addChoices(
              ...(Object.keys(MODES) as Mode[]).map((m) => ({
                name: MODES[m].label,
                value: m,
              })),
            ),
        )
        .addStringOption((o) =>
          o.setName('adres').setDescription('Tryb HTTP: adres health-check (200 = działa)'),
        )
        .addUserOption((o) => o.setName('bot').setDescription('Tryb presence: konto bota'))
        .addUserOption((o) =>
          o.setName('wlasciciel').setDescription('Klient – dostanie DM o awarii i powrocie'),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('usun')
        .setDescription('Usuń bota z monitoringu')
        .addStringOption((o) =>
          o.setName('bot').setDescription('Bot').setRequired(true).setAutocomplete(true),
        ),
    )
    .addSubcommand((s) => s.setName('lista').setDescription('Szczegóły wszystkich botów'))
    .addSubcommand((s) =>
      s
        .setName('sprawdz')
        .setDescription('Sprawdź bota teraz')
        .addStringOption((o) =>
          o.setName('bot').setDescription('Bot').setRequired(true).setAutocomplete(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('heartbeat')
        .setDescription('Pokaż adres i kod heartbeat bota')
        .addStringOption((o) =>
          o.setName('bot').setDescription('Bot').setRequired(true).setAutocomplete(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('panel')
        .setDescription('[Admin] Wyślij tablicę statusu (aktualizuje się sama)')
        .addChannelOption((o) =>
          o
            .setName('kanal')
            .setDescription('Gdzie (domyślnie tutaj)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
        ),
    ),
  access: 'staff',
  autocomplete: botAutocomplete,

  async run(interaction, { client, config }) {
    const sub = interaction.options.getSubcommand();
    const reply = (p: Parameters<typeof v2>[0]) => interaction.reply(v2(p, { ephemeral: true }));

    if (sub === 'dodaj') {
      const name = interaction.options.getString('nazwa', true).trim();
      const mode = interaction.options.getString('tryb', true) as Mode;
      const url = interaction.options.getString('adres')?.trim() ?? null;
      const botUser = interaction.options.getUser('bot');
      if (mode === 'http' && (!url || !/^https?:\/\/\S+$/i.test(url)))
        throw new UserError('Tryb HTTP wymaga adresu `http(s)://…`.');
      if (mode === 'presence') {
        if (!botUser?.bot) throw new UserError('Tryb presence wymaga wskazania konta bota (opcja `bot`).');
        if (!env.ENABLE_PRESENCE_INTENT)
          throw new UserError(
            'Włącz **Presence Intent** w Developer Portal i ustaw `ENABLE_PRESENCE_INTENT=true` w .env.',
          );
      }
      if (await prisma.monitoredBot.findUnique({ where: { name } }))
        throw new UserError(`Bot „${name}” już jest w monitoringu.`);
      const bot = await prisma.monitoredBot.create({
        data: {
          name,
          mode,
          healthUrl: mode === 'http' ? url : null,
          botUserId: mode === 'presence' ? botUser!.id : null,
          heartbeatToken: mode === 'heartbeat' ? newHeartbeatToken() : null,
          ownerId: interaction.options.getUser('wlasciciel')?.id ?? null,
        },
      });
      await audit(client, {
        action: 'monitoring.add',
        actorId: interaction.user.id,
        summary: `Dodano do monitoringu **${name}** (${MODES[mode].label})`,
      });
      void refreshBoard(client);
      return reply(
        card({
          tone: 'success',
          emoji: 'server',
          title: `Monitoring: ${name}`,
          description:
            mode === 'heartbeat'
              ? heartbeatHelp(bot.heartbeatToken!)
              : 'Pierwsze sprawdzenie w ciągu minuty.',
          fields: [
            { emoji: 'tools', label: 'Tryb', value: MODES[mode].label },
            { emoji: 'user', label: 'Klient', value: bot.ownerId ? `<@${bot.ownerId}>` : null },
          ],
          timestamp: false,
        }),
      );
    }

    if (sub === 'lista') {
      const bots = await prisma.monitoredBot.findMany({ orderBy: { name: 'asc' } });
      return reply(
        card({
          tone: 'brand',
          emoji: 'server',
          title: `Monitorowane boty (${bots.length})`,
          description:
            bots
              .map(
                (b) =>
                  `**${b.name}** \`${b.online ? 'online' : 'offline'}\` \`${MODES[b.mode as Mode]?.label.split(' ')[0] ?? b.mode}\` · uptime ${uptime(b)}${b.ownerId ? ` · <@${b.ownerId}>` : ''}\n-# ${[
                    b.healthUrl ? truncate(b.healthUrl, 60) : null,
                    b.lastCheckAt
                      ? `sprawdzono ${discordTime(b.lastCheckAt, 'R')}`
                      : 'jeszcze nie sprawdzono',
                    b.lastError ? `błąd: ${truncate(b.lastError, 60)}` : null,
                  ]
                    .filter(Boolean)
                    .join(' • ')}`,
              )
              .join('\n') || 'Brak botów. Dodaj: `/monitoring dodaj`.',
          timestamp: false,
        }),
      );
    }

    if (sub === 'panel') {
      if (!isAdmin(interaction.member, config))
        throw new UserError('Tablicę statusu wysyła administracja.', 'Brak uprawnień');
      const target =
        interaction.options.getChannel('kanal', false, [
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement,
        ]) ?? interaction.channel;
      if (!target?.isSendable()) throw new UserError('Nie mogę pisać na tym kanale.');
      const bots = await prisma.monitoredBot.findMany({ orderBy: { name: 'asc' } });
      const msg = await target.send(v2Message(statusBoard(bots)));
      await updateConfig({ statusBoardChannelId: msg.channelId, statusBoardMessageId: msg.id });
      return reply(
        card({
          tone: 'success',
          title: 'Tablica statusu wysłana',
          description: 'Aktualizuje się automatycznie przy każdej zmianie.',
          timestamp: false,
        }),
      );
    }

    const bot = await findBot(interaction.options.getString('bot', true));
    if (sub === 'usun') {
      await prisma.monitoredBot.delete({ where: { id: bot.id } });
      await audit(client, {
        action: 'monitoring.remove',
        actorId: interaction.user.id,
        summary: `Usunięto z monitoringu **${bot.name}**`,
      });
      void refreshBoard(client);
      return reply(card({ tone: 'success', title: `Usunięto ${bot.name} z monitoringu`, timestamp: false }));
    }
    if (sub === 'heartbeat') {
      if (bot.mode !== 'heartbeat' || !bot.heartbeatToken)
        throw new UserError('Ten bot nie używa trybu heartbeat.');
      return reply(
        card({
          tone: 'info',
          emoji: 'server',
          title: `Heartbeat: ${bot.name}`,
          description: heartbeatHelp(bot.heartbeatToken),
          timestamp: false,
        }),
      );
    }
    await interaction.deferReply({ flags: ['Ephemeral'] });
    const result = await checkBot(client, bot);
    return interaction.editReply(
      v2Message(
        card({
          tone: result.ok ? 'success' : 'error',
          emoji: 'server',
          title: `${bot.name}: ${result.ok ? 'działa' : 'nie działa'}`,
          fields: [
            {
              emoji: 'lightning',
              label: 'Odpowiedź',
              value: result.ms !== undefined ? `${result.ms} ms` : null,
            },
            { emoji: 'tools', label: 'Błąd', value: result.error },
            { emoji: 'code', label: 'Wersja', value: result.version ?? bot.version },
            { emoji: 'checklist', label: 'Uptime', value: uptime(bot) },
          ],
          timestamp: false,
        }),
      ),
    );
  },
});

const statusCommand = defineCommand({
  data: new SlashCommandBuilder().setName('status').setDescription('Status botów zxCode'),
  cooldown: 5,
  async run(interaction, { config }) {
    const bots = await prisma.monitoredBot.findMany({ orderBy: { name: 'asc' } });
    const own = bots.filter((b) => b.ownerId === interaction.user.id);
    const panel = statusBoard(
      isStaff(interaction.member, config) || !own.length
        ? bots
        : [...own, ...bots.filter((b) => !own.includes(b))],
    );
    return interaction.reply(v2(panel, { ephemeral: true }));
  },
});

export const monitoringModule = defineModule({
  name: 'monitoring',
  description: 'Monitoring botów klientów (HTTP, heartbeat, presence) i tablica statusu',
  commands: [monitoringCommand, statusCommand],
  jobs: [defineJob({ name: 'checks', intervalMs: 60_000, runOnStart: true, run: runChecks })],
});
