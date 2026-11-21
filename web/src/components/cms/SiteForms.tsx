'use client';

import { useState } from 'react';
import { put } from '@/lib/client';
import type { Announcement, Maintenance, Redirect, Tone } from '@/lib/cms';
import { Icon } from '../Icon';
import { useToast } from '../Toast';
import { CopyButton } from '../ui/CopyButton';

const TONES: { value: Tone; label: string }[] = [
  { value: 'info', label: 'Informacja' },
  { value: 'success', label: 'Sukces' },
  { value: 'warning', label: 'Ostrzeżenie' },
  { value: 'promo', label: 'Promocja' },
];

const local = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const iso = (v: string) => (v ? new Date(v).toISOString() : null);

function useSave(url: string) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  async function save(body: unknown, ok: string) {
    setBusy(true);
    const res = await put(url, body);
    setBusy(false);
    toast.show(res.ok, res.ok ? ok : (res.error ?? 'Nie udało się zapisać.'));
    return res.ok;
  }
  return { busy, save, node: toast.node };
}

export function AnnouncementForm({ siteId, initial }: { siteId: number; initial: Announcement }) {
  const [a, setA] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const { busy, save, node } = useSave(`/api/strony/${siteId}/announcement`);
  const set = <K extends keyof Announcement>(k: K, v: Announcement[K]) => setA((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(a) !== JSON.stringify(saved);
  const now = Date.now();
  const live = a.enabled && !!a.text && (!a.startsAt || new Date(a.startsAt).getTime() <= now) && (!a.endsAt || new Date(a.endsAt).getTime() > now);

  return (
    <section className="card">
      <div className="module-head">
        <div style={{ flex: 1 }}>
          <h2>Ogłoszenie na stronie</h2>
          <p>Pasek z komunikatem u góry każdej podstrony, np. promocja, zmiana godzin, ważna informacja.</p>
        </div>
        <button type="button" role="switch" className="switch" aria-checked={a.enabled} aria-label="Ogłoszenie włączone" onClick={() => set('enabled', !a.enabled)} />
      </div>
      <div className="module-fields">
        <div className="field wide">
          <span className="field-label">Podgląd</span>
          <div className={`ann-preview ann-${a.tone}${a.enabled ? '' : ' off'}`}>
            <span>{a.text || 'Treść ogłoszenia'}</span>
            {a.link && <u>{a.linkLabel || 'Więcej'}</u>}
            {a.dismissible && <span className="ann-x">×</span>}
          </div>
          <span className="field-desc">{a.enabled ? (live ? 'Widoczne teraz na stronie.' : 'Włączone, ale poza ustawionym czasem wyświetlania.') : 'Wyłączone – nie pokazuje się na stronie.'}</span>
        </div>
        <label className="field wide">
          <span className="field-label">Treść</span>
          <input className="input" maxLength={300} value={a.text} onChange={(e) => set('text', e.target.value)} placeholder="np. Do końca miesiąca -20% na strony firmowe!" />
        </label>
        <label className="field">
          <span className="field-label">Link (opcjonalnie)</span>
          <input className="input" maxLength={500} value={a.link} onChange={(e) => set('link', e.target.value)} placeholder="/cennik albo https://…" />
        </label>
        <label className="field">
          <span className="field-label">Tekst linku</span>
          <input className="input" maxLength={40} value={a.linkLabel} onChange={(e) => set('linkLabel', e.target.value)} placeholder="Więcej" />
        </label>
        <div className="field wide">
          <span className="field-label">Kolor</span>
          <div className="q-chips">
            {TONES.map((t) => (
              <button key={t.value} type="button" className={`q-chip ann-chip-${t.value}${a.tone === t.value ? ' on' : ''}`} onClick={() => set('tone', t.value)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span className="field-label">Pokazuj od</span>
          <input className="input" type="datetime-local" value={local(a.startsAt)} onChange={(e) => set('startsAt', iso(e.target.value))} />
          <span className="field-desc">Puste = od razu</span>
        </label>
        <label className="field">
          <span className="field-label">Pokazuj do</span>
          <input className="input" type="datetime-local" value={local(a.endsAt)} onChange={(e) => set('endsAt', iso(e.target.value))} />
          <span className="field-desc">Puste = bez końca</span>
        </label>
        <div className="field wide">
          <div className="field-row">
            <span className="field-label">Odwiedzający może zamknąć pasek</span>
            <button type="button" role="switch" className="switch" aria-checked={a.dismissible} aria-label="Można zamknąć" onClick={() => set('dismissible', !a.dismissible)} />
          </div>
        </div>
      </div>
      <div className="card-foot">
        <button type="button" className="btn btn-ghost btn-sm" disabled={!dirty || busy} onClick={() => setA(saved)}>
          Cofnij
        </button>
        <button
          type="button"
          className={`btn btn-primary btn-sm${busy ? ' loading' : ''}`}
          disabled={!dirty || busy}
          onClick={async () => {
            if (await save(a, a.enabled ? 'Zapisano. Ogłoszenie jest na stronie.' : 'Zapisano.')) setSaved(a);
          }}
        >
          Zapisz ogłoszenie
        </button>
      </div>
      {node}
    </section>
  );
}

export function MaintenanceForm({ siteId, initial, previewUrl }: { siteId: number; initial: Maintenance; previewUrl: string | null }) {
  const [m, setM] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const { busy, save, node } = useSave(`/api/strony/${siteId}/maintenance`);
  const set = <K extends keyof Maintenance>(k: K, v: Maintenance[K]) => setM((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(m) !== JSON.stringify(saved);

  async function toggle() {
    const next = { ...m, enabled: !saved.enabled };
    if (next.enabled && !confirm('Włączyć przerwę techniczną? Odwiedzający zobaczą tylko stronę „Przerwa techniczna”.')) return;
    if (await save(next, next.enabled ? 'Przerwa techniczna włączona.' : 'Przerwa techniczna wyłączona – strona znów działa.')) {
      setM(next);
      setSaved(next);
    }
  }

  return (
    <section className={`card${saved.enabled ? ' maint-on' : ''}`}>
      <div className="module-head">
        <div style={{ flex: 1 }}>
          <h2>Przerwa techniczna</h2>
          <p>Każde wejście na stronę pokazuje komunikat o przerwie (kod 503 – Google nie obniża pozycji). Ty i osoby z dostępem widzicie normalną stronę.</p>
        </div>
      </div>
      <div className={`maint-state${saved.enabled ? ' on' : ''}`}>
        <span className="maint-dot" />
        <div className="grow">
          <b>{saved.enabled ? 'Przerwa techniczna jest WŁĄCZONA' : 'Strona działa normalnie'}</b>
          <small>{saved.enabled ? 'Odwiedzający widzą stronę z komunikatem.' : 'Włącz przed większymi zmianami albo awarią.'}</small>
        </div>
        <button type="button" className={`btn ${saved.enabled ? 'btn-primary' : 'btn-danger'}${busy ? ' loading' : ''}`} disabled={busy} onClick={toggle}>
          {saved.enabled ? 'Wyłącz przerwę' : 'Włącz przerwę'}
        </button>
      </div>
      <div className="module-fields">
        <label className="field wide">
          <span className="field-label">Tytuł</span>
          <input className="input" maxLength={80} value={m.title} onChange={(e) => set('title', e.target.value)} placeholder="Przerwa techniczna" />
        </label>
        <label className="field wide">
          <span className="field-label">Komunikat</span>
          <textarea className="input" rows={3} maxLength={1000} value={m.message} onChange={(e) => set('message', e.target.value)} placeholder="Wprowadzamy ulepszenia. Wróć za chwilę." />
        </label>
        <label className="field">
          <span className="field-label">Planowany powrót</span>
          <input className="input" type="datetime-local" value={local(m.until)} onChange={(e) => set('until', iso(e.target.value))} />
          <span className="field-desc">Pokażemy go odwiedzającym (opcjonalnie)</span>
        </label>
        {previewUrl && (
          <div className="field">
            <span className="field-label">Link dla osób z dostępem</span>
            <span className="field-desc">Otwiera normalną stronę mimo przerwy (na 7 dni w tej przeglądarce).</span>
            <div className="row" style={{ gap: 8 }}>
              <a className="btn btn-sm" href={previewUrl} target="_blank" rel="noopener">
                Otwórz stronę
              </a>
              <CopyButton text={previewUrl} label="Kopiuj link" />
            </div>
          </div>
        )}
      </div>
      <div className="card-foot">
        <button type="button" className={`btn btn-sm${busy ? ' loading' : ''}`} disabled={!dirty || busy} onClick={async () => (await save(m, 'Zapisano komunikat.')) && setSaved(m)}>
          Zapisz komunikat
        </button>
      </div>
      {node}
    </section>
  );
}

export function RedirectsEditor({ siteId, initial }: { siteId: number; initial: Redirect[] }) {
  const [list, setList] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const { busy, save, node } = useSave(`/api/strony/${siteId}/redirects`);
  const dirty = JSON.stringify(list) !== JSON.stringify(saved);
  const set = (i: number, patch: Partial<Redirect>) => setList((l) => l.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <section className="card">
      <div className="module-head">
        <div style={{ flex: 1 }}>
          <h2>Przekierowania</h2>
          <p>Gdy zmienia się adres podstrony, stary link prowadzi na nowy – odwiedzający nie trafiają na błąd, a Google przenosi pozycję.</p>
        </div>
      </div>
      <div className="redir-list">
        {list.length === 0 && <p className="faint" style={{ padding: '8px 20px 16px' }}>Brak przekierowań.</p>}
        {list.map((r, i) => (
          <div key={i} className="redir-row">
            <input className="input" aria-label="Skąd" placeholder="/stara-oferta" maxLength={300} value={r.from} onChange={(e) => set(i, { from: e.target.value })} />
            <span className="redir-arrow" aria-hidden>
              →
            </span>
            <input className="input" aria-label="Dokąd" placeholder="/oferta albo https://…" maxLength={1000} value={r.to} onChange={(e) => set(i, { to: e.target.value })} />
            <select className="input redir-type" aria-label="Rodzaj" value={r.permanent ? '1' : '0'} onChange={(e) => set(i, { permanent: e.target.value === '1' })}>
              <option value="1">Na stałe (301)</option>
              <option value="0">Tymczasowo (302)</option>
            </select>
            <button type="button" className="icon-btn" aria-label="Usuń" onClick={() => setList((l) => l.filter((_, idx) => idx !== i))}>
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="card-foot">
        <button type="button" className="btn btn-sm" disabled={list.length >= 200} onClick={() => setList((l) => [...l, { from: '', to: '', permanent: true }])}>
          + Dodaj przekierowanie
        </button>
        <span className="grow" />
        <button type="button" className="btn btn-ghost btn-sm" disabled={!dirty || busy} onClick={() => setList(saved)}>
          Cofnij
        </button>
        <button type="button" className={`btn btn-primary btn-sm${busy ? ' loading' : ''}`} disabled={!dirty || busy} onClick={async () => (await save({ redirects: list }, 'Zapisano przekierowania.')) && setSaved(list)}>
          Zapisz
        </button>
      </div>
      {node}
    </section>
  );
}

export function ExportCard({ siteId, isSelf }: { siteId: number; isSelf: boolean }) {
  return (
    <section className="card">
      <div className="module-head">
        <div style={{ flex: 1 }}>
          <h2>Eksport i kopia treści</h2>
          <p>Pobierz całą treść strony w pliku JSON: teksty, listy, ustawienia ogłoszenia, przerwy i przekierowań oraz adresy wszystkich zdjęć.</p>
        </div>
      </div>
      <div className="export-body">
        <a className="btn btn-primary" href={`/api/strony/${siteId}/export`} download>
          <Icon name="cloud_upload" size={16} /> Pobierz kopię (.json)
        </a>
        <p className="faint small">
          Dodatkowo każda publikacja zapisuje się w historii zmian (30 ostatnich wersji), z której możesz przywrócić dowolną.
          {isSelf ? ' Cennik, realizacje i opinie są w bazie zxCode i mają własną kopię zapasową serwera.' : ''}
        </p>
      </div>
    </section>
  );
}

export function TrackerSnippet({ trackId, scriptUrl }: { trackId: string; scriptUrl: string }) {
  const code = `<script defer src="${scriptUrl}" data-site="${trackId}"></script>`;
  return (
    <div className="tracker">
      <span className="field-label">Kod statystyk dla strony</span>
      <span className="field-desc">Wklej przed &lt;/head&gt; (w Next.js w layout.tsx). Bez cookies, bez zapisywania adresów IP.</span>
      <div className="row" style={{ gap: 8, alignItems: 'stretch' }}>
        <code className="tracker-code">{code}</code>
        <CopyButton text={code} label="Kopiuj" />
      </div>
    </div>
  );
}
