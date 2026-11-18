import {
  ChannelSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits,
  RoleSelectMenuBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type ModalSubmitInteraction,
} from 'discord.js';
import type { Announcement, Prisma } from '../../generated/prisma/client.js';
import type { ZxClient } from '../../client.js';
import { prisma } from '../../db/prisma.js';
import { audit } from '../../core/audit.js';
import { getConfig } from '../../core/config-service.js';
import { UserError } from '../../core/errors.js';
import { defineCommand, defineComponent, defineJob, defineModule } from '../../core/types.js';
import { button, linkButton } from '../../ui/builders/buttons.js';
import { Form } from '../../ui/builders/modal.js';
import { v2, v2Message } from '../../ui/builders/payload.js';
import { card } from '../../ui/components/card.js';
import { discordTime, truncate } from '../../utils/format.js';
import { parseWhen, WHEN_HINT } from '../../utils/time.js';
import {
  downloadImage,
  linksOf,
  linksText,
  parseLinks,
  pingText,
  publishAnnouncement,
  publishDue,
  renderAnnouncement,
  updatePublished,
} from './service.js';

const PING_OPTIONS = [
  { value: 'none', label: 'Bez pingu', emoji: '🔕' },
  { value: 'everyone', label: '@everyone', emoji: '📣' },
  { value: 'here', label: '@here', emoji: '🟢' },
];

const STATUS = {
  DRAFT: { label: '📝 Szkic', tone: 'info' },
  SCHEDULED: { label: '⏰ Zaplanowane', tone: 'warning' },
  PUBLISHED: { label: '✅ Opublikowane', tone: 'success' },
} as const;

const idOf = (args: string[]) => {
  const id = Number(args[0]);
  if (!Number.isSafeInteger(id) || id <= 0) throw new UserError('Nieprawidłowe ogłoszenie.');
  return id;
};

async function getAnnouncement(id: number): Promise<Announcement> {
  const a = await prisma.announcement.findUnique({ where: { id } });
  if (!a) throw new UserError('To ogłoszenie nie istnieje (mogło zostać usunięte).');
  return a;
}

/** Edytor: podgląd ogłoszenia + panel sterowania pod nim. */
async function editorPayload(client: ZxClient, a: Announcement, notice?: string) {
  const config = await getConfig();
  const { panel: preview, files } = await renderAnnouncement(client, a);
  const channelId = a.channelId ?? config.announcementChannelId;
  const s = STATUS[a.status];
  const controls = card({
    tone: s.tone,
    emoji: 'tools',
    title: `Edytor ogłoszenia #${a.id}`,
    description:
      (notice ? `${notice}\n` : '') +
      (a.status === 'SCHEDULED' && a.publishAt
        ? `${s.label} na **${discordTime(a.publishAt, 'f')}** (${discordTime(a.publishAt, 'R')})`
        : s.label),
    fields: [
      {
        emoji: 'discord',
        label: 'Kanał',
        value: channelId ? `<#${channelId}>` : '`nie ustawiono – wybierz poniżej`',
      },
      { emoji: 'notification', label: 'Ping', value: pingText(a.ping) ?? 'brak' },
    ],
    timestamp: false,
  });

  if (a.status !== 'PUBLISHED') {
    controls
      .select(
        new StringSelectMenuBuilder()
          .setCustomId(`announce:ping:${a.id}`)
          .setPlaceholder('🔔 Ping…')
          .addOptions(
            PING_OPTIONS.map((o) =>
              new StringSelectMenuOptionBuilder()
                .setValue(o.value)
                .setLabel(o.label)
                .setEmoji({ name: o.emoji })
                .setDefault((a.ping ?? 'none') === o.value),
            ),
          ),
      )
      .select(
        (() => {
          const roles = new RoleSelectMenuBuilder()
            .setCustomId(`announce:pingRole:${a.id}`)
            .setPlaceholder('…albo pinguj wybraną rolę')
            .setMinValues(0)
            .setMaxValues(1);
          if (a.ping?.startsWith('role:')) roles.setDefaultRoles(a.ping.slice(5));
          return roles;
        })(),
      )
      .select(
        (() => {
          const ch = new ChannelSelectMenuBuilder()
            .setCustomId(`announce:channel:${a.id}`)
            .setPlaceholder('📌 Kanał publikacji…')
            .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setMinValues(1)
            .setMaxValues(1);
          if (channelId) ch.setDefaultChannels(channelId);
          return ch;
        })(),
      )
      .buttons(
        button(`announce:publish:${a.id}`, 'Opublikuj teraz', { style: 'success', emoji: 'rocket' }),
        a.status === 'SCHEDULED'
          ? button(`announce:unschedule:${a.id}`, 'Anuluj plan', { emoji: 'calendar' })
          : button(`announce:schedule:${a.id}`, 'Zaplanuj', { emoji: 'calendar' }),
        button(`announce:edit:${a.id}`, 'Edytuj treść', { emoji: 'code_file' }),
        button(`announce:delete:${a.id}`, 'Usuń', { style: 'danger', emoji: 'shield_x' }),
      );
  } else {
    controls.buttons(
      button(`announce:edit:${a.id}`, 'Edytuj opublikowane', { emoji: 'code_file' }),
      ...(a.channelId && a.messageId
        ? [
            linkButton(
              `https://discord.com/channels/${config.guildId}/${a.channelId}/${a.messageId}`,
              'Zobacz',
              'discord',
            ),
          ]
        : []),
      button(`announce:delete:${a.id}`, 'Usuń z kanału', { style: 'danger', emoji: 'shield_x' }),
    );
  }
  return { ...v2Message([preview, controls], { files }), attachments: [] };
}

