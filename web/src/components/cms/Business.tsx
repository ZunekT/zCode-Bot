'use client';

import { useRef, useState } from 'react';
import { del, post, put } from '@/lib/client';
import type { Person, PortfolioRow, PricingAddonRow, PricingPackageRow, ReviewRow } from '@/lib/cms';
import { PersonChip } from '../PersonChip';
import { useToast } from '../Toast';
import { Modal } from '../ui/Modal';

type Kind = 'BOT' | 'WEBSITE';
const KINDS: { value: Kind; label: string }[] = [
  { value: 'WEBSITE', label: 'Strony' },
  { value: 'BOT', label: 'Boty' },
];
const zl = (n: number) => `${n.toLocaleString('pl-PL', { maximumFractionDigits: 2 })} zł`;

function KindPicker({ value, onChange }: { value: Kind; onChange: (k: Kind) => void }) {
  return (
    <div className="q-chips">
      {KINDS.map((k) => (
        <button key={k.value} type="button" className={`q-chip${value === k.value ? ' on' : ''}`} onClick={() => onChange(k.value)}>
          {k.label}
        </button>
      ))}
    </div>
  );
}

function useApi<T>(initial: T) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  async function run(method: 'POST' | 'PUT' | 'DELETE', url: string, body?: unknown, ok?: string) {
    setBusy(true);
    setError(null);
    const res = method === 'DELETE' ? await del<T>(url) : method === 'POST' ? await post<T>(url, body) : await put<T>(url, body);
    setBusy(false);
    if (!res.ok || !res.data) {
      setError(res.error ?? 'Nie udało się zapisać.');
      if (method === 'DELETE') toast.show(false, res.error ?? 'Nie udało się usunąć.');
      return false;
    }
    setData(res.data);
    if (ok) toast.show(true, ok);
    return true;
  }
  return { data, busy, error, setError, run, toast: toast.node };
}

type PkgForm = { id: number | null; kind: Kind; name: string; description: string; price: string; features: string; position: string };
type AddonForm = { id: number | null; kind: Kind; label: string; description: string; price: string; active: boolean };

