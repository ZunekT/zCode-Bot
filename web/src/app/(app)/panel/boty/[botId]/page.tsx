import Link from 'next/link';
import { BotAvatar, StatusPill } from '@/components/BotAvatar';
import { Icon } from '@/components/Icon';
import { ProfileEditor } from '@/components/ProfileEditor';
import { api } from '@/lib/api';
import { guildIconUrl, initials, timeAgo } from '@/lib/format';
import { requireSession } from '@/lib/session';

export default async function BotPage({ params }: { params: Promise<{ botId: string }> }) {
  const { botId } = await params;
  const session = await requireSession();
  const d = await api.bot(session.id, botId);
  const { bot } = d;

  return (
    <div className="app-page">
      <div className="crumbs">
        <Link href="/panel/boty">Moje boty</Link>
        <span className="sep">/</span>
        <span>{bot.name}</span>
      </div>
      <div className="page-head">
        <BotAvatar bot={bot} large />
        <div>
          <h1>{bot.name}</h1>
          <div className="meta" style={{ marginTop: 6 }}>
            <StatusPill connected={bot.connected} />
            {bot.username && <span>@{bot.username}</span>}
            {bot.botVersion && <span>v{bot.botVersion.replace(/^v/, '')}</span>}
            {!bot.connected && <span>ostatnio {timeAgo(bot.lastSeenAt)}</span>}
          </div>
        </div>
      </div>

      {!bot.connected && (
        <div className="notice notice-warn" style={{ marginBottom: 16 }}>
          <Icon name="notification" />
          <p>
            Bot nie jest teraz połączony z panelem. Zmiany zapiszą się i trafią do bota, gdy się połączy.
            {bot.sdkVersion === null && ' Bot jeszcze ani razu się nie połączył – skontaktuj się z zxCode.'}
          </p>
        </div>
      )}

      <div className="two-col">
        <div className="stack">
          <section className="card glow">
            <div className="card-head">
              <Icon name="server" />
              <h2>Serwery</h2>
              <div className="spacer" />
              <span className="muted small">Wybierz serwer, żeby zmienić ustawienia bota</span>
            </div>
            {d.guilds.length === 0 ? (
              <div className="card-body muted">Bot nie jest jeszcze na żadnym serwerze.</div>
            ) : (
              <div className="list">
                {d.guilds.map((g) => {
                  const icon = guildIconUrl(g.icon);
                  return (
                    <Link key={g.id} href={`/panel/boty/${bot.id}/${g.id}`} className="list-item">
                      {icon ? (
                        <img src={icon} alt="" className="avatar avatar-guild" />
                      ) : (
                        <div className="avatar avatar-guild">{initials(g.name)}</div>
                      )}
                      <div className="grow">
                        <div style={{ fontWeight: 700 }}>{g.name}</div>
                        <div className="faint small">ID {g.id}</div>
                      </div>
                      <span className="btn btn-sm">Ustawienia</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {d.monitoring && (
            <section className="card glow">
              <div className="card-head">
                <Icon name="lightning" />
                <h2>Monitoring</h2>
              </div>
              <div className="stats">
                <div className="stat">
                  <div className="stat-label">Stan</div>
                  <div className="stat-value" style={{ color: d.monitoring.online ? 'var(--ok)' : 'var(--err)' }}>
                    {d.monitoring.online ? 'Działa' : 'Awaria'}
                  </div>
                </div>
                <div className="stat">
                  <div className="stat-label">Uptime</div>
                  <div className="stat-value">{d.monitoring.uptime}</div>
                </div>
                <div className="stat">
                  <div className="stat-label">Ostatnia awaria</div>
                  <div className="stat-value" style={{ fontSize: 16 }}>
                    {d.monitoring.lastDownAt ? timeAgo(d.monitoring.lastDownAt) : 'brak'}
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>

        <ProfileEditor botId={bot.id} profile={d.profile} username={bot.username} avatarUrl={bot.avatarUrl} />
      </div>
    </div>
  );
}