function contentModal(customId: string, title: string, a?: Announcement) {
  const form = new Form(customId, title)
    .text({ id: 'title', label: 'Tytuł', max: 100, value: a?.title })
    .text({
      id: 'content',
      label: 'Treść',
      description: 'Markdown Discorda: **pogrubienie**, listy, linki',
      paragraph: true,
      max: 3000,
      value: a?.content,
    })
    .files({
      id: 'image',
      label: a?.imageData ? 'Nowy obrazek (puste = zostaw obecny)' : 'Obrazek (opcjonalnie)',
      max: 1,
      required: false,
    })
    .text({
      id: 'links',
      label: 'Przyciski z linkami (opcjonalnie)',
      description: 'Każdy w nowej linii: Nazwa | https://…',
      paragraph: true,
      required: false,
      max: 1000,
      value: a ? linksText(linksOf(a)) || undefined : undefined,
    });
  if (!a)
    form.select({
      id: 'ping',
      label: 'Ping',
      options: PING_OPTIONS.map((o) => ({ value: o.value, label: o.label, default: o.value === 'none' })),
    });
  return form.build();
}

async function readContent(i: ModalSubmitInteraction) {
  const f = i.fields;
  const image = f.getUploadedFiles('image', false)?.first();
  return {
    title: f.getTextInputValue('title').trim(),
    content: f.getTextInputValue('content').trim(),
    buttons: parseLinks(f.getTextInputValue('links')) as unknown as Prisma.InputJsonValue,
    ...(image ? await downloadImage(image) : {}),
  };
}

const announceCommand = defineCommand({
  data: new SlashCommandBuilder()
    .setName('ogloszenie')
    .setDescription('[Admin] Ogłoszenia')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName('nowe')
        .setDescription('Kreator ogłoszenia (szkic z podglądem)')
        .addChannelOption((o) =>
          o
            .setName('kanal')
            .setDescription('Kanał (domyślnie kanał ogłoszeń z /config)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
        ),
    )
    .addSubcommand((s) => s.setName('lista').setDescription('Szkice, zaplanowane i ostatnie ogłoszenia')),
  access: 'admin',

  async run(interaction) {
    if (interaction.options.getSubcommand() === 'nowe') {
      const channel = interaction.options.getChannel('kanal');
      return interaction.showModal(contentModal(`announce:create:${channel?.id ?? 0}`, 'Nowe ogłoszenie'));
    }

    const rows = await prisma.announcement.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 25,
      select: { id: true, title: true, status: true, publishAt: true, publishedAt: true, createdAt: true },
    });
    const panel = card({
      tone: 'brand',
      emoji: 'announcement',
      title: `Ogłoszenia (${rows.length})`,
      description: rows.length
        ? rows
            .map(
              (r) =>
                `${STATUS[r.status].label.split(' ')[0]} **#${r.id}** ${truncate(r.title, 60)} – ${discordTime(r.publishedAt ?? r.publishAt ?? r.createdAt, 'R')}`,
            )
            .join('\n')
        : 'Brak ogłoszeń. Utwórz pierwsze: `/ogloszenie nowe`.',
      timestamp: false,
    });
    if (rows.length) {
      panel.select(
        new StringSelectMenuBuilder()
          .setCustomId('announce:open')
          .setPlaceholder('✏️ Otwórz w edytorze…')
          .addOptions(
            rows.map((r) =>
              new StringSelectMenuOptionBuilder()
                .setValue(String(r.id))
                .setLabel(truncate(`#${r.id} ${r.title}`, 100))
                .setDescription(STATUS[r.status].label),
            ),
          ),
      );
    }
    return interaction.reply(v2(panel, { ephemeral: true }));
  },
});

