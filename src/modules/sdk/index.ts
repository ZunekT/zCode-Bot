import { PermissionFlagsBits, SlashCommandBuilder, type AutocompleteInteraction } from 'discord.js';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { audit } from '../../core/audit.js';
import { UserError } from '../../core/errors.js';
import { defineCommand, defineModule } from '../../core/types.js';
import { v2 } from '../../ui/builders/payload.js';
import { card, codeBlock } from '../../ui/components/card.js';
import { discordTime, truncate } from '../../utils/format.js';
import { sdkHub } from './hub.js';
import { createBot, deleteBot, regenerateKey } from './service.js';

const SDK_URL = () => env.PUBLIC_URL?.replace(/\/$/, '') ?? `http://ADRES-SERWERA:${env.HTTP_PORT}`;

/** Instrukcja dla bota klienta – pokazywana razem z kluczem (tylko raz). */
function setupText(key: string) {
  return (
    '**1.** W bocie: `npm install zxcode-sdk`\n' +
    '**2.** Do `.env` bota:\n' +
    codeBlock(`ZXCODE_KEY=${key}\nZXCODE_URL=${SDK_URL()}`, 'ini') +
    '\n**3.** W kodzie (szczegóły w README pakietu):\n' +
    codeBlock("const { zxcode } = require('zxcode-sdk');\nconst zx = zxcode(client, { modules: { /* … */ } });", 'js') +
    '\n-# Klucz widzisz tylko teraz. Zgubiony klucz wygenerujesz ponownie: `/sdk klucz`.'
  );
}

async function botAutocomplete(interaction: AutocompleteInteraction) {
  const q = interaction.options.getFocused();
  const bots = await prisma.sdkBot.findMany({ where: { name: { contains: q, mode: 'insensitive' } }, orderBy: { name: 'asc' }, take: 25 });
  await interaction.respond(bots.map((b) => ({ name: truncate(`${b.name} (#${b.id})`, 100), value: String(b.id) })));
}

async function findBot(raw: string) {
  const bot = await prisma.sdkBot.findUnique({ where: { id: Number(raw) || 0 } });
  if (!bot) throw new UserError('Nie ma takiego bota SDK.');
  return bot;
}

const sdkCommand = defineCommand({
  data: new SlashCommandBuilder()
    .setName('sdk')
    .setDescription('[Admin] Boty klientów w panelu zxCode (zxcode-sdk)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName('dodaj')
        .setDescription('Dodaj bota klienta – dostaniesz klucz do .env')
        .addStringOption((o) => o.setName('nazwa').setDescription('Nazwa bota w panelu').setRequired(true).setMaxLength(40))
        .addUserOption((o) => o.setName('wlasciciel').setDescription('Klient – tylko on edytuje bota w panelu').setRequired(true)),
    )
    .addSubcommand((s) => s.setName('lista').setDescription('Boty SDK i ich stan'))
    .addSubcommand((s) =>
      s
        .setName('klucz')
        .setDescription('Wygeneruj nowy klucz (stary przestaje działać)')
        .addStringOption((o) => o.setName('bot').setDescription('Bot').setRequired(true).setAutocomplete(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('usun')
        .setDescription('Usuń bota z panelu (razem z ustawieniami i monitoringiem)')
        .addStringOption((o) => o.setName('bot').setDescription('Bot').setRequired(true).setAutocomplete(true)),
    ),
  access: 'admin',
  autocomplete: botAutocomplete,

  async run(interaction, { client }) {
    const sub = interaction.options.getSubcommand();
    const actorId = interaction.user.id;

    if (sub === 'dodaj') {
      const name = interaction.options.getString('nazwa', true).trim();
      const owner = interaction.options.getUser('wlasciciel', true);
      if (owner.bot) throw new UserError('Właścicielem musi być człowiek, nie bot.');
      const { bot, key } = await createBot(name, owner.id);
      await audit(client, { action: 'sdk.add', actorId, targetId: owner.id, summary: `Dodano bota SDK **${name}** (#${bot.id}) dla <@${owner.id}>` });
      return interaction.reply(
        v2(card({ tone: 'success', emoji: 'bot', title: `Bot ${name} dodany (#${bot.id})`, description: `Właściciel: <@${owner.id}>`, body: setupText(key), timestamp: false }), {
          ephemeral: true,
        }),
      );
    }

    if (sub === 'lista') {
      const bots = await prisma.sdkBot.findMany({ orderBy: { createdAt: 'asc' }, include: { _count: { select: { guilds: true } } } });
      return interaction.reply(
        v2(
          card({
            tone: 'brand',
            emoji: 'bot',
            title: `Boty SDK (${bots.length})`,
            description:
              bots
                .map(
                  (b) =>
                    `**${b.name}** \`#${b.id}\` \`${sdkHub.isConnected(b.id) ? 'połączony' : 'rozłączony'}\` · <@${b.ownerId}>\n-# ${[
                      b.username ? `@${b.username}` : 'jeszcze się nie połączył',
                      `serwery: ${b._count.guilds}`,
                      b.botVersion ? `v${b.botVersion.replace(/^v/, '')}` : null,
                      b.sdkVersion ? `SDK ${b.sdkVersion}` : null,
                      b.lastSeenAt ? `ostatnio ${discordTime(b.lastSeenAt, 'R')}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}`,
                )
                .join('\n') || 'Brak botów. Dodaj: `/sdk dodaj`.',
            timestamp: false,
          }),
          { ephemeral: true },
        ),
      );
    }

    const bot = await findBot(interaction.options.getString('bot', true));
    if (sub === 'klucz') {
      const key = await regenerateKey(bot.id);
      await audit(client, { action: 'sdk.key', actorId, summary: `Nowy klucz dla bota SDK **${bot.name}** (#${bot.id})` });
      return interaction.reply(
        v2(card({ tone: 'warning', emoji: 'lock', title: `Nowy klucz: ${bot.name}`, description: 'Stary klucz już nie działa – podmień go w `.env` bota.', body: setupText(key), timestamp: false }), {
          ephemeral: true,
        }),
      );
    }

    await deleteBot(bot.id);
    await audit(client, { action: 'sdk.delete', actorId, summary: `Usunięto bota SDK **${bot.name}** (#${bot.id})` });
    return interaction.reply(v2(card({ tone: 'success', title: `Usunięto bota ${bot.name}`, timestamp: false }), { ephemeral: true }));
  },
});

export const sdkModule = defineModule({
  name: 'sdk',
  description: 'Panel botów klientów (zxcode-sdk)',
  toggleable: false,
  commands: [sdkCommand],
});
