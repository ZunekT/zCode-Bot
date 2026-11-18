'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { post } from '@/lib/client';
import { pln } from '@/lib/money';
import { Icon } from './Icon';
import { useToast } from './Toast';

export function OrderActions({
  id,
  status,
  statuses,
  due,
}: {
  id: number;
  status: string;
  statuses: { status: string; label: string }[];
  due: number | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [next, setNext] = useState(status);
  const [amount, setAmount] = useState(due && due > 0 ? String(due) : '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  async function run(action: string, body: unknown, ok: string) {
    setBusy(action);
    const res = await post(`/api/admin/orders/${id}/${action}`, body);
    setBusy(null);
    if (!res.ok) {
      toast.show(false, res.error ?? 'Nie udało się.');
      return false;
    }
    toast.show(true, ok);
    router.refresh();
    return true;
  }

  const label = statuses.find((s) => s.status === next)?.label;
  return (
    <section className="card">
      <div className="card-head">
        <Icon name="tools" />
        <h2>Akcje</h2>
      </div>
      <div className="card-body stack" style={{ gap: 20 }}>
        <div className="field">
          <label className="field-label" htmlFor="order-status">
            Status
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <select id="order-status" value={next} onChange={(e) => setNext(e.target.value)}>
              {statuses.map((s) => (
                <option key={s.status} value={s.status}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              className="btn btn-primary"
              disabled={next === status || busy !== null}
              onClick={() => run('status', { status: next }, `Status: ${label}. Klient dostał powiadomienie.`)}
            >
              {busy === 'status' ? '…' : 'Zmień'}
            </button>
          </div>
          <span className="field-desc" style={{ marginTop: 0 }}>
            Tak samo jak na Discordzie: historia, wiadomość do klienta, panel w tickecie, role.
          </span>
        </div>

        <form
          className="field"
          onSubmit={(e) => {
            e.preventDefault();
            const v = Number(amount.replace(',', '.'));
            if (!(v > 0)) return toast.show(false, 'Podaj kwotę większą od zera.');
            void run('payment', { amount: v, note: note.trim() || undefined }, `Zapisano wpłatę ${pln(v)}.`).then((ok) => {
              if (!ok) return;
              setNote('');
              setAmount('');
            });
          }}
        >
          <label className="field-label" htmlFor="pay-amount">
            Dodaj wpłatę
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '120px minmax(0,1fr) auto', gap: 8 }}>
            <input
              id="pay-amount"
              className="input"
              inputMode="decimal"
              placeholder="kwota"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <input className="input" placeholder="notatka (opcjonalnie)" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn" type="submit" disabled={busy !== null}>
              {busy === 'payment' ? '…' : 'Zapisz'}
            </button>
          </div>
          {due !== null && due > 0 && <span className="field-desc" style={{ marginTop: 0 }}>Do zapłaty: {pln(due)}</span>}
        </form>
      </div>
      {toast.node}
    </section>
  );
}

export function TaskList({ id, tasks }: { id: number; tasks: { id: number; content: string; done: boolean }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [done, setDone] = useState(() => new Set(tasks.filter((t) => t.done).map((t) => t.id)));
  const [busy, setBusy] = useState(false);

  async function toggle(taskId: number) {
    const next = new Set(done);
    if (next.has(taskId)) next.delete(taskId);
    else next.add(taskId);
    setDone(next);
    setBusy(true);
    const res = await post(`/api/admin/orders/${id}/tasks`, { doneIds: [...next] });
    setBusy(false);
    if (!res.ok) {
      setDone(done);
      return toast.show(false, res.error ?? 'Nie udało się.');
    }
    router.refresh();
  }

  return (
    <>
      {tasks.map((t) => (
        <label key={t.id} className={`task-row${done.has(t.id) ? ' done' : ''}`}>
          <input type="checkbox" checked={done.has(t.id)} disabled={busy} onChange={() => toggle(t.id)} />
          <span>{t.content}</span>
        </label>
      ))}
      {toast.node}
    </>
  );
}
