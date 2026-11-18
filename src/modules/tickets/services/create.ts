import {
  AttachmentBuilder,
  ChannelType,
  FileBuilder,
  type Attachment,
  type GuildMember,
  type ModalSubmitInteraction,
} from 'discord.js';
import type { FaqArticle, GuildConfig, Prisma, TicketCategory } from '../../../generated/prisma/client.js';
import type { ZxClient } from '../../../client.js';
import { prisma } from '../../../db/prisma.js';
import { UserError } from '../../../core/errors.js';
import { card } from '../../../ui/components/card.js';
import { linkButton } from '../../../ui/builders/buttons.js';
import { v2Message } from '../../../ui/builders/payload.js';
import { withLock } from '../../../utils/locks.js';
import { padNumber, slugify } from '../../../utils/format.js';
import { createLogger } from '../../../utils/logger.js';
import { ACTIVE_STATUSES, CATEGORIES, LIMITS } from '../constants.js';
import { parseTicketForm } from '../forms.js';
import { controlPanel, ticketNo } from '../panels.js';
import { getCategory, hasRoom, logTicket, ticketOverwrites } from './channel.js';
import { ticketChannels } from './store.js';

const log = createLogger('tickets:create');

export async function assertCanOpen(
  member: GuildMember,
  category: TicketCategory,
  config: GuildConfig,
): Promise<void> {
  const parent = await getCategory(member.guild, config.ticketCategoryId);
  if (!parent) {
    throw new UserError(
      'Tickety nie są jeszcze skonfigurowane. Administracja musi ustawić kategorię: `/config kategoria`.',
    );
  }
  if (!hasRoom(parent)) {
    throw new UserError(
      'Wszystkie miejsca na tickety są zajęte. Spróbuj ponownie za kilka minut.',
      'Brak miejsca',
    );
  }

  const open = await prisma.ticket.findMany({
    where: { userId: member.id, status: { in: ACTIVE_STATUSES } },
    select: { category: true, channelId: true },
  });
  const same = open.find((t) => t.category === category);
  if (open.filter((t) => t.category === category).length >= LIMITS.perUserPerCategory) {
    throw new UserError(
      `Masz już otwarty ticket w kategorii **${CATEGORIES[category].label}**${same?.channelId ? `: <#${same.channelId}>` : ''}.`,
      'Ticket już istnieje',
    );
  }
  if (open.length >= LIMITS.perUser) {
    throw new UserError(`Możesz mieć maksymalnie ${LIMITS.perUser} otwarte tickety naraz.`, 'Limit ticketów');
  }
}

async function suggestFaq(text: string): Promise<FaqArticle[]> {
  const articles = await prisma.faqArticle.findMany();
  const haystack = text.toLowerCase();
  return articles
    .map((a) => ({ a, score: a.keywords.filter((k) => k && haystack.includes(k.toLowerCase())).length }))
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, 3)
    .map((x) => x.a);
}

function attachmentFiles(files: Attachment[]) {
  const safe = files.slice(0, 10).map((f, i) => {
    const name = `${i + 1}-${f.name.replace(/[^\w.-]+/g, '_').slice(-60)}`;
    return {
      name,
      file: new AttachmentBuilder(f.url, { name }),
      isImage: !!f.contentType?.startsWith('image/'),
    };
  });
  return safe;
}

