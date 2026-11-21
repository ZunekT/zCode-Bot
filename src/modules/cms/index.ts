import { PermissionFlagsBits, SlashCommandBuilder, type AutocompleteInteraction } from 'discord.js';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { audit } from '../../core/audit.js';
import { UserError } from '../../core/errors.js';
import { defineCommand, defineModule } from '../../core/types.js';
import { v2 } from '../../ui/builders/payload.js';
import { card, codeBlock } from '../../ui/components/card.js';
import { discordTime, truncate } from '../../utils/format.js';
import { createSite, rotateKey } from './service.js';

const API_URL = () => env.PUBLIC_URL?.replace(/\/$/, '') ?? `http://ADRES-SERWERA:${env.HTTP_PORT}`;

function setupText(key: string) {
  return (
    '**1.** W projekcie strony: `npm install zxcode-cms`\n' +
    '**2.** Do `.env` strony (tylko po stronie serwera, nigdy z prefiksem `NEXT_PUBLIC_`):\n' +
    codeBlock(`ZXCODE_SITE_KEY=${key}\nZXCODE_URL=${API_URL()}`, 'ini') +
    '\n**3.** Opisz sekcje w kodzie i pobieraj treść (szczegóły w README pakietu):\n' +
    codeBlock("const { createSite, field } = require('zxcode-cms');\nconst site = createSite({ sections: { /* … */ } });\nconst tresc = await site.content();", 'js') +
    '\n-# Klucz widzisz tylko teraz. Zgubiony klucz wygenerujesz ponownie: `/cms klucz`.'
  );
}

async function siteAutocomplete(interaction: AutocompleteInteraction) {
  const q = interaction.options.getFocused();
  const sites = await prisma.cmsSite.findMany({ where: { name: { contains: q, mode: 'insensitive' } }, orderBy: { name: 'asc' }, take: 25 });
  await interaction.respond(sites.map((s) => ({ name: truncate(`${s.name} (#${s.id})`, 100), value: String(s.id) })));
}

function normalizeUrl(raw: string | null): string | null {
  if (!raw) return null;
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withProto);
    if (!u.hostname.includes('.')) throw new Error();
    return `${u.protocol}//${u.host}`;
  } catch {
    throw new UserError('Nieprawidłowy adres strony.');
  }
}

