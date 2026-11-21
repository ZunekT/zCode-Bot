import { createHash } from 'node:crypto';

export const CMS_FIELD_TYPES = ['text', 'textarea', 'richtext', 'number', 'boolean', 'select', 'color', 'url', 'image', 'list'] as const;
export type CmsFieldType = (typeof CMS_FIELD_TYPES)[number];

export interface CmsField {
  key: string;
  type: CmsFieldType;
  label: string;
  description?: string;
  default?: unknown;
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  integer?: boolean;
  options?: { value: string; label: string }[];
  fields?: CmsField[];
  maxItems?: number;
}

export interface CmsSection {
  key: string;
  label: string;
  description?: string;
  fields: CmsField[];
}

export interface CmsSchema {
  sections: CmsSection[];
}

export type CmsImage = { id: string; alt: string } | null;
export type CmsContent = Record<string, Record<string, unknown>>;

const KEY_RE = /^[a-zA-Z][a-zA-Z0-9_]{0,31}$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const ASSET_RE = /^[a-f0-9]{24}$/;
export const LIMITS = {
  sections: 30,
  fields: 40,
  itemFields: 15,
  options: 30,
  label: 80,
  description: 300,
  text: 500,
  textarea: 20_000,
  url: 2000,
  alt: 200,
  items: 200,
  defaultItems: 50,
  contentBytes: 600_000,
};

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);

function sanitizeField(f: Record<string, unknown>, nested: boolean, warn: (m: string) => void, where: string): CmsField | null {
  const key = str(f?.key, 32);
  const type = f?.type as CmsFieldType;
  if (!key || !KEY_RE.test(key) || !CMS_FIELD_TYPES.includes(type)) {
    warn(`${where}: pominięto pole ${String(f?.key)} (${String(f?.type)})`);
    return null;
  }
  if (nested && type === 'list') {
    warn(`${where}: lista w liście nie jest obsługiwana (${key})`);
    return null;
  }
  const field: CmsField = { key, type, label: str(f.label, LIMITS.label) || key };
  const description = str(f.description, LIMITS.description);
  if (description) field.description = description;
  if (f.required === true) field.required = true;
  if (type === 'text' || type === 'textarea' || type === 'richtext') {
    const cap = type === 'text' ? LIMITS.text : LIMITS.textarea;
    field.maxLength = Math.min(cap, Math.max(1, Number(f.maxLength) || cap));
  }
  if (type === 'number') {
    if (Number.isFinite(f.min)) field.min = Number(f.min);
    if (Number.isFinite(f.max)) field.max = Number(f.max);
    if (f.integer === true) field.integer = true;
  }
  if (type === 'select') {
    field.options = (Array.isArray(f.options) ? f.options : [])
      .slice(0, LIMITS.options)
      .map((o: Record<string, unknown>) => ({ value: str(o?.value, 100) ?? '', label: str(o?.label, LIMITS.label) || String(o?.value ?? '') }))
      .filter((o) => o.value);
    if (!field.options.length) {
      warn(`${where}: pole ${key} typu select nie ma opcji`);
      return null;
    }
  }
  if (type === 'list') {
    const seen = new Set<string>();
    field.fields = [];
    for (const sub of (Array.isArray(f.fields) ? f.fields : []).slice(0, LIMITS.itemFields) as Record<string, unknown>[]) {
      const s = sanitizeField(sub, true, warn, `${where}.${key}`);
      if (s && !seen.has(s.key)) {
        seen.add(s.key);
        field.fields.push(s);
      }
    }
    if (!field.fields.length) {
      warn(`${where}: lista ${key} nie ma pól`);
      return null;
    }
    field.maxItems = Math.min(LIMITS.items, Math.max(1, Number(f.maxItems) || LIMITS.defaultItems));
  }
  if (f.default !== undefined && type !== 'image') {
    const check = validateValue(field, f.default, () => true);
    if (check.ok) field.default = check.value;
    else warn(`${where}: nieprawidłowa wartość domyślna pola ${key}`);
  }
  return field;
}

