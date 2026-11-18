'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { put } from '@/lib/client';
import type { Presence, Profile } from '@/lib/types';
import { Icon } from './Icon';
import { Select } from './ui/Select';
import { useToast } from './Toast';

const STATUSES: { value: Presence['status']; label: string }[] = [
  { value: 'online', label: 'Dostępny' },
  { value: 'idle', label: 'Zaraz wracam' },
  { value: 'dnd', label: 'Nie przeszkadzać' },
  { value: 'invisible', label: 'Niewidoczny' },
];

const ACTIVITIES: { value: NonNullable<Presence['activity']>['type']; label: string }[] = [
  { value: 'playing', label: 'Gra w' },
  { value: 'watching', label: 'Ogląda' },
  { value: 'listening', label: 'Słucha' },
  { value: 'competing', label: 'Rywalizuje w' },
  { value: 'custom', label: 'Własny status' },
];

const MAX_AVATAR = 1024 * 1024;
const DISCORD_CDN = /^https:\/\/cdn\.discordapp\.com\//;

export function ProfileEditor({
  botId,
  profile,
  username,
  avatarUrl,
}: {
  botId: number;
  profile: Profile;
  username: string | null;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const initial = profile.presence ?? { status: 'online' as const, activity: null };
  const [status, setStatus] = useState<Presence['status']>(initial.status);
  const [actType, setActType] = useState(initial.activity?.type ?? 'playing');
  const [actText, setActText] = useState(initial.activity?.text ?? '');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const presenceChanged =
    status !== initial.status || actText.trim() !== (initial.activity?.text ?? '') || (actText.trim() !== '' && actType !== initial.activity?.type);
  const dirty = presenceChanged || name.trim() !== '' || avatar !== null;

  function pickFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type)) return setError('Avatar musi być obrazkiem PNG, JPG, GIF lub WEBP.');
    if (file.size > MAX_AVATAR) return setError('Avatar może mieć maksymalnie 1 MB.');
    const reader = new FileReader();
    reader.onload = () => setAvatar(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await put(`/api/bots/${botId}/profile`, {
      ...(presenceChanged && {
        presence: { status, activity: actText.trim() ? { type: actType, text: actText.trim() } : null },
      }),
      ...(name.trim() && { username: name.trim() }),
      ...(avatar && { avatar }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.errors?.map((e) => e.message).join(', ') || res.error || 'Nie udało się zapisać.');
      return;
    }
    toast.show(true, name || avatar ? 'Zapisano. Bot zmieni profil za chwilę.' : 'Status bota zmieniony.');
    setName('');
    setAvatar(null);
    router.refresh();
  }

  const last = profile.lastResult;
  const shownAvatar = avatar ?? (avatarUrl && DISCORD_CDN.test(avatarUrl) ? avatarUrl : '/emojis/bot.png');

  return (
    <section className="card">
      <div className="card-head">
        <Icon name="user" />
        <h2>Profil bota</h2>
      </div>
      <div className="card-body stack">
        <div className="field">
          <span className="field-label">Status</span>
          <div className="status-opts">
            {STATUSES.map((s) => (
              <button key={s.value} type="button" className="status-opt" aria-pressed={status === s.value} onClick={() => setStatus(s.value)}>
                <span className={`sdot ${s.value}`} />
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field-label">Aktywność</span>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8 }}>
            <Select
              ariaLabel="Typ aktywności"
              value={actType}
              onChange={(v) => v && setActType(v as typeof actType)}
              options={ACTIVITIES.map((x) => ({ value: x.value, label: x.label }))}
            />
            <input
              className="input"
              value={actText}
              maxLength={128}
              placeholder="np. zxcode.pl"
              onChange={(e) => setActText(e.target.value)}
              aria-label="Tekst aktywności"
            />
          </div>
          <span className="field-desc">Puste pole = bez aktywności.</span>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="bot-name">
            Nowa nazwa
          </label>
          <input
            id="bot-name"
            className="input"
            value={name}
            maxLength={32}
            placeholder={username ?? 'Nazwa bota'}
            onChange={(e) => setName(e.target.value)}
          />
          <span className="field-desc">Discord pozwala zmienić nazwę bota tylko 2 razy na godzinę.</span>
        </div>

        <div className="field">
          <span className="field-label">Avatar</span>
          <div className="avatar-edit">
            <img src={shownAvatar} alt="" className="avatar avatar-lg" />
            <div className="stack" style={{ gap: 6 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-sm" onClick={() => fileRef.current?.click()}>
                  <Icon name="cloud_upload" size={16} /> Wybierz obrazek
                </button>
                {avatar && (
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => setAvatar(null)}>
                    Anuluj
                  </button>
                )}
              </div>
              <span className="field-desc" style={{ margin: 0 }}>
                PNG, JPG, GIF lub WEBP, do 1 MB
              </span>
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
          </div>
        </div>

        {error && <div className="field-error">{error}</div>}
        {last && !last.ok && last.error && (
          <div className="notice notice-err small">
            <Icon name="shield_x" />
            <p>Ostatnia zmiana profilu nie powiodła się: {last.error}</p>
          </div>
        )}
        {profile.request && (
          <div className="notice notice-warn small">
            <Icon name="notification" />
            <p>Zmiana nazwy lub avatara czeka na bota – zostanie wykonana, gdy bot się połączy.</p>
          </div>
        )}

        <button type="button" className="btn btn-primary" disabled={!dirty || saving} onClick={save}>
          {saving ? 'Zapisywanie…' : 'Zapisz profil'}
        </button>
      </div>
      {toast.node}
    </section>
  );
}
