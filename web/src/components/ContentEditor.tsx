'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { del, post, put } from '@/lib/client';
import { assetSrc, previewUrl, type CmsAsset, type CmsContent, type CmsEditorData, type CmsField, type CmsImageRef, type CmsSection } from '@/lib/cms';
import { Icon } from './Icon';
import { useToast } from './Toast';
import { Modal } from './ui/Modal';
import { RichTextInput } from './cms/RichTextInput';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_SIDE = 2560;

function emptyOf(f: CmsField): unknown {
  if (f.default !== undefined && f.type !== 'image') return clone(f.default);
  switch (f.type) {
    case 'boolean':
      return false;
    case 'number':
    case 'image':
      return null;
    case 'list':
      return [];
    case 'select':
      return f.options?.[0]?.value ?? '';
    default:
      return '';
  }
}

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const dateTime = (iso: string) => new Date(iso).toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' });

async function prepare(file: File): Promise<{ name: string; data: string }> {
  if (!TYPES.includes(file.type)) throw new Error('Obsługiwane formaty: PNG, JPG, WebP, GIF.');
  let blob: Blob = file;
  let name = file.name;
  if (file.type !== 'image/gif') {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    if (scale < 1 || file.size > 1.5 * 1024 * 1024) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.86));
      if (out && (out.size < file.size || scale < 1)) {
        blob = out;
        name = name.replace(/\.[a-z0-9]+$/i, '') + '.webp';
      }
    }
    bmp.close();
  }
  if (blob.size > MAX_BYTES) throw new Error('Zdjęcie ma ponad 4 MB nawet po zmniejszeniu.');
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('Nie udało się odczytać pliku.'));
    reader.readAsDataURL(blob);
  });
  return { name, data };
}

