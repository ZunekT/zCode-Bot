import type { PublicBot } from '@/lib/types';

const DISCORD_CDN = /^https:\/\/cdn\.discordapp\.com\//;

export function BotAvatar({ bot, large }: { bot: Pick<PublicBot, 'avatarUrl'>; large?: boolean }) {
  const src = bot.avatarUrl && DISCORD_CDN.test(bot.avatarUrl) ? bot.avatarUrl : '/emojis/bot.png';
  return <img src={src} alt="" className={`avatar${large ? ' avatar-lg' : ''}`} />;
}

export function StatusPill({ connected }: { connected: boolean }) {
  return <span className={`pill ${connected ? 'pill-ok pill-live' : 'pill-err pill-down'}`}>{connected ? 'Połączony' : 'Rozłączony'}</span>;
}
