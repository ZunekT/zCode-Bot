import { discordTime } from '../../utils/format.js';
import { Panel } from '../builders/container.js';
import { e, type EmojiName } from '../emojis.js';
import { Tone, type ToneName } from '../theme.js';

export interface CardField {
  emoji?: EmojiName;
  label: string;
  value: string | null | undefined;
}

export interface CardOptions {
  tone: ToneName;
  /** Emotka w nagłówku (domyślnie emotka tonu). */
  emoji?: EmojiName;
  title: string;
  description?: string;
  /** Miniaturka po prawej (np. avatar osoby, która wykonała akcję). */
  thumbnail?: string;
  fields?: CardField[];
  /** Dodatkowa treść pod polami (np. cytat komentarza), przed stopką. */
  body?: string;
  /** Mała stopka; czas wydarzenia dopisywany automatycznie. */
  footer?: string;
  timestamp?: boolean;
  /** Własny kolor akcentu (nadpisuje ton). */
  accent?: number;
}

/**
 * Jednolita „karta” zdarzenia – wszystkie komunikaty bota (zmiana statusu, priorytetu,
 * opinie, alerty, logi) wyglądają tak samo:
 *
 *   ┃ ### <emoji> Tytuł                      [avatar]
 *   ┃ opis
 *   ┃ ─────────────
 *   ┃ <emoji> **Pole:** wartość
 *   ┃ -# stopka • 5 minut temu
 */
export function card(o: CardOptions): Panel {
  const panel = new Panel({ tone: o.tone, accent: o.accent });
  const header = `### ${e(o.emoji ?? Tone[o.tone].emoji)} ${o.title}${o.description ? `\n${o.description}` : ''}`;

  if (o.thumbnail) panel.sectionWithThumbnail(header, o.thumbnail);
  else panel.text(header);

  const fields = (o.fields ?? []).filter((f) => f.value);
  if (fields.length) {
    panel
      .separator(true, 'small')
      .text(fields.map((f) => `${f.emoji ? `${e(f.emoji)} ` : ''}**${f.label}:** ${f.value}`).join('\n'));
  }

  if (o.body) panel.text(o.body);

  const footer = [o.footer, o.timestamp === false ? null : discordTime(new Date(), 'R')]
    .filter(Boolean)
    .join(' • ');
  if (footer) panel.footer(footer);
  return panel;
}

/** „🟢 Otwarty ➜ **🔵 W obsłudze**” */
export const change = (from: string, to: string) => `${from} ➜ **${to}**`;

export const RATING_LABELS: Record<number, string> = {
  1: 'Bardzo źle',
  2: 'Słabo',
  3: 'Przeciętnie',
  4: 'Dobrze',
  5: 'Rewelacja',
};

/** Gwiazdki z emotek zxCode: stars(4) -> ⭐⭐⭐⭐ **4/5** · Dobrze */
export function stars(n: number): string {
  return `${e('star').repeat(n)} **${n}/5** · ${RATING_LABELS[n] ?? ''}`;
}

/** Cytat wielolinijkowy. */
export const quote = (text: string) => `> ${text.replace(/\n/g, '\n> ')}`;