export function PricingEditor({ siteId, initial }: { siteId: number; initial: { packages: PricingPackageRow[]; addons: PricingAddonRow[] } }) {
  const api = useApi(initial);
  const [pkg, setPkg] = useState<PkgForm | null>(null);
  const [addon, setAddon] = useState<AddonForm | null>(null);
  const base = `/api/strony/${siteId}/pricing`;

  async function savePkg() {
    if (!pkg) return;
    const body = { kind: pkg.kind, name: pkg.name, description: pkg.description, price: pkg.price, features: pkg.features, position: Number(pkg.position) || 0 };
    if (await api.run(pkg.id ? 'PUT' : 'POST', pkg.id ? `${base}/packages/${pkg.id}` : `${base}/packages`, body, 'Zapisano pakiet. Cennik na stronie i na Discordzie jest już zaktualizowany.')) setPkg(null);
  }
  async function saveAddon() {
    if (!addon) return;
    const body = { kind: addon.kind, label: addon.label, description: addon.description, price: addon.price, active: addon.active };
    if (await api.run(addon.id ? 'PUT' : 'POST', addon.id ? `${base}/addons/${addon.id}` : `${base}/addons`, body, 'Zapisano dodatek.')) setAddon(null);
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      {KINDS.map((k) => {
        const list = api.data.packages.filter((p) => p.kind === k.value);
        return (
          <section key={k.value} className="card">
            <div className="card-head">
              <h2>Pakiety – {k.label.toLowerCase()}</h2>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={list.length >= 3}
                title={list.length >= 3 ? 'Maksymalnie 3 pakiety na rodzaj' : undefined}
                onClick={() => { api.setError(null); setPkg({ id: null, kind: k.value, name: '', description: '', price: '', features: '', position: String(list.length) }); }}
              >
                + Pakiet
              </button>
            </div>
            <div className="biz-grid">
              {list.length === 0 && <p className="faint" style={{ padding: '4px 4px 8px' }}>Brak pakietów – na stronie pokaże się tylko przycisk wyceny.</p>}
              {list.map((p) => (
                <div key={p.id} className="biz-card">
                  <div className="biz-top">
                    <b>{p.name}</b>
                    <span className="biz-price">od {zl(p.price)}</span>
                  </div>
                  <p className="faint small">{p.description}</p>
                  {p.features.length > 0 && (
                    <ul className="biz-feat">
                      {p.features.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  )}
                  <div className="row" style={{ gap: 6, marginTop: 'auto' }}>
                    <button type="button" className="btn btn-sm" onClick={() => { api.setError(null); setPkg({ id: p.id, kind: p.kind, name: p.name, description: p.description, price: String(p.price), features: p.features.join('\n'), position: String(p.position) }); }}>
                      Edytuj
                    </button>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => confirm(`Usunąć pakiet „${p.name}”?`) && api.run('DELETE', `${base}/packages/${p.id}`, undefined, 'Usunięto pakiet.')}>
                      Usuń
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <section className="card">
        <div className="card-head">
          <h2>Dodatki i moduły</h2>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => { api.setError(null); setAddon({ id: null, kind: 'BOT', label: '', description: '', price: '', active: true }); }}>
            + Dodatek
          </button>
        </div>
        <ul className="list">
          {api.data.addons.length === 0 && <li className="faint" style={{ padding: '6px 20px 18px' }}>Brak dodatków.</li>}
          {api.data.addons.map((a) => (
            <li key={a.id} className={`link-row${a.active ? '' : ' muted-row'}`}>
              <span className="grow" style={{ minWidth: 0 }}>
                <b>{a.label}</b> <span className="pill pill-muted">{a.kind === 'BOT' ? 'Boty' : 'Strony'}</span>
                {!a.active && <span className="pill pill-warn" style={{ marginLeft: 6 }}>ukryty</span>}
                {a.description && <div className="faint small">{a.description}</div>}
              </span>
              <b className="nowrap">{zl(a.price)}</b>
              <span className="row" style={{ gap: 6 }}>
                <button type="button" className="btn btn-sm" onClick={() => { api.setError(null); setAddon({ id: a.id, kind: a.kind, label: a.label, description: a.description ?? '', price: String(a.price), active: a.active }); }}>
                  Edytuj
                </button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => confirm(`Usunąć dodatek „${a.label}”?`) && api.run('DELETE', `${base}/addons/${a.id}`, undefined, 'Usunięto dodatek.')}>
                  Usuń
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <Modal
        open={!!pkg}
        onClose={() => setPkg(null)}
        title={pkg?.id ? 'Edytuj pakiet' : 'Nowy pakiet'}
        busy={api.busy}
        actions={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setPkg(null)}>Anuluj</button>
            <button type="button" className={`btn btn-primary${api.busy ? ' loading' : ''}`} disabled={api.busy} onClick={savePkg}>Zapisz</button>
          </>
        }
      >
        {pkg && (
          <div className="stack" style={{ gap: 12 }}>
            <KindPicker value={pkg.kind} onChange={(kind) => setPkg({ ...pkg, kind })} />
            <label className="field"><span className="field-label">Nazwa</span><input className="input" maxLength={60} value={pkg.name} onChange={(e) => setPkg({ ...pkg, name: e.target.value })} /></label>
            <label className="field"><span className="field-label">Opis</span><input className="input" maxLength={300} value={pkg.description} onChange={(e) => setPkg({ ...pkg, description: e.target.value })} /></label>
            <div className="q-grid">
              <label className="field"><span className="field-label">Cena od (zł)</span><input className="input" inputMode="decimal" value={pkg.price} onChange={(e) => setPkg({ ...pkg, price: e.target.value })} /></label>
              <label className="field"><span className="field-label">Kolejność</span><input className="input" type="number" min={0} value={pkg.position} onChange={(e) => setPkg({ ...pkg, position: e.target.value })} /></label>
            </div>
            <label className="field"><span className="field-label">Co zawiera</span><textarea className="input" rows={5} value={pkg.features} onChange={(e) => setPkg({ ...pkg, features: e.target.value })} /><span className="field-desc">Jedna pozycja w linii, maks. 12</span></label>
            {api.error && <p className="field-error">{api.error}</p>}
          </div>
        )}
      </Modal>

      <Modal
        open={!!addon}
        onClose={() => setAddon(null)}
        title={addon?.id ? 'Edytuj dodatek' : 'Nowy dodatek'}
        busy={api.busy}
        actions={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setAddon(null)}>Anuluj</button>
            <button type="button" className={`btn btn-primary${api.busy ? ' loading' : ''}`} disabled={api.busy} onClick={saveAddon}>Zapisz</button>
          </>
        }
      >
        {addon && (
          <div className="stack" style={{ gap: 12 }}>
            <KindPicker value={addon.kind} onChange={(kind) => setAddon({ ...addon, kind })} />
            <label className="field"><span className="field-label">Nazwa</span><input className="input" maxLength={60} value={addon.label} onChange={(e) => setAddon({ ...addon, label: e.target.value })} /></label>
            <label className="field"><span className="field-label">Opis</span><input className="input" maxLength={200} value={addon.description} onChange={(e) => setAddon({ ...addon, description: e.target.value })} /></label>
            <label className="field"><span className="field-label">Cena (zł)</span><input className="input" inputMode="decimal" value={addon.price} onChange={(e) => setAddon({ ...addon, price: e.target.value })} /></label>
            <div className="field-row"><span className="field-label">Widoczny w cenniku</span><button type="button" role="switch" className="switch" aria-checked={addon.active} aria-label="Widoczny" onClick={() => setAddon({ ...addon, active: !addon.active })} /></div>
            {api.error && <p className="field-error">{api.error}</p>}
          </div>
        )}
      </Modal>
      {api.toast}
    </div>
  );
}

type WorkForm = { id: number | null; kind: Kind; title: string; description: string; technologies: string; url: string; position: string };

async function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(new Error('Nie udało się odczytać pliku.'));
    r.readAsDataURL(file);
  });
}

export function PortfolioEditor({ siteId, initial }: { siteId: number; initial: PortfolioRow[] }) {
  const api = useApi(initial);
  const [form, setForm] = useState<WorkForm | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const [uploadFor, setUploadFor] = useState<number | null>(null);
  const base = `/api/strony/${siteId}/portfolio`;

  async function save() {
    if (!form) return;
    const body = { kind: form.kind, title: form.title, description: form.description, technologies: form.technologies, url: form.url, position: Number(form.position) || 0 };
    if (await api.run(form.id ? 'PUT' : 'POST', form.id ? `${base}/${form.id}` : base, body, 'Zapisano realizację.')) setForm(null);
  }

  async function upload(files: FileList | null) {
    const f = files?.[0];
    if (!f || uploadFor === null) return;
    if (f.size > 4 * 1024 * 1024) return api.setError('Zdjęcie może mieć maksymalnie 4 MB.');
    await api.run('POST', `${base}/${uploadFor}/images`, { data: await toBase64(f) }, 'Dodano zdjęcie.');
    if (file.current) file.current.value = '';
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>Realizacje</h2>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => { api.setError(null); setForm({ id: null, kind: 'WEBSITE', title: '', description: '', technologies: '', url: '', position: '0' }); }}>
          + Realizacja
        </button>
      </div>
      <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => upload(e.target.files)} />
      {api.error && !form && <p className="field-error" style={{ padding: '0 20px' }}>{api.error}</p>}
      <div className="biz-grid">
        {api.data.length === 0 && <p className="faint" style={{ padding: 8 }}>Brak realizacji.</p>}
        {api.data.map((w) => (
          <div key={w.id} className="biz-card">
            <div className="biz-imgs">
              {w.images.map((img) => (
                <span key={img} className="biz-img">
                  <img src={`/api/portfolio/${img}`} alt="" loading="lazy" />
                  <button type="button" aria-label="Usuń zdjęcie" onClick={() => confirm('Usunąć to zdjęcie?') && api.run('DELETE', `/api/strony/${siteId}/portfolio-images/${img}`, undefined, 'Usunięto zdjęcie.')}>
                    ×
                  </button>
                </span>
              ))}
              {w.images.length < 10 && (
                <button type="button" className="biz-add-img" disabled={api.busy} onClick={() => { setUploadFor(w.id); file.current?.click(); }}>
                  + zdjęcie
                </button>
              )}
            </div>
            <div className="biz-top">
              <b>{w.title}</b>
              <span className="pill pill-muted">{w.kind === 'BOT' ? 'Bot' : 'Strona'}</span>
            </div>
            <p className="faint small biz-desc">{w.description}</p>
            <div className="row" style={{ gap: 6, marginTop: 'auto' }}>
              <button type="button" className="btn btn-sm" onClick={() => { api.setError(null); setForm({ id: w.id, kind: w.kind, title: w.title, description: w.description, technologies: w.technologies.join('\n'), url: w.url ?? '', position: String(w.position) }); }}>
                Edytuj
              </button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => confirm(`Usunąć realizację „${w.title}” razem ze zdjęciami?`) && api.run('DELETE', `${base}/${w.id}`, undefined, 'Usunięto realizację.')}>
                Usuń
              </button>
            </div>
          </div>
        ))}
      </div>
      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? 'Edytuj realizację' : 'Nowa realizacja'}
        busy={api.busy}
        actions={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Anuluj</button>
            <button type="button" className={`btn btn-primary${api.busy ? ' loading' : ''}`} disabled={api.busy} onClick={save}>Zapisz</button>
          </>
        }
      >
        {form && (
          <div className="stack" style={{ gap: 12 }}>
            <KindPicker value={form.kind} onChange={(kind) => setForm({ ...form, kind })} />
            <label className="field"><span className="field-label">Tytuł</span><input className="input" maxLength={80} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label className="field"><span className="field-label">Opis</span><textarea className="input" rows={5} maxLength={2000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <label className="field"><span className="field-label">Technologie</span><textarea className="input" rows={3} value={form.technologies} onChange={(e) => setForm({ ...form, technologies: e.target.value })} /><span className="field-desc">Jedna w linii</span></label>
            <div className="q-grid">
              <label className="field"><span className="field-label">Adres projektu</span><input className="input" inputMode="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="opcjonalnie" /></label>
              <label className="field"><span className="field-label">Kolejność</span><input className="input" type="number" min={0} value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></label>
            </div>
            {api.error && <p className="field-error">{api.error}</p>}
          </div>
        )}
      </Modal>
      {api.toast}
    </section>
  );
}

