import { SlashCommandBuilder, type AutocompleteInteraction } from 'discord.js';
import { prisma } from '../../db/prisma.js';
import { audit } from '../../core/audit.js';
import { UserError } from '../../core/errors.js';
import { isStaff } from '../../core/permissions.js';
import { defineCommand, defineComponent, defineModule } from '../../core/types.js';
import { Panel } from '../../ui/builders/container.js';
import { Form } from '../../ui/builders/modal.js';
import { v2 } from '../../ui/builders/payload.js';
import { success } from '../../ui/components/notice.js';
import { truncate } from '../../utils/format.js';

async function faqAutocomplete(interaction: AutocompleteInteraction) {
  const q = interaction.options.getFocused().toLowerCase();
  const rows = await prisma.faqArticle.findMany({
    where: q ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { keywords: { has: q } }] } : {},
    orderBy: { title: 'asc' },
    take: 25,
  });
  await interaction.respond(rows.map((r) => ({ name: truncate(r.title, 100), value: String(r.id) })));
}

async function findArticle(value: string) {
  const id = Number(value);
  const article = Number.isSafeInteger(id) ? await prisma.faqArticle.findUnique({ where: { id } }) : null;
  if (!article) throw new UserError('Nie znaleziono takiego artykułu FAQ.');
  return article;
}

function faqModal(existing?: { id: number; title: string; content: string; keywords: string[] }) {
  return new Form(
    `faq:save${existing ? `:${existing.id}` : ''}`,
    existing ? 'Edycja FAQ' : 'Nowy artykuł FAQ',
  )
    .text({ id: 'title', label: 'Pytanie / tytuł', max: 100, value: existing?.title })
    .text({ id: 'content', label: 'Odpowiedź', paragraph: true, max: 3000, value: existing?.content })
    .text({
      id: 'keywords',
      label: 'Słowa kluczowe',
      description: 'Po przecinku – po nich bot podpowiada artykuł w nowych ticketach',
      required: false,
      max: 300,
      value: existing?.keywords.join(', '),
      placeholder: 'cena, cennik, koszt, ile kosztuje',
    })
    .build();
}

const articlePanel = (a: { title: string; content: string }) =>
  new Panel({ tone: 'info' }).title('documentation', a.title, 3).text(a.content).footer('zxCode • FAQ');

const faqCommand = defineCommand({
  data: new SlashCommandBuilder()
    .setName('faq')
    .setDescription('Najczęstsze pytania')
    .addSubcommand((s) =>
      s
        .setName('pokaz')
        .setDescription('Pokaż odpowiedź z FAQ')
        .addStringOption((o) =>
          o.setName('pytanie').setDescription('Szukaj').setRequired(true).setAutocomplete(true),
        )
        .addBooleanOption((o) =>
          o.setName('publicznie').setDescription('[Obsługa] Wyślij widoczne dla wszystkich'),
        ),
    )
    .addSubcommand((s) => s.setName('lista').setDescription('Wszystkie pytania'))
    .addSubcommand((s) => s.setName('dodaj').setDescription('[Obsługa] Dodaj artykuł'))
    .addSubcommand((s) =>
      s
        .setName('edytuj')
        .setDescription('[Obsługa] Edytuj artykuł')
        .addStringOption((o) =>
          o.setName('pytanie').setDescription('Artykuł').setRequired(true).setAutocomplete(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('usun')
        .setDescription('[Obsługa] Usuń artykuł')
        .addStringOption((o) =>
          o.setName('pytanie').setDescription('Artykuł').setRequired(true).setAutocomplete(true),
        ),
    ),
  cooldown: 3,
  autocomplete: faqAutocomplete,

  async run(interaction, { client, config }) {
    const sub = interaction.options.getSubcommand();
    const staff = isStaff(interaction.member, config);

    if (sub === 'pokaz') {
      const article = await findArticle(interaction.options.getString('pytanie', true));
      const publicly = staff && interaction.options.getBoolean('publicznie') === true;
      return interaction.reply(v2(articlePanel(article), { ephemeral: !publicly }));
    }

    if (sub === 'lista') {
      const rows = await prisma.faqArticle.findMany({ orderBy: { title: 'asc' } });
      return interaction.reply(
        v2(
          new Panel({ tone: 'brand' })
            .title('documentation', `FAQ (${rows.length})`)
            .text(rows.map((r) => `• ${r.title}`).join('\n') || 'Brak artykułów.')
            .footer('Szczegóły: /faq pokaz'),
          { ephemeral: true },
        ),
      );
    }

    if (!staff) throw new UserError('Ta akcja jest dostępna tylko dla obsługi.', 'Brak uprawnień');
    if (sub === 'dodaj') return interaction.showModal(faqModal());

    const article = await findArticle(interaction.options.getString('pytanie', true));
    if (sub === 'edytuj') return interaction.showModal(faqModal(article));

    await prisma.faqArticle.delete({ where: { id: article.id } });
    await audit(client, {
      action: 'faq.delete',
      actorId: interaction.user.id,
      summary: `Usunięto FAQ: **${article.title}**`,
    });
    return interaction.reply(success('Usunięto', article.title));
  },
});

const faqSave = defineComponent({
  id: 'faq:save',
  type: 'modal',
  access: 'staff',
  async run(interaction, args, { client }) {
    const title = interaction.fields.getTextInputValue('title').trim();
    const content = interaction.fields.getTextInputValue('content').trim();
    const keywords = [
      ...new Set(
        interaction.fields
          .getTextInputValue('keywords')
          .split(',')
          .map((k) => k.trim().toLowerCase())
          .filter((k) => k.length >= 2),
      ),
    ];

    const id = args[0] ? Number(args[0]) : null;
    const article = id
      ? await prisma.faqArticle.update({ where: { id }, data: { title, content, keywords } })
      : await prisma.faqArticle.create({ data: { title, content, keywords } });

    await audit(client, {
      action: id ? 'faq.edit' : 'faq.add',
      actorId: interaction.user.id,
      summary: `${id ? 'Edytowano' : 'Dodano'} FAQ: **${article.title}**`,
    });
    return interaction.reply(
      success(
        'Zapisano',
        `**${article.title}**${keywords.length ? `\n-# Słowa kluczowe: ${keywords.join(', ')}` : ''}`,
      ),
    );
  },
});

export const faqModule = defineModule({
  name: 'faq',
  description: 'Baza najczęstszych pytań (podpowiedzi w ticketach)',
  commands: [faqCommand],
  components: [faqSave],
});
