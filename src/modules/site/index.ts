import { SlashCommandBuilder } from 'discord.js';
import { audit } from '../../core/audit.js';
import { UserError } from '../../core/errors.js';
import { defineCommand, defineModule } from '../../core/types.js';
import { v2 } from '../../ui/builders/payload.js';
import { card } from '../../ui/components/card.js';
import { getAdmins, isOwner, loadAdmins, setAdmins, type Admins } from './admins.js';
import { getAccess, setAccess, type SiteAccess } from './service.js';

const statusCard = (a: SiteAccess, title?: string) =>
  card({
    tone: a.launched ? 'success' : 'warning',
    emoji: 'desktop',
    title: title ?? 'Strona zxcode.pl',
    description: a.launched
      ? 'Strona jest **publiczna** – widzi ją każdy.'
      : 'Tryb **Start wkrótce** – pełną stronę widzisz Ty i osoby z listy (po zalogowaniu na zxcode.pl/zaloguj).',
    fields: [
      {
        label: 'Podgląd przed startem',
        value: a.previewUsers.length ? a.previewUsers.map((id) => `<@${id}>`).join(', ') : 'tylko właściciel',
      },
    ],
    timestamp: false,
  });

const siteCommand = defineCommand({
  data: new SlashCommandBuilder()
    .setName('strona')
    .setDescription('[Właściciel] Strona zxcode.pl: start, tryb „Start wkrótce”, podgląd')
    .addSubcommand((s) => s.setName('status').setDescription('Czy strona jest publiczna i kto ma podgląd'))
    .addSubcommand((s) => s.setName('uruchom').setDescription('Uruchom stronę dla wszystkich'))
    .addSubcommand((s) =>
      s.setName('wkrotce').setDescription('Ukryj stronę – wszyscy poza podglądem widzą „Start wkrótce”'),
    )
    .addSubcommand((s) =>
      s
        .setName('dodaj')
        .setDescription('Daj komuś podgląd strony przed startem')
        .addUserOption((o) => o.setName('osoba').setDescription('Kto').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('usun')
        .setDescription('Odbierz podgląd strony')
        .addUserOption((o) => o.setName('osoba').setDescription('Kto').setRequired(true)),
    ),
  access: 'admin',
  allowInMaintenance: true,
  async run(interaction, { client }) {
    if (!(await isOwner(client, interaction.user.id)))
      throw new UserError('Tylko właściciel zxCode zarządza stroną.');
    const sub = interaction.options.getSubcommand();
    const actorId = interaction.user.id;
    const current = await getAccess();

    if (sub === 'status') return interaction.reply(v2(statusCard(current), { ephemeral: true }));

    let next: SiteAccess;
    let summary: string;
    if (sub === 'uruchom' || sub === 'wkrotce') {
      next = await setAccess({ launched: sub === 'uruchom' }, actorId);
      summary =
        sub === 'uruchom'
          ? 'Strona zxcode.pl uruchomiona publicznie'
          : 'Strona zxcode.pl w trybie „Start wkrótce”';
    } else {
      const user = interaction.options.getUser('osoba', true);
      const list =
        sub === 'dodaj'
          ? [...current.previewUsers, user.id]
          : current.previewUsers.filter((id) => id !== user.id);
      next = await setAccess({ previewUsers: list }, actorId);
      summary = `${sub === 'dodaj' ? 'Podgląd strony dla' : 'Odebrano podgląd strony:'} <@${user.id}>`;
    }
    await audit(client, { action: 'site.access', actorId, summary });
    return interaction.reply(v2(statusCard(next, 'Zapisano'), { ephemeral: true }));
  },
});

const adminsCard = (a: Admins, title = 'Administratorzy zxCode') =>
  card({
    tone: 'brand',
    emoji: 'user_crown',
    title,
    description:
      'Administratorzy mają dostęp do Administracji na zxcode.pl (zlecenia, tickety, klienci, przegląd, dziennik) i uprawnienia administracyjne w bocie. Ewidencja, VPS, start strony i ta lista – tylko właściciel.',
    fields: [
      { label: 'Osoby', value: a.users.length ? a.users.map((u) => `<@${u}>`).join(', ') : 'brak' },
      { label: 'Role', value: a.roles.length ? a.roles.map((r) => `<@&${r}>`).join(', ') : 'brak' },
    ],
    timestamp: false,
  });

const adminsCommand = defineCommand({
  data: new SlashCommandBuilder()
    .setName('administratorzy')
    .setDescription('[Właściciel] Kto ma uprawnienia administracyjne (strona + bot)')
    .addSubcommand((s) => s.setName('lista').setDescription('Pokaż administratorów'))
    .addSubcommand((s) =>
      s
        .setName('dodaj')
        .setDescription('Nadaj komuś uprawnienia administracyjne')
        .addUserOption((o) => o.setName('osoba').setDescription('Kto').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('usun')
        .setDescription('Odbierz uprawnienia administracyjne')
        .addUserOption((o) => o.setName('osoba').setDescription('Kto').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('rola')
        .setDescription('Dodaj lub usuń rolę – każdy z tą rolą jest administratorem')
        .addRoleOption((o) => o.setName('rola').setDescription('Rola').setRequired(true)),
    ),
  access: 'admin',
  allowInMaintenance: true,
  async run(interaction, { client }) {
    if (!(await isOwner(client, interaction.user.id)))
      throw new UserError('Tylko właściciel zxCode nadaje uprawnienia administracyjne.');
    const sub = interaction.options.getSubcommand();
    const a = await getAdmins();
    if (sub === 'lista') return interaction.reply(v2(adminsCard(a), { ephemeral: true }));

    let next: Admins;
    let summary: string;
    if (sub === 'rola') {
      const role = interaction.options.getRole('rola', true);
      const has = a.roles.includes(role.id);
      next = await setAdmins(
        { roles: has ? a.roles.filter((r) => r !== role.id) : [...a.roles, role.id] },
        interaction.user.id,
      );
      summary = `${has ? 'Usunięto rolę administratorów' : 'Rola administratorów'}: <@&${role.id}>`;
    } else {
      const user = interaction.options.getUser('osoba', true);
      if (sub === 'dodaj' && user.bot) throw new UserError('Bot nie może być administratorem.');
      next = await setAdmins(
        { users: sub === 'dodaj' ? [...a.users, user.id] : a.users.filter((u) => u !== user.id) },
        interaction.user.id,
      );
      summary = `${sub === 'dodaj' ? 'Nadano uprawnienia administracyjne' : 'Odebrano uprawnienia administracyjne'}: <@${user.id}>`;
    }
    await audit(client, { action: 'site.admins', actorId: interaction.user.id, summary });
    return interaction.reply(v2(adminsCard(next, 'Zapisano'), { ephemeral: true }));
  },
});

export const siteModule = defineModule({
  name: 'site',
  description: 'Strona zxcode.pl: tryb „Start wkrótce” i podgląd przed startem',
  toggleable: false,
  commands: [siteCommand, adminsCommand],
  async onReady() {
    await loadAdmins();
  },
});