export function sanitizeSchema(input: unknown): { schema: CmsSchema; warnings: string[] } {
  const warnings: string[] = [];
  const sections: CmsSection[] = [];
  const raw = (input as { sections?: unknown })?.sections;
  if (!Array.isArray(raw)) return { schema: { sections }, warnings: ['Brak listy sekcji w schemacie'] };
  const seen = new Set<string>();
  for (const s of raw.slice(0, LIMITS.sections) as Record<string, unknown>[]) {
    const key = str(s?.key, 32);
    if (!key || !KEY_RE.test(key) || seen.has(key)) {
      warnings.push(`Pominięto sekcję o nieprawidłowym kluczu: ${String(s?.key)}`);
      continue;
    }
    seen.add(key);
    const fields: CmsField[] = [];
    const seenFields = new Set<string>();
    for (const f of (Array.isArray(s.fields) ? s.fields : []).slice(0, LIMITS.fields) as Record<string, unknown>[]) {
      const field = sanitizeField(f, false, (m) => warnings.push(m), key);
      if (field && !seenFields.has(field.key)) {
        seenFields.add(field.key);
        fields.push(field);
      }
    }
    const section: CmsSection = { key, label: str(s.label, LIMITS.label) || key, fields };
    const description = str(s.description, LIMITS.description);
    if (description) section.description = description;
    sections.push(section);
  }
  return { schema: { sections }, warnings };
}

export const schemaHash = (schema: CmsSchema) => createHash('sha256').update(JSON.stringify(schema)).digest('hex').slice(0, 32);

type Check = { ok: true; value: unknown } | { ok: false; error: string };

function validateUrl(v: string): boolean {
  if (v.startsWith('/') && !v.startsWith('//')) return true;
  if (/^(mailto:|tel:)/i.test(v)) return v.length <= 200;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export function validateValue(field: CmsField, v: unknown, assetExists: (id: string) => boolean): Check {
  switch (field.type) {
    case 'boolean':
      return typeof v === 'boolean' ? { ok: true, value: v } : { ok: false, error: 'oczekiwano tak/nie' };
    case 'text':
    case 'textarea':
    case 'richtext': {
      if (typeof v !== 'string') return { ok: false, error: 'oczekiwano tekstu' };
      const value = field.type === 'text' ? v.replace(/[\r\n]+/g, ' ').trim() : v.replace(/\r\n/g, '\n');
      const max = field.maxLength ?? LIMITS.text;
      if (value.length > max) return { ok: false, error: `maksymalnie ${max} znaków` };
      if (field.required && !value.trim()) return { ok: false, error: 'pole wymagane' };
      return { ok: true, value };
    }
    case 'number': {
      const n = typeof v === 'string' && v.trim() !== '' ? Number(v.replace(',', '.')) : v;
      if (typeof n !== 'number' || !Number.isFinite(n)) return { ok: false, error: 'oczekiwano liczby' };
      if (field.integer && !Number.isInteger(n)) return { ok: false, error: 'oczekiwano liczby całkowitej' };
      if (field.min !== undefined && n < field.min) return { ok: false, error: `minimum ${field.min}` };
      if (field.max !== undefined && n > field.max) return { ok: false, error: `maksimum ${field.max}` };
      return { ok: true, value: n };
    }
    case 'select':
      return typeof v === 'string' && field.options?.some((o) => o.value === v) ? { ok: true, value: v } : { ok: false, error: 'wartość spoza listy' };
    case 'color':
      return typeof v === 'string' && COLOR_RE.test(v) ? { ok: true, value: v.toLowerCase() } : { ok: false, error: 'kolor w formacie #rrggbb' };
    case 'url': {
      if (typeof v !== 'string') return { ok: false, error: 'oczekiwano adresu' };
      const value = v.trim();
      if (!value) return field.required ? { ok: false, error: 'pole wymagane' } : { ok: true, value: '' };
      if (value.length > LIMITS.url || !validateUrl(value)) return { ok: false, error: 'nieprawidłowy adres (https://…, /podstrona, mailto: lub tel:)' };
      return { ok: true, value };
    }
    case 'image': {
      if (v === null) return field.required ? { ok: false, error: 'wybierz zdjęcie' } : { ok: true, value: null };
      const img = v as { id?: unknown; alt?: unknown };
      if (typeof img !== 'object' || typeof img.id !== 'string' || !ASSET_RE.test(img.id)) return { ok: false, error: 'nieprawidłowe zdjęcie' };
      if (!assetExists(img.id)) return { ok: false, error: 'zdjęcie nie istnieje' };
      const alt = typeof img.alt === 'string' ? img.alt.trim().slice(0, LIMITS.alt) : '';
      return { ok: true, value: { id: img.id, alt } };
    }
    case 'list': {
      if (!Array.isArray(v)) return { ok: false, error: 'oczekiwano listy' };
      if (v.length > (field.maxItems ?? LIMITS.defaultItems)) return { ok: false, error: `maksymalnie ${field.maxItems} elementów` };
      const items: Record<string, unknown>[] = [];
      for (const [idx, raw] of v.entries()) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: `element ${idx + 1}: nieprawidłowy` };
        const item: Record<string, unknown> = {};
        for (const sub of field.fields ?? []) {
          const val = (raw as Record<string, unknown>)[sub.key];
          if (val === undefined || val === null || val === '') {
            if (sub.required && sub.type !== 'boolean') return { ok: false, error: `element ${idx + 1}: pole „${sub.label}” jest wymagane` };
            item[sub.key] = sub.type === 'image' ? null : (sub.default ?? emptyOf(sub));
            continue;
          }
          const c = validateValue(sub, val, assetExists);
          if (!c.ok) return { ok: false, error: `element ${idx + 1}, „${sub.label}”: ${c.error}` };
          item[sub.key] = c.value;
        }
        items.push(item);
      }
      return { ok: true, value: items };
    }
  }
}

