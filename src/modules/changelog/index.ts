import {
  ChannelType,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type AutocompleteInteraction,
} from 'discord.js';
import type { RoadmapStatus } from '../../generated/prisma/client.js';
import type { ZxClient } from '../../client.js';
import { prisma } from '../../db/prisma.js';
import { audit } from '../../core/audit.js';
import { UserError } from '../../core/errors.js';
import { isAdmin, isStaff } from '../../core/permissions.js';
import { defineCommand, defineComponent, defineModule } from '../../core/types.js';
import { githubEvents } from '../../http/github-events.js';
import { pageButtons } from '../../ui/builders/paginator.js';
import { Form } from '../../ui/builders/modal.js';
import { v2, v2Message } from '../../ui/builders/payload.js';
import { card } from '../../ui/components/card.js';
import { e } from '../../ui/emojis.js';
import { discordTime, truncate } from '../../utils/format.js';
import { onRelease } from './github.js';
import {
  PROJECT_RE,
  SECTIONS,
  SECTION_KEYS,
  VERSION_RE,
  changelogPanel,
  createDraft,
  draftPayload,
  fromLines,
  getProject,
  publishChangelog,
  sectionsOf,
  toLines,
  type Sections,
} from './service.js';

const ROADMAP: Record<RoadmapStatus, { label: string; icon: string }> = {
  PLANNED: { label: 'W planach', icon: '🗓️' },
  IN_PROGRESS: { label: 'W trakcie', icon: '🛠️' },
  DONE: { label: 'Gotowe', icon: '✅' },
};

async function projectAutocomplete(interaction: AutocompleteInteraction) {
  const focused = interaction.options.getFocused(true);
  const q = String(focused.value);
  if (focused.name === 'pozycja') {
    const rows = await prisma.roadmapItem.findMany({
      where: { title: { contains: q, mode: 'insensitive' } },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });
    return interaction.respond(
      rows.map((r) => ({
        name: truncate(`${ROADMAP[r.status].icon} ${r.project}: ${r.title}`, 100),
        value: String(r.id),
      })),
    );
  }
  const rows = await prisma.changelogProject.findMany({
    where: { name: { contains: q, mode: 'insensitive' } },
    take: 25,
  });
  return interaction.respond(rows.map((r) => ({ name: r.name, value: r.name })));
}

function entryModal(customId: string, title: string, s: Sections, description?: string | null) {
  const form = new Form(customId, title).text({
    id: 'description',
    label: 'Krótki opis wersji (opcjonalnie)',
    required: false,
    max: 300,
    value: description ?? undefined,
  });
  for (const k of SECTION_KEYS) {
    form.text({
      id: k,
      label: `${SECTIONS[k].icon} ${SECTIONS[k].label}`,
      description: 'Każda zmiana w nowej linii',
      paragraph: true,
      required: false,
      max: 1500,
      value: s[k].length ? fromLines(s[k]) : undefined,
    });
  }
  return form.build();
}

const readSections = (get: (id: string) => string): Sections => ({
  added: toLines(get('added')),
  changed: toLines(get('changed')),
  fixed: toLines(get('fixed')),
  removed: toLines(get('removed')),
});

