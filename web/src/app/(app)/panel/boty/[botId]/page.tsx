import Link from 'next/link';
import { BotAccessEditor } from '@/components/BotAccessEditor';
import { BotAvatar, StatusPill } from '@/components/BotAvatar';
import { Icon } from '@/components/Icon';
import { ProfileEditor } from '@/components/ProfileEditor';
import { Segmented } from '@/components/ui/Segmented';
import { api } from '@/lib/api';
import { guildIconUrl, initials, timeAgo } from '@/lib/format';
import { requireSession } from '@/lib/session';
import { EmptyState } from '@/components/ui/EmptyState';

const TABS = ['serwery', 'profil', 'dostep', 'monitoring'] as const;
type Tab = (typeof TABS)[number];

export default async function BotPage({
  params,
  searchParams,
}: {
  params: Promise<{ botId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ botId }, { tab: rawTab }] = await Promise.all([params, searchParams]);
  const session = await requireSession();
  const [d, members] = await Promise.all([api.bot(session.id, botId), api.botMembers(session.id, botId)]);
  const { bot } = d;
  const canProfile = d.access.perms.includes('profile');
  let tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : 'serwery';
  if (tab === 'monitoring' && !d.monitoring) tab = 'serwery';
  const base = `/panel/boty/${bot.id}`;

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
            {!d.access.owner && <span className="pill pill-plain">Udostępniony</span>}
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

      <div style={{ marginBottom: 20 }}>
        <Segmented
          variant="tabs"
          value={tab}
          items={[
            { value: 'serwery', label: `Serwery (${d.guilds.length})`, href: base },
            { value: 'profil', label: 'Profil', href: `${base}?tab=profil` },
            { value: 'dostep', label: `Dostęp (${members.members.length + 1})`, href: `${base}?tab=dostep` },
            ...(d.monitoring
              ? [{ value: 'monitoring', label: 'Monitoring', href: `${base}?tab=monitoring` }]
              : []),
          ]}
        />
      </div>

      <div key={tab} className="tab-in">
        {tab === 'serwery' && (
          <section className="card glow">
            <div className="card-head">
              <Icon name="server" />
              <h2>Serwery</h2>
              <div className="spacer" />
              <span className="muted small">Wybierz serwer, żeby zmienić ustawienia bota</span>
            </div>
            {d.guilds.length === 0 ? (
              <EmptyState compact icon="server" title="Bot nie jest jeszcze na żadnym serwerze" text="Dodaj go na serwer Discord – pojawi się tutaj." />
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
        )}

        {tab === 'profil' && (
          <div className="stack" style={{ maxWidth: 720 }}>
            {!canProfile && (
              <div className="notice">
                <Icon name="shield_check" />
                <p>Masz tu tylko podgląd – właściciel bota nie dał Ci uprawnienia do zmiany profilu.</p>
              </div>
            )}
            <fieldset className="readonly-wrap" disabled={!canProfile}>
              <ProfileEditor
                botId={bot.id}
                profile={d.profile}
                username={bot.username}
                avatarUrl={bot.avatarUrl}
              />
            </fieldset>
          </div>
        )}

        {tab === 'dostep' && (
          <div style={{ maxWidth: 820 }}>
            <BotAccessEditor
              botId={bot.id}
              me={session.id}
              data={members}
              modules={d.schema.modules.map((m) => ({ key: m.key, label: m.label }))}
              guilds={d.guilds.map((g) => ({ key: g.id, label: g.name }))}
            />
          </div>
        )}

        {tab === 'monitoring' && d.monitoring && (
          <section className="card glow">
            <div className="card-head">
              <Icon name="lightning" />
              <h2>Monitoring</h2>
            </div>
            <div className="stats">
              <div className="stat">
                <div className="stat-label">Stan</div>
                <div
                  className="stat-value"
                  style={{ color: d.monitoring.online ? 'var(--ok)' : 'var(--err)' }}
                >
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
    </div>
  );
}
