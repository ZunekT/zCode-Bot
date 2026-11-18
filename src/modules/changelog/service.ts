import type { ChangelogEntry, ChangelogProject, Prisma } from '../../generated/prisma/client.js';
import type { ZxClient } from '../../client.js';
import { prisma } from '../../db/prisma.js';
import { audit } from '../../core/audit.js';
import { getSendableChannel } from '../../core/channels.js';
import { getConfig } from '../../core/config-service.js';
import { UserError } from '../../core/errors.js';
import type { Panel } from '../../ui/builders/container.js';
import { button, linkButton } from '../../ui/builders/buttons.js';
import { v2Message } from '../../ui/builders/payload.js';
import { card, diffBlock, type DiffSign } from '../../ui/components/card.js';
import { discordTime } from '../../utils/format.js';
import { withLock } from '../../utils/locks.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('changelog');

export const SECTION_KEYS = ['added', 'changed', 'fixed', 'removed'] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];
export type Sections = Record<SectionKey, string[]>;

/** Prefiks linii w bloku ```diff: „+” zielony, „-” czerwony, „~” i „*” neutralne. */
export const SECTIONS: Record<SectionKey, { label: string; sign: DiffSign }> = {
  added: { label: 'Dodano', sign: '+' },
  changed: { label: 'Zmieniono', sign: '~' },
  fixed: { label: 'Naprawiono', sign: '*' },
  removed: { label: 'Usunięto', sign: '-' },
};

export const PROJECT_RE = /^[\p{L}\p{N} _.-]{2,40}$/u;
export const VERSION_RE = /^v?[\w.+-]{1,30}$/;

export const emptySections = (): Sections => ({ added: [], changed: [], fixed: [], removed: [] });

export function sectionsOf(entry: Pick<ChangelogEntry, 'sections'>): Sections {
  const raw = (entry.sections ?? {}) as Partial<Sections>;
  const out = emptySections();
  for (const k of SECTION_KEYS)
    out[k] = Array.isArray(raw[k]) ? raw[k]!.filter((x) => typeof x === 'string') : [];
  return out;
}

/** Linie z formularza -> lista punktów (usuwa punktory). */
export const toLines = (raw: string) =>
  raw
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*•+]|\d+[.)])\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 30);

export const fromLines = (lines: string[]) => lines.map((l) => `- ${l}`).join('\n');

/** Karta wersji (kanał changelogu, DM do subskrybentów, podgląd). */
export function changelogPanel(
  entry: ChangelogEntry,
  opts: { subscribeButton?: boolean; pingRoleId?: string | null } = {},
): Panel {
  const s = sectionsOf(entry);
  const used = SECTION_KEYS.filter((k) => s[k].length);
  const panel = card({
    tone: 'brand',
    emoji: 'rocket',
    title: `${entry.project} • ${entry.version}`,
    description:
      [opts.pingRoleId ? `<@&${opts.pingRoleId}>` : null, entry.description].filter(Boolean).join('\n') ||
      undefined,
    timestamp: false,
  });
  if (used.length) {
    // Jeden blok ```diff: + Dodano (zielone), ~ Zmieniono, * Naprawiono, - Usunięto (czerwone).
    const lines: [DiffSign, string][] = [];
    for (const k of used) for (const l of s[k]) lines.push([SECTIONS[k].sign, `${SECTIONS[k].label}: ${l}`]);
    let block = diffBlock(lines);
    while (block.length > 3200 && lines.length > 1) {
      lines.pop();
      block = diffBlock([...lines, [' ', '…']]);
    }
    panel.text(block);
  }
  const buttons = [
    ...(opts.subscribeButton
      ? [button(`changelog:sub:${entry.project}`, 'Powiadamiaj mnie', { emoji: 'notification' })]
      : []),
    ...(entry.releaseUrl ? [linkButton(entry.releaseUrl, 'Release na GitHubie', 'git_branch')] : []),
  ];
  if (buttons.length) panel.buttons(...buttons);
  return panel.footer(
    `${entry.source === 'GITHUB' ? 'GitHub release • ' : ''}${entry.publishedAt ? `Opublikowano ${discordTime(entry.publishedAt, 'D')}` : 'Szkic – niewidoczny dla innych'}`,
  );
}

