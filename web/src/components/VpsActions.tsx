'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icon } from './Icon';
import { useToast } from './Toast';

type Action = 'reboot' | 'backup';

const CONFIRM: Record<Action, { title: string; text: string; button: string; danger: boolean }> = {
  reboot: {
    title: 'Zrestartować VPS?',
    text: 'Bot zxCode, ta strona i baza danych będą niedostępne przez 1–2 minuty. Wszystko uruchomi się samo po starcie systemu.',
    button: 'Tak, zrestartuj',
    danger: true,
  },
  backup: {
    title: 'Zrobić kopię zapasową?',
    text: 'Mathost wykona kopię całego dysku. Serwer działa w tym czasie normalnie, kopia pojawi się na liście po kilku minutach.',
    button: 'Zrób kopię',
    danger: false,
  },
};

export function VpsActions() {
  const router = useRouter();
  const toast = useToast();
  const [confirm, setConfirm] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: Action) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/vps/${action}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Nie udało się.');
      toast.show(true, action === 'reboot' ? 'Restart zlecony – strona wróci za 1–2 minuty.' : 'Kopia zapasowa zlecona.');
      if (action === 'backup') setTimeout(() => router.refresh(), 1500);
    } catch (err) {
      toast.show(false, (err as Error).message);
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  const c = confirm ? CONFIRM[confirm] : null;
  return (
    <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-sm" onClick={() => router.refresh()}>
          <Icon name="tools" size={16} /> Odśwież
        </button>
        <button className="btn btn-sm" onClick={() => setConfirm('backup')}>
          <Icon name="database" size={16} /> Kopia zapasowa
        </button>
        <button className="btn btn-sm btn-danger" onClick={() => setConfirm('reboot')}>
          <Icon name="lightning" size={16} /> Restart VPS
        </button>
      </div>
      {c && confirm && (
        <div className="modal-back" role="presentation" onClick={() => !busy && setConfirm(null)}>
          <div className="card modal" role="dialog" aria-modal="true" aria-labelledby="vps-confirm" onClick={(e) => e.stopPropagation()}>
            <h2 id="vps-confirm">{c.title}</h2>
            <p className="muted">{c.text}</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setConfirm(null)} disabled={busy}>
                Anuluj
              </button>
              <button className={`btn ${c.danger ? 'btn-danger-solid' : 'btn-primary'}`} onClick={() => run(confirm)} disabled={busy} autoFocus>
                {busy ? 'Chwila…' : c.button}
              </button>
            </div>
          </div>
        </div>
      )}
      {toast.node}
    </>
  );
}
