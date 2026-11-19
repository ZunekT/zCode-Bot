import Link from 'next/link';
import { BotAvatar, StatusPill } from '@/components/BotAvatar';
import { Icon } from '@/components/Icon';
import { api } from '@/lib/api';
import { env } from '@/lib/env';
import { timeAgo } from '@/lib/format';
import { requireSession } from '@/lib/session';

export const metadata = { title: 'Moje boty' };

export default async function BotsPage() {
  const session = await requireSession();
  const bots = await api.bots(session.id);
  const invite = env.discordInvite;

  return (
    <div className="app-page">
      <div className="app-head">
        <div>
          <h1>Moje boty</h1>
          <p>Ustawienia, uprawnienia, profil i monitoring Twoich botów oraz botów udostępnionych Tobie.</p>
        </div>
        <div className="spacer" />
        {invite && (
          <a href={invite} className="btn btn-primary" target="_blank" rel="noreferrer">
            <Icon name="cart" size={20} /> Zamów nowego bota
          </a>
        )}
      </div>

      {bots.length === 0 ? (
        <div className="card empty">
          <Icon name="bot" size={56} />
          <h2>Nie masz jeszcze botów</h2>
          <p>Gdy zamówisz bota w zxCode, pojawi się tutaj. Zarządzisz nim na stronie: ustawienia, uprawnienia i status.</p>
          {invite && (
            <a href={invite} className="btn btn-primary" target="_blank" rel="noreferrer">
              Zamów bota na Discordzie
            </a>
          )}
        </div>
      ) : (
        <div className="grid-bots">
          {bots.map((b) => (
            <Link key={b.id} href={`/panel/boty/${b.id}`} className="card bot-card glow">
              <div className="bot-id">
                <BotAvatar bot={b} />
                <div>
                  <div className="bot-name">{b.name}</div>
                  <div className="muted small">{b.username ? `@${b.username}` : 'jeszcze się nie połączył'}</div>
                </div>
              </div>
              <div className="meta">
                <StatusPill connected={b.connected} />
                {b.shared && <span className="pill pill-plain">Udostępniony</span>}
                <span>Serwery: {b.guildCount ?? 0}</span>
                {b.botVersion && <span>v{b.botVersion.replace(/^v/, '')}</span>}
                {!b.connected && b.lastSeenAt && <span>ostatnio {timeAgo(b.lastSeenAt)}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