/** Podgląd szkicu z przyciskami dla obsługi. */
export function draftPayload(entry: ChangelogEntry, notice?: string) {
  const controls = card({
    tone: entry.status === 'PUBLISHED' ? 'success' : 'info',
    emoji: 'tools',
    title: `Changelog #${entry.id} • ${entry.status === 'PUBLISHED' ? 'opublikowany' : 'szkic'}`,
    description: notice,
    timestamp: false,
  });
  if (entry.status !== 'PUBLISHED') {
    controls.buttons(
      button(`changelog:publish:${entry.id}`, 'Opublikuj', { style: 'success', emoji: 'rocket' }),
      button(`changelog:edit:${entry.id}`, 'Edytuj', { emoji: 'code_file' }),
      button(`changelog:delete:${entry.id}`, 'Odrzuć', { style: 'danger', emoji: 'shield_x' }),
    );
  }
  return v2Message([changelogPanel(entry, { subscribeButton: true }), controls]);
}

export async function getProject(name: string): Promise<ChangelogProject> {
  const p = await prisma.changelogProject.findUnique({ where: { name } });
  if (!p) throw new UserError(`Nie ma projektu „${name}”. Dodaj go: \`/changelog projekt dodaj\`.`);
  return p;
}

/** Publikacja: kanał projektu (ping roli), potem DM do subskrybentów w tle. */
export async function publishChangelog(
  client: ZxClient,
  id: number,
  actorId: string,
): Promise<ChangelogEntry> {
  const result = await withLock(`changelog:${id}`, async () => {
    const entry = await prisma.changelogEntry.findUnique({ where: { id } });
    if (!entry) throw new UserError('Ten wpis nie istnieje.');
    if (entry.status === 'PUBLISHED') throw new UserError('Ten wpis jest już opublikowany.');
    const s = sectionsOf(entry);
    if (!SECTION_KEYS.some((k) => s[k].length))
      throw new UserError('Wpis jest pusty – dodaj przynajmniej jedną zmianę.');

    const project = await prisma.changelogProject.findUnique({ where: { name: entry.project } });
    const config = await getConfig();
    const channel = await getSendableChannel(client, project?.channelId ?? config.changelogChannelId);
    if (!channel)
      throw new UserError('Ustaw kanał changelogu: `/config kanal typ:Changelog` (albo kanał projektu).');

    const published = await prisma.changelogEntry.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
    const panel = changelogPanel(published, { subscribeButton: true, pingRoleId: project?.roleId });
    const msg = await channel.send({
      ...v2Message(panel),
      allowedMentions: { roles: project?.roleId ? [project.roleId] : [] },
    });
    const saved = await prisma.changelogEntry.update({
      where: { id },
      data: { messageId: msg.id, channelId: msg.channelId },
    });
    await audit(client, {
      action: 'changelog.publish',
      actorId,
      summary: `Opublikowano changelog **${entry.project} ${entry.version}**`,
    });
    return saved;
  });
  if (!result) throw new UserError('Ten wpis jest właśnie publikowany.');
  void notifySubscribers(client, result);
  return result;
}

async function notifySubscribers(client: ZxClient, entry: ChangelogEntry) {
  const subs = await prisma.changelogSubscription.findMany({ where: { project: entry.project }, take: 500 });
  const { guildId } = await getConfig();
  const panel = () => {
    const p = changelogPanel(entry);
    if (entry.channelId && entry.messageId) {
      p.buttons(
        linkButton(
          `https://discord.com/channels/${guildId}/${entry.channelId}/${entry.messageId}`,
          'Zobacz na serwerze',
          'discord',
        ),
      );
    }
    return p;
  };
  let sent = 0;
  for (const s of subs) {
    const user = await client.users.fetch(s.userId).catch(() => null);
    if (
      await user?.send(v2Message(panel())).then(
        () => true,
        () => false,
      )
    )
      sent++;
    await new Promise((r) => setTimeout(r, 250)); // łagodnie dla limitów Discorda
  }
  if (subs.length)
    log.info(`Changelog ${entry.project} ${entry.version}: DM do ${sent}/${subs.length} subskrybentów`);
}

export async function createDraft(data: Prisma.ChangelogEntryCreateInput): Promise<ChangelogEntry> {
  const exists = await prisma.changelogEntry.findUnique({
    where: { project_version: { project: data.project, version: data.version } },
  });
  if (exists)
    throw new UserError(
      `Wersja **${data.version}** projektu **${data.project}** już istnieje (#${exists.id}).`,
    );
  return prisma.changelogEntry.create({ data });
}
