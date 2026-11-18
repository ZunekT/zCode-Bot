import { StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import type { FaqArticle, Ticket } from '../../generated/prisma/client.js';
import { Colors } from '../../config/constants.js';
import { Panel } from '../../ui/builders/container.js';
import { button, linkButton } from '../../ui/builders/buttons.js';
import { BANNER_URL } from '../../ui/assets.js';
import { badge, card, quote, stars } from '../../ui/components/card.js';
import { e, emojiComponent } from '../../ui/emojis.js';
import { discordTime, formatDuration, padNumber, truncate } from '../../utils/format.js';
import {
  CATEGORIES,
  CATEGORY_KEYS,
  CONTROL_ACTIONS,
  PRIORITIES,
  STATUS_LABELS,
  type ControlAction,
} from './constants.js';
import { answersOf } from './forms.js';

export const ticketNo = (id: number) => `#${padNumber(id)}`;

const PRIORITY_ACCENT = {
  LOW: Colors.success,
  NORMAL: Colors.brand,
  HIGH: 0xe67e22,
  URGENT: Colors.error,
} as const;

const statusLine = (t: Ticket) => badge(STATUS_LABELS[t.status]);
const priorityLine = (t: Ticket) => badge(PRIORITIES[t.priority].label);

export function categorySelect(): StringSelectMenuBuilder {
  return new StringSelectMenuBuilder()
    .setCustomId('ticket:category')
    .setPlaceholder('Wybierz kategorię zgłoszenia…')
    .addOptions(
      CATEGORY_KEYS.map((key) =>
        new StringSelectMenuOptionBuilder()
          .setValue(key)
          .setLabel(CATEGORIES[key].label)
          .setDescription(CATEGORIES[key].description)
          .setEmoji(emojiComponent(CATEGORIES[key].emoji)),
      ),
    );
}

export function publicPanel(): Panel {
  return new Panel({ tone: 'brand' })
    .banner(BANNER_URL)
    .title('support', 'Centrum pomocy zxCode')
    .text(
      'Chcesz zamówić bota, coś przestało działać albo masz pytanie? ' +
        'Otwórz ticket – porozmawiamy na prywatnym kanale, który widzisz tylko Ty i nasza obsługa.',
    )
    .separator()
    .text(
      `### Jak to działa?\n` +
        `\`1\` Wybierz kategorię z listy poniżej\n` +
        `\`2\` Wypełnij krótki formularz – możesz dodać pliki\n` +
        `\`3\` Rozmawiaj z nami na prywatnym kanale`,
    )
    .separator()
    .text(
      `### Kategorie\n` +
        CATEGORY_KEYS.map(
          (k) => `${e(CATEGORIES[k].emoji)} **${CATEGORIES[k].label}**\n-# ${CATEGORIES[k].description}`,
        ).join('\n'),
    )
    .select(categorySelect())
    .footer('Jeden ticket na kategorię • Nigdy nie podawaj haseł ani tokenów botów');
}

export function actionSelect(ticket: Ticket): StringSelectMenuBuilder {
  const actions: ControlAction[] = [
    ticket.claimedBy ? 'unclaim' : 'claim',
    'priority',
    'add',
    ...(ticket.participants.length ? (['remove'] as const) : []),
    'note',
    ...(ticket.orderId ? [] : (['order'] as const)),
    'remind',
    'close',
  ];
  return new StringSelectMenuBuilder()
    .setCustomId(`ticket:action:${ticket.id}`)
    .setPlaceholder('Zarządzaj ticketem…')
    .addOptions(
      actions.map((a) => {
        const def = CONTROL_ACTIONS[a];
        const description =
          a === 'priority'
            ? `Aktualny: ${PRIORITIES[ticket.priority].label}`
            : a === 'close' || !def.staff
              ? def.description
              : `${def.description} • obsługa`;
        return new StringSelectMenuOptionBuilder()
          .setValue(a)
          .setLabel(def.label)
          .setDescription(description)
          .setEmoji(emojiComponent(def.emoji));
      }),
    );
}

export function controlPanel(
  ticket: Ticket,
  opts: { avatarUrl: string; staffRoleId?: string | null; faq?: FaqArticle[]; mention?: boolean },
): Panel {
  const def = CATEGORIES[ticket.category];
  const answers = answersOf(ticket.formData);
  const perAnswer = Math.max(200, Math.floor(2400 / Math.max(answers.length, 1)));

  const greeting = opts.mention
    ? `Cześć <@${ticket.userId}>! Dziękujemy za zgłoszenie – ${opts.staffRoleId ? `<@&${opts.staffRoleId}>` : 'obsługa'} odpowie najszybciej, jak to możliwe.`
    : `Zgłoszenie od <@${ticket.userId}>`;

  const panel = new Panel({ accent: PRIORITY_ACCENT[ticket.priority] })
    .sectionWithThumbnail(
      `## ${e(def.emoji)} ${def.label} • ${ticketNo(ticket.id)}\n${greeting}`,
      opts.avatarUrl,
    )
    .separator()
    .text(
      [
        `**Status:** ${statusLine(ticket)}  ·  **Priorytet:** ${priorityLine(ticket)}`,
        `**Obsługa:** ${ticket.claimedBy ? `<@${ticket.claimedBy}>` : '_czeka na przejęcie_'}`,
        `**Otwarty:** ${discordTime(ticket.openedAt, 'f')} · ${discordTime(ticket.openedAt, 'R')}`,
        ...(ticket.participants.length
          ? [`**Dodani:** ${ticket.participants.map((id) => `<@${id}>`).join(', ')}`]
          : []),
      ].join('\n'),
    )
    .separator();

  if (answers.length) panel.text('### Formularz');
  for (const a of answers) panel.text(`**${a.label}**\n>>> ${truncate(a.value, perAnswer)}`);

  if (opts.faq?.length) {
    panel
      .separator()
      .text(
        `### Może to pomoże, zanim odpowiemy\n` +
          opts.faq
            .map((f) => `**${f.title}**\n-# ${truncate(f.content.replace(/\s+/g, ' '), 140)}`)
            .join('\n') +
          '\n-# Pełna odpowiedź: `/faq pokaz`',
      );
  }

  return panel
    .separator()
    .select(actionSelect(ticket))
    .footer('Opisz sprawę jak najdokładniej • Prosimy nie pingować obsługi');
}

export function closedPanel(
  ticket: Ticket,
  opts: { archived: boolean; transcriptUrl?: string | null },
): Panel {
  const panel = card({
    tone: 'neutral',
    emoji: 'lock',
    title: `Ticket ${ticketNo(ticket.id)} zamknięty`,
    description: opts.archived
      ? 'Kanał trafił do archiwum – widzi go tylko obsługa.'
      : 'Kanał zostanie usunięty za kilka sekund. Transkrypt jest zapisany.',
    fields: [
      { emoji: 'user', label: 'Zamknął', value: ticket.closedBy ? `<@${ticket.closedBy}>` : 'system' },
      { emoji: 'documentation', label: 'Powód', value: ticket.closeReason ?? 'brak' },
      {
        emoji: 'calendar',
        label: 'Czas trwania',
        value: ticket.closedAt ? formatDuration(ticket.closedAt.getTime() - ticket.openedAt.getTime()) : null,
      },
    ],
  });
  if (opts.archived) {
    panel.buttons(
      button(`ticket:reopen:${ticket.id}`, 'Otwórz ponownie', { style: 'success', emoji: 'unlock' }),
      button(`ticket:delete:${ticket.id}`, 'Usuń kanał', { style: 'danger', emoji: 'shield_x' }),
      ...(opts.transcriptUrl ? [linkButton(opts.transcriptUrl, 'Transkrypt', 'documentation')] : []),
    );
  }
  return panel;
}

export function closeSummaryCard(ticket: Ticket, ownerAvatar?: string) {
  const def = CATEGORIES[ticket.category];
  return card({
    tone: 'neutral',
    emoji: def.emoji,
    title: `Ticket ${ticketNo(ticket.id)} zamknięty • ${def.label}`,
    thumbnail: ownerAvatar,
    fields: [
      { emoji: 'user', label: 'Klient', value: `<@${ticket.userId}>` },
      { emoji: 'documentation', label: 'Temat', value: ticket.subject },
      { emoji: 'user_crown', label: 'Obsługa', value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : null },
      { emoji: 'lock', label: 'Zamknął', value: ticket.closedBy ? `<@${ticket.closedBy}>` : null },
      { emoji: 'checklist', label: 'Powód', value: ticket.closeReason },
      {
        emoji: 'calendar',
        label: 'Czas trwania',
        value: ticket.closedAt ? formatDuration(ticket.closedAt.getTime() - ticket.openedAt.getTime()) : null,
      },
    ],
  });
}

export function ratingSelect(ticketId: number): StringSelectMenuBuilder {
  const labels = ['Bardzo źle', 'Słabo', 'Przeciętnie', 'Dobrze', 'Rewelacja'];
  return new StringSelectMenuBuilder()
    .setCustomId(`ticket:rate:${ticketId}`)
    .setPlaceholder('Oceń obsługę…')
    .addOptions(
      [5, 4, 3, 2, 1].map((n) =>
        new StringSelectMenuOptionBuilder()
          .setValue(String(n))
          .setLabel(`${labels[n - 1]} · ${n}/5`)
          .setDescription(n === 5 ? 'Wszystko super!' : n === 1 ? 'Coś poszło bardzo nie tak' : `${n} z 5`)
          .setEmoji(emojiComponent('star')),
      ),
    );
}

export function closedDmPanel(ticket: Ticket, guildName: string): Panel {
  const def = CATEGORIES[ticket.category];
  return card({
    tone: 'brand',
    emoji: 'ticket',
    title: `Twój ticket ${ticketNo(ticket.id)} został zamknięty`,
    description: `Dziękujemy za kontakt z **${guildName}**!`,
    fields: [
      { emoji: def.emoji, label: 'Kategoria', value: def.label },
      { emoji: 'documentation', label: 'Temat', value: ticket.subject },
      { emoji: 'user_crown', label: 'Obsługa', value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : null },
      { emoji: 'lock', label: 'Powód zamknięcia', value: ticket.closeReason ?? 'brak' },
    ],
    timestamp: false,
  })
    .separator()
    .text(
      `### ${e('star')} Jak oceniasz naszą obsługę?\nTwoja opinia pomaga nam działać lepiej – zajmie to 10 sekund.`,
    )
    .select(ratingSelect(ticket.id))
    .footer('Zapis rozmowy znajdziesz w wiadomości poniżej');
}

export function ratedDmPanel(ticket: Ticket): Panel {
  return card({
    tone: 'success',
    emoji: 'order_complete',
    title: `Dziękujemy za ocenę ticketu ${ticketNo(ticket.id)}!`,
    description: `${stars(ticket.rating ?? 0)}${ticket.ratingComment ? `\n${quote(truncate(ticket.ratingComment, 500))}` : ''}`,
    footer: 'Do zobaczenia na zxCode',
  });
}

export function ratingLogCard(ticket: Ticket, avatarUrl?: string) {
  const rating = ticket.rating ?? 0;
  return card({
    tone: rating <= 2 ? 'error' : rating === 3 ? 'warning' : 'success',
    emoji: 'star',
    title: `Nowa opinia • ticket ${ticketNo(ticket.id)}`,
    description: stars(rating),
    thumbnail: avatarUrl,
    fields: [
      { emoji: 'user', label: 'Klient', value: `<@${ticket.userId}>` },
      {
        emoji: 'user_crown',
        label: 'Obsługa',
        value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'nikt nie przejął',
      },
      {
        emoji: CATEGORIES[ticket.category].emoji,
        label: 'Kategoria',
        value: CATEGORIES[ticket.category].label,
      },
    ],
    body: ticket.ratingComment ? quote(truncate(ticket.ratingComment, 1000)) : '-# Bez komentarza',
  });
}

export function slaAlertPanel(ticket: Ticket, staffRoleId: string | null, waitingMs: number): Panel {
  const def = CATEGORIES[ticket.category];
  return card({
    tone: 'warning',
    emoji: 'notification',
    title: `Ticket ${ticketNo(ticket.id)} czeka na odpowiedź`,
    description: `${staffRoleId ? `<@&${staffRoleId}> ` : ''}Klient czeka już **${formatDuration(waitingMs)}**.`,
    fields: [
      { emoji: 'user', label: 'Klient', value: `<@${ticket.userId}>` },
      { emoji: def.emoji, label: 'Kategoria', value: def.label },
      { emoji: 'lightning', label: 'Priorytet', value: priorityLine(ticket) },
      {
        emoji: 'user_crown',
        label: 'Obsługa',
        value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : '**nikt nie przejął**',
      },
      { emoji: 'ticket', label: 'Kanał', value: `<#${ticket.channelId}>` },
    ],
  });
}

export function closeWarningPanel(ticket: Ticket, closesAt: Date): Panel {
  return card({
    tone: 'warning',
    emoji: 'lightning',
    title: 'Czy sprawa jest nadal aktualna?',
    description:
      `<@${ticket.userId}>, nie dostaliśmy od Ciebie odpowiedzi.\n` +
      `Jeśli nic nie napiszesz, ticket zostanie automatycznie zamknięty **${discordTime(closesAt, 'R')}**.`,
    timestamp: false,
  }).buttons(
    button(`ticket:keepOpen:${ticket.id}`, 'Sprawa aktualna – zostaw otwarty', {
      style: 'success',
      emoji: 'unlock',
    }),
  );
}
