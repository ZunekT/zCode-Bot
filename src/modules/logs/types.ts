import type { EmojiName } from '../../ui/emojis.js';

export const LOG_TYPES = {
  messages: {
    label: 'Wiadomości',
    description: 'Usunięte, edytowane, masowo czyszczone, przypięcia',
    emoji: 'discord',
  },
  members: {
    label: 'Członkowie',
    description: 'Wejścia, wyjścia, pseudonimy, role, boosty, weryfikacja',
    emoji: 'users',
  },
  moderation: {
    label: 'Moderacja',
    description: 'Bany, kicki, wyciszenia, AutoMod',
    emoji: 'shield_check',
  },
  voice: {
    label: 'Kanały głosowe',
    description: 'Dołączenia, wyjścia, przeniesienia',
    emoji: 'notification',
  },
  channels: {
    label: 'Kanały',
    description: 'Tworzenie, usuwanie, zmiany, uprawnienia, wątki',
    emoji: 'documentation',
  },
  roles: {
    label: 'Role',
    description: 'Tworzenie, usuwanie i zmiany ról',
    emoji: 'crown',
  },
  server: {
    label: 'Serwer',
    description: 'Ustawienia, zaproszenia, webhooki, emotki, boty',
    emoji: 'server',
  },
} as const satisfies Record<string, { label: string; description: string; emoji: EmojiName }>;

export type LogType = keyof typeof LOG_TYPES;
export const LOG_TYPE_KEYS = Object.keys(LOG_TYPES) as LogType[];

export const isLogType = (v: string | undefined): v is LogType => !!v && v in LOG_TYPES;