export function ReviewsEditor({ siteId, initial }: { siteId: number; initial: { reviews: ReviewRow[]; people: Record<string, Person> } }) {
  const api = useApi(initial);
  const base = `/api/strony/${siteId}/reviews`;
  const who = (id: string): Person => api.data.people[id] ?? { id, name: `Klient …${id.slice(-4)}`, avatar: null };
  const pending = api.data.reviews.filter((r) => !r.approved).length;
  return (
    <section className="card">
      <div className="card-head">
        <h2>Opinie klientów</h2>
        {pending > 0 && <span className="pill pill-warn">{pending} czeka na decyzję</span>}
      </div>
      <ul className="list">
        {api.data.reviews.length === 0 && <li className="faint" style={{ padding: '6px 20px 18px' }}>Brak opinii. Pojawią się po zakończonych zleceniach.</li>}
        {api.data.reviews.map((r) => (
          <li key={r.id} className="review-row">
            <div className="row" style={{ gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <PersonChip p={who(r.userId)} sub={`Ocena ${r.rating}/5 · ${new Date(r.createdAt).toLocaleDateString('pl-PL')}${r.order ? ` · ${r.order.title}` : ''}`} />
              <span className="row" style={{ gap: 6 }}>
                <span className={`pill ${r.approved ? 'pill-ok' : 'pill-warn'}`}>{r.approved ? 'Na stronie' : 'Ukryta'}</span>
                <button type="button" className="btn btn-sm" disabled={api.busy} onClick={() => api.run('PUT', `${base}/${r.id}`, { approved: !r.approved }, r.approved ? 'Ukryto opinię.' : 'Opinia jest na stronie.')}>
                  {r.approved ? 'Ukryj' : 'Pokaż na stronie'}
                </button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => confirm('Usunąć tę opinię na zawsze?') && api.run('DELETE', `${base}/${r.id}`, undefined, 'Usunięto opinię.')}>
                  Usuń
                </button>
              </span>
            </div>
            <p className="review-text">{r.content}</p>
          </li>
        ))}
      </ul>
      {api.toast}
    </section>
  );
}
