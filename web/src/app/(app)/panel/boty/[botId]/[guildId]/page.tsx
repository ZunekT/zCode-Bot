import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { PermissionsEditor } from '@/components/PermissionsEditor';
import { SettingsEditor } from '@/components/SettingsEditor';
import { Segmented } from '@/components/ui/Segmented';
import { api } from '@/lib/api';
import { guildIconUrl, initials, timeAgo } from '@/lib/format';
import { requireSession } from '@/lib/session';

export default async function GuildPage({
  params,
  searchParams,
}: {
  params: Promise<{ botId: string; guildId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ botId, guildId }, { tab }] = await Promise.all([params, searchParams]);
  const session = await requireSession();
  const [d, s] = await Promise.all([api.bot(session.id, botId), api.guild(session.id, botId, guildId)]);
  const icon = guildIconUrl(s.guild.icon);
  const perms = tab === 'uprawnienia';
  const base = `/panel/boty/${d.bot.id}/${s.guild.id}`;

  return (
    <div className="app-page">
      <div className="crumbs">
        <Link href="/panel/boty">Moje boty</Link>
        <span className="sep">/</span>
        <Link href={`/panel/boty/${d.bot.id}`}>{d.bot.name}</Link>
        <span className="sep">/</span>
        <span>{s.guild.name}</span>
      </div>
      <div className="page-head">
        {icon ? <img src={icon} alt="" className="avatar avatar-guild" /> : <div className="avatar avatar-guild">{initials(s.guild.name)}</div>}
        <div>
          <h1>{s.guild.name}</h1>
          <div className="muted small">
            Ustawienia bota {d.bot.name}
            {s.updatedAt && ` · ostatnia zmiana ${timeAgo(s.updatedAt)}`}
          </div>
        </div>
      </div>

      {!d.bot.connected && (
        <div className="notice notice-warn" style={{ marginBottom: 16 }}>
          <Icon name="notification" />
          <p>Bot jest teraz rozłączony. Zapisane zmiany dotrą do niego po ponownym połączeniu.</p>
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <Segmented
          variant="tabs"
          value={perms ? 'perm' : 'set'}
          items={[
            { value: 'set', label: 'Ustawienia', href: base },
            { value: 'perm', label: 'Uprawnienia komend', href: `${base}?tab=uprawnienia` },
          ]}
        />
      </div>

      {perms ? (
        <PermissionsEditor
          key={`p-${s.revision}`}
          botId={d.bot.id}
          guildId={s.guild.id}
          commands={d.commands}
          roles={s.guild.roles}
          initial={s.permissions}
        />
      ) : (
        <SettingsEditor
          key={`s-${s.revision}`}
          botId={d.bot.id}
          guildId={s.guild.id}
          schema={d.schema}
          initial={s.values}
          channels={s.guild.channels}
          roles={s.guild.roles}
        />
      )}
    </div>
  );
}
