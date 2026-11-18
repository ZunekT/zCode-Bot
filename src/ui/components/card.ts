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
  emoji?: EmojiName;
  title: string;
  description?: string;
  thumbnail?: string;
  fields?: CardField[];
  body?: string;
  footer?: string;
  timestamp?: boolean;
  accent?: number;
}

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

export const change = (from: string, to: string) => `${from} → **${to}**`;

export const badge = (text: string) => `\`${text.replace(/`/g, 'ʼ')}\``;

export const RATING_LABELS: Record<number, string> = {
  1: 'Bardzo źle',
  2: 'Słabo',
  3: 'Przeciętnie',
  4: 'Dobrze',
  5: 'Rewelacja',
};

export function stars(n: number): string {
  return `${e('star').repeat(n)} **${n}/5** · ${RATING_LABELS[n] ?? ''}`;
}

export const quote = (text: string) => `> ${text.replace(/\n/g, '\n> ')}`;

export const escapeCode = (text: string) => text.replace(/```/g, 'ʼʼʼ');

export function codeBlock(content: string, lang = ''): string {
  return `\`\`\`${lang}\n${escapeCode(content) || ' '}\n\`\`\``;
}

export type DiffSign = '+' | '-' | '~' | '*' | ' ';

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

export function tableBlock(
  rows: [string, string][],
  opts: { lang?: string; separatorBefore?: number[]; align?: 'left' | 'right' } = {},
): string {
  const width = Math.max(...rows.map(([k]) => k.length)) + 2;
  const valueWidth = Math.max(...rows.map(([, v]) => v.length));
  const lines: string[] = [];
  rows.forEach(([k, v], i) => {
    if (opts.separatorBefore?.includes(i)) lines.push('─'.repeat(width + valueWidth));
    lines.push(`${k.padEnd(width)}${opts.align === 'left' ? v : v.padStart(valueWidth)}`.trimEnd());
  });
  return codeBlock(lines.join('\n'), opts.lang ?? '');
}
