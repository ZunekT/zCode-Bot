'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { del, put } from '@/lib/client';
import type { BotMember, BotMembers, BotPerm } from '@/lib/types';
import { Icon } from './Icon';
import { PersonChip } from './PersonChip';
import { useToast } from './Toast';
import { Modal } from './ui/Modal';

const PERMS: { key: BotPerm; label: string; hint: string }[] = [
  { key: 'settings', label: 'Ustawienia serwerów', hint: 'Zmiana ustawień bota na serwerach' },
  { key: 'commands', label: 'Uprawnienia komend', hint: 'Które role mogą używać komend' },
  { key: 'profile', label: 'Profil bota', hint: 'Nazwa, avatar i status bota' },
  {
    key: 'access',
    label: 'Zarządzanie dostępem',
    hint: 'Dodawanie i usuwanie osób (w granicach własnych uprawnień)',
  },
];

const summary = (perms: BotPerm[]) =>
  perms.length === PERMS.length
    ? 'pełny dostęp'
    : perms.length
      ? PERMS.filter((p) => perms.includes(p.key))
          .map((p) => p.label.toLowerCase())
          .join(', ')
      : 'tylko podgląd';

interface Editing {
  id: string;
  name: string;
  perms: BotPerm[];
  isNew: boolean;
}

export function BotAccessEditor({ botId, me, data }: { botId: number; me: string; data: BotMembers }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [newId, setNewId] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const mine = data.me.perms;
  const manager = mine.includes('access');
  const canManage = (m: BotMember) => manager && m.id !== me && m.permissions.every((p) => mine.includes(p));

  function startAdd() {
    const id = newId.trim().replace(/[<@!>]/g, '');
    if (!/^\d{17,20}$/.test(id)) return toast.show(false, 'Wklej poprawne ID Discord (17–20 cyfr).');
    if (id === me) return toast.show(false, 'To Twoje ID.');
    if (id === data.owner.id) return toast.show(false, 'To właściciel bota – ma pełny dostęp.');
    if (data.members.some((m) => m.id === id))
      return toast.show(false, 'Ta osoba ma już dostęp – zmień jej uprawnienia na liście.');
    setEditing({
      id,
      name: `ID ${id}`,
      perms: (['settings', 'commands'] as BotPerm[]).filter((p) => mine.includes(p)),
      isNew: true,
    });
  }

  async function save() {
    if (!editing) return;
    setBusy('save');
    const res = await put<{ added: boolean }>(`/api/bots/${botId}/members/${editing.id}`, {
      permissions: editing.perms,
    });
    setBusy(null);
    if (!res.ok) return toast.show(false, res.error ?? 'Nie udało się zapisać.');
    toast.show(
      true,
      res.data?.added
        ? 'Udostępniono bota – osoba dostała wiadomość na Discordzie.'
        : 'Zapisano uprawnienia.',
    );
    setEditing(null);
    setNewId('');
    router.refresh();
  }

  async function remove(m: BotMember) {
    const self = m.id === me;
    if (!confirm(self ? 'Zrezygnować z dostępu do tego bota?' : `Odebrać dostęp: ${m.name}?`)) return;
    setBusy(m.id);
    const res = await del(`/api/bots/${botId}/members/${m.id}`);
    setBusy(null);
    if (!res.ok) return toast.show(false, res.error ?? 'Nie udało się.');
    toast.show(true, self ? 'Zrezygnowano z dostępu.' : 'Odebrano dostęp.');
    if (self) router.push('/panel/boty');
    else router.refresh();
  }

  const toggle = (p: BotPerm) =>
    setEditing(
      (e) => e && { ...e, perms: e.perms.includes(p) ? e.perms.filter((x) => x !== p) : [...e.perms, p] },
    );

  return (
    <section className="card glow">
      <div className="card-head">
        <Icon name="user_crown" />
        <h2>Dostęp do bota</h2>
        <div className="spacer" />
        <span className="faint small">{data.members.length + 1} os.</span>
      </div>

      <div className="list">
        <div className="link-row">
          <PersonChip p={data.owner} sub="Właściciel · pełny dostęp" />
          <div className="grow" />
          {data.owner.id === me && <span className="pill pill-ok">Ty</span>}
        </div>
        {data.members.map((m) => (
          <div key={m.id} className="link-row">
            <PersonChip p={m} sub={summary(m.permissions)} />
            <div className="grow" />
            {m.id === me && <span className="pill pill-plain">Ty</span>}
            {canManage(m) && (
              <button
                className="btn btn-sm"
                disabled={busy !== null}
                onClick={() => setEditing({ id: m.id, name: m.name, perms: m.permissions, isNew: false })}
              >
                Zmień
              </button>
            )}
            {(canManage(m) || m.id === me) && (
              <button
                className={`btn btn-sm btn-danger${busy === m.id ? ' loading' : ''}`}
                disabled={busy !== null}
                onClick={() => remove(m)}
              >
                {m.id === me ? 'Zrezygnuj' : 'Usuń'}
              </button>
            )}
          </div>
        ))}
      </div>

      {manager ? (
        <div className="card-body stack" style={{ gap: 10, borderTop: '1px solid var(--border)' }}>
          <span className="field-label">Udostępnij bota</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              inputMode="numeric"
              placeholder="ID Discord osoby"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && startAdd()}
            />
            <button className="btn btn-primary" onClick={startAdd} disabled={busy !== null || !newId.trim()}>
              Dodaj
            </button>
          </div>
          <span className="faint small">
            ID skopiujesz na Discordzie: Ustawienia → Zaawansowane → Tryb dewelopera, potem prawy klik na
            osobę → Kopiuj ID.
          </span>
        </div>
      ) : (
        <div className="card-body faint small" style={{ borderTop: '1px solid var(--border)' }}>
          Masz dostęp: {summary(mine)}. Dostępem zarządza właściciel bota.
        </div>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        busy={busy === 'save'}
        title={editing?.isNew ? 'Udostępnij bota' : `Uprawnienia: ${editing?.name ?? ''}`}
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setEditing(null)} disabled={busy === 'save'}>
              Anuluj
            </button>
            <button
              className={`btn btn-primary${busy === 'save' ? ' loading' : ''}`}
              onClick={save}
              disabled={busy === 'save'}
            >
              {editing?.isNew ? 'Udostępnij' : 'Zapisz'}
            </button>
          </>
        }
      >
        {editing && (
          <div className="stack" style={{ gap: 4 }}>
            {editing.isNew && (
              <p className="muted small" style={{ marginBottom: 8 }}>
                Osoba: {editing.name}. Zawsze może przeglądać bota; zaznacz, co może zmieniać.
              </p>
            )}
            {PERMS.map((p) => {
              const allowed = mine.includes(p.key);
              return (
                <label
                  key={p.key}
                  className="link-row"
                  style={{ cursor: allowed ? 'pointer' : 'not-allowed', opacity: allowed ? 1 : 0.5 }}
                >
                  <span className="grow">
                    <span style={{ fontWeight: 600, display: 'block' }}>{p.label}</span>
                    <span className="faint small">
                      {allowed ? p.hint : 'Nie masz tego uprawnienia, więc nie możesz go nadać.'}
                    </span>
                  </span>
                  <button
                    type="button"
                    role="switch"
                    className="switch"
                    aria-label={p.label}
                    aria-checked={editing.perms.includes(p.key)}
                    disabled={!allowed}
                    onClick={() => toggle(p.key)}
                  />
                </label>
              );
            })}
          </div>
        )}
      </Modal>
    </section>
  );
}
