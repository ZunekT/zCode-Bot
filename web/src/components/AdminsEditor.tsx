'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Person } from '@/lib/api';
import { put } from '@/lib/client';
import { roleColor } from '@/lib/format';
import { Icon } from './Icon';
import { PersonChip } from './PersonChip';
import { useToast } from './Toast';
import { Select } from './ui/Select';
import { EmptyState } from './ui/EmptyState';

interface Data {
  users: Person[];
  roles: string[];
  guildRoles: { id: string; name: string; color: number; members: number }[];
}

export function AdminsEditor({ initial, people }: { initial: Data; people: Person[] }) {
  const router = useRouter();
  const toast = useToast();
  const [roles, setRoles] = useState(initial.roles);
  const [pick, setPick] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const ids = initial.users.map((u) => u.id);
  const rolesDirty = roles.join() !== initial.roles.join();

  async function save(key: string, body: { users?: string[]; roles?: string[] }, ok: string) {
    setBusy(key);
    const res = await put('/api/admin/admins', body);
    setBusy(null);
    if (!res.ok) return toast.show(false, res.error ?? 'Nie udało się zapisać.');
    toast.show(true, ok);
    router.refresh();
  }

  function add() {
    const id = (manual.trim() || pick || '').replace(/[<@!>]/g, '');
    if (!/^\d{17,20}$/.test(id)) return toast.show(false, 'Wybierz osobę albo wklej ID Discord.');
    if (ids.includes(id)) return toast.show(false, 'Ta osoba już jest administratorem.');
    setManual('');
    setPick(null);
    void save('add', { users: [...ids, id] }, 'Nadano uprawnienia administracyjne.');
  }

  const fromRoles = initial.guildRoles.filter((r) => roles.includes(r.id)).reduce((s, r) => s + r.members, 0);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="notice">
        <Icon name="shield_check" />
        <p className="small">
          Administratorzy widzą w panelu: Przegląd, Zlecenia, Tickety, Klienci i Dziennik, a w bocie mają uprawnienia
          administracyjne. <b>Ewidencja, Strona i serwer oraz ta lista są tylko dla Ciebie.</b> Na Discordzie:{' '}
          <code>/administratorzy dodaj | usun | rola | lista</code>.
        </p>
      </div>

      <div className="grid2">
        <section className="card glow">
          <div className="card-head">
            <Icon name="user_crown" />
            <h2>Osoby ({initial.users.length})</h2>
          </div>
          {initial.users.length === 0 ? (
            <EmptyState compact icon="user_crown" title="Tylko Ty" text="Nikt poza Tobą nie ma uprawnień administracyjnych." />
          ) : (
            <div className="list">
              {initial.users.map((u) => (
                <div key={u.id} className="link-row">
                  <PersonChip p={u} sub={`ID ${u.id}`} />
                  <div className="grow" />
                  <button
                    className={`btn btn-sm btn-danger${busy === u.id ? ' loading' : ''}`}
                    disabled={busy !== null}
                    onClick={() => save(u.id, { users: ids.filter((x) => x !== u.id) }, 'Odebrano uprawnienia.')}
                  >
                    Odbierz
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="card-body stack" style={{ gap: 10, borderTop: '1px solid var(--border)' }}>
            <span className="field-label">Dodaj osobę</span>
            <Select
              ariaLabel="Wybierz osobę"
              value={pick}
              onChange={(v) => {
                setPick(v);
                setManual('');
              }}
              placeholder={people.length ? 'Wybierz z klientów i osób z ticketów…' : 'Brak znanych osób'}
              searchable
              options={people.filter((p) => !ids.includes(p.id)).map((p) => ({ value: p.id, label: p.name, hint: p.id.slice(-5) }))}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                inputMode="numeric"
                placeholder="albo wklej ID Discord"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && add()}
              />
              <button className={`btn btn-primary${busy === 'add' ? ' loading' : ''}`} onClick={add} disabled={busy !== null || (!pick && !manual.trim())}>
                Dodaj
              </button>
            </div>
          </div>
        </section>

        <section className="card glow">
          <div className="card-head">
            <Icon name="crown" />
            <h2>Role Discorda</h2>
          </div>
          <div className="card-body stack" style={{ gap: 12 }}>
            <p className="muted small">
              Każdy z wybraną rolą na serwerze zxCode jest administratorem – nadajesz i odbierasz uprawnienia rangą na Discordzie.
            </p>
            <Select
              multiple
              ariaLabel="Role administratorów"
              value={roles}
              onChange={setRoles}
              placeholder="Wybierz role…"
              searchable
              options={initial.guildRoles.map((r) => ({ value: r.id, label: r.name, color: roleColor(r.color), prefix: '@', hint: `${r.members} os.` }))}
            />
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="faint small">{roles.length ? `obecnie ok. ${fromRoles} osób z tymi rolami` : 'bez ról'}</span>
              <button
                className={`btn btn-primary btn-sm${busy === 'roles' ? ' loading' : ''}`}
                disabled={!rolesDirty || busy !== null}
                onClick={() => save('roles', { roles }, 'Zapisano role administratorów.')}
              >
                Zapisz role
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
