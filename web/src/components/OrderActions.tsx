'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { post } from '@/lib/client';
import { pln } from '@/lib/money';
import { Icon } from './Icon';
import { useToast } from './Toast';
import { Modal } from './ui/Modal';
import { Select } from './ui/Select';

type Busy = string | null;

async function patch(url: string, body: unknown) {
  const res = await fetch(url, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return { ok: res.ok, error: data.error };
}

export interface OrderForEdit {
  id: number;
  title: string;
  description: string | null;
  price: number | null;
  deadline: string | null;
  repoUrl: string | null;
}

export function OrderActions({
  order,
  status,
  statuses,
  due,
}: {
  order: OrderForEdit;
  status: string;
  statuses: { status: string; label: string }[];
  due: number | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const id = order.id;
  const [next, setNext] = useState(status);
  const [amount, setAmount] = useState(due && due > 0 ? String(due) : '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<Busy>(null);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({
    title: order.title,
    description: order.description ?? '',
    price: order.price === null ? '' : String(order.price),
    deadline: order.deadline ? order.deadline.slice(0, 10) : '',
    repoUrl: order.repoUrl ?? '',
  });
  const [tasks, setTasks] = useState('');
  const [inv, setInv] = useState({ open: false, amount: '', days: '7' });

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) {
    setBusy(key);
    const res = await fn();
    setBusy(null);
    if (!res.ok) {
      toast.show(false, res.error ?? 'Nie udało się.');
      return false;
    }
    toast.show(true, ok);
    router.refresh();
    return true;
  }
  const action = (a: string, body: unknown) => () => post(`/api/admin/orders/${id}/${a}`, body);
  const label = statuses.find((s) => s.status === next)?.label;

  return (
    <section className="card glow">
      <div className="card-head">
        <Icon name="tools" />
        <h2>Akcje</h2>
        <div className="spacer" />
        <button className="btn btn-sm" onClick={() => setEdit(true)}>
          Edytuj
        </button>
      </div>
      <div className="card-body stack" style={{ gap: 22 }}>
        <div className="field">
          <span className="field-label">Status</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Select
              ariaLabel="Status zlecenia"
              value={next}
              onChange={(v) => v && setNext(v)}
              options={statuses.map((s) => ({ value: s.status, label: s.label }))}
            />
            <button
              className={`btn btn-primary${busy === 'status' ? ' loading' : ''}`}
              disabled={next === status || busy !== null}
              onClick={() => run('status', action('status', { status: next }), `Status: ${label}. Klient dostał powiadomienie.`)}
            >
              Zmień
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
            void run('payment', action('payment', { amount: v, note: note.trim() || undefined }), `Zapisano wpłatę ${pln(v)}.`).then((ok) => {
              if (!ok) return;
              setNote('');
              setAmount('');
            });
          }}
        >
          <span className="field-label">Dodaj wpłatę</span>
          <div style={{ display: 'grid', gridTemplateColumns: '110px minmax(0,1fr) auto', gap: 8 }}>
            <input className="input" inputMode="decimal" placeholder="kwota" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Kwota" />
            <input className="input" placeholder="notatka" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} aria-label="Notatka" />
            <button className={`btn${busy === 'payment' ? ' loading' : ''}`} type="submit" disabled={busy !== null}>
              Zapisz
            </button>
          </div>
          {due !== null && due > 0 && (
            <span className="field-desc" style={{ marginTop: 0 }}>
              Do zapłaty: {pln(due)}
            </span>
          )}
        </form>

        <form
          className="field"
          onSubmit={(e) => {
            e.preventDefault();
            if (!tasks.trim()) return;
            void run('tasks', action('addtasks', { text: tasks }), 'Dodano zadania.').then((ok) => ok && setTasks(''));
          }}
        >
          <span className="field-label">Dodaj zadania</span>
          <textarea
            className="input"
            rows={3}
            placeholder={'Jedno zadanie w linii, np.\nSystem ekonomii\nPanel ustawień'}
            value={tasks}
            onChange={(e) => setTasks(e.target.value)}
            style={{ minHeight: 84 }}
          />
          <button className={`btn btn-sm${busy === 'tasks' ? ' loading' : ''}`} type="submit" disabled={busy !== null || !tasks.trim()} style={{ alignSelf: 'flex-start' }}>
            Dodaj
          </button>
        </form>

        <div className="field">
          <span className="field-label">Proforma</span>
          <button className="btn" onClick={() => setInv((s) => ({ ...s, open: true, amount: due && due > 0 ? String(due) : '' }))} disabled={busy !== null}>
            <Icon name="invoice" size={16} /> Wystaw proformę
          </button>
          <span className="field-desc" style={{ marginTop: 0 }}>
            Bot wyśle ją klientowi w tickecie, a klient zobaczy ją w panelu.
          </span>
        </div>
      </div>

      <Modal
        open={edit}
        onClose={() => setEdit(false)}
        title="Edytuj zlecenie"
        busy={busy === 'edit'}
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setEdit(false)}>
              Anuluj
            </button>
            <button
              className={`btn btn-primary${busy === 'edit' ? ' loading' : ''}`}
              onClick={() =>
                run(
                  'edit',
                  () =>
                    patch(`/api/admin/orders/${id}`, {
                      title: form.title,
                      description: form.description || null,
                      price: form.price === '' ? null : Number(form.price.replace(',', '.')),
                      deadline: form.deadline || null,
                      repoUrl: form.repoUrl || null,
                    }),
                  'Zapisano zmiany.',
                ).then((ok) => ok && setEdit(false))
              }
            >
              Zapisz
            </button>
          </>
        }
      >
        <div className="stack" style={{ gap: 12, marginTop: 12 }}>
          <label className="field">
            <span className="field-label">Tytuł</span>
            <input className="input" value={form.title} maxLength={100} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <div className="grid2">
            <label className="field">
              <span className="field-label">Cena (zł)</span>
              <input className="input" inputMode="decimal" value={form.price} placeholder="do wyceny" onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </label>
            <label className="field">
              <span className="field-label">Termin</span>
              <input className="input" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            </label>
          </div>
          <label className="field">
            <span className="field-label">Repozytorium</span>
            <input className="input" value={form.repoUrl} placeholder="https://github.com/…" onChange={(e) => setForm({ ...form, repoUrl: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">Opis</span>
            <textarea className="input" rows={4} value={form.description} maxLength={2000} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
        </div>
      </Modal>

      <Modal
        open={inv.open}
        onClose={() => setInv((s) => ({ ...s, open: false }))}
        title="Wystaw proformę"
        busy={busy === 'invoice'}
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setInv((s) => ({ ...s, open: false }))}>
              Anuluj
            </button>
            <button
              className={`btn btn-primary${busy === 'invoice' ? ' loading' : ''}`}
              onClick={() =>
                run(
                  'invoice',
                  action('invoice', { amount: inv.amount === '' ? null : Number(inv.amount.replace(',', '.')), days: Number(inv.days) }),
                  'Proforma wystawiona i wysłana klientowi.',
                ).then((ok) => ok && setInv((s) => ({ ...s, open: false })))
              }
            >
              Wystaw
            </button>
          </>
        }
      >
        <p>Puste pole kwoty = cała należność.</p>
        <div className="grid2" style={{ marginTop: 12 }}>
          <label className="field">
            <span className="field-label">Kwota (zł)</span>
            <input className="input" inputMode="decimal" value={inv.amount} placeholder="cała należność" onChange={(e) => setInv({ ...inv, amount: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">Termin płatności</span>
            <Select
              value={inv.days}
              onChange={(v) => v && setInv({ ...inv, days: v })}
              options={['3', '7', '14', '30'].map((d) => ({ value: d, label: `${d} dni` }))}
            />
          </label>
        </div>
      </Modal>
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
    </>
  );
}

