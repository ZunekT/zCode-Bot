import type { Person } from '@/lib/api';

const CDN = /^https:\/\/cdn\.discordapp\.com\//;

export function PersonChip({ p, sub }: { p: Person; sub?: React.ReactNode }) {
  return (
    <span className="person">
      <img src={p.avatar && CDN.test(p.avatar) ? p.avatar : '/emojis/user.png'} alt="" width={28} height={28} loading="lazy" />
      <span>
        <span className="person-name">{p.name}</span>
        {sub && <span className="faint small">{sub}</span>}
      </span>
    </span>
  );
}