const cmsCommand = defineCommand({
  data: new SlashCommandBuilder()
    .setName('cms')
    .setDescription('[Admin] Edycja treści stron klientów w panelu zxCode')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName('dodaj')
        .setDescription('Dodaj stronę klienta – dostaniesz klucz do .env strony')
        .addStringOption((o) => o.setName('nazwa').setDescription('Nazwa strony w panelu').setRequired(true).setMaxLength(60))
        .addUserOption((o) => o.setName('wlasciciel').setDescription('Klient – edytuje treść w panelu').setRequired(true))
        .addStringOption((o) => o.setName('adres').setDescription('Adres strony, np. firma.pl').setMaxLength(200)),
    )
    .addSubcommand((s) => s.setName('lista').setDescription('Strony z edycją treści'))
    .addSubcommand((s) =>
      s
        .setName('klucz')
        .setDescription('Nowy klucz strony (stary przestaje działać)')
        .addStringOption((o) => o.setName('strona').setDescription('Strona').setRequired(true).setAutocomplete(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('wlasciciel')
        .setDescription('Przekaż stronę innej osobie')
        .addStringOption((o) => o.setName('strona').setDescription('Strona').setRequired(true).setAutocomplete(true))
        .addUserOption((o) => o.setName('osoba').setDescription('Nowy właściciel').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('usun')
        .setDescription('Usuń stronę z panelu (razem z treścią i zdjęciami)')
        .addStringOption((o) => o.setName('strona').setDescription('Strona').setRequired(true).setAutocomplete(true)),
    ),
  access: 'admin',
  autocomplete: siteAutocomplete,

  async run(i, { client }) {
    const sub = i.options.getSubcommand();
    if (sub === 'dodaj') {
      const owner = i.options.getUser('wlasciciel', true);
      if (owner.bot) throw new UserError('Właścicielem musi być człowiek, nie bot.');
      const name = i.options.getString('nazwa', true).trim();
      const { site, key } = await createSite(name, owner.id, normalizeUrl(i.options.getString('adres')));
      await audit(client, { action: 'cms.add', actorId: i.user.id, targetId: owner.id, summary: `Dodano stronę **${name}** (#${site.id}) do edycji treści dla <@${owner.id}>` });
      return i.reply(
        v2(card({ tone: 'success', emoji: 'laptop', title: `Strona ${name} dodana (#${site.id})`, description: `Właściciel: <@${owner.id}>`, body: setupText(key), timestamp: false }), { ephemeral: true }),
      );
    }

    if (sub === 'lista') {
      const sites = await prisma.cmsSite.findMany({ orderBy: { createdAt: 'asc' }, include: { _count: { select: { assets: true } } } });
      return i.reply(
        v2(
          card({
            tone: 'brand',
            emoji: 'laptop',
            title: `Strony z edycją treści (${sites.length})`,
            description:
              sites
                .map(
                  (s) =>
                    `**${s.name}** \`#${s.id}\` · <@${s.ownerId}>${s.url ? ` · ${s.url}` : ''}\n-# ${[
                      s.schemaAt ? 'połączona' : 'jeszcze się nie połączyła',
                      `wersja treści ${s.revision}`,
                      `zdjęcia: ${s._count.assets}`,
                      s.webhookUrl ? 'odświeżanie natychmiastowe' : 'odświeżanie co kilka minut',
                      s.lastFetchAt ? `ostatnio ${discordTime(s.lastFetchAt, 'R')}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}`,
                )
                .join('\n') || 'Brak stron. Dodaj: `/cms dodaj`.',
            timestamp: false,
          }),
          { ephemeral: true },
        ),
      );
    }

    const site = await prisma.cmsSite.findUnique({ where: { id: Number(i.options.getString('strona', true)) || 0 } });
    if (!site) throw new UserError('Nie ma takiej strony.');

    if (sub === 'klucz') {
      const key = await rotateKey(site.id);
      await audit(client, { action: 'cms.key', actorId: i.user.id, summary: `Nowy klucz strony **${site.name}** (#${site.id})` });
      return i.reply(
        v2(card({ tone: 'warning', emoji: 'lock', title: `Nowy klucz: ${site.name}`, description: 'Stary klucz już nie działa – podmień go w `.env` strony.', body: setupText(key), timestamp: false }), { ephemeral: true }),
      );
    }

    if (sub === 'wlasciciel') {
      const owner = i.options.getUser('osoba', true);
      if (owner.bot) throw new UserError('Właścicielem musi być człowiek, nie bot.');
      await prisma.cmsSite.update({ where: { id: site.id }, data: { ownerId: owner.id } });
      await audit(client, { action: 'cms.owner', actorId: i.user.id, targetId: owner.id, summary: `Strona **${site.name}** (#${site.id}) przekazana <@${owner.id}>` });
      return i.reply(v2(card({ tone: 'success', emoji: 'user_crown', title: `${site.name}: nowy właściciel`, description: `<@${owner.id}>`, timestamp: false }), { ephemeral: true }));
    }

    await prisma.cmsSite.delete({ where: { id: site.id } });
    await audit(client, { action: 'cms.delete', actorId: i.user.id, summary: `Usunięto stronę **${site.name}** (#${site.id}) z edycji treści` });
    return i.reply(v2(card({ tone: 'success', emoji: 'laptop', title: `Usunięto stronę ${site.name}`, timestamp: false }), { ephemeral: true }));
  },
});

export const cmsModule = defineModule({
  name: 'cms',
  description: 'Edycja treści stron klientów w panelu (zxcode-cms)',
  toggleable: false,
  commands: [cmsCommand],
});
