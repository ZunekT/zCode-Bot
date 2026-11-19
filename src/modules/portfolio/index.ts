import {
  AttachmentBuilder,
  ChannelType,
  SlashCommandBuilder,
  type AutocompleteInteraction,
} from 'discord.js';
import type { PortfolioImage, PortfolioItem, ServiceKind } from '../../generated/prisma/client.js';
import { prisma } from '../../db/prisma.js';
import { audit } from '../../core/audit.js';
import { UserError } from '../../core/errors.js';
import { isStaff } from '../../core/permissions.js';
import { defineCommand, defineComponent, defineModule } from '../../core/types.js';
import { BANNER_URL, bannerFile } from '../../ui/assets.js';
import { Panel } from '../../ui/builders/container.js';
import { button, linkButton } from '../../ui/builders/buttons.js';
import { Form } from '../../ui/builders/modal.js';
import { pageButtons } from '../../ui/builders/paginator.js';
import { v2, v2Message } from '../../ui/builders/payload.js';
import { card } from '../../ui/components/card.js';
import { e } from '../../ui/emojis.js';
import { truncate } from '../../utils/format.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('portfolio');
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

type ItemWithImages = PortfolioItem & { images: PortfolioImage[] };

const allItems = () =>
  prisma.portfolioItem.findMany({
    orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
    include: { images: { orderBy: { position: 'asc' } } },
  });

const fileName = (img: PortfolioImage, i: number) =>
  `p${img.itemId}-${i + 1}.${img.contentType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'png'}`;

function itemPage(items: ItemWithImages[], page: number) {
  const item = items[page]!;
  const files = item.images.map(
    (img, i) => new AttachmentBuilder(Buffer.from(img.data), { name: fileName(img, i) }),
  );
  const panel = card({
    tone: 'brand',
    emoji: 'rocket',
    title: item.title,
    description: item.description,
    fields: [
      {
        emoji: 'code',
        label: 'Technologie',
        value: item.technologies.length ? item.technologies.map((t) => `\`${t}\``).join(' ') : null,
      },
    ],
    timestamp: false,
  });
  if (files.length) panel.gallery(item.images.map((img, i) => ({ url: `attachment://${fileName(img, i)}` })));
  panel.buttons(
    ...pageButtons('portfolio:page', page, items.length),
    ...(item.url ? [linkButton(item.url, 'Zobacz', 'discord')] : []),
  );
  panel.footer(`Realizacja ${page + 1} z ${items.length} • zxCode`);
  return { panel, files };
}

async function itemAutocomplete(interaction: AutocompleteInteraction) {
  const q = interaction.options.getFocused();
  const rows = await prisma.portfolioItem.findMany({
    where: { title: { contains: q, mode: 'insensitive' } },
    take: 25,
  });
  await interaction.respond(rows.map((r) => ({ name: truncate(r.title, 100), value: String(r.id) })));
}

function itemModal(kind: ServiceKind, existing?: PortfolioItem) {
  const form = new Form(
    existing ? `portfolio:save:${existing.id}:${kind}` : `portfolio:save:0:${kind}`,
    existing ? 'Edycja realizacji' : 'Nowa realizacja',
  )
    .text({ id: 'title', label: 'Nazwa projektu', max: 80, value: existing?.title })
    .text({ id: 'description', label: 'Opis', paragraph: true, max: 1000, value: existing?.description })
    .text({
      id: 'tech',
      label: 'Technologie (po przecinku)',
      required: false,
      max: 200,
      value: existing?.technologies.join(', '),
      placeholder: kind === 'WEBSITE' ? 'Next.js, React, Tailwind' : 'discord.js, TypeScript, PostgreSQL',
    })
    .text({
      id: 'url',
      label: kind === 'WEBSITE' ? 'Adres strony' : 'Link (opcjonalnie)',
      required: false,
      max: 200,
      value: existing?.url ?? undefined,
    });
  if (!existing)
    form.files({
      id: 'images',
      label: 'Zrzuty ekranu',
      description: `Do ${MAX_IMAGES} obrazków (PNG/JPG/GIF/WEBP)`,
      max: MAX_IMAGES,
    });
  return form.build();
}