async function historyPage(project: string, page: number) {
  const entries = await prisma.changelogEntry.findMany({
    where: { project, status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    take: 50,
  });
  if (!entries.length) throw new UserError(`Projekt **${project}** nie ma jeszcze opublikowanych wersji.`);
  const p = Math.min(Math.max(page, 0), entries.length - 1);
  return changelogPanel(entries[p]!).buttons(...pageButtons(`changelog:page:${project}`, p, entries.length));
}

const changelogCommand = defineCommand({
  data: new SlashCommandBuilder()
    .setName('changelog')
    .setDescription('Changelog projektów')
    .addSubcommand((s) =>
      s
        .setName('historia')
        .setDescription('Historia wersji projektu')
        .addStringOption((o) =>
          o.setName('projekt').setDescription('Projekt').setRequired(true).setAutocomplete(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('nowy')
        .setDescription('[Obsługa] Nowa wersja (szkic z podglądem)')
        .addStringOption((o) =>
          o.setName('projekt').setDescription('Projekt').setRequired(true).setAutocomplete(true),
        )
        .addStringOption((o) =>
          o.setName('wersja').setDescription('np. v1.2.0').setRequired(true).setMaxLength(30),
        ),
    )
    .addSubcommand((s) => s.setName('szkice').setDescription('[Obsługa] Nieopublikowane wpisy'))
    .addSubcommandGroup((g) =>
      g
        .setName('projekt')
        .setDescription('[Admin] Projekty')
        .addSubcommand((s) =>
          s
            .setName('dodaj')
            .setDescription('Dodaj lub zmień projekt')
            .addStringOption((o) =>
              o.setName('nazwa').setDescription('np. zxCode Bot').setRequired(true).setMaxLength(40),
            )
            .addStringOption((o) => o.setName('opis').setDescription('Krótki opis').setMaxLength(200))
            .addStringOption((o) =>
              o.setName('repo').setDescription('GitHub: właściciel/repo – release utworzy szkic'),
            )
            .addRoleOption((o) =>
              o.setName('rola').setDescription('Rola pingowana przy nowej wersji (subskrypcja = rola)'),
            )
            .addChannelOption((o) =>
              o
                .setName('kanal')
                .setDescription('Własny kanał changelogu projektu')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
            ),
        )
        .addSubcommand((s) =>
          s
            .setName('usun')
            .setDescription('Usuń projekt')
            .addStringOption((o) =>
              o.setName('projekt').setDescription('Projekt').setRequired(true).setAutocomplete(true),
            ),
        )
        .addSubcommand((s) => s.setName('lista').setDescription('Lista projektów')),
    ),
  autocomplete: projectAutocomplete,

  async run(interaction, { client, config }) {
    const group = interaction.options.getSubcommandGroup();
    const sub = interaction.options.getSubcommand();
    const member = interaction.member;

    if (!group && sub === 'historia') {
      const project = (await getProject(interaction.options.getString('projekt', true))).name;
      return interaction.reply(v2(await historyPage(project, 0), { ephemeral: true }));
    }
    if (!isStaff(member, config))
      throw new UserError('Ta akcja jest dostępna tylko dla obsługi.', 'Brak uprawnień');

    if (!group && sub === 'nowy') {
      const project = (await getProject(interaction.options.getString('projekt', true))).name;
      const version = interaction.options.getString('wersja', true).trim();
      if (!VERSION_RE.test(version))
        throw new UserError('Wersja może zawierać litery, cyfry, kropki i myślniki, np. `v1.2.0`.');
      const exists = await prisma.changelogEntry.findUnique({
        where: { project_version: { project, version } },
      });
      if (exists) throw new UserError(`Wersja ${version} już istnieje (#${exists.id}).`);
      return interaction.showModal(
        entryModal(`changelog:create:${project}:${version}`, `${project} ${version}`.slice(0, 45), {
          added: [],
          changed: [],
          fixed: [],
          removed: [],
        }),
      );
    }

    if (!group && sub === 'szkice') {
      const drafts = await prisma.changelogEntry.findMany({
        where: { status: { not: 'PUBLISHED' } },
        orderBy: { createdAt: 'desc' },
        take: 25,
      });
      const panel = card({
        tone: 'info',
        emoji: 'git_branch',
        title: `Szkice changelogu (${drafts.length})`,
        description:
          drafts
            .map(
              (d) =>
                `**#${d.id}** ${d.project} ${d.version}${d.source === 'GITHUB' ? ' • GitHub' : ''} – ${discordTime(d.createdAt, 'R')}`,
            )
            .join('\n') || 'Brak szkiców.',
        timestamp: false,
      });
      if (drafts.length) {
        panel.select(
          new StringSelectMenuBuilder()
            .setCustomId('changelog:open')
            .setPlaceholder('✏️ Otwórz szkic…')
            .addOptions(
              drafts.map((d) =>
                new StringSelectMenuOptionBuilder()
                  .setValue(String(d.id))
                  .setLabel(truncate(`#${d.id} ${d.project} ${d.version}`, 100)),
              ),
            ),
        );
      }
      return interaction.reply(v2(panel, { ephemeral: true }));
    }

    // grupa „projekt” – administracja
    if (!isAdmin(member, config)) throw new UserError('Projektami zarządza administracja.', 'Brak uprawnień');
    if (sub === 'lista') {
      const projects = await prisma.changelogProject.findMany({ orderBy: { name: 'asc' } });
      const counts = await prisma.changelogSubscription.groupBy({ by: ['project'], _count: true });
      return interaction.reply(
        v2(
          card({
            tone: 'brand',
            emoji: 'git_branch',
            title: `Projekty (${projects.length})`,
            description:
              projects
                .map(
                  (p) =>
                    `**${p.name}**${p.description ? ` – ${p.description}` : ''}\n-# ${[
                      p.repo ? `GitHub: \`${p.repo}\`` : null,
                      p.roleId
                        ? `rola <@&${p.roleId}>`
                        : `subskrybenci DM: ${counts.find((c) => c.project === p.name)?._count ?? 0}`,
                      p.channelId ? `<#${p.channelId}>` : null,
                    ]
                      .filter(Boolean)
                      .join(' • ')}`,
                )
                .join('\n') || 'Brak projektów.',
            timestamp: false,
          }),
          { ephemeral: true },
        ),
      );
    }
    if (sub === 'usun') {
      const name = interaction.options.getString('projekt', true);
      await prisma.changelogProject.delete({ where: { name } }).catch(() => {
        throw new UserError('Nie ma takiego projektu.');
      });
      await audit(client, {
        action: 'changelog.project.delete',
        actorId: member.id,
        summary: `Usunięto projekt **${name}** (historia wersji zostaje)`,
      });
      return interaction.reply(
        v2(card({ tone: 'success', title: `Usunięto projekt ${name}`, timestamp: false }), {
          ephemeral: true,
        }),
      );
    }

    const name = interaction.options.getString('nazwa', true).trim();
    if (!PROJECT_RE.test(name)) throw new UserError('Nazwa: 2–40 znaków (litery, cyfry, spacje, . _ -).');
    const repoRaw = interaction.options
      .getString('repo')
      ?.trim()
      .replace(/^https?:\/\/github\.com\//i, '')
      .replace(/\.git$/, '')
      .toLowerCase();
    if (repoRaw && !/^[\w.-]+\/[\w.-]+$/.test(repoRaw))
      throw new UserError('Repozytorium w formacie `właściciel/nazwa`.');
    const role = interaction.options.getRole('rola');
    if (
      role &&
      interaction.guild.members.me &&
      role.position >= interaction.guild.members.me.roles.highest.position
    ) {
      throw new UserError('Rola musi być niżej niż rola bota (bot ją nadaje przy subskrypcji).');
    }
    const data = {
      description: interaction.options.getString('opis'),
      repo: repoRaw || null,
      roleId: role?.id ?? null,
      channelId: interaction.options.getChannel('kanal')?.id ?? null,
    };
    const project = await prisma.changelogProject
      .upsert({ where: { name }, create: { name, ...data }, update: data })
      .catch(() => {
        throw new UserError('To repozytorium jest już przypisane do innego projektu.');
      });
    await audit(client, {
      action: 'changelog.project.save',
      actorId: member.id,
      summary: `Zapisano projekt **${name}**`,
    });
    return interaction.reply(
      v2(
        card({
          tone: 'success',
          emoji: 'git_branch',
          title: `Projekt ${project.name} zapisany`,
          fields: [
            {
              emoji: 'git_branch',
              label: 'GitHub',
              value: project.repo
                ? `\`${project.repo}\` – webhook: \`/webhooks/github\`, zdarzenie „Releases”`
                : null,
            },
            {
              emoji: 'notification',
              label: 'Subskrypcja',
              value: project.roleId ? `rola <@&${project.roleId}>` : 'powiadomienia w DM',
            },
            {
              emoji: 'discord',
              label: 'Kanał',
              value: project.channelId ? `<#${project.channelId}>` : 'domyślny z /config',
            },
          ],
          timestamp: false,
        }),
        { ephemeral: true },
      ),
    );
  },
});

const roadmapCommand = defineCommand({
  data: new SlashCommandBuilder()
    .setName('roadmapa')
    .setDescription('Plany rozwoju projektów')
    .addSubcommand((s) =>
      s
        .setName('pokaz')
        .setDescription('Pokaż roadmapę')
        .addStringOption((o) => o.setName('projekt').setDescription('Projekt').setAutocomplete(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('dodaj')
        .setDescription('[Obsługa] Nowa pozycja')
        .addStringOption((o) =>
          o.setName('projekt').setDescription('Projekt').setRequired(true).setAutocomplete(true),
        )
        .addStringOption((o) =>
          o.setName('tytul').setDescription('Co planujecie').setRequired(true).setMaxLength(120),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('status')
        .setDescription('[Obsługa] Zmień status pozycji')
        .addStringOption((o) =>
          o.setName('pozycja').setDescription('Pozycja').setRequired(true).setAutocomplete(true),
        )
        .addStringOption((o) =>
          o
            .setName('status')
            .setDescription('Nowy status')
            .setRequired(true)
            .addChoices(
              ...(Object.keys(ROADMAP) as RoadmapStatus[]).map((k) => ({
                name: `${ROADMAP[k].icon} ${ROADMAP[k].label}`,
                value: k,
              })),
            ),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('usun')
        .setDescription('[Obsługa] Usuń pozycję')
        .addStringOption((o) =>
          o.setName('pozycja').setDescription('Pozycja').setRequired(true).setAutocomplete(true),
        ),
    ),
  autocomplete: projectAutocomplete,

  async run(interaction, { config }) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'pokaz') {
      const project = interaction.options.getString('projekt');
      const items = await prisma.roadmapItem.findMany({
        where: project ? { project } : {},
        orderBy: { createdAt: 'asc' },
      });
      const panel = card({
        tone: 'brand',
        emoji: 'calendar',
        title: `Roadmapa${project ? ` • ${project}` : ''}`,
        timestamp: false,
      });
      if (!items.length)
        return interaction.reply(v2(panel.text('-# Nic tu jeszcze nie ma.'), { ephemeral: true }));
      for (const status of ['IN_PROGRESS', 'PLANNED', 'DONE'] as RoadmapStatus[]) {
        const list = items.filter((i) => i.status === status).slice(-15);
        if (!list.length) continue;
        panel
          .separator(false)
          .text(
            `### ${ROADMAP[status].icon} ${ROADMAP[status].label}\n${list.map((i) => `${status === 'DONE' ? `~~${i.title}~~` : i.title}${project ? '' : ` -# ${i.project}`}`).join('\n')}`,
          );
      }
      return interaction.reply(v2(panel, { ephemeral: true }));
    }

    if (!isStaff(interaction.member, config))
      throw new UserError('Roadmapą zarządza obsługa.', 'Brak uprawnień');
    if (sub === 'dodaj') {
      const project = (await getProject(interaction.options.getString('projekt', true))).name;
      const item = await prisma.roadmapItem.create({
        data: { project, title: interaction.options.getString('tytul', true) },
      });
      return interaction.reply(
        v2(
          card({
            tone: 'success',
            emoji: 'calendar',
            title: 'Dodano do roadmapy',
            description: `${ROADMAP.PLANNED.icon} **${item.title}** • ${project}`,
            timestamp: false,
          }),
          { ephemeral: true },
        ),
      );
    }
    const id = Number(interaction.options.getString('pozycja', true));
    const item = Number.isSafeInteger(id) ? await prisma.roadmapItem.findUnique({ where: { id } }) : null;
    if (!item) throw new UserError('Nie ma takiej pozycji.');
    if (sub === 'usun') {
      await prisma.roadmapItem.delete({ where: { id } });
      return interaction.reply(
        v2(card({ tone: 'success', title: `Usunięto: ${item.title}`, timestamp: false }), {
          ephemeral: true,
        }),
      );
    }
    const status = interaction.options.getString('status', true) as RoadmapStatus;
    await prisma.roadmapItem.update({ where: { id }, data: { status } });
    return interaction.reply(
      v2(
        card({
          tone: 'success',
          title: `${ROADMAP[status].icon} ${item.title}`,
          description: `Status: **${ROADMAP[status].label}**`,
          timestamp: false,
        }),
        { ephemeral: true },
      ),
    );
  },
});

let githubBound = false;

export const changelogModule = defineModule({
  name: 'changelog',
  description: 'Changelog projektów, subskrypcje, roadmapa, release z GitHuba',
  commands: [changelogCommand, roadmapCommand],
  async onReady(client: ZxClient) {
    if (githubBound) return;
    githubBound = true;
    githubEvents.on('release', (payload) => void onRelease(client, payload as never));
  },
  components: [
    defineComponent({
      id: 'changelog:create',
      type: 'modal',
      access: 'staff',
      async run(interaction, args) {
        const [project, version] = [args[0]!, args.slice(1).join(':')];
        await getProject(project);
        const sections = readSections((id) => interaction.fields.getTextInputValue(id));
        if (!SECTION_KEYS.some((k) => sections[k].length))
          throw new UserError('Wpisz przynajmniej jedną zmianę.');
        const entry = await createDraft({
          project,
          version,
          description: interaction.fields.getTextInputValue('description').trim() || null,
          sections: sections as never,
          authorId: interaction.user.id,
        });
        await interaction.reply({
          ...draftPayload(entry, '📝 Szkic zapisany – tak będzie wyglądał wpis.'),
          flags: ['IsComponentsV2', 'Ephemeral'],
        });
      },
    }),
    defineComponent({
      id: 'changelog:open',
      type: 'select',
      access: 'staff',
      async run(interaction) {
        const entry = await prisma.changelogEntry.findUnique({
          where: { id: Number(interaction.values[0]) },
        });
        if (!entry) throw new UserError('Ten wpis nie istnieje.');
        await interaction.update(draftPayload(entry));
      },
    }),
    defineComponent({
      id: 'changelog:publish',
      type: 'button',
      access: 'staff',
      async run(interaction, args, { client }) {
        await interaction.deferUpdate();
        const entry = await publishChangelog(client, Number(args[0]), interaction.user.id);
        await interaction.editReply(
          draftPayload(entry, `🚀 Opublikowano na <#${entry.channelId}>. Subskrybenci dostają DM.`),
        );
      },
    }),
    defineComponent({
      id: 'changelog:edit',
      type: 'button',
      access: 'staff',
      async run(interaction, args) {
        const entry = await prisma.changelogEntry.findUnique({ where: { id: Number(args[0]) } });
        if (!entry || entry.status === 'PUBLISHED') throw new UserError('Można edytować tylko szkic.');
        await interaction.showModal(
          entryModal(
            `changelog:editSubmit:${entry.id}`,
            `${entry.project} ${entry.version}`.slice(0, 45),
            sectionsOf(entry),
            entry.description,
          ),
        );
      },
    }),
    defineComponent({
      id: 'changelog:editSubmit',
      type: 'modal',
      access: 'staff',
      async run(interaction, args) {
        const entry = await prisma.changelogEntry.update({
          where: { id: Number(args[0]) },
          data: {
            description: interaction.fields.getTextInputValue('description').trim() || null,
            sections: readSections((id) => interaction.fields.getTextInputValue(id)) as never,
          },
        });
        const payload = draftPayload(entry, '✏️ Zapisano zmiany.');
        if (interaction.isFromMessage()) await interaction.update(payload);
        else await interaction.reply({ ...payload, flags: ['IsComponentsV2', 'Ephemeral'] });
      },
    }),
    defineComponent({
      id: 'changelog:delete',
      type: 'button',
      access: 'staff',
      async run(interaction, args, { client }) {
        const entry = await prisma.changelogEntry.findUnique({ where: { id: Number(args[0]) } });
        if (!entry || entry.status === 'PUBLISHED') throw new UserError('Można odrzucić tylko szkic.');
        await prisma.changelogEntry.delete({ where: { id: entry.id } });
        await audit(client, {
          action: 'changelog.discard',
          actorId: interaction.user.id,
          summary: `Odrzucono szkic **${entry.project} ${entry.version}**`,
        });
        await interaction.update(
          v2Message(
            card({
              tone: 'neutral',
              emoji: 'shield_x',
              title: `Odrzucono szkic ${entry.project} ${entry.version}`,
              timestamp: false,
            }),
          ),
        );
      },
    }),
    defineComponent({
      id: 'changelog:page',
      type: 'button',
      async run(interaction, args) {
        // customId: changelog:page:<projekt>:<strona>:<kierunek>
        const page = Number(args[args.length - 2]);
        const project = args.slice(0, -2).join(':');
        await interaction.update(v2Message(await historyPage(project, page)));
      },
    }),
    defineComponent({
      id: 'changelog:sub',
      type: 'button',
      async run(interaction, args) {
        const project = await getProject(args.join(':'));
        if (project.roleId) {
          const has = interaction.member.roles.cache.has(project.roleId);
          if (has)
            await interaction.member.roles.remove(project.roleId, 'Rezygnacja z powiadomień changelogu');
          else await interaction.member.roles.add(project.roleId, 'Subskrypcja changelogu');
          return interaction.reply(
            v2(
              card({
                tone: has ? 'neutral' : 'success',
                emoji: 'notification',
                title: has ? 'Wyłączono powiadomienia' : 'Włączono powiadomienia',
                description: `${has ? 'Nie dostaniesz już' : 'Dostaniesz'} pingu przy nowych wersjach **${project.name}** (rola <@&${project.roleId}>).`,
                timestamp: false,
              }),
              { ephemeral: true },
            ),
          );
        }
        const key = { userId_project: { userId: interaction.user.id, project: project.name } };
        const existing = await prisma.changelogSubscription.findUnique({ where: key });
        if (existing) await prisma.changelogSubscription.delete({ where: key });
        else
          await prisma.changelogSubscription.create({
            data: { userId: interaction.user.id, project: project.name },
          });
        return interaction.reply(
          v2(
            card({
              tone: existing ? 'neutral' : 'success',
              emoji: 'notification',
              title: existing ? 'Wyłączono powiadomienia' : 'Włączono powiadomienia',
              description: existing
                ? `Nie dostaniesz już DM o wersjach **${project.name}**.`
                : `Każdą nową wersję **${project.name}** dostaniesz w wiadomości prywatnej. ${e('rocket')}`,
              timestamp: false,
            }),
            { ephemeral: true },
          ),
        );
      },
    }),
  ],
});
