import { v2 } from '../builders/payload.js';
import type { ToneName } from '../theme.js';
import { card } from './card.js';

export function notice(tone: ToneName, title: string, description?: string, ephemeral = true) {
  return v2(card({ tone, title, description, timestamp: false }), { ephemeral });
}

export const success = (title: string, description?: string) => notice('success', title, description);
export const failure = (title: string, description?: string) => notice('error', title, description);
export const info = (title: string, description?: string) => notice('info', title, description);
export const warning = (title: string, description?: string) => notice('warning', title, description);
