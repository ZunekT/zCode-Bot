import type { TicketCategory, TicketPriority, TicketStatus } from '../../generated/prisma/client.js';
import type { EmojiName } from '../../ui/emojis.js';

export interface CategoryDef {
  label: string;
  description: string;
  emoji: EmojiName;
  /** Unicode na początku nazwy kanału (custom emoji nie działa w nazwach). */
  channelIcon: string;
}

export const CATEGORIES: Record<TicketCategory, CategoryDef> = {
  ORDER: {
    label: 'Zamówienie bota',
    description: 'Chcesz zamówić bota lub nową funkcję',
    emoji: 'cart',
    channelIcon: '🛒',
  },
  SUPPORT: {
    label: 'Wsparcie techniczne',
    description: 'Problem z botem, który od nas masz',
    emoji: 'support',
    channelIcon: '🛠️',
  },
  PARTNERSHIP: {
    label: 'Współpraca',
    description: 'Partnerstwo, reklama, wspólny projekt',
    emoji: 'partnership',
    channelIcon: '🤝',
  },
  QUESTION: {
    label: 'Pytanie',
    description: 'Ceny, terminy, możliwości – zapytaj śmiało',
    emoji: 'idea',
    channelIcon: '❓',
  },
  COMPLAINT: {
    label: 'Reklamacja',
    description: 'Coś nie działa tak, jak było ustalone',
    emoji: 'shield_x',
    channelIcon: '⚠️',
  },
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as TicketCategory[];

export const PRIORITIES: Record<TicketPriority, { label: string; icon: string }> = {
  LOW: { label: 'Niski', icon: '🟢' },
  NORMAL: { label: 'Normalny', icon: '🔵' },
  HIGH: { label: 'Wysoki', icon: '🟠' },
  URGENT: { label: 'Pilny', icon: '🔴' },
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: '🟢 Otwarty',
  CLAIMED: '🔵 W obsłudze',
  WAITING_CLIENT: '🟡 Czeka na klienta',
  CLOSED: '⚫ Zamknięty',
  ARCHIVED: '📁 Zarchiwizowany',
};

/** Statusy, w których ticket jest „żywy”. */
export const ACTIVE_STATUSES: TicketStatus[] = ['OPEN', 'CLAIMED', 'WAITING_CLIENT'];

export const LIMITS = {
  /** Maks. otwartych ticketów jednego użytkownika. */
  perUser: 3,
  /** Maks. otwartych ticketów jednego użytkownika w jednej kategorii. */
  perUserPerCategory: 1,
  /** Cooldown na tworzenie ticketu (s). */
  createCooldown: 30,
  /** Ile maksymalnie wiadomości trafia do transkryptu. */
  transcriptMessages: 5000,
  /** Maksymalny czas ostrzeżenia przed auto-zamknięciem (h). */
  closeWarningHours: 24,
  /** Opóźnienie usunięcia kanału, gdy nie ma archiwum (s). */
  deleteDelaySeconds: 10,
};

export const CHECK_INTERVAL_MS = 5 * 60 * 1000;
