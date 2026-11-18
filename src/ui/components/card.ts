import { discordTime } from '../../utils/format.js';
import { Panel } from '../builders/container.js';
import { e, type EmojiName } from '../emojis.js';
import { Tone, type ToneName } from '../theme.js';

export interface CardField {
  /** Zachowane dla zgodności – pola renderujemy bez ikon (czytelniej). */
  emoji?: EmojiName;
  label: string;
  value: string | null | undefined;
}

export interface CardOptions {
  tone: ToneName;
  /** Emotka z paczki zxCode w nagłówku (domyślnie emotka tonu). */
  emoji?: EmojiName;
  title: string;
  description?: string;
  /** Miniaturka po prawej (np. avatar osoby, która wykonała akcję). */
  thumbnail?: string;
  fields?: CardField[];
  /** Dodatkowa treść pod polami (np. cytat, blok kodu), przed stopką. */
  body?: string;
  /** Mała stopka; czas wydarzenia dopisywany automatycznie. */
  footer?: string;
  timestamp?: boolean;
  /** Własny kolor akcentu (nadpisuje ton). */
  accent?: number;
}

/**
 * Jednolita „karta” – wszystkie komunikaty bota wyglądają tak samo:
 *
 *   ┃ ### <emotka zxCode> Tytuł              [avatar]
 *   ┃ opis
 *   ┃ ─────────────
 *   ┃ **Pole:** wartość
 *   ┃ **Pole:** wartość
 *   ┃ ```blok kodu / cytat```
 *   ┃ -# stopka • 5 minut temu
 *
 * Ikona jest tylko w nagłówku, kolor paska mówi o charakterze zdarzenia
 * (zielony – sukces, żółty – uwaga, czerwony – problem).
 */
export function card(o: CardOptions): Panel {
  const panel = new Panel({ tone: o.tone, accent: o.accent });
  const header = `### ${e(o.emoji ?? Tone[o.tone].emoji)} ${o.title}${o.description ? `\n${o.description}` : ''}`;

  if (o.thumbnail) panel.sectionWithThumbnail(header, o.thumbnail);
  else panel.text(header);

  const fields = (o.fields ?? []).filter((f) => f.value);
  if (fields.length) {
    panel.separator(true, 'small').text(fields.map((f) => `**${f.label}:** ${f.value}`).join('\n'));
  }

  if (o.body) panel.text(o.body);

  const footer = [o.footer, o.timestamp === false ? null : discordTime(new Date(), 'R')]
    .filter(Boolean)
    .join(' • ');
  if (footer) panel.footer(footer);
  return panel;
}

/** „Otwarty → **W obsłudze**” */
export const change = (from: string, to: string) => `${from} → **${to}**`;

/** Znacznik w formie kodu inline: badge('Pilny') -> `Pilny` */
export const badge = (text: string) => `\`${text.replace(/`/g, 'ʼ')}\``;

export const RATING_LABELS: Record<number, string> = {
  1: 'Bardzo źle',
  2: 'Słabo',
  3: 'Przeciętnie',
  4: 'Dobrze',
  5: 'Rewelacja',
};

/** Gwiazdki z emotek zxCode: stars(4) -> ★★★★ **4/5** · Dobrze (gwiazdki z paczki) */
export function stars(n: number): string {
  return `${e('star').repeat(n)} **${n}/5** · ${RATING_LABELS[n] ?? ''}`;
}

/** Cytat wielolinijkowy. */
export const quote = (text: string) => `> ${text.replace(/\n/g, '\n> ')}`;

// ───────────────────────────── Bloki kodu ─────────────────────────────

/** Treść użytkownika w bloku kodu nie może zamknąć bloku. */
export const escapeCode = (text: string) => text.replace(/```/g, 'ʼʼʼ');

/** ```lang\n…\n``` */
export function codeBlock(content: string, lang = ''): string {
  return `\`\`\`${lang}\n${escapeCode(content) || ' '}\n\`\`\``;
}

export type DiffSign = '+' | '-' | '~' | '*' | ' ';

/**
 * Blok ```diff – Discord koloruje linie „+” na zielono i „-” na czerwono.
 * diffBlock([['+', 'Dodano: X'], ['-', 'Usunięto: Y']])
 */
export function diffBlock(lines: [DiffSign, string][]): string {
  return codeBlock(
    lines
      .map(([sign, text]) =>
        text
          .split('\n')
          .map((l) => `${sign} ${l}`)
          .join('\n'),
      )
      .join('\n'),
    'diff',
  );
}

/**
 * Wyrównana tabelka w bloku kodu:
 *   Cena          600,00 zł
 *   Do zapłaty    240,00 zł
 */
export function tableBlock(
  rows: [string, string][],
  opts: { lang?: string; separatorBefore?: number[] } = {},
): string {
  const width = Math.max(...rows.map(([k]) => k.length)) + 2;
  const valueWidth = Math.max(...rows.map(([, v]) => v.length));
  const lines: string[] = [];
  rows.forEach(([k, v], i) => {
    if (opts.separatorBefore?.includes(i)) lines.push('─'.repeat(width + valueWidth));
    lines.push(`${k.padEnd(width)}${v.padStart(valueWidth)}`);
  });
  return codeBlock(lines.join('\n'), opts.lang ?? '');
}