function emptyOf(field: CmsField): unknown {
  switch (field.type) {
    case 'boolean':
      return false;
    case 'number':
      return null;
    case 'list':
      return [];
    case 'image':
      return null;
    case 'select':
      return field.options?.[0]?.value ?? '';
    default:
      return '';
  }
}

export const defaultOf = (field: CmsField) => (field.default !== undefined ? field.default : emptyOf(field));

export class ContentInvalid extends Error {
  constructor(readonly errors: { path: string; message: string }[]) {
    super('Nieprawidłowa treść');
  }
}

export function validateContent(schema: CmsSchema, input: unknown, assetExists: (id: string) => boolean): CmsContent {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ContentInvalid([{ path: '', message: 'nieprawidłowe dane' }]);
  const errors: { path: string; message: string }[] = [];
  const out: CmsContent = {};
  for (const section of schema.sections) {
    const raw = ((input as Record<string, unknown>)[section.key] ?? {}) as Record<string, unknown>;
    if (typeof raw !== 'object' || Array.isArray(raw)) {
      errors.push({ path: section.key, message: 'nieprawidłowa sekcja' });
      continue;
    }
    out[section.key] = {};
    for (const field of section.fields) {
      const v = raw[field.key];
      if (v === undefined) {
        out[section.key]![field.key] = defaultOf(field);
        continue;
      }
      if ((v === null || v === '') && field.type !== 'image' && field.type !== 'url' && field.type !== 'text' && field.type !== 'textarea' && field.type !== 'richtext') {
        if (field.required) errors.push({ path: `${section.key}.${field.key}`, message: 'pole wymagane' });
        out[section.key]![field.key] = emptyOf(field);
        continue;
      }
      const c = validateValue(field, v, assetExists);
      if (c.ok) out[section.key]![field.key] = c.value;
      else errors.push({ path: `${section.key}.${field.key}`, message: c.error });
    }
  }
  if (errors.length) throw new ContentInvalid(errors);
  if (Buffer.byteLength(JSON.stringify(out)) > LIMITS.contentBytes) throw new ContentInvalid([{ path: '', message: 'treść jest za duża' }]);
  return out;
}

export function mergeDefaults(schema: CmsSchema, stored: CmsContent): CmsContent {
  const out: CmsContent = {};
  for (const section of schema.sections) {
    const raw = stored[section.key] ?? {};
    out[section.key] = {};
    for (const field of section.fields) out[section.key]![field.key] = field.key in raw ? raw[field.key] : defaultOf(field);
  }
  return out;
}

export function assetIds(content: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(content)) for (const v of content) assetIds(v, into);
  else if (content && typeof content === 'object') {
    const o = content as Record<string, unknown>;
    if (typeof o.id === 'string' && ASSET_RE.test(o.id) && 'alt' in o) into.add(o.id);
    else for (const v of Object.values(o)) assetIds(v, into);
  }
  return into;
}
