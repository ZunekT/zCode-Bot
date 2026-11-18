'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { SiteAccessData } from '@/lib/api';
import { put } from '@/lib/client';
import { Icon } from './Icon';
import { useToast } from './Toast';
import { Modal } from './ui/Modal';

export function SiteAccessCard({ initial }: { initial: SiteAccessData }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [newId, setNewId] = useState('');
  const ids = initial.previewUsers.map((u) => u.id);

  async function save(body: { launched?: boolean; previewUsers?: string[] }, ok: string) {
    setBusy(true);
    const res = await put('/api/admin/site', body);
    setBusy(false);
    setConfirm(false);
    if (!res.ok) return toast.show(false, res.error ?? 'Nie udało się zapisać.');
    toast.show(true, ok);
    router.refresh();
  }

  function add() {
    const id = newId.trim().replace(/[<@!>]/g, '');
    if (!/^\d{17,20}$/.test(id)) return toast.show(false, 'Wklej ID użytkownika Discord (17–20 cyfr).');
    setNewId('');
    void save({ previewUsers: [...ids, id] }, 'Dodano podgląd.');
  }

  return (
    <section className="card glow" style={{ marginBottom: 16 }}>
      <div className="card-head">
        <Icon name="desktop" />
        <h2>Strona publiczna</h2>
        <span className={`pill ${initial.launched ? 'pill-ok' : 'pill-err'}`} style={{ marginLeft: 8 }}>
          {initial.launched ? 'Uruchomiona' : 'Start wkrótce'}
        </span>
        <div className="spacer" />
        {initial.launched ? (
          <button className="btn btn-sm" disabled={busy} onClick={() => save({ launched: false }, 'Strona ukryta – wszyscy widzą „Start wkrótce”.')}>
            Włącz „Start wkrótce”
          </button>
        ) : (
          <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => setConfirm(true)}>
            Uruchom stronę
          </button>
        )}
      </div>
      <div className="card-body stack" style={{ gap: 14 }}>
        <p className="muted small">
          {initial.launched
            ? 'Stronę widzi każdy.'
            : 'Wszyscy poza Tobą i osobami poniżej widzą tylko „Start wkrótce”. Podgląd działa po zalogowaniu na zxcode.pl/zaloguj.'}
        </p>
        <div>
          <div className="field-label" style={{ marginBottom: 8 }}>
            Podgląd przed startem
          </div>
          <div className="chips">
            {initial.previewUsers.length === 0 && <span className="muted small">tylko Ty</span>}
            {initial.previewUsers.map((u) => (
              <span key={u.id} className="chip">
                {u.avatar && /^https:\/\/cdn\.discordapp\.com\//.test(u.avatar) && (
                  <img src={u.avatar} alt="" width={18} height={18} style={{ borderRadius: '50%' }} />
                )}
                {u.name ?? u.id}
                <button
                  type="button"
                  aria-label={`Usuń ${u.name ?? u.id}`}
                  disabled={busy}
                  onClick={() => save({ previewUsers: ids.filter((x) => x !== u.id) }, 'Odebrano podgląd.')}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
        <form
          style={{ display: 'flex', gap: 8, maxWidth: 460 }}
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <input
            className="input"
            placeholder="ID użytkownika Discord"
            inputMode="numeric"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            aria-label="ID użytkownika Discord"
          />
          <button className="btn" type="submit" disabled={busy || !newId.trim()}>
            Dodaj
          </button>
        </form>
        <p className="faint small">Na Discordzie: /strona dodaj @osoba · /strona uruchom · /strona wkrotce</p>
      </div>
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Uruchomić stronę dla wszystkich?"
        busy={busy}
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setConfirm(false)} disabled={busy}>
              Anuluj
            </button>
            <button className={`btn btn-primary${busy ? ' loading' : ''}`} onClick={() => save({ launched: true }, 'Strona uruchomiona!')} autoFocus>
              Uruchom
            </button>
          </>
        }
      >
        <p>Każdy odwiedzający zobaczy pełną stronę zxcode.pl. Możesz w każdej chwili wrócić do „Start wkrótce”.</p>
      </Modal>
      {toast.node}
    </section>
  );
}
