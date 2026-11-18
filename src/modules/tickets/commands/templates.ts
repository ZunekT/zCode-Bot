import { SlashCommandBuilder, type AutocompleteInteraction } from 'discord.js';
import { prisma } from '../../../db/prisma.js';
import { audit } from '../../../core/audit.js';
import { UserError } from '../../../core/errors.js';
import { defineCommand, defineComponent } from '../../../core/types.js';
import { Panel } from '../../../ui/builders/container.js';
import { Form } from '../../../ui/builders/modal.js';
import { v2, v2Message } from '../../../ui/builders/payload.js';
import { card } from '../../../ui/components/card.js';
import { success } from '../../../ui/components/notice.js';
import { truncate } from '../../../utils/format.js';
import { ticketNo } from '../panels.js';
import { recordStaffActivity } from '../services/activity.js';

const KEY_RE = /^[a-z0-9-]{2,30}$/;

export async function templateAutocomplete(interaction: AutocompleteInteraction) {
  const q = interaction.options.getFocused().toLowerCase();
  const rows = await prisma.responseTemplate.findMany({
    where: q ? { OR: [{ key: { contains: q } }, { title: { contains: q, mode: 'insensitive' } }] } : {},
    orderBy: { key: 'asc' },
    take: 25,
  });
  await interaction.respond(
    rows.map((r) => ({ name: truncate(`${r.key} – ${r.title}`, 100), value: r.key })),
  );
}

function templateModal(existing?: { key: string; title: string; content: string }) {
  const form = new Form(
    `ticket:templateSave${existing ? `:${existing.key}` : ''}`,
    existing ? 'Edycja szablonu' : 'Nowy szablon',
  );
  form.info('Możesz użyć: `{klient}` – wzmianka klienta, `{obsluga}` – Ty, `{ticket}` – numer ticketu.');
  if (!existing) {
    form.text({
      id: 'key',
      label: 'Skrót',
      description: 'Małe litery, cyfry i myślniki, np. cennik',
      max: 30,
      min: 2,
    });
  }
  return form
    .text({ id: 'title', label: 'Tytuł', max: 80, value: existing?.title })
    .text({ id: 'content', label: 'Treść', paragraph: true, max: 2000, value: existing?.content })
    .build();
}

export const templateCommand = defineCommand({
  data: new SlashCommandBuilder()
    .setName('szablon')
    .setDescription('[Obsługa] Szablony odpowiedzi')
    .addSubcommand((s) => s.setName('dodaj').setDescription('Dodaj szablon'))
    .addSubcommand((s) =>
      s
        .setName('edytuj')
        .setDescription('Edytuj szablon')
        .addStringOption((o) =>
          o.setName('skrot').setDescription('Szablon').setRequired(true).setAutocomplete(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('usun')
        .setDescription('Usuń szablon')
        .addStringOption((o) =>
          o.setName('skrot').setDescription('Szablon').setRequired(true).setAutocomplete(true),
        ),
    )
    .addSubcommand((s) => s.setName('lista').setDescription('Lista szablonów')),
  access: 'staff',
  autocomplete: templateAutocomplete,

  async run(interaction, { client }) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'dodaj') return interaction.showModal(templateModal());

    if (sub === 'lista') {
      const rows = await prisma.responseTemplate.findMany({ orderBy: { key: 'asc' } });
      const panel = new Panel({ tone: 'brand' })
        .title('documentation', `Szablony odpowiedzi (${rows.length})`)
        .text(
          rows.map((r) => `\`${r.key}\` – ${r.title}`).join('\n') ||
            'Brak szablonów. Dodaj pierwszy: `/szablon dodaj`.',
        )
        .footer('Wysyłasz je przez /odpowiedz');
      return interaction.reply(v2(panel, { ephemeral: true }));
    }

    const key = interaction.options.getString('skrot', true);
    const template = await prisma.responseTemplate.findUnique({ where: { key } });
    if (!template) throw new UserError(`Nie ma szablonu \`${key}\`.`);

    if (sub === 'edytuj') return interaction.showModal(templateModal(template));

    await prisma.responseTemplate.delete({ where: { key } });
    await audit(client, {
      action: 'tickets.template.delete',
      actorId: interaction.user.id,
      summary: `Usunięto szablon \`${key}\``,
    });
    return interaction.reply(success('Usunięto', `Szablon \`${key}\` został usunięty.`));
  },
});

export const templateSaveComponent = defineComponent({
  id: 'ticket:templateSave',
  type: 'modal',
  access: 'staff',
  async run(interaction, args, { client }) {
    const existingKey = args[0];
    const key = existingKey ?? interaction.fields.getTextInputValue('key').trim().toLowerCase();
    if (!KEY_RE.test(key))
      throw new UserError('Skrót może zawierać tylko małe litery, cyfry i myślniki (2–30 znaków).');

    const title = interaction.fields.getTextInputValue('title').trim();
    const content = interaction.fields.getTextInputValue('content').trim();

    if (existingKey) {
      await prisma.responseTemplate.update({ where: { key }, data: { title, content } });
    } else {
      if (await prisma.responseTemplate.findUnique({ where: { key } }))
        throw new UserError(`Szablon \`${key}\` już istnieje.`);
      await prisma.responseTemplate.create({ data: { key, title, content, createdBy: interaction.user.id } });
    }
    await audit(client, {
      action: existingKey ? 'tickets.template.edit' : 'tickets.template.add',
      actorId: interaction.user.id,
      summary: `${existingKey ? 'Edytowano' : 'Dodano'} szablon \`${key}\``,
    });
    return interaction.reply(success('Zapisano szablon', `\`${key}\` – ${title}`));
  },
});

export const replyCommand = defineCommand({
  data: new SlashCommandBuilder()
    .setName('odpowiedz')
    .setDescription('[Obsługa] Wyślij gotową odpowiedź z szablonu')
    .addStringOption((o) =>
      o.setName('szablon').setDescription('Który szablon').setRequired(true).setAutocomplete(true),
    ),
  access: 'staff',
  autocomplete: templateAutocomplete,

  async run(interaction) {
    const key = interaction.options.getString('szablon', true);
    const template = await prisma.responseTemplate.findUnique({ where: { key } });
    if (!template) throw new UserError(`Nie ma szablonu \`${key}\`.`);
    if (!interaction.channel?.isSendable()) throw new UserError('Nie mogę pisać na tym kanale.');

    const ticket = await prisma.ticket.findUnique({ where: { channelId: interaction.channelId } });
    const fill = (s: string) =>
      s
        .replaceAll('{klient}', ticket ? `<@${ticket.userId}>` : '')
        .replaceAll('{obsluga}', `<@${interaction.user.id}>`)
        .replaceAll('{ticket}', ticket ? ticketNo(ticket.id) : '');

    const panel = card({
      tone: 'brand',
      emoji: 'support',
      title: fill(template.title),
      description: fill(template.content),
      thumbnail: interaction.member.displayAvatarURL({ size: 128 }),
      footer: `${interaction.member.displayName} • zxCode Support`,
    });

    await interaction.channel.send({
      ...v2Message(panel),
      allowedMentions: { users: ticket ? [ticket.userId] : [] },
    });
    if (ticket) await recordStaffActivity(ticket.id);
    return interaction.reply(success('Wysłano', `Szablon \`${key}\``));
  },
});
