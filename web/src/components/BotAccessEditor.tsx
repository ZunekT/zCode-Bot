'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { del, put } from '@/lib/client';
import type { BotAccess, BotMember, BotMembers, BotPerm } from '@/lib/types';
import { Icon } from './Icon';
import { PersonChip } from './PersonChip';
import { useToast } from './Toast';
import { Modal } from './ui/Modal';
import { Select } from './ui/Select';

const PERMS: { key: BotPerm; label: string; hint: string }[] = [
  { key: 'settings', label: 'Ustawienia i moduły', hint: 'Konfiguracja modułów bota na serwerach' },
  { key: 'commands', label: 'Uprawnienia komend', hint: 'Które role mogą używać komend' },
  { key: 'profile', label: 'Profil bota', hint: 'Nazwa, avatar i status bota' },
  {
    key: 'access',
    label: 'Zarządzanie dostępem',
    hint: 'Dodawanie i usuwanie osób (w granicach własnych uprawnień)',
  },
];

interface Named {
  key: string;
  label: string;
}

interface Editing {
  id: string;
  name: string;
  perms: BotPerm[];
  modules: string[];
  guilds: string[];
  isNew: boolean;
}

export function BotAccessEditor({
  botId,
  me,
  data,
  modules,
  guilds,
}: {
  botId: number;
  me: string;
  data: BotMembers;
  modules: Named[];
  guilds: Named[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [newId, setNewId] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const mine: BotAccess = data.me;
  const manager = mine.perms.includes('access');
  // Moduły i serwery, które mogę przydzielić (ograniczone moim własnym zakresem).
  const myModules = mine.modules ? modules.filter((m) => mine.modules!.includes(m.key)) : modules;
  const myGuilds = mine.guilds ? guilds.filter((g) => mine.guilds!.includes(g.key)) : guilds;
  const labelOf = (list: Named[], key: string) => list.find((x) => x.key === key)?.label ?? key;

  const within = (mineList: string[] | null, theirs: string[]) =>
    !mineList || (theirs.length > 0 && theirs.every((x) => mineList.includes(x)));
  const canManage = (m: BotMember) =>
    manager &&
    m.id !== me &&
    m.permissions.every((p) => mine.perms.includes(p)) &&
    (!m.permissions.includes('settings') || within(mine.modules, m.modules)) &&
    (!(m.permissions.includes('settings') || m.permissions.includes('commands')) ||
      within(mine.guilds, m.guilds));

  function summary(m: { permissions: BotPerm[]; modules: string[]; guilds: string[] }) {
    if (!m.permissions.length) return 'tylko podgląd';
    const parts = PERMS.filter((p) => m.permissions.includes(p.key)).map((p) =>
      p.key === 'settings' && m.modules.length
        ? `moduły: ${m.modules.map((k) => labelOf(modules, k)).join(', ')}`
        : p.label.toLowerCase(),
    );
    const scope = m.guilds.length ? ` · serwery: ${m.guilds.map((k) => labelOf(guilds, k)).join(', ')}` : '';
    return (
      (m.permissions.length === PERMS.length && !m.modules.length && !m.guilds.length
        ? 'pełny dostęp'
        : parts.join(', ')) + scope
    );
  }

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
      perms: (['settings', 'commands'] as BotPerm[]).filter((p) => mine.perms.includes(p)),
      modules: mine.modules ? [...mine.modules] : [],
      guilds: mine.guilds ? [...mine.guilds] : [],
      isNew: true,
    });
  }

  async function save() {
    if (!editing) return;
    const { perms, modules: mods, guilds: gs } = editing;
    if (perms.includes('settings') && mine.modules && !mods.length)
      return toast.show(false, 'Wybierz moduły.');
    if ((perms.includes('settings') || perms.includes('commands')) && mine.guilds && !gs.length)
      return toast.show(false, 'Wybierz serwery.');
    setBusy('save');
    const res = await put<{ added: boolean }>(`/api/bots/${botId}/members/${editing.id}`, {
      permissions: perms,
      modules: mods,
      guilds: gs,
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
  const scoped = editing && (editing.perms.includes('settings') || editing.perms.includes('commands'));

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
            <PersonChip p={m} sub={summary(m)} />
            <div className="grow" />
            {m.id === me && <span className="pill pill-plain">Ty</span>}
            {canManage(m) && (
              <button
                className="btn btn-sm"
                disabled={busy !== null}
                onClick={() =>
                  setEditing({
                    id: m.id,
                    name: m.name,
                    perms: m.permissions,
                    modules: m.modules,
                    guilds: m.guilds,
                    isNew: false,
                  })
                }
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
          Twój dostęp:{' '}
          {summary({ permissions: mine.perms, modules: mine.modules ?? [], guilds: mine.guilds ?? [] })}.
          Dostępem zarządza właściciel bota.
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
              const allowed = mine.perms.includes(p.key);
              return (
                <div key={p.key}>
                  <label
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
                  {p.key === 'settings' && editing.perms.includes('settings') && myModules.length > 0 && (
                    <div className="stack" style={{ gap: 6, padding: '0 16px 12px' }}>
                      <span className="faint small">Które moduły może edytować</span>
                      <Select
                        multiple
                        ariaLabel="Moduły"
                        value={editing.modules}
                        onChange={(v) => setEditing((e) => e && { ...e, modules: v })}
                        placeholder={mine.modules ? 'Wybierz moduły…' : 'Wszystkie moduły'}
                        options={myModules.map((m) => ({ value: m.key, label: m.label }))}
                      />
                    </div>
                  )}
                </div>
              );
            })}
            {scoped && myGuilds.length > 0 && (
              <div
                className="stack"
                style={{ gap: 6, padding: '12px 16px 0', borderTop: '1px solid var(--border)' }}
              >
                <span style={{ fontWeight: 600 }}>Serwery</span>
                <span className="faint small">
                  Na których serwerach działają ustawienia i uprawnienia komend tej osoby
                </span>
                <Select
                  multiple
                  ariaLabel="Serwery"
                  value={editing.guilds}
                  onChange={(v) => setEditing((e) => e && { ...e, guilds: v })}
                  placeholder={mine.guilds ? 'Wybierz serwery…' : 'Wszystkie serwery'}
                  options={myGuilds.map((g) => ({ value: g.key, label: g.label }))}
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </section>
  );
}