export const announcementsModule = defineModule({
  name: 'announcements',
  description: 'Ogłoszenia: kreator, szkice, planowanie, ping, crosspost',
  commands: [announceCommand],
  jobs: [defineJob({ name: 'scheduled', intervalMs: 60_000, runOnStart: true, run: publishDue })],
  components: [
    defineComponent({
      id: 'announce:create',
      type: 'modal',
      access: 'admin',
      async run(interaction, args, { client }) {
        await interaction.deferReply({ flags: ['Ephemeral'] });
        const data = await readContent(interaction);
        const ping = interaction.fields.getStringSelectValues('ping')[0];
        const a = await prisma.announcement.create({
          data: {
            ...data,
            ping: ping && ping !== 'none' ? ping : null,
            channelId: args[0] && args[0] !== '0' ? args[0] : null,
            authorId: interaction.user.id,
          },
        });
        const payload = await editorPayload(client, a, '📝 Szkic zapisany – sprawdź podgląd i opublikuj.');
        await interaction.editReply(payload);
      },
    }),
    defineComponent({
      id: 'announce:open',
      type: 'select',
      access: 'admin',
      async run(interaction, _args, { client }) {
        await interaction.update(
          await editorPayload(client, await getAnnouncement(Number(interaction.values[0]))),
        );
      },
    }),
    defineComponent({
      id: 'announce:ping',
      type: 'select',
      access: 'admin',
      async run(interaction, args, { client }) {
        const v = interaction.values[0];
        const a = await prisma.announcement.update({
          where: { id: idOf(args) },
          data: { ping: v && v !== 'none' ? v : null },
        });
        await interaction.update(await editorPayload(client, a));
      },
    }),
    defineComponent({
      id: 'announce:pingRole',
      type: 'select',
      access: 'admin',
      async run(interaction, args, { client }) {
        const role = interaction.values[0];
        const a = await prisma.announcement.update({
          where: { id: idOf(args) },
          data: { ping: role ? `role:${role}` : null },
        });
        await interaction.update(await editorPayload(client, a));
      },
    }),
    defineComponent({
      id: 'announce:channel',
      type: 'select',
      access: 'admin',
      async run(interaction, args, { client }) {
        if (!interaction.isChannelSelectMenu()) return;
        const channel = interaction.channels.first();
        const me = interaction.guild.members.me;
        if (
          !channel ||
          !('permissionsFor' in channel) ||
          !me ||
          !channel.permissionsFor(me)?.has(['ViewChannel', 'SendMessages', 'AttachFiles'])
        ) {
          throw new UserError('Bot nie może pisać na tym kanale.');
        }
        const a = await prisma.announcement.update({
          where: { id: idOf(args) },
          data: { channelId: channel.id },
        });
        await interaction.update(await editorPayload(client, a));
      },
    }),
    defineComponent({
      id: 'announce:publish',
      type: 'button',
      access: 'admin',
      async run(interaction, args, { client }) {
        await interaction.deferUpdate();
        const a = await publishAnnouncement(client, idOf(args), interaction.user.id);
        await interaction.editReply(await editorPayload(client, a, `🚀 Opublikowano na <#${a.channelId}>!`));
      },
    }),
    defineComponent({
      id: 'announce:schedule',
      type: 'button',
      access: 'admin',
      async run(interaction, args) {
        await interaction.showModal(
          new Form(`announce:scheduleSubmit:${idOf(args)}`, 'Zaplanuj publikację')
            .info('Czas polski (Europe/Warsaw).')
            .text({ id: 'when', label: 'Kiedy?', max: 40, placeholder: WHEN_HINT })
            .build(),
        );
      },
    }),
    defineComponent({
      id: 'announce:scheduleSubmit',
      type: 'modal',
      access: 'admin',
      async run(interaction, args, { client }) {
        const when = parseWhen(interaction.fields.getTextInputValue('when'));
        if (!when) throw new UserError(`Nie rozumiem daty. Przykłady: ${WHEN_HINT}`);
        if (when.getTime() < Date.now() + 60_000)
          throw new UserError('Termin musi być co najmniej minutę w przyszłości.');
        if (when.getTime() > Date.now() + 60 * 86_400_000)
          throw new UserError('Można planować maksymalnie 60 dni do przodu.');
        const a = await prisma.announcement.update({
          where: { id: idOf(args) },
          data: { status: 'SCHEDULED', publishAt: when },
        });
        await audit(client, {
          action: 'announcement.schedule',
          actorId: interaction.user.id,
          summary: `Zaplanowano ogłoszenie **${a.title}** na ${discordTime(when, 'f')}`,
        });
        const payload = await editorPayload(client, a, `⏰ Zaplanowano na ${discordTime(when, 'f')}.`);
        if (interaction.isFromMessage()) await interaction.update(payload);
        else await interaction.reply({ ...payload, flags: ['IsComponentsV2', 'Ephemeral'] });
      },
    }),
    defineComponent({
      id: 'announce:unschedule',
      type: 'button',
      access: 'admin',
      async run(interaction, args, { client }) {
        const a = await prisma.announcement.update({
          where: { id: idOf(args) },
          data: { status: 'DRAFT', publishAt: null },
        });
        await interaction.update(
          await editorPayload(client, a, 'Plan anulowany – ogłoszenie wróciło do szkiców.'),
        );
      },
    }),
    defineComponent({
      id: 'announce:edit',
      type: 'button',
      access: 'admin',
      async run(interaction, args) {
        const a = await getAnnouncement(idOf(args));
        await interaction.showModal(
          contentModal(
            `announce:editSubmit:${a.id}`,
            a.status === 'PUBLISHED' ? 'Edycja opublikowanego' : 'Edycja ogłoszenia',
            a,
          ),
        );
      },
    }),
    defineComponent({
      id: 'announce:editSubmit',
      type: 'modal',
      access: 'admin',
      async run(interaction, args, { client }) {
        await interaction.deferUpdate();
        const a = await prisma.announcement.update({
          where: { id: idOf(args) },
          data: await readContent(interaction),
        });
        if (a.status === 'PUBLISHED') await updatePublished(client, a);
        await interaction.editReply(
          await editorPayload(
            client,
            a,
            a.status === 'PUBLISHED' ? '✏️ Zaktualizowano opublikowaną wiadomość.' : '✏️ Zapisano zmiany.',
          ),
        );
      },
    }),
    defineComponent({
      id: 'announce:delete',
      type: 'button',
      access: 'admin',
      async run(interaction, args) {
        const a = await getAnnouncement(idOf(args));
        await interaction.reply(
          v2(
            card({
              tone: 'error',
              emoji: 'shield_x',
              title: `Usunąć ogłoszenie #${a.id}?`,
              description:
                a.status === 'PUBLISHED'
                  ? 'Wiadomość zniknie z kanału. Tego nie da się cofnąć.'
                  : 'Szkic zostanie usunięty.',
              timestamp: false,
            }).buttons(
              button(`announce:deleteConfirm:${a.id}`, 'Tak, usuń', { style: 'danger', emoji: 'shield_x' }),
            ),
            { ephemeral: true },
          ),
        );
      },
    }),
    defineComponent({
      id: 'announce:deleteConfirm',
      type: 'button',
      access: 'admin',
      async run(interaction, args, { client }) {
        const a = await getAnnouncement(idOf(args));
        if (a.status === 'PUBLISHED' && a.channelId && a.messageId) {
          const channel = await client.channels.fetch(a.channelId).catch(() => null);
          if (channel?.isTextBased()) await channel.messages.delete(a.messageId).catch(() => undefined);
        }
        await prisma.announcement.delete({ where: { id: a.id } });
        await audit(client, {
          action: 'announcement.delete',
          actorId: interaction.user.id,
          summary: `Usunięto ogłoszenie **${a.title}**`,
        });
        await interaction.update(
          v2Message(card({ tone: 'success', title: `Usunięto ogłoszenie #${a.id}`, timestamp: false })),
        );
      },
    }),
  ],
});
