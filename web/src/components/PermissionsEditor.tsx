'use client';

import { useMemo, useState } from 'react';
import { put } from '@/lib/client';
import type { GuildRole, Permissions } from '@/lib/types';
import { roleOptions } from './FieldInput';
import { Icon } from './Icon';
import { Select } from './ui/Select';
import { useToast } from './Toast';

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function PermissionsEditor({
  botId,
  guildId,
  commands,
  roles,
  initial,
}: {
  botId: number;
  guildId: string;
  commands: { name: string; description: string }[];
  roles: GuildRole[];
  initial: Permissions;
}) {
  const [saved, setSaved] = useState(initial);
  const [perms, setPerms] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const toast = useToast();


  const roleOpts = useMemo(() => roleOptions(roles), [roles]);
  const dirty = !same(perms, saved);
  const shown = commands.filter((c) => c.name.includes(filter.trim().toLowerCase().replace(/^\//, '')));

  function update(cmd: string, list: string[]) {
    setError(null);
    setPerms((p) => {
      const next = { ...p };
      if (list.length) next[cmd] = { roles: list };
      else delete next[cmd];
      return next;
    });
  }

  async function save() {
    setSaving(true);
    const res = await put<{ permissions: Permissions }>(`/api/bots/${botId}/guilds/${guildId}/config`, { permissions: perms });
    setSaving(false);
    if (!res.ok) {
      setError(res.errors?.map((e) => `/${e.path}: ${e.message}`).join(', ') || res.error || 'Nie udało się zapisać.');
      return;
    }
    const fresh = res.data?.permissions ?? perms;
    setSaved(fresh);
    setPerms(fresh);
    toast.show(true, 'Uprawnienia zapisane.');
  }

  if (!commands.length) {
    return (
      <div className="card empty">
        <Icon name="lock" size={56} />
        <h2>Brak komend</h2>
        <p>Bot nie zgłosił jeszcze żadnych komend.</p>
      </div>
    );
  }

  return (
    <>
      <div className="notice" style={{ marginBottom: 16 }}>
        <Icon name="shield_check" />
        <p className="small">
          Komenda bez ról jest dostępna na zasadach ustawionych w bocie. Gdy wybierzesz role, komendy mogą używać tylko osoby z
          jedną z nich. Administratorzy serwera mają dostęp zawsze.
        </p>
      </div>
      <div className="card">
        <div className="card-head">
          <Icon name="lock" />
          <h2>Komendy ({commands.length})</h2>
          <div className="spacer" />
          <input
            className="input"
            style={{ width: 200, height: 34 }}
            placeholder="Szukaj komendy…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <div>
          {shown.map((c) => {
            const list = perms[c.name]?.roles ?? [];
            return (
              <div key={c.name} className="perm-row">
                <div>
                  <div className="perm-cmd">/{c.name}</div>
                  {c.description && <div className="faint small">{c.description}</div>}
                </div>
                <div className="perm-roles">
                  <Select
                    multiple
                    size="sm"
                    ariaLabel={`Role dla /${c.name}`}
                    value={list}
                    onChange={(v) => update(c.name, v)}
                    options={roleOpts}
                    placeholder="Domyślne uprawnienia – dodaj rolę…"
                    searchable
                  />
                </div>
              </div>
            );
          })}
          {!shown.length && <div className="card-body muted">Brak komend pasujących do „{filter}”.</div>}
        </div>
      </div>

      <div className={`savebar${dirty ? ' show' : ''}${error ? ' error' : ''}`}>
        <p style={error ? { color: 'var(--err)' } : undefined}>{error ?? 'Masz niezapisane zmiany uprawnień'}</p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPerms(saved)} disabled={saving}>
          Cofnij
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
          {saving ? 'Zapisywanie…' : 'Zapisz uprawnienia'}
        </button>
      </div>
      {toast.node}
    </>
  );
}
