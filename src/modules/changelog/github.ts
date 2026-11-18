import type { ZxClient } from '../../client.js';
import { prisma } from '../../db/prisma.js';
import { getSendableChannel } from '../../core/channels.js';
import { getConfig } from '../../core/config-service.js';
import { createLogger } from '../../utils/logger.js';
import { createDraft, draftPayload, emptySections, type SectionKey, type Sections } from './service.js';

const log = createLogger('changelog:github');

const HEADING_KEYS: [RegExp, SectionKey][] = [
  [/(add|new|feat|dodan|now)/i, 'added'],
  [/(fix|bug|napraw|poprawk)/i, 'fixed'],
  [/(remov|delet|deprecat|usuni)/i, 'removed'],
  [/(chang|improv|updat|refactor|perf|zmian|zmieni|ulepsz)/i, 'changed'],
];

const PREFIX_KEYS: [RegExp, SectionKey][] = [
  [/^feat(\(.+?\))?!?:\s*/i, 'added'],
  [/^fix(\(.+?\))?!?:\s*/i, 'fixed'],
  [/^(remove|revert)(\(.+?\))?!?:\s*/i, 'removed'],
  [/^(refactor|perf|chore|docs|style|build|ci|test)(\(.+?\))?!?:\s*/i, 'changed'],
];

export function parseReleaseBody(body: string): Sections {
  const sections = emptySections();
  let current: SectionKey | null = null;
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      // „What's Changed” to ogólny nagłówek automatycznych notatek GitHuba – nie przesądza o sekcji.
      current = /what'?s changed/i.test(heading[1]!)
        ? null
        : (HEADING_KEYS.find(([re]) => re.test(heading[1]!))?.[1] ?? null);
      continue;
    }
    const bullet = line.match(/^[-*+•]\s+(.+)$/);
    if (!bullet) continue;
    // Automatyczne notatki GitHuba: „feat: X by @user in https://…/pull/12”
    let text = bullet[1]!
      .replace(/\s+by @[\w-]+ in https?:\/\/\S+$/i, '')
      .replace(/\*\*Full Changelog\*\*.*/i, '')
      .trim();
    let key: SectionKey = current ?? 'changed';
    // Prefiks commita („feat:”, „fix:”) jest dokładniejszy niż nagłówek sekcji.
    for (const [re, k] of PREFIX_KEYS) {
      if (re.test(text)) {
        text = text.replace(re, '');
        key = k;
        break;
      }
    }
    if (text) sections[key].push(text.charAt(0).toUpperCase() + text.slice(1));
  }
  return sections;
}

interface ReleasePayload {
  action?: string;
  release?: {
    tag_name?: string;
    name?: string;
    body?: string | null;
    html_url?: string;
    draft?: boolean;
    prerelease?: boolean;
  };
  repository?: { full_name?: string };
}

export async function onRelease(client: ZxClient, payload: ReleasePayload): Promise<void> {
  if (payload.action !== 'published' || !payload.release || payload.release.draft) return;
  const repo = payload.repository?.full_name?.toLowerCase();
  if (!repo) return;
  const project = await prisma.changelogProject.findUnique({ where: { repo } });
  if (!project) {
    log.debug(`Release z ${repo} – brak projektu z tym repozytorium`);
    return;
  }
  const version = (payload.release.tag_name ?? payload.release.name ?? '').slice(0, 30);
  if (!version) return;
  try {
    const entry = await createDraft({
      project: project.name,
      version,
      description:
        payload.release.name && payload.release.name !== version ? payload.release.name.slice(0, 200) : null,
      sections: parseReleaseBody(payload.release.body ?? '') as never,
      source: 'GITHUB',
      releaseUrl: payload.release.html_url ?? null,
    });
    const config = await getConfig();
    const channel =
      (await getSendableChannel(client, config.staffAlertChannelId)) ??
      (await getSendableChannel(client, config.logChannelId));
    await channel?.send(draftPayload(entry, `Nowy release **${repo}** – sprawdź i opublikuj.`));
    log.info(`Szkic changelogu z GitHuba: ${project.name} ${version}`);
  } catch (err) {
    log.warn(`Nie udało się utworzyć szkicu z release ${repo}@${version}`, err);
  }
}
