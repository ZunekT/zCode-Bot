import type { TicketCategory, TicketPriority, TicketStatus } from '../../generated/prisma/client.js';
import type { EmojiName } from '../../ui/emojis.js';

export interface CategoryDef {
  label: string;
  description: string;
  emoji: EmojiName;
  channelPrefix: string;
}

export const CATEGORIES: Record<TicketCategory, CategoryDef> = {
  ORDER: {
    label: 'Zamówienie bota',
    description: 'Chcesz zamówić bota lub nową funkcję',
    emoji: 'cart',
    channelPrefix: 'zamowienie',
  },
  WEBSITE: {
    label: 'Zamówienie strony',
    description: 'Strona firmowa, landing, sklep albo aplikacja WWW',
    emoji: 'laptop',
    channelPrefix: 'strona',
  },
  SUPPORT: {
    label: 'Wsparcie techniczne',
    description: 'Problem z botem lub stroną, którą od nas masz',
    emoji: 'support',
    channelPrefix: 'wsparcie',
  },
  PARTNERSHIP: {
    label: 'Współpraca',
    description: 'Partnerstwo, reklama, wspólny projekt',
    emoji: 'partnership',
    channelPrefix: 'wspolpraca',
  },
  QUESTION: {
    label: 'Pytanie',
    description: 'Ceny, terminy, możliwości – zapytaj śmiało',
    emoji: 'idea',
    channelPrefix: 'pytanie',
  },
  COMPLAINT: {
    label: 'Reklamacja',
    description: 'Coś nie działa tak, jak było ustalone',
    emoji: 'shield_x',
    channelPrefix: 'reklamacja',
  },
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as TicketCategory[];

export const PRIORITIES: Record<TicketPriority, { label: string; emoji: EmojiName }> = {
  LOW: { label: 'Niski', emoji: 'cube' },
  NORMAL: { label: 'Normalny', emoji: 'notification' },
  HIGH: { label: 'Wysoki', emoji: 'lightning' },
  URGENT: { label: 'Pilny', emoji: 'shield_x' },
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Otwarty',
  CLAIMED: 'W obsłudze',
  WAITING_CLIENT: 'Czeka na klienta',
  CLOSED: 'Zamknięty',
  ARCHIVED: 'W archiwum',
};

export const ACTIVE_STATUSES: TicketStatus[] = ['OPEN', 'CLAIMED', 'WAITING_CLIENT'];

export const LIMITS = {
  perUser: 3,
  perUserPerCategory: 1,
  createCooldown: 30,
  transcriptMessages: 5000,
  closeWarningHours: 24,
  deleteDelaySeconds: 10,
};

export const CHECK_INTERVAL_MS = 5 * 60 * 1000;

export const CONTROL_ACTIONS = {
  claim: { label: 'Przejmij ticket', description: 'Zajmij się tą sprawą', emoji: 'user_crown', staff: true },
  unclaim: {
    label: 'Zwolnij ticket',
    description: 'Oddaj sprawę innej osobie z obsługi',
    emoji: 'user_remove',
    staff: true,
  },
  priority: {
    label: 'Zmień priorytet',
    description: 'Niski, normalny, wysoki lub pilny',
    emoji: 'lightning',
    staff: true,
  },
  add: { label: 'Dodaj osobę', description: 'Daj komuś dostęp do ticketu', emoji: 'user_add', staff: true },
  remove: {
    label: 'Usuń osobę',
    description: 'Odbierz dostęp dodanej osobie',
    emoji: 'user_remove',
    staff: true,
  },
  note: {
    label: 'Dodaj notatkę',
    description: 'Widoczna tylko dla obsługi',
    emoji: 'documentation',
    staff: true,
  },
  order: {
    label: 'Utwórz zlecenie',
    description: 'Zamień ticket w zlecenie ZX-xxxx z panelem',
    emoji: 'package',
    staff: true,
  },
  remind: {
    label: 'Przypomnij klientowi',
    description: 'Ping z prośbą o odpowiedź',
    emoji: 'notification',
    staff: true,
  },
  close: {
    label: 'Zamknij ticket',
    description: 'Transkrypt, archiwum i prośba o ocenę',
    emoji: 'lock',
    staff: false,
  },
} as const satisfies Record<string, { label: string; description: string; emoji: EmojiName; staff: boolean }>;

export type ControlAction = keyof typeof CONTROL_ACTIONS;

export const REMIND_COOLDOWN = 30 * 60;
