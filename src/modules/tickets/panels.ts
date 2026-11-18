import type { FaqArticle, Ticket } from '../../generated/prisma/client.js';
import { Panel } from '../../ui/builders/container.js';
import { button, linkButton } from '../../ui/builders/buttons.js';
import { BANNER_URL } from '../../ui/assets.js';
import { e } from '../../ui/emojis.js';
import { discordTime, formatDuration, padNumber, truncate } from '../../utils/format.js';
import { CATEGORIES, CATEGORY_KEYS, PRIORITIES, STATUS_LABELS } from './constants.js';
import { answersOf } from './forms.js';

export const ticketNo = (id: number) => `#${padNumber(id)}`;

/** Publiczny panel „Centrum pomocy” wysyłany przez /ticket panel. */
export function publicPanel(): Panel {
  const panel = new Panel({ tone: 'brand' })
    .banner(BANNER_URL)
    .title('support', 'Centrum pomocy zxCode')
    .text(
      'Potrzebujesz bota, masz problem albo pytanie? Wybierz kategorię i wypełnij krótki formularz – ' +
        'utworzymy prywatny kanał, w którym porozmawiasz z nami bezpośrednio.',
    )
    .separator();

  for (const key of CATEGORY_KEYS) {
    const def = CATEGORIES[key];
    panel.sectionWithButton(
      `${e(def.emoji)} **${def.label}**\n-# ${def.description}`,
      button(`ticket:open:${key}`, 'Otwórz', { style: key === 'ORDER' ? 'primary' : 'secondary' }),
    );
  }

  return panel
    .separator()
    .footer('Jeden ticket na kategorię • Nie podawaj haseł ani tokenów botów w tickecie');
}

/** Panel sterowania na początku kanału ticketu. */
export function controlPanel(
  ticket: Ticket,
  opts: { avatarUrl: string; staffRoleId?: string | null; faq?: FaqArticle[]; mention?: boolean },
): Panel {
  const def = CATEGORIES[ticket.category];
  const prio = PRIORITIES[ticket.priority];
  const answers = answersOf(ticket.formData);
  const perAnswer = Math.max(200, Math.floor(2400 / Math.max(answers.length, 1)));

  const mentions = opts.mention
    ? `<@${ticket.userId}>${opts.staffRoleId ? ` • <@&${opts.staffRoleId}>` : ''}\n`
    : '';

  const panel = new Panel({ accent: ticket.priority === 'URGENT' ? 0xe74c3c : undefined, tone: 'brand' })
    .title(def.emoji, `Ticket ${ticketNo(ticket.id)} • ${def.label}`)
    .sectionWithThumbnail(
      `${mentions}` +
        [
          `**Klient:** <@${ticket.userId}>`,
          `**Status:** ${STATUS_LABELS[ticket.status]}`,
          `**Priorytet:** ${prio.icon} ${prio.label}`,
          `**Obsługa:** ${ticket.claimedBy ? `<@${ticket.claimedBy}>` : '_jeszcze nikt_'}`,
          `**Otwarty:** ${discordTime(ticket.openedAt, 'f')}`,
        ].join('\n'),
      opts.avatarUrl,
    )
    .separator();

  // „>>>” cytuje do końca bloku tekstu, więc każda odpowiedź to osobny TextDisplay.
  for (const a of answers) panel.text(`**${a.label}**\n>>> ${truncate(a.value, perAnswer)}`);

  if (opts.faq?.length) {
    panel
      .separator()
      .text(
        `${e('documentation')} **Może to pomoże, zanim odpowiemy:**\n` +
          opts.faq
            .map((f) => `• **${f.title}** – ${truncate(f.content.replace(/\s+/g, ' '), 120)}`)
            .join('\n') +
          '\n-# Pełną treść zobaczysz przez `/faq pokaz`.',
      );
  }

  return panel
    .separator()
    .buttons(
      ticket.claimedBy
        ? button(`ticket:claim:${ticket.id}`, 'Zwolnij', { emoji: 'user_remove' })
        : button(`ticket:claim:${ticket.id}`, 'Przejmij', { style: 'success', emoji: 'user_crown' }),
      button(`ticket:priority:${ticket.id}`, 'Priorytet', { emoji: 'lightning' }),
      button(`ticket:add:${ticket.id}`, 'Dodaj osobę', { emoji: 'user_add' }),
      button(`ticket:close:${ticket.id}`, 'Zamknij', { style: 'danger', emoji: 'lock' }),
    )
    .footer('Obsługa odpowie najszybciej, jak to możliwe • Prosimy nie pingować obsługi');
}