function AssetPicker({
  siteId,
  open,
  assets,
  onClose,
  onPick,
  onUploaded,
  onDeleted,
}: {
  siteId: number;
  open: boolean;
  assets: CmsAsset[];
  onClose: () => void;
  onPick: (a: CmsAsset) => void;
  onUploaded: (a: CmsAsset) => void;
  onDeleted: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    let last: CmsAsset | null = null;
    for (const file of Array.from(files).slice(0, 10)) {
      try {
        const body = await prepare(file);
        const res = await post<CmsAsset>(`/api/strony/${siteId}/obrazy`, body);
        if (!res.ok || !res.data) throw new Error(res.error ?? 'Nie udało się wgrać zdjęcia.');
        onUploaded(res.data);
        last = res.data;
      } catch (err) {
        setError(`${file.name}: ${(err as Error).message}`);
      }
    }
    setBusy(false);
    if (input.current) input.current.value = '';
    if (last && files.length === 1) onPick(last);
  }

  async function remove(a: CmsAsset) {
    if (!confirm(`Usunąć zdjęcie „${a.name}”?`)) return;
    const res = await del(`/api/strony/${siteId}/obrazy/${a.id}`);
    if (!res.ok) return toast.show(false, res.error ?? 'Nie udało się usunąć.');
    onDeleted(a.id);
  }

  return (
    <Modal open={open} onClose={onClose} title="Zdjęcia" busy={busy}>
      <div className="cms-upload">
        <input ref={input} type="file" accept={TYPES.join(',')} multiple hidden onChange={(e) => upload(e.target.files)} />
        <button type="button" className={`btn btn-primary${busy ? ' loading' : ''}`} disabled={busy} onClick={() => input.current?.click()}>
          <Icon name="cloud_upload" size={16} /> {busy ? 'Wgrywanie…' : 'Wgraj zdjęcia'}
        </button>
        <span className="faint small">PNG, JPG, WebP, GIF · duże zdjęcia zmniejszamy automatycznie</span>
      </div>
      {error && <p className="field-error">{error}</p>}
      {assets.length === 0 ? (
        <p className="faint" style={{ padding: '24px 0', textAlign: 'center' }}>
          Brak zdjęć. Wgraj pierwsze.
        </p>
      ) : (
        <div className="cms-assets">
          {assets.map((a) => (
            <div key={a.id} className="cms-asset">
              <button type="button" className="cms-asset-pick" onClick={() => onPick(a)} title={`Wybierz: ${a.name}`}>
                <img src={assetSrc(siteId, a.id)} alt="" loading="lazy" />
              </button>
              <div className="cms-asset-meta">
                <span title={a.name}>{a.name}</span>
                <small>
                  {a.width && a.height ? `${a.width}×${a.height} · ` : ''}
                  {kb(a.size)}
                </small>
              </div>
              <button type="button" className="cms-asset-del" aria-label={`Usuń ${a.name}`} onClick={() => remove(a)}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function ImageInput({
  siteId,
  id,
  value,
  onChange,
  openPicker,
  assets,
}: {
  siteId: number;
  id: string;
  value: CmsImageRef;
  onChange: (v: CmsImageRef) => void;
  openPicker: (pick: (a: CmsAsset) => void) => void;
  assets: CmsAsset[];
}) {
  const asset = value ? assets.find((a) => a.id === value.id) : null;
  return (
    <div className="cms-image" id={id}>
      <button type="button" className={`cms-image-box${value ? '' : ' empty'}`} onClick={() => openPicker((a) => onChange({ id: a.id, alt: value?.alt ?? '' }))}>
        {value ? (
          asset ? (
            <img src={assetSrc(siteId, value.id)} alt="" />
          ) : (
            <span className="faint small">Zdjęcie usunięte</span>
          )
        ) : (
          <span>
            <Icon name="cloud_upload" size={22} />
            Wybierz zdjęcie
          </span>
        )}
      </button>
      {value && (
        <div className="cms-image-side">
          <label className="cms-alt">
            <span className="field-desc">Opis zdjęcia – czytają go niewidomi i Google</span>
            <input className="input" placeholder="np. Sesja rodzinna w parku" maxLength={200} value={value.alt} onChange={(e) => onChange({ ...value, alt: e.target.value })} />
          </label>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn btn-sm" onClick={() => openPicker((a) => onChange({ id: a.id, alt: value.alt }))}>
              Zmień
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => onChange(null)}>
              Usuń ze strony
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

type Ctx = { siteId: number; assets: CmsAsset[]; openPicker: (pick: (a: CmsAsset) => void) => void };

function Input({ field, value, onChange, id, ctx }: { field: CmsField; value: unknown; onChange: (v: unknown) => void; id: string; ctx: Ctx }) {
  switch (field.type) {
    case 'textarea':
      return <textarea id={id} className="input" rows={Math.min(14, Math.max(4, String(value ?? '').split('\n').length + 1))} maxLength={field.maxLength} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
    case 'richtext':
      return <RichTextInput id={id} value={String(value ?? '')} onChange={onChange} maxLength={field.maxLength} />;
    case 'number':
      return (
        <input
          id={id}
          className="input"
          type="number"
          inputMode="decimal"
          min={field.min}
          max={field.max}
          step={field.integer ? 1 : 'any'}
          value={value === null || value === undefined ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
      );
    case 'boolean':
      return <button id={id} type="button" role="switch" className="switch" aria-checked={value === true} aria-label={field.label} onClick={() => onChange(value !== true)} />;
    case 'select':
      return (
        <select id={id} className="input" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case 'color':
      return (
        <div className="cms-color">
          <input type="color" aria-label={field.label} value={/^#[0-9a-f]{6}$/i.test(String(value)) ? String(value) : '#000000'} onChange={(e) => onChange(e.target.value)} />
          <input id={id} className="input" maxLength={7} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
    case 'url':
      return <input id={id} className="input" inputMode="url" placeholder="https://… albo /podstrona" maxLength={2000} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
    case 'image':
      return <ImageInput id={id} siteId={ctx.siteId} value={(value as CmsImageRef) ?? null} onChange={onChange} openPicker={ctx.openPicker} assets={ctx.assets} />;
    case 'list':
      return <ListInput id={id} field={field} value={Array.isArray(value) ? (value as Record<string, unknown>[]) : []} onChange={onChange} ctx={ctx} />;
    default:
      return <input id={id} className="input" maxLength={field.maxLength} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
  }
}

function FieldRow({ field, value, onChange, path, error, ctx }: { field: CmsField; value: unknown; onChange: (v: unknown) => void; path: string; error?: string; ctx: Ctx }) {
  const id = `f-${path}`;
  const wide = field.type === 'textarea' || field.type === 'richtext' || field.type === 'list' || field.type === 'image';
  const len = (field.type === 'text' || field.type === 'textarea' || field.type === 'richtext') && field.maxLength ? String(value ?? '').length : null;
  return (
    <div className={`field${wide ? ' wide' : ''}${error ? ' invalid' : ''}`}>
      {field.type === 'boolean' ? (
        <div className="field-row">
          <label className="field-label" htmlFor={id}>
            {field.label}
          </label>
          <Input field={field} value={value} onChange={onChange} id={id} ctx={ctx} />
        </div>
      ) : (
        <label className="field-label" htmlFor={id}>
          {field.label}
          {field.required && <span className="req">*</span>}
          {len !== null && len > field.maxLength! * 0.8 && (
            <span className="faint small" style={{ marginLeft: 'auto', fontWeight: 400 }}>
              {len}/{field.maxLength}
            </span>
          )}
        </label>
      )}
      {field.description && <span className="field-desc">{field.description}</span>}
      {field.type !== 'boolean' && <Input field={field} value={value} onChange={onChange} id={id} ctx={ctx} />}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

function ListInput({ field, value, onChange, id, ctx }: { field: CmsField; value: Record<string, unknown>[]; onChange: (v: unknown) => void; id: string; ctx: Ctx }) {
  const [open, setOpen] = useState<number | null>(null);
  const fields = field.fields ?? [];
  const titleField = fields.find((f) => f.type === 'text');
  const max = field.maxItems ?? 50;
  const update = (i: number, key: string, v: unknown) => onChange(value.map((item, idx) => (idx === i ? { ...item, [key]: v } : item)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
    setOpen((o) => (o === i ? j : o === j ? i : o));
  };
  const add = () => {
    onChange([...value, Object.fromEntries(fields.map((f) => [f.key, emptyOf(f)]))]);
    setOpen(value.length);
  };
  const remove = (i: number) => {
    onChange(value.filter((_, idx) => idx !== i));
    setOpen(null);
  };

  return (
    <div className="cms-list" id={id}>
      {value.map((item, i) => {
        const title = (titleField && String(item[titleField.key] ?? '').trim()) || `Element ${i + 1}`;
        const thumb = fields.find((f) => f.type === 'image');
        const img = thumb ? (item[thumb.key] as CmsImageRef) : null;
        return (
          <div key={i} className={`cms-item${open === i ? ' open' : ''}`}>
            <div className="cms-item-head">
              <button type="button" className="cms-item-toggle" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                <span className="cms-item-num">{i + 1}</span>
                {img && <img src={assetSrc(ctx.siteId, img.id)} alt="" className="cms-item-thumb" />}
                <span className="cms-item-title">{title}</span>
              </button>
              <div className="cms-item-actions">
                <button type="button" className="icon-btn" aria-label="W górę" disabled={i === 0} onClick={() => move(i, -1)}>
                  ↑
                </button>
                <button type="button" className="icon-btn" aria-label="W dół" disabled={i === value.length - 1} onClick={() => move(i, 1)}>
                  ↓
                </button>
                <button type="button" className="icon-btn danger" aria-label="Usuń" onClick={() => remove(i)}>
                  ×
                </button>
              </div>
            </div>
            {open === i && (
              <div className="cms-item-body module-fields">
                {fields.map((f) => (
                  <FieldRow key={f.key} field={f} value={item[f.key]} onChange={(v) => update(i, f.key, v)} path={`${id.replace(/^f-/, '')}.${i}.${f.key}`} ctx={ctx} />
                ))}
              </div>
            )}
          </div>
        );
      })}
      <button type="button" className="btn btn-sm cms-add" disabled={value.length >= max} onClick={add}>
        + Dodaj {value.length >= max ? `(maks. ${max})` : 'element'}
      </button>
    </div>
  );
}

const local = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function ContentEditor({ data, viewerId }: { data: CmsEditorData; viewerId: string }) {
  const can = (p: CmsEditorData['me']['perms'][number]) => data.me.perms.includes(p);
  const canEdit = can('content');
  const canPublish = can('publish');
  const sections = data.schema.sections.filter((s) => !data.me.sections || data.me.sections.includes(s.key));
  const [published, setPublished] = useState<CmsContent>(() => clone(data.content));
  const [saved, setSaved] = useState<CmsContent>(() => clone(data.draft ?? data.content));
  const [values, setValues] = useState<CmsContent>(() => clone(data.draft ?? data.content));
  const [draftAt, setDraftAt] = useState(data.draftAt);
  const [scheduledAt, setScheduledAt] = useState(data.scheduledAt);
  const [revision, setRevision] = useState(data.site.revision);
  const [assets, setAssets] = useState<CmsAsset[]>(data.assets);
  const [versions, setVersions] = useState(data.versions);
  const [active, setActive] = useState(sections[0]?.key);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [barError, setBarError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [picker, setPicker] = useState<((a: CmsAsset) => void) | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [planAt, setPlanAt] = useState(() => local(new Date(Date.now() + 86_400_000).toISOString()));
  const toast = useToast();

  const dirtySections = useMemo(() => sections.filter((s) => !same(values[s.key], saved[s.key])).map((s) => s.key), [sections, values, saved]);
  const dirty = dirtySections.length > 0;
  const hasDraft = !!draftAt;

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  useEffect(() => {
    const key = window.location.hash.replace(/^#s-/, '');
    if (sections.some((s) => s.key === key)) setActive(key);
  }, [sections]);

  const ctx: Ctx = { siteId: data.site.id, assets, openPicker: (pick) => setPicker(() => pick) };

  function select(key: string) {
    setActive(key);
    window.history.replaceState(null, '', `#s-${key}`);
    const top = document.querySelector('.settings')?.getBoundingClientRect().top ?? 0;
    if (top < 0) window.scrollBy({ top: top - 90 });
  }

  function set(section: CmsSection, key: string, v: unknown) {
    setValues((prev) => ({ ...prev, [section.key]: { ...(prev[section.key] ?? {}), [key]: v } }));
    setErrors((e) => {
      const { [`${section.key}.${key}`]: _, ...rest } = e;
      return rest;
    });
    setBarError(null);
  }

  function showErrors(res: { error?: string; errors?: { path: string; message: string }[] }) {
    const map: Record<string, string> = {};
    for (const e of res.errors ?? []) map[e.path] = e.message;
    setErrors(map);
    setBarError(res.error ?? 'Nie udało się zapisać.');
    const first = Object.keys(map)[0];
    if (first) {
      setActive(first.split('.')[0]!);
      setTimeout(() => document.getElementById(`f-${first}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    }
  }

  const base = `/api/strony/${data.site.id}`;

  async function saveDraft(quiet = false) {
    setBusy('draft');
    setBarError(null);
    const res = await put<{ draftAt: string }>(`${base}/draft`, { content: values });
    setBusy(null);
    if (!res.ok || !res.data) {
      showErrors(res);
      return false;
    }
    setDraftAt(res.data.draftAt);
    setSaved(clone(values));
    setErrors({});
    if (!quiet) toast.show(true, 'Zapisano wersję roboczą. Na stronie nic się jeszcze nie zmieniło.');
    return true;
  }

  async function publishNow() {
    setBusy('publish');
    setBarError(null);
    const res = await post<{ revision: number }>(`${base}/publish`, dirty || !hasDraft ? { content: values, revision } : { revision });
    setBusy(null);
    if (!res.ok || !res.data) return showErrors(res);
    setRevision(res.data.revision);
    setVersions((v) => [{ revision: res.data!.revision, authorId: viewerId, createdAt: new Date().toISOString(), content: clone(values) }, ...v].slice(0, 30));
    setPublished(clone(values));
    setSaved(clone(values));
    setDraftAt(null);
    setScheduledAt(null);
    setErrors({});
    toast.show(true, data.site.webhook || data.site.isSelf ? 'Opublikowano. Strona już pokazuje nową treść.' : 'Opublikowano. Strona pokaże zmiany w ciągu kilku minut.');
  }

  async function plan() {
    setBusy('plan');
    const res = await post<{ scheduledAt: string }>(`${base}/schedule`, { ...(dirty || !hasDraft ? { content: values } : {}), at: new Date(planAt).toISOString() });
    setBusy(null);
    if (!res.ok || !res.data) {
      setPlanOpen(false);
      return showErrors(res);
    }
    setScheduledAt(res.data.scheduledAt);
    setDraftAt((d) => d ?? new Date().toISOString());
    setSaved(clone(values));
    setPlanOpen(false);
    toast.show(true, `Zaplanowano publikację na ${dateTime(res.data.scheduledAt)}.`);
  }

  async function unplan() {
    const res = await del(`${base}/schedule`);
    if (!res.ok) return toast.show(false, res.error ?? 'Nie udało się anulować.');
    setScheduledAt(null);
    toast.show(true, 'Anulowano zaplanowaną publikację. Zmiany zostały w wersji roboczej.');
  }

  async function discard() {
    if (!confirm('Odrzucić wersję roboczą? Wrócisz do treści opublikowanej na stronie.')) return;
    const res = await del(`${base}/draft`);
    if (!res.ok) return toast.show(false, res.error ?? 'Nie udało się odrzucić.');
    setDraftAt(null);
    setScheduledAt(null);
    setValues(clone(published));
    setSaved(clone(published));
    toast.show(true, 'Odrzucono wersję roboczą.');
  }

  async function openPreview() {
    if (dirty && canEdit && !(await saveDraft(true))) return;
    const url = previewUrl(data.site);
    if (url) window.open(url, '_blank', 'noopener');
  }

  function reset() {
    setValues(clone(saved));
    setErrors({});
    setBarError(null);
  }

  function restore(rev: number) {
    const v = versions.find((x) => x.revision === rev);
    if (!v) return;
    setValues((prev) => ({ ...prev, ...clone(v.content) }));
    setHistoryOpen(false);
    toast.show(true, `Wczytano wersję ${rev}. Zapisz albo opublikuj, żeby ją przywrócić.`);
  }

  if (!sections.length) {
    return (
      <div className="card empty">
        <Icon name="tools" size={56} />
        <h2>{data.schema.sections.length ? 'Brak sekcji do edycji' : 'Strona jeszcze się nie połączyła'}</h2>
        <p>{data.schema.sections.length ? 'Nie masz dostępu do żadnej sekcji tej strony.' : 'Pola do edycji pojawią się tutaj, gdy strona pierwszy raz połączy się z panelem zxCode.'}</p>
      </div>
    );
  }

  const preview = previewUrl(data.site);
  const author = (id: string) => (id === viewerId ? 'Ty' : (data.people[id]?.name ?? 'zxCode'));

  return (
    <>
      <div className={`cms-status${scheduledAt ? ' plan' : hasDraft ? ' draft' : ''}`}>
        <span className="cms-status-dot" />
        <div className="grow" style={{ minWidth: 0 }}>
          <b>{scheduledAt ? 'Publikacja zaplanowana' : hasDraft ? 'Wersja robocza – jeszcze nie na stronie' : 'Strona jest aktualna'}</b>
          <small>
            {scheduledAt
              ? `Zmiany pojawią się na stronie ${dateTime(scheduledAt)}.`
              : hasDraft
                ? `Zapisana ${dateTime(draftAt!)}. Odwiedzający widzą jeszcze poprzednią treść.`
                : `Opublikowana wersja ${revision}.`}
          </small>
        </div>
        <div className="cms-status-actions">
          {preview && (
            <button type="button" className="btn btn-sm" onClick={openPreview}>
              Podgląd
            </button>
          )}
          {scheduledAt && canPublish && (
            <button type="button" className="btn btn-sm btn-ghost" onClick={unplan}>
              Anuluj plan
            </button>
          )}
          {hasDraft && !dirty && canPublish && !scheduledAt && (
            <>
              <button type="button" className="btn btn-sm" onClick={() => setPlanOpen(true)}>
                Zaplanuj
              </button>
              <button type="button" className={`btn btn-sm btn-primary${busy === 'publish' ? ' loading' : ''}`} disabled={!!busy} onClick={publishNow}>
                Opublikuj
              </button>
            </>
          )}
          {hasDraft && canEdit && (
            <button type="button" className="btn btn-sm btn-ghost" onClick={discard}>
              Odrzuć
            </button>
          )}
        </div>
      </div>

      <div className="cms-toolbar">
        <button type="button" className="btn btn-sm" disabled={!canEdit} onClick={() => setPicker(() => () => setPicker(null))}>
          <Icon name="cloud_upload" size={16} /> Zdjęcia ({assets.length})
        </button>
        <button type="button" className="btn btn-sm" onClick={() => setHistoryOpen(true)} disabled={!versions.length}>
          <Icon name="calendar" size={16} /> Historia zmian
        </button>
        {!canEdit && <span className="pill pill-muted">Tylko podgląd</span>}
      </div>

      <div className="settings">
        <nav className="side" aria-label="Sekcje strony" role="tablist">
          <div className="side-title">Sekcje</div>
          {sections.map((s) => {
            const hasError = Object.keys(errors).some((k) => k.startsWith(`${s.key}.`));
            const changed = !same(values[s.key], published[s.key]);
            return (
              <a
                key={s.key}
                href={`#s-${s.key}`}
                role="tab"
                aria-selected={active === s.key}
                aria-current={active === s.key}
                onClick={(e) => {
                  e.preventDefault();
                  select(s.key);
                }}
              >
                <span className={`dot ${dirtySections.includes(s.key) || hasError || changed ? 'dirty' : 'on'}`} />
                {s.label}
              </a>
            );
          })}
        </nav>

        <div role="tabpanel">
          {sections
            .filter((s) => s.key === active)
            .map((s) => (
              <section key={s.key} className="card module tab-in">
                <div className="module-head">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h2>{s.label}</h2>
                    {s.description && <p>{s.description}</p>}
                  </div>
                </div>
                <fieldset className="cms-fields" disabled={!canEdit}>
                  <div className="module-fields">
                    {s.fields.map((f) => (
                      <FieldRow key={f.key} field={f} value={values[s.key]?.[f.key]} onChange={(v) => set(s, f.key, v)} path={`${s.key}.${f.key}`} error={errors[`${s.key}.${f.key}`]} ctx={ctx} />
                    ))}
                  </div>
                </fieldset>
              </section>
            ))}
        </div>

        <div className={`savebar${dirty ? ' show' : ''}${barError ? ' error' : ''}`} role="region" aria-label="Niezapisane zmiany">
          <p style={barError ? { color: 'var(--err)' } : undefined}>{barError ?? 'Masz niezapisane zmiany'}</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={reset} disabled={!!busy}>
            Cofnij
          </button>
          {canEdit && (
            <button type="button" className={`btn btn-sm${busy === 'draft' ? ' loading' : ''}`} onClick={() => saveDraft()} disabled={!!busy}>
              Zapisz roboczo
            </button>
          )}
          {canPublish && (
            <button type="button" className={`btn btn-primary btn-sm${busy === 'publish' ? ' loading' : ''}`} onClick={publishNow} disabled={!!busy}>
              Opublikuj
            </button>
          )}
        </div>
      </div>

      <AssetPicker
        siteId={data.site.id}
        open={!!picker}
        assets={assets}
        onClose={() => setPicker(null)}
        onPick={(a) => {
          picker?.(a);
          setPicker(null);
        }}
        onUploaded={(a) => setAssets((list) => [a, ...list])}
        onDeleted={(id) => setAssets((list) => list.filter((a) => a.id !== id))}
      />

      <Modal
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        title="Zaplanuj publikację"
        busy={busy === 'plan'}
        actions={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setPlanOpen(false)}>
              Anuluj
            </button>
            <button type="button" className={`btn btn-primary${busy === 'plan' ? ' loading' : ''}`} onClick={plan} disabled={!!busy}>
              Zaplanuj
            </button>
          </>
        }
      >
        <p className="muted">Zmiany z wersji roboczej pojawią się na stronie automatycznie o wybranej godzinie.</p>
        <label className="field" style={{ marginTop: 12 }}>
          <span className="field-label">Data i godzina</span>
          <input className="input" type="datetime-local" value={planAt} min={local(new Date().toISOString())} onChange={(e) => setPlanAt(e.target.value)} />
        </label>
      </Modal>

      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title="Historia zmian">
        <ul className="cms-versions">
          {versions.map((v) => (
            <li key={v.revision}>
              <div>
                <b>Wersja {v.revision}</b>
                {v.revision === revision && <span className="pill pill-ok" style={{ marginLeft: 8 }}>na stronie</span>}
                <div className="faint small">
                  {dateTime(v.createdAt)} · {author(v.authorId)}
                </div>
              </div>
              {v.revision !== revision && canEdit && (
                <button type="button" className="btn btn-sm" onClick={() => restore(v.revision)}>
                  Wczytaj
                </button>
              )}
            </li>
          ))}
        </ul>
      </Modal>
      {toast.node}
    </>
  );
}

export function RefreshButton({ siteId }: { siteId: number }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <>
      <button
        type="button"
        className={`btn btn-sm${busy ? ' loading' : ''}`}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await post<{ ok: boolean }>(`/api/strony/${siteId}/odswiez`, {});
          setBusy(false);
          toast.show(!!res.data?.ok, res.data?.ok ? 'Strona odświeżona.' : (res.error ?? 'Strona nie odpowiedziała na odświeżenie.'));
        }}
      >
        Odśwież stronę
      </button>
      {toast.node}
    </>
  );
}