export async function createTicket(
  client: ZxClient,
  interaction: ModalSubmitInteraction<'cached'>,
  category: TicketCategory,
  config: GuildConfig,
): Promise<void> {
  await interaction.deferReply({ flags: ['Ephemeral'] });

  const result = await withLock(`ticket:create:${interaction.user.id}`, async () => {
    const member = interaction.member;
    await assertCanOpen(member, category, config);

    const form = parseTicketForm(category, interaction);
    const parent = (await getCategory(interaction.guild, config.ticketCategoryId))!;
    const faq = await suggestFaq(form.answers.map((a) => a.value).join(' '));
    const now = new Date();

    const ticket = await prisma.ticket.create({
      data: {
        userId: member.id,
        category,
        subject: form.subject.slice(0, 200) || null,
        formData: form.answers as unknown as Prisma.InputJsonValue,
        lastClientMsgAt: now,
        lastActivityAt: now,
      },
    });

    let channelId: string | null = null;
    try {
      const def = CATEGORIES[category];
      const channel = await interaction.guild.channels.create({
        name: `${def.channelPrefix}-${padNumber(ticket.id)}-${slugify(member.user.username, 16)}`,
        type: ChannelType.GuildText,
        parent: parent.id,
        topic: `Ticket ${ticketNo(ticket.id)} • ${def.label} • ${member.user.username} (${member.id})`,
        permissionOverwrites: ticketOverwrites(interaction.guild, ticket, config, 'active'),
        reason: `Ticket ${ticketNo(ticket.id)} od ${member.user.username}`,
      });
      channelId = channel.id;

      const control = await channel.send({
        ...v2Message(
          controlPanel(ticket, {
            avatarUrl: member.displayAvatarURL({ size: 128 }),
            staffRoleId: config.staffRoleId,
            faq,
            mention: true,
          }),
        ),
        allowedMentions: { users: [member.id], roles: config.staffRoleId ? [config.staffRoleId] : [] },
      });
      await control.pin().catch(() => undefined);

      // Załączniki z formularza – przesyłamy ponownie, bo linki z modala wygasają.
      if (form.files.length) {
        const files = attachmentFiles(form.files);
        const panel = card({
          tone: 'brand',
          emoji: 'cloud_upload',
          title: 'Załączniki od klienta',
          description: `${files.length} ${files.length === 1 ? 'plik' : files.length < 5 ? 'pliki' : 'plików'} z formularza`,
          timestamp: false,
        });
        const images = files.filter((f) => f.isImage);
        if (images.length) panel.gallery(images.map((f) => ({ url: `attachment://${f.name}` })));
        for (const f of files.filter((x) => !x.isImage)) {
          panel.container.addFileComponents(new FileBuilder().setURL(`attachment://${f.name}`));
        }
        await channel
          .send(v2Message(panel, { files: files.map((f) => f.file) }))
          .catch((err) => log.warn(`Nie udało się przesłać załączników ticketu #${ticket.id}`, err));
      }

      const saved = await prisma.ticket.update({
        where: { id: ticket.id },
        data: { channelId: channel.id, controlMessageId: control.id },
      });
      ticketChannels.set(channel.id, saved.id);

      await logTicket(
        client,
        config,
        card({
          tone: 'success',
          emoji: def.emoji,
          title: `Nowy ticket ${ticketNo(ticket.id)} • ${def.label}`,
          thumbnail: member.displayAvatarURL({ size: 128 }),
          fields: [
            { emoji: 'user', label: 'Klient', value: `<@${member.id}>` },
            { emoji: 'documentation', label: 'Temat', value: form.subject || null },
            { emoji: 'ticket', label: 'Kanał', value: `<#${channel.id}>` },
            {
              emoji: 'cloud_upload',
              label: 'Załączniki',
              value: form.files.length ? String(form.files.length) : null,
            },
          ],
        }),
      );

      return channel;
    } catch (err) {
      // Sprzątanie po nieudanym tworzeniu – nie zostawiamy „sierot”.
      await prisma.ticket.delete({ where: { id: ticket.id } }).catch(() => undefined);
      if (channelId) await interaction.guild.channels.delete(channelId).catch(() => undefined);
      throw err;
    }
  });

  if (!result) throw new UserError('Twój ticket jest właśnie tworzony – poczekaj chwilę.');

  await interaction.editReply(
    v2Message(
      card({
        tone: 'success',
        emoji: 'order_complete',
        title: 'Ticket utworzony!',
        description: `Twój prywatny kanał: ${result}\nObsługa odpowie najszybciej, jak to możliwe – dostaniesz wzmiankę, gdy ktoś przejmie zgłoszenie.`,
        timestamp: false,
      }).buttons(linkButton(result.url, 'Przejdź do ticketu', 'ticket')),
    ),
  );
}
