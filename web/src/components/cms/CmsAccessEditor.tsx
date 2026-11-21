'use client';

import { useState } from 'react';
import { del, put } from '@/lib/client';
import { PERM_INFO, type CmsMember, type CmsPerm, type CmsSection, type Person } from '@/lib/cms';
import { PersonChip } from '../PersonChip';
import { useToast } from '../Toast';
import { Modal } from '../ui/Modal';

interface Editing {
  userId: string;
  perms: CmsPerm[];
  sections: string[];
  isNew: boolean;
}

export function CmsAccessEditor({
  siteId,
  ownerId,
  me,
  initial,
  people: initialPeople,
  sections,
}: {
  siteId: number;
  ownerId: string;
  me: { owner: boolean; perms: CmsPerm[]; sections: string[] | null };
  initial: CmsMember[];
  people: Record<string, Person>;
  sections: CmsSection[];
}) {
  const [members, setMembers] = useState(initial);
  const [people, setPeople] = useState(initialPeople);
  const [edit, setEdit] = useState<Editing | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const mine = PERM_INFO.filter((p) => me.perms.includes(p.key));
  const mySections = sections.filter((s) => !me.sections || me.sections.includes(s.key));
  const who = (id: string): Person => people[id] ?? { id, name: `Użytkownik …${id.slice(-4)}`, avatar: null };

  async function save() {
    if (!edit) return;
    if (!/^\d{17,20}$/.test(edit.userId.trim())) return setError('Wpisz ID użytkownika Discord (17–20 cyfr).');
    setBusy(true);
    setError(null);
    const res = await put<{ members: CmsMember[]; people: Record<string, Person> }>(`/api/strony/${siteId}/members/${edit.userId.trim()}`, {
      permissions: edit.perms,
      sections: edit.sections,
    });
    setBusy(false);
    if (!res.ok || !res.data) return setError(res.error ?? 'Nie udało się zapisać.');
    setMembers(res.data.members);
    setPeople((p) => ({ ...p, ...res.data!.people }));
    setEdit(null);
    toast.show(true, 'Zapisano dostęp.');
  }

  async function remove(userId: string) {
    if (!confirm(`Odebrać dostęp: ${who(userId).name}?`)) return;
    const res = await del<{ members: CmsMember[] }>(`/api/strony/${siteId}/members/${userId}`);
    if (!res.ok || !res.data) return toast.show(false, res.error ?? 'Nie udało się usunąć.');
    setMembers(res.data.members);
    toast.show(true, 'Odebrano dostęp.');
  }

  const toggle = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <section className="card">
      <div className="card-head">
        <h2>Kto może edytować stronę</h2>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => { setError(null); setEdit({ userId: '', perms: ['content'], sections: [], isNew: true }); }}>
          + Dodaj osobę
        </button>
      </div>
      <ul className="list access-list">
        <li className="link-row">
          <PersonChip p={who(ownerId)} sub="Właściciel – pełny dostęp" />
        </li>
        {members.map((m) => (
          <li key={m.userId} className="link-row">
            <PersonChip p={who(m.userId)} sub={m.sections.length ? `Sekcje: ${m.sections.map((k) => sections.find((s) => s.key === k)?.label ?? k).join(', ')}` : 'Wszystkie sekcje'} />
            <span className="access-perms">
              {m.permissions.map((p) => (
                <span key={p} className="pill pill-muted">
                  {PERM_INFO.find((x) => x.key === p)?.label ?? p}
                </span>
              ))}
            </span>
            <span className="row" style={{ gap: 6 }}>
              <button type="button" className="btn btn-sm" onClick={() => { setError(null); setEdit({ userId: m.userId, perms: m.permissions, sections: m.sections, isNew: false }); }}>
                Zmień
              </button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => remove(m.userId)}>
                Usuń
              </button>
            </span>
          </li>
        ))}
        {members.length === 0 && <li className="faint" style={{ padding: '6px 20px 18px' }}>Na razie tylko właściciel. Dodaj osobę, żeby mogła pomóc w edycji.</li>}
      </ul>

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.isNew ? 'Dodaj osobę' : `Dostęp: ${edit ? who(edit.userId).name : ''}`}
        busy={busy}
        actions={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setEdit(null)}>
              Anuluj
            </button>
            <button type="button" className={`btn btn-primary${busy ? ' loading' : ''}`} disabled={busy || !edit?.perms.length} onClick={save}>
              Zapisz
            </button>
          </>
        }
      >
        {edit && (
          <div className="stack" style={{ gap: 16 }}>
            {edit.isNew && (
              <label className="field">
                <span className="field-label">ID użytkownika Discord</span>
                <input className="input" inputMode="numeric" placeholder="np. 123456789012345678" value={edit.userId} onChange={(e) => setEdit({ ...edit, userId: e.target.value.replace(/\D/g, '') })} />
                <span className="field-desc">Discord → Ustawienia → Zaawansowane → Tryb dewelopera, potem prawy klik na osobę → Kopiuj ID.</span>
              </label>
            )}
            <div>
              <span className="field-label">Uprawnienia</span>
              <div className="perm-grid">
                {mine.map((p) => (
                  <label key={p.key} className={`perm-opt${edit.perms.includes(p.key) ? ' on' : ''}`}>
                    <input type="checkbox" checked={edit.perms.includes(p.key)} onChange={() => setEdit({ ...edit, perms: toggle(edit.perms, p.key) })} />
                    <span>
                      <b>{p.label}</b>
                      <small>{p.hint}</small>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            {mySections.length > 1 && (
              <div>
                <span className="field-label">Sekcje treści</span>
                <span className="field-desc">Nic nie zaznaczone = {me.sections ? 'Twoje sekcje' : 'wszystkie sekcje'}</span>
                <div className="q-chips" style={{ marginTop: 8 }}>
                  {mySections.map((s) => (
                    <button key={s.key} type="button" className={`q-chip${edit.sections.includes(s.key) ? ' on' : ''}`} onClick={() => setEdit({ ...edit, sections: toggle(edit.sections, s.key) })}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {error && <p className="field-error">{error}</p>}
          </div>
        )}
      </Modal>
      {toast.node}
    </section>
  );
}
