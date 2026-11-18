import type { APIMessageComponentEmoji, Client } from 'discord.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('emojis');

export const EMOJI_FALLBACKS = {
  announcement: '📢',
  bot: '🤖',
  brackets: '🧩',
  calendar: '📅',
  cart: '🛒',
  checklist: '📋',
  client_badge: '🎖️',
  client_crown: '👑',
  client_group: '👥',
  cloud_upload: '☁️',
  code: '💻',
  code_file: '📄',
  coins: '🪙',
  crown: '👑',
  cube: '🧊',
  database: '🗄️',
  desktop: '🖥️',
  discord: '💬',
  documentation: '📚',
  gamepad: '🎮',
  gift: '🎁',
  git_branch: '🌿',
  idea: '💡',
  invoice: '🧾',
  laptop: '💻',
  lightning: '⚡',
  lock: '🔒',
  logo: '🔷',
  logo_blue: '🔷',
  logo_dark: '🔷',
  logo_round: '🔷',
  mobile: '📱',
  money: '💰',
  notification: '🔔',
  order_complete: '✅',
  package: '📦',
  partnership: '🤝',
  payment_card: '💳',
  rocket: '🚀',
  server: '🖧',
  service: '🛠️',
  shield_check: '🛡️',
  shield_x: '⛔',
  star: '⭐',
  store: '🏪',
  support: '🎧',
  terminal: '⌨️',
  ticket: '🎫',
  tools: '🧰',
  unlock: '🔓',
  user: '👤',
  user_add: '➕',
  user_crown: '👑',
  user_remove: '➖',
  users: '👥',
  verified: '✅',
} as const;

export type EmojiName = keyof typeof EMOJI_FALLBACKS;

export const EMOJI_NAMES = Object.keys(EMOJI_FALLBACKS) as EmojiName[];

interface LoadedEmoji {
  id: string;
  name: string;
  animated: boolean;
}

const loaded = new Map<string, LoadedEmoji>();

export async function loadApplicationEmojis(client: Client<true>): Promise<void> {
  try {
    const emojis = await client.application.emojis.fetch();
    loaded.clear();
    for (const emoji of emojis.values()) {
      if (emoji.name)
        loaded.set(emoji.name, { id: emoji.id, name: emoji.name, animated: emoji.animated ?? false });
    }
    const missing = EMOJI_NAMES.filter((n) => !loaded.has(n));
    log.info(`Załadowano ${loaded.size} emotek aplikacji`);
    if (missing.length)
      log.warn(`Brak ${missing.length} emotek – uruchom "npm run emojis:sync": ${missing.join(', ')}`);
  } catch (err) {
    log.error('Nie udało się pobrać emotek aplikacji, używam zapasowych', err);
  }
}

export function e(name: EmojiName): string {
  const emoji = loaded.get(name);
  if (!emoji) return EMOJI_FALLBACKS[name];
  return `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`;
}

export function emojiComponent(name: EmojiName): APIMessageComponentEmoji {
  const emoji = loaded.get(name);
  if (!emoji) return { name: EMOJI_FALLBACKS[name] };
  return { id: emoji.id, name: emoji.name, animated: emoji.animated };
}