export function closedPanel(
  ticket: Ticket,
  opts: { archived: boolean; transcriptUrl?: string | null },
): Panel {
  const panel = new Panel({ tone: 'neutral' })
    .title('lock', `Ticket ${ticketNo(ticket.id)} zamknięty`, 3)
    .fields({
      Zamknął: ticket.closedBy ? `<@${ticket.closedBy}>` : 'system',
      Powód: ticket.closeReason ?? 'brak',
      'Czas trwania': ticket.closedAt
        ? formatDuration(ticket.closedAt.getTime() - ticket.openedAt.getTime())
        : null,
    });

  if (opts.archived) {
    panel.buttons(
      button(`ticket:reopen:${ticket.id}`, 'Otwórz ponownie', { style: 'success', emoji: 'unlock' }),
      button(`ticket:delete:${ticket.id}`, 'Usuń kanał', { style: 'danger', emoji: 'shield_x' }),
      ...(opts.transcriptUrl ? [linkButton(opts.transcriptUrl, 'Transkrypt', 'documentation')] : []),
    );
    panel.footer('Kanał przeniesiony do archiwum • widoczny tylko dla obsługi');
  } else {
    panel.footer('Kanał zostanie usunięty za chwilę');
  }
  return panel;
}

/** DM do klienta po zamknięciu: podsumowanie + prośba o ocenę. */
export function closedDmPanel(ticket: Ticket, guildName: string): Panel {
  const def = CATEGORIES[ticket.category];
  return new Panel({ tone: 'brand' })
    .title('ticket', `Twój ticket ${ticketNo(ticket.id)} został zamknięty`)
    .fields({
      Serwer: guildName,
      Kategoria: `${e(def.emoji)} ${def.label}`,
      Temat: ticket.subject,
      'Powód zamknięcia': ticket.closeReason ?? 'brak',
    })
    .separator()
    .text(`${e('star')} **Jak oceniasz naszą obsługę?** Twoja opinia pomaga nam działać lepiej.`)
    .buttons(
      ...[1, 2, 3, 4, 5].map((n) =>
        button(`ticket:rate:${ticket.id}:${n}`, `${n}`, {
          emoji: 'star',
          style: n >= 4 ? 'success' : 'secondary',
        }),
      ),
    )
    .footer('Pełny zapis rozmowy w załączniku');
}

export function ratedDmPanel(ticket: Ticket): Panel {
  return new Panel({ tone: 'success' })
    .title('order_complete', `Dziękujemy za ocenę ticketu ${ticketNo(ticket.id)}!`, 3)
    .text(
      `${'⭐'.repeat(ticket.rating ?? 0)}${ticket.ratingComment ? `\n> ${truncate(ticket.ratingComment, 500)}` : ''}`,
    )
    .footer('Do zobaczenia na zxCode');
}

export function slaAlertPanel(ticket: Ticket, staffRoleId: string | null, waitingMs: number): Panel {
  const def = CATEGORIES[ticket.category];
  return new Panel({ tone: 'warning' })
    .title('notification', `Ticket ${ticketNo(ticket.id)} czeka na odpowiedź`, 3)
    .text(
      `${staffRoleId ? `<@&${staffRoleId}> ` : ''}Klient <@${ticket.userId}> czeka już **${formatDuration(waitingMs)}**.\n` +
        `${e(def.emoji)} ${def.label} • ${PRIORITIES[ticket.priority].icon} ${PRIORITIES[ticket.priority].label}` +
        `${ticket.claimedBy ? ` • obsługa: <@${ticket.claimedBy}>` : ' • **nikt nie przejął**'}\n` +
        `Kanał: <#${ticket.channelId}>`,
    );
}

export function closeWarningPanel(ticket: Ticket, closesAt: Date): Panel {
  return new Panel({ tone: 'warning' })
    .title('lightning', 'Czy sprawa jest nadal aktualna?', 3)
    .text(
      `<@${ticket.userId}>, nie dostaliśmy od Ciebie odpowiedzi. ` +
        `Jeśli nic nie napiszesz, ticket zostanie automatycznie zamknięty ${discordTime(closesAt, 'R')}.`,
    )
    .buttons(button(`ticket:keepOpen:${ticket.id}`, 'Zostaw otwarty', { style: 'success', emoji: 'unlock' }));
}
