import { Panel } from '../builders/container.js';
import { v2 } from '../builders/payload.js';
import { Tone, type ToneName } from '../theme.js';

/** Krótki komunikat (domyślnie ephemeral): sukces, błąd, info. */
export function notice(tone: ToneName, title: string, description?: string, ephemeral = true) {
  const panel = new Panel({ tone }).title(Tone[tone].emoji, title, 3);
  if (description) panel.text(description);
  return v2(panel, { ephemeral });
}

export const success = (title: string, description?: string) => notice('success', title, description);
export const failure = (title: string, description?: string) => notice('error', title, description);
export const info = (title: string, description?: string) => notice('info', title, description);
export const warning = (title: string, description?: string) => notice('warning', title, description);