const portfolioCommand = defineCommand({
  data: new SlashCommandBuilder()
    .setName('portfolio')
    .setDescription('Nasze realizacje')
    .addSubcommand((s) => s.setName('przegladaj').setDescription('Przeglądaj realizacje'))
    .addSubcommand((s) =>
      s
        .setName('panel')
        .setDescription('[Obsługa] Wyślij panel portfolio')
        .addChannelOption((o) =>
          o
            .setName('kanal')
            .setDescription('Gdzie wysłać (domyślnie tutaj)')
            .addChannelTypes(ChannelType.GuildText),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('dodaj')
        .setDescription('[Obsługa] Dodaj realizację')
        .addStringOption((o) =>
          o
            .setName('rodzaj')
            .setDescription('Bot czy strona')
            .addChoices(
              { name: 'Bot Discord', value: 'BOT' },
              { name: 'Strona internetowa', value: 'WEBSITE' },
            ),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('edytuj')
        .setDescription('[Obsługa] Edytuj realizację')
        .addStringOption((o) =>
          o.setName('pozycja').setDescription('Realizacja').setRequired(true).setAutocomplete(true),
        )
        .addStringOption((o) =>
          o
            .setName('rodzaj')
            .setDescription('Bot czy strona')
            .addChoices(
              { name: 'Bot Discord', value: 'BOT' },
              { name: 'Strona internetowa', value: 'WEBSITE' },
            ),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('usun')
        .setDescription('[Obsługa] Usuń realizację')
        .addStringOption((o) =>
          o.setName('pozycja').setDescription('Realizacja').setRequired(true).setAutocomplete(true),
        ),
    ),
  cooldown: 3,
  autocomplete: itemAutocomplete,

  async run(interaction, { client, config }) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'przegladaj') {
      const items = await allItems();
      if (!items.length)
        throw new UserError(
          'Portfolio jest jeszcze puste – wkrótce pokażemy nasze projekty!',
          'Brak realizacji',
        );
      const { panel, files } = itemPage(items, 0);
      return interaction.reply(v2(panel, { ephemeral: true, files }));
    }

    if (!isStaff(interaction.member, config))
      throw new UserError('Ta akcja jest dostępna tylko dla obsługi.', 'Brak uprawnień');

    if (sub === 'panel') {
      const target =
        interaction.options.getChannel('kanal', false, [ChannelType.GuildText]) ?? interaction.channel;
      if (!target?.isSendable()) throw new UserError('Nie mogę pisać na tym kanale.');
      const items = await allItems();
      const panel = new Panel({ tone: 'brand' })
        .banner(BANNER_URL)
        .title('rocket', 'Portfolio zxCode')
        .text(
          `Zobacz boty, które już zbudowaliśmy – **${items.length}** ${items.length === 1 ? 'realizacja' : 'realizacji'} i ciągle przybywa.`,
        )
        .separator()
        .text(
          items
            .slice(0, 10)
            .map(
              (i) =>
                `${e('order_complete')} **${i.title}**${i.technologies.length ? ` – ${i.technologies.slice(0, 3).join(', ')}` : ''}`,
            )
            .join('\n') || '-# Wkrótce!',
        )
        .buttons(button('portfolio:browse', 'Przeglądaj realizacje', { style: 'primary', emoji: 'rocket' }))
        .footer('Podoba Ci się? Zamów swojego bota w tickecie');
      await target.send(v2Message(panel, { files: [bannerFile()] }));
      return interaction.reply(
        v2(card({ tone: 'success', title: 'Panel portfolio wysłany', timestamp: false }), {
          ephemeral: true,
        }),
      );
    }
    if (sub === 'dodaj')
      return interaction.showModal(
        itemModal(interaction.options.getString('rodzaj') === 'WEBSITE' ? 'WEBSITE' : 'BOT'),
      );

    const item = await prisma.portfolioItem.findUnique({
      where: { id: Number(interaction.options.getString('pozycja', true)) },
    });
    if (!item) throw new UserError('Nie ma takiej realizacji.');
    if (sub === 'edytuj') {
      const k = interaction.options.getString('rodzaj');
      return interaction.showModal(itemModal(k === 'WEBSITE' || k === 'BOT' ? k : item.kind, item));
    }

    await prisma.portfolioItem.delete({ where: { id: item.id } });
    await audit(client, {
      action: 'portfolio.delete',
      actorId: interaction.user.id,
      summary: `Usunięto realizację **${item.title}**`,
    });
    return interaction.reply(
      v2(card({ tone: 'success', title: `Usunięto: ${item.title}`, timestamp: false }), { ephemeral: true }),
    );
  },
});

export const portfolioModule = defineModule({
  name: 'portfolio',
  description: 'Portfolio realizacji ze zdjęciami',
  commands: [portfolioCommand],
  components: [
    defineComponent({
      id: 'portfolio:browse',
      type: 'button',
      async run(interaction) {
        const items = await allItems();
        if (!items.length) throw new UserError('Portfolio jest jeszcze puste.');
        const { panel, files } = itemPage(items, 0);
        await interaction.reply(v2(panel, { ephemeral: true, files }));
      },
    }),
    defineComponent({
      id: 'portfolio:page',
      type: 'button',
      async run(interaction, args) {
        const items = await allItems();
        if (!items.length) throw new UserError('Portfolio jest puste.');
        const page = Math.min(Math.max(Number(args[0]) || 0, 0), items.length - 1);
        const { panel, files } = itemPage(items, page);
        await interaction.update({ ...v2Message(panel, { files }), attachments: [] });
      },
    }),
    defineComponent({
      id: 'portfolio:save',
      type: 'modal',
      access: 'staff',
      async run(interaction, args, { client }) {
        const f = interaction.fields;
        const url = f.getTextInputValue('url').trim() || null;
        if (url && !/^https?:\/\/\S+$/i.test(url))
          throw new UserError('Link musi zaczynać się od http:// lub https://');
        const data = {
          title: f.getTextInputValue('title').trim(),
          description: f.getTextInputValue('description').trim(),
          technologies: f
            .getTextInputValue('tech')
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 10),
          url,
          kind: (args[1] === 'WEBSITE' ? 'WEBSITE' : 'BOT') as ServiceKind,
        };

        if (args[0] && args[0] !== '0') {
          const item = await prisma.portfolioItem.update({ where: { id: Number(args[0]) }, data });
          await audit(client, {
            action: 'portfolio.edit',
            actorId: interaction.user.id,
            summary: `Edytowano realizację **${item.title}**`,
          });
          return interaction.reply(
            v2(card({ tone: 'success', title: `Zapisano: ${item.title}`, timestamp: false }), {
              ephemeral: true,
            }),
          );
        }

        await interaction.deferReply({ flags: ['Ephemeral'] });
        const uploads = [...(f.getUploadedFiles('images', false)?.values() ?? [])].slice(0, MAX_IMAGES);
        const images: {
          name: string;
          contentType: string;
          data: Uint8Array<ArrayBuffer>;
          position: number;
        }[] = [];
        for (const [i, a] of uploads.entries()) {
          if (!a.contentType?.startsWith('image/') || !/png|jpe?g|gif|webp/.test(a.contentType))
            throw new UserError(`„${a.name}” nie jest obrazkiem PNG/JPG/GIF/WEBP.`);
          if (a.size > MAX_IMAGE_BYTES) throw new UserError(`„${a.name}” jest za duży (max 8 MB).`);
          const res = await fetch(a.url);
          if (!res.ok) throw new UserError(`Nie udało się pobrać „${a.name}”.`);
          images.push({
            name: a.name,
            contentType: a.contentType,
            data: new Uint8Array(await res.arrayBuffer()),
            position: i,
          });
        }
        const count = await prisma.portfolioItem.count();
        const item = await prisma.portfolioItem.create({
          data: { ...data, position: count, images: { create: images } },
        });
        log.info(`Dodano realizację „${item.title}” (${images.length} zdjęć)`);
        await audit(client, {
          action: 'portfolio.add',
          actorId: interaction.user.id,
          summary: `Dodano realizację **${item.title}** (${images.length} zdjęć)`,
        });
        return interaction.editReply(
          v2Message(
            card({
              tone: 'success',
              emoji: 'rocket',
              title: `Dodano: ${item.title}`,
              description: `Zdjęcia: **${images.length}**. Zobacz: \`/portfolio przegladaj\``,
              timestamp: false,
            }),
          ),
        );
      },
    }),
  ],
});
