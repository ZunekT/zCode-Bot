import { Colors, type ColorName } from '../config/constants.js';
import type { EmojiName } from './emojis.js';

/** Typ komunikatu -> kolor akcentu i domyślna emotka. */
export const Tone = {
  info: { color: Colors.info, emoji: 'notification' },
  success: { color: Colors.success, emoji: 'order_complete' },
  client: { color: Colors.client, emoji: 'client_badge' },
  warning: { color: Colors.warning, emoji: 'lightning' },
  error: { color: Colors.error, emoji: 'shield_x' },
  brand: { color: Colors.brand, emoji: 'logo' },
} as const satisfies Record<string, { color: number; emoji: EmojiName }>;

export type ToneName = keyof typeof Tone;

export function color(name: ColorName): number {
  return Colors[name];
}
