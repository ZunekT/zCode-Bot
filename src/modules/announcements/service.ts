import { AttachmentBuilder, ChannelType, type Attachment, type MessageMentionOptions } from 'discord.js';
import type { Announcement } from '../../generated/prisma/client.js';
import type { ZxClient } from '../../client.js';
import { prisma } from '../../db/prisma.js';
import { audit } from '../../core/audit.js';
import { getSendableChannel } from '../../core/channels.js';
import { getConfig } from '../../core/config-service.js';
import { UserError } from '../../core/errors.js';
import { Panel } from '../../ui/builders/container.js';
import { linkButton } from '../../ui/builders/buttons.js';
import { v2Message } from '../../ui/builders/payload.js';
import { e } from '../../ui/emojis.js';
import { withLock } from '../../utils/locks.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('announcements');
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export interface LinkButton {
  label: string;
  url: string;
}

export const linksOf = (a: Pick<Announcement, 'buttons'>): LinkButton[] =>
  Array.isArray(a.buttons) ? (a.buttons as unknown as LinkButton[]).filter((b) => b?.url) : [];

export function parseLinks(raw: string): LinkButton[] {
  const out: LinkButton[] = [];
  for (const line of raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)) {
    const [a, b] = line.includes('|') ? line.split('|').map((x) => x.trim()) : ['Link', line];
    const url = b ?? '';
    if (!/^https?:\/\/\S+$/i.test(url))
      throw new UserError(`Nieprawidłowy link: „${line}”. Format: \`Nazwa | https://…\``);
    out.push({ label: (a || 'Link').slice(0, 80), url });
  }
  if (out.length > 5) throw new UserError('Maksymalnie 5 linków.');
  return out;
}

export const linksText = (links: LinkButton[]) => links.map((l) => `${l.label} | ${l.url}`).join('\n');

export async function downloadImage(
  a: Attachment,
): Promise<{ imageData: Uint8Array<ArrayBuffer>; imageName: string; imageType: string }> {
  if (!a.contentType || !/^image\/(png|jpe?g|gif|webp)$/.test(a.contentType))
    throw new UserError('Obrazek musi być w formacie PNG, JPG, GIF lub WEBP.');
  if (a.size > MAX_IMAGE_BYTES) throw new UserError('Obrazek może mieć maksymalnie 8 MB.');
  const res = await fetch(a.url);
  if (!res.ok) throw new UserError('Nie udało się pobrać obrazka – spróbuj ponownie.');
  const ext = a.contentType.split('/')[1]!.replace('jpeg', 'jpg');
  return {
    imageData: new Uint8Array(await res.arrayBuffer()),
    imageName: `ogloszenie.${ext}`,
    imageType: a.contentType,
  };
}

export function pingText(ping: string | null): string | null {
  if (!ping) return null;
  if (ping === 'everyone') return '@everyone';
  if (ping === 'here') return '@here';
  if (ping.startsWith('role:')) return `<@&${ping.slice(5)}>`;
  return null;
}

export function pingMentions(ping: string | null): MessageMentionOptions {
  if (ping === 'everyone' || ping === 'here') return { parse: ['everyone'] };
  if (ping?.startsWith('role:')) return { roles: [ping.slice(5)] };
  return { parse: [] };
}

export function announcementPanel(
  a: Announcement,
  authorName: string,
): { panel: Panel; files: AttachmentBuilder[] } {
  const panel = new Panel({ tone: 'brand' });
  const ping = pingText(a.ping);
  if (ping) panel.text(ping);
  panel.title('announcement', a.title).text(a.content);
  const files: AttachmentBuilder[] = [];
  if (a.imageData && a.imageName) {
    files.push(new AttachmentBuilder(Buffer.from(a.imageData), { name: a.imageName }));
    panel.banner(`attachment://${a.imageName}`);
  }
  const links = linksOf(a);
  if (links.length) panel.buttons(...links.map((l) => linkButton(l.url, l.label)));
  panel.footer(`${e('logo')} ${authorName} • zxCode`);
  return { panel, files };
}

async function authorName(client: ZxClient, a: Announcement) {
  const config = await getConfig();
  const guild = client.guilds.cache.get(config.guildId);
  const member = await guild?.members.fetch(a.authorId).catch(() => null);
  return (
    member?.displayName ?? (await client.users.fetch(a.authorId).catch(() => null))?.username ?? 'zxCode'
  );
}

export async function renderAnnouncement(client: ZxClient, a: Announcement) {
  return announcementPanel(a, await authorName(client, a));
}

export async function publishAnnouncement(
  client: ZxClient,
  id: number,
  actorId: string,
): Promise<Announcement> {
  const result = await withLock(`announcement:${id}`, async () => {
    const a = await prisma.announcement.findUnique({ where: { id } });
    if (!a) throw new UserError('To ogłoszenie nie istnieje.');
    if (a.status === 'PUBLISHED') throw new UserError('To ogłoszenie jest już opublikowane.');
    const config = await getConfig();
    const channelId = a.channelId ?? config.announcementChannelId;
    const channel = await getSendableChannel(client, channelId);
    if (!channel)
      throw new UserError(
        'Ustaw kanał ogłoszeń (`/config kanal typ:Ogłoszenia`) albo wybierz kanał w edytorze.',
      );

    const { panel, files } = await renderAnnouncement(client, a);
    const msg = await channel.send({ ...v2Message(panel, { files }), allowedMentions: pingMentions(a.ping) });
    if (channel.type === ChannelType.GuildAnnouncement)
      await msg.crosspost().catch((err) => log.warn('Crosspost nieudany', err));

    const published = await prisma.announcement.update({
      where: { id },
      data: { status: 'PUBLISHED', messageId: msg.id, channelId: msg.channelId, publishedAt: new Date() },
    });
    await audit(client, {
      action: 'announcement.publish',
      actorId,
      targetId: msg.channelId,
      summary: `Opublikowano ogłoszenie **${a.title}** na <#${msg.channelId}>`,
    });
    return published;
  });
  if (!result) throw new UserError('To ogłoszenie jest właśnie publikowane.');
  return result;
}

export async function updatePublished(client: ZxClient, a: Announcement): Promise<void> {
  if (!a.channelId || !a.messageId) return;
  const channel = await getSendableChannel(client, a.channelId);
  if (!channel || !('messages' in channel)) throw new UserError('Kanał ogłoszenia już nie istnieje.');
  const msg = await channel.messages.fetch(a.messageId).catch(() => null);
  if (!msg) throw new UserError('Opublikowana wiadomość została usunięta.');
  const { panel, files } = await renderAnnouncement(client, a);
  // Edycja nie pinguje ponownie.
  await msg.edit({ ...v2Message(panel, { files }), attachments: [] });
}

export async function publishDue(client: ZxClient): Promise<void> {
  const due = await prisma.announcement.findMany({
    where: { status: 'SCHEDULED', publishAt: { lte: new Date() } },
  });
  for (const a of due) {
    try {
      await publishAnnouncement(client, a.id, a.authorId);
      log.info(`Opublikowano zaplanowane ogłoszenie #${a.id}`);
    } catch (err) {
      log.error(`Nie udało się opublikować ogłoszenia #${a.id}`, err);
      // Wracamy do szkicu, żeby nie próbować co minutę bez końca.
      await prisma.announcement.update({ where: { id: a.id }, data: { status: 'DRAFT' } });
    }
  }
}
