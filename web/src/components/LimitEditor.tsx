'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { put } from '@/lib/client';
import { pln } from '@/lib/money';
import { useToast } from './Toast';

/** Limit kwartalny: kliknij, żeby zmienić. */
export function LimitEditor({ limit }: { limit: number }) {
  const router = useRouter();
  const toast = useToast();
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(String(limit));
  const [busy, setBusy] = useState(false);

  if (!edit) {
    return (
      <button className="btn btn-ghost btn-sm" style={{ fontSize: 22, fontWeight: 800, padding: '0 6px', height: 'auto' }} onClick={() => setEdit(true)} title="Zmień limit">
        {pln(limit)}
      </button>
    );
  }
  return (
    <form
      className="row"
      style={{ justifyContent: 'flex-end', marginTop: 4 }}
      onSubmit={async (e) => {
        e.preventDefault();
        const n = Number(v.replace(',', '.'));
        if (!(n > 0)) return toast.show(false, 'Podaj kwotę większą od zera.');
        setBusy(true);
        const res = await put('/api/admin/ledger/settings', { quarterLimit: n });
        setBusy(false);
        if (!res.ok) return toast.show(false, res.error ?? 'Nie udało się.');
        toast.show(true, `Limit: ${pln(n)}`);
        setEdit(false);
        router.refresh();
      }}
    >
      <input className="input" style={{ width: 130, height: 36 }} inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} autoFocus aria-label="Limit kwartalny" />
      <button className={`btn btn-sm btn-primary${busy ? ' loading' : ''}`} type="submit">
        Zapisz
      </button>
    </form>
  );
}
