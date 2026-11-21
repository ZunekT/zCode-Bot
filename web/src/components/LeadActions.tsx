'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useToast } from './Toast';
import { Segmented } from './ui/Segmented';

async function patch(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  window.dispatchEvent(new CustomEvent('zx:result', { detail: { ok: res.ok } }));
  return { ok: res.ok, error: data.error };
}

export function LeadActions({
  id,
  status,
  note,
  statuses,
}: {
  id: number;
  status: string;
  note: string | null;
  statuses: { value: string; label: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [current, setCurrent] = useState(status);
  const [text, setText] = useState(note ?? '');
  const [busy, setBusy] = useState(false);

  async function setStatus(v: string) {
    const prev = current;
    setCurrent(v);
    const res = await patch(`/api/admin/leads/${id}`, { status: v });
    if (!res.ok) {
      setCurrent(prev);
      return toast.show(false, res.error ?? 'Nie udało się zmienić statusu.');
    }
    toast.show(true, `Status: ${statuses.find((s) => s.value === v)?.label ?? v}`);
    router.refresh();
  }

  async function saveNote() {
    setBusy(true);
    const res = await patch(`/api/admin/leads/${id}`, { note: text });
    setBusy(false);
    if (!res.ok) return toast.show(false, res.error ?? 'Nie udało się zapisać notatki.');
    toast.show(true, 'Zapisano notatkę.');
    router.refresh();
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div>
        <span className="field-label">Status</span>
        <div style={{ marginTop: 8 }}>
          <Segmented value={current} onChange={setStatus} items={statuses} ariaLabel="Status zapytania" />
        </div>
      </div>
      <div>
        <span className="field-label">Notatka wewnętrzna</span>
        <textarea
          className="input"
          rows={4}
          maxLength={2000}
          style={{ marginTop: 8, width: '100%', padding: '10px 12px', resize: 'vertical' }}
          placeholder="np. wysłana wycena 1800 zł, czekamy na odpowiedź"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
          <button
            className={`btn btn-sm btn-primary${busy ? ' loading' : ''}`}
            disabled={busy || text === (note ?? '')}
            onClick={saveNote}
          >
            Zapisz notatkę
          </button>
        </div>
      </div>
    </div>
  );
}
