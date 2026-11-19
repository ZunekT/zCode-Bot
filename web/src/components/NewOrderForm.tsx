'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Person } from '@/lib/api';
import { post } from '@/lib/client';
import { useToast } from './Toast';
import { Segmented } from './ui/Segmented';
import { Select } from './ui/Select';

export function NewOrderForm({ people }: { people: Person[] }) {
  const router = useRouter();
  const toast = useToast();
  const [who, setWho] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [f, setF] = useState({ title: '', price: '', deadline: '', description: '' });
  const [kind, setKind] = useState<'BOT' | 'WEBSITE'>('BOT');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const userId = (manual.trim() || who || '').replace(/[<@!>]/g, '');
    if (!/^\d{17,20}$/.test(userId)) return toast.show(false, 'Wybierz klienta albo wklej jego ID Discord.');
    if (f.title.trim().length < 3) return toast.show(false, 'Tytuł: min. 3 znaki.');
    setBusy(true);
    const res = await post<{ id: number; number: string }>('/api/admin/orders', {
      kind,
      userId,
      title: f.title.trim(),
      price: f.price === '' ? null : Number(f.price.replace(',', '.')),
      deadline: f.deadline || null,
      description: f.description.trim() || undefined,
    });
    setBusy(false);
    if (!res.ok || !res.data) return toast.show(false, res.error ?? 'Nie udało się utworzyć.');
    toast.show(true, `Utworzono ${res.data.number}.`);
    router.push(`/admin/zlecenia/${res.data.id}`);
  }

  return (
    <form className="card card-pad glow stack" style={{ gap: 16, maxWidth: 720 }} onSubmit={submit}>
      <div className="field">
        <span className="field-label">Rodzaj</span>
        <Segmented
          ariaLabel="Rodzaj zlecenia"
          value={kind}
          onChange={(v) => setKind(v === 'WEBSITE' ? 'WEBSITE' : 'BOT')}
          items={[
            { value: 'BOT', label: 'Bot Discord' },
            { value: 'WEBSITE', label: 'Strona internetowa' },
          ]}
        />
      </div>
      <div className="grid2">
        <div className="field">
          <span className="field-label">Klient</span>
          <Select
            ariaLabel="Klient"
            value={who}
            onChange={(v) => {
              setWho(v);
              setManual('');
            }}
            placeholder={people.length ? 'Wybierz z listy…' : 'Brak znanych klientów'}
            searchable
            options={people.map((p) => ({ value: p.id, label: p.name, hint: p.id.slice(-5) }))}
          />
        </div>
        <label className="field">
          <span className="field-label">albo ID Discord</span>
          <input
            className="input"
            inputMode="numeric"
            placeholder="np. 123456789012345678"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
          />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Tytuł</span>
        <input
          className="input"
          maxLength={100}
          placeholder="np. Bot RP dla serwera Miasto Nocą"
          value={f.title}
          onChange={(e) => setF({ ...f, title: e.target.value })}
        />
      </label>
      <div className="grid2">
        <label className="field">
          <span className="field-label">Cena (zł)</span>
          <input
            className="input"
            inputMode="decimal"
            placeholder="puste = do wyceny"
            value={f.price}
            onChange={(e) => setF({ ...f, price: e.target.value })}
          />
        </label>
        <label className="field">
          <span className="field-label">Termin</span>
          <input
            className="input"
            type="date"
            value={f.deadline}
            onChange={(e) => setF({ ...f, deadline: e.target.value })}
          />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Opis</span>
        <textarea
          className="input"
          rows={5}
          maxLength={2000}
          value={f.description}
          onChange={(e) => setF({ ...f, description: e.target.value })}
        />
      </label>
      <div className="row">
        <button className={`btn btn-primary${busy ? ' loading' : ''}`} type="submit" disabled={busy}>
          Utwórz zlecenie
        </button>
        <span className="faint small">
          Panel zlecenia na Discordzie dodasz w tickecie klienta komendą /zlecenie.
        </span>
      </div>
    </form>
  );
}
