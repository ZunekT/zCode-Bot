/** „5 min temu”, „wczoraj” itd. */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'nigdy';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'przed chwilą';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min temu`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} godz. temu`;
  const d = Math.round(h / 24);
  if (d === 1) return 'wczoraj';
  if (d < 30) return `${d} dni temu`;
  return new Date(iso).toLocaleDateString('pl-PL');
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export const roleColor = (c?: number) => (c ? `#${c.toString(16).padStart(6, '0')}` : '#99aab5');

export function guildIconUrl(icon: string | null): string | null {
  return icon && /^https:\/\/cdn\.discordapp\.com\//.test(icon) ? icon : null;
}
