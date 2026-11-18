import type { OrderStatus } from '../../generated/prisma/client.js';
import type { EmojiName } from '../../ui/emojis.js';
import type { ToneName } from '../../ui/theme.js';

export interface StatusDef {
  label: string;
  short: string;
  emoji: EmojiName;
  icon: string;
  tone: ToneName;
  /** Pozycja na osi postępu (0 = poza osią). */
  step: number;
  /** Co zobaczy klient w DM po zmianie na ten status. */
  clientText: string;
}

export const ORDER_STATUSES: Record<OrderStatus, StatusDef> = {
  QUOTE: {
    label: 'Wycena',
    short: 'Wycena',
    emoji: 'documentation',
    icon: '📝',
    tone: 'info',
    step: 1,
    clientText: 'Przygotowujemy wycenę Twojego projektu.',
  },
  ACCEPTED: {
    label: 'Zaakceptowane',
    short: 'Akceptacja',
    emoji: 'verified',
    icon: '🤝',
    tone: 'success',
    step: 2,
    clientText: 'Wycena zaakceptowana – zaraz ruszamy!',
  },
  AWAITING_PAYMENT: {
    label: 'Oczekuje na płatność',
    short: 'Płatność',
    emoji: 'payment_card',
    icon: '💳',
    tone: 'warning',
    step: 3,
    clientText: 'Czekamy na płatność – dane do przelewu są na fakturze proforma.',
  },
  IN_PROGRESS: {
    label: 'W realizacji',
    short: 'Realizacja',
    emoji: 'code',
    icon: '💻',
    tone: 'brand',
    step: 4,
    clientText: 'Pracujemy nad Twoim botem!',
  },
  TESTING: {
    label: 'Testy',
    short: 'Testy',
    emoji: 'tools',
    icon: '🧪',
    tone: 'info',
    step: 5,
    clientText: 'Bot jest gotowy i właśnie go testujemy.',
  },
  DELIVERED: {
    label: 'Dostarczone',
    short: 'Dostarczone',
    emoji: 'package',
    icon: '📦',
    tone: 'success',
    step: 6,
    clientText: 'Bot dostarczony – sprawdź go i daj znać, czy wszystko działa.',
  },
  COMPLETED: {
    label: 'Zakończone',
    short: 'Koniec',
    emoji: 'order_complete',
    icon: '🎉',
    tone: 'success',
    step: 7,
    clientText: 'Zlecenie zakończone. Dziękujemy za współpracę!',
  },
  CANCELLED: {
    label: 'Anulowane',
    short: 'Anulowane',
    emoji: 'shield_x',
    icon: '⛔',
    tone: 'error',
    step: 0,
    clientText: 'Zlecenie zostało anulowane.',
  },
};

export const STATUS_ORDER: OrderStatus[] = [
  'QUOTE',
  'ACCEPTED',
  'AWAITING_PAYMENT',
  'IN_PROGRESS',
  'TESTING',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
];

export const ACTIVE_ORDER_STATUSES: OrderStatus[] = STATUS_ORDER.filter(
  (s) => s !== 'COMPLETED' && s !== 'CANCELLED',
);

/** Akcje w menu panelu zlecenia (tylko obsługa). */
export const ORDER_ACTIONS = {
  status: { label: 'Zmień status', description: 'Przesuń zlecenie na kolejny etap', emoji: 'checklist' },
  edit: {
    label: 'Edytuj szczegóły',
    description: 'Tytuł, opis, cena, termin, repozytorium',
    emoji: 'code_file',
  },
  task_add: {
    label: 'Dodaj zadania',
    description: 'Pozycje checklisty (każda w nowej linii)',
    emoji: 'checklist',
  },
  task_toggle: {
    label: 'Odhacz zadania',
    description: 'Oznacz zadania jako zrobione / niezrobione',
    emoji: 'order_complete',
  },
  payment: { label: 'Zapisz wpłatę', description: 'Dodaj wpłatę do salda zlecenia', emoji: 'money' },
  invoice: {
    label: 'Wystaw proformę',
    description: 'Dokument z danymi do przelewu dla klienta',
    emoji: 'invoice',
  },
  discount: { label: 'Kod rabatowy', description: 'Zastosuj kod rabatowy do zlecenia', emoji: 'gift' },
} as const satisfies Record<string, { label: string; description: string; emoji: EmojiName }>;

export type OrderAction = keyof typeof ORDER_ACTIONS;

/** Ile zakończonych zleceń daje rolę „Stały klient”. */
export const LOYAL_CLIENT_ORDERS = 3;
/** Domyślny termin płatności proformy (dni). */
export const DEFAULT_INVOICE_DAYS = 7;
