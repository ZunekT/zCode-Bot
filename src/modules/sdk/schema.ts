/**
 * Format schematu, który bot klienta wysyła przez zxcode-sdk, i walidacja wartości z panelu.
 * Panel może zapisać tylko to, co bot zadeklarował – z kontrolą typów i istnienia kanałów/ról.
 */

export const FIELD_TYPES = ['boolean', 'text', 'textarea', 'number', 'select', 'channel', 'role', 'color'] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const CHANNEL_TYPES = ['text', 'voice', 'category', 'announcement', 'forum', 'stage'] as const;
export type ChannelKind = (typeof CHANNEL_TYPES)[number];

export interface SchemaField {
  key: string;
  type: FieldType;
  label: string;
  description?: string;
  default?: unknown;
  required?: boolean;
  multiple?: boolean;
  /** text/textarea */
  maxLength?: number;
  /** number */
  min?: number;
  max?: number;
  integer?: boolean;
  /** select */
  options?: { value: string; label: string }[];
  /** channel */
  channelTypes?: ChannelKind[];
}

export interface SchemaModule {
  key: string;
  label: string;
  description?: string;
  /** Moduł ma przełącznik włącz/wyłącz (wartość „enabled”). */
  toggle?: boolean;
  defaultEnabled?: boolean;
  fields: SchemaField[];
}

export interface BotSchema {
  modules: SchemaModule[];
}

export interface GuildChannel {
  id: string;
  name: string;
  type: ChannelKind | 'other';
  parentId?: string | null;
  position?: number;
}

export interface GuildRole {
  id: string;
  name: string;
  color?: number;
  position?: number;
  managed?: boolean;
}

export interface GuildData {
  channels: GuildChannel[];
  roles: GuildRole[];
}

export type ModuleValues = Record<string, unknown>;
export type ConfigValues = Record<string, ModuleValues>;

const KEY_RE = /^[a-zA-Z0-9_]{1,32}$/;
const SNOWFLAKE_RE = /^\d{17,20}$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const LIMITS = { modules: 50, fields: 60, options: 25, multiple: 25, label: 80, description: 300, text: 2000, textarea: 6000 };

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);

/** Czyści schemat przysłany przez bota (nie ufamy danym z zewnątrz). Zwraca też ostrzeżenia. */
export function sanitizeSchema(input: unknown): { schema: BotSchema; warnings: string[] } {
  const warnings: string[] = [];
  const modules: SchemaModule[] = [];
  const raw = (input as { modules?: unknown })?.modules;
  if (!Array.isArray(raw)) return { schema: { modules }, warnings: ['Brak listy modułów w schemacie'] };

  const seenModules = new Set<string>();
  for (const m of raw.slice(0, LIMITS.modules) as Record<string, unknown>[]) {
    const key = str(m?.key, 32);
    if (!key || !KEY_RE.test(key) || seenModules.has(key)) {
      warnings.push(`Pominięto moduł o nieprawidłowym kluczu: ${String(m?.key)}`);
      continue;
    }
    seenModules.add(key);
    const fields: SchemaField[] = [];
    const seenFields = new Set<string>(['enabled']);
    for (const f of (Array.isArray(m.fields) ? m.fields : []).slice(0, LIMITS.fields) as Record<string, unknown>[]) {
      const fkey = str(f?.key, 32);
      const type = f?.type as FieldType;
      if (!fkey || !KEY_RE.test(fkey) || seenFields.has(fkey) || !FIELD_TYPES.includes(type)) {
        warnings.push(`Moduł ${key}: pominięto pole ${String(f?.key)} (${String(f?.type)})`);
        continue;
      }
      seenFields.add(fkey);
      const field: SchemaField = { key: fkey, type, label: str(f.label, LIMITS.label) || fkey };
      const description = str(f.description, LIMITS.description);
      if (description) field.description = description;
      if (f.required === true) field.required = true;
      if (f.multiple === true && ['select', 'channel', 'role'].includes(type)) field.multiple = true;
      if (type === 'text' || type === 'textarea') {
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
          .map((o: Record<string, unknown>) => ({ value: str(o?.value, 100) ?? '', label: str(o?.label, LIMITS.label) ?? '' }))
          .filter((o) => o.value);
        if (!field.options.length) {
          warnings.push(`Moduł ${key}: pole ${fkey} typu select nie ma opcji`);
          continue;
        }
      }
      if (type === 'channel' && Array.isArray(f.channelTypes)) {
        field.channelTypes = f.channelTypes.filter((t): t is ChannelKind => CHANNEL_TYPES.includes(t as ChannelKind));
      }
      // Wartość domyślna przechodzi tę samą walidację (bez sprawdzania istnienia kanałów/ról).
      if (f.default !== undefined) {
        const check = validateField(field, f.default, null);
        if (check.ok) field.default = check.value;
        else warnings.push(`Moduł ${key}: nieprawidłowa wartość domyślna pola ${fkey}`);
      }
      fields.push(field);
    }
    const mod: SchemaModule = { key, label: str(m.label, LIMITS.label) || key, fields };
    const description = str(m.description, LIMITS.description);
    if (description) mod.description = description;
    if (m.toggle === true) {
      mod.toggle = true;
      mod.defaultEnabled = m.defaultEnabled !== false;
    }
    modules.push(mod);
  }
  return { schema: { modules }, warnings };
}

type Check = { ok: true; value: unknown } | { ok: false; error: string };

function one(field: SchemaField, v: unknown, guild: GuildData | null): Check {
  switch (field.type) {
    case 'boolean':
      return typeof v === 'boolean' ? { ok: true, value: v } : { ok: false, error: 'oczekiwano tak/nie' };
    case 'text':
    case 'textarea': {
      if (typeof v !== 'string') return { ok: false, error: 'oczekiwano tekstu' };
      const max = field.maxLength ?? (field.type === 'text' ? LIMITS.text : LIMITS.textarea);
      if (v.length > max) return { ok: false, error: `maksymalnie ${max} znaków` };
      return { ok: true, value: field.type === 'text' ? v.trim() : v };
    }
    case 'number': {
      const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
      if (typeof n !== 'number' || !Number.isFinite(n)) return { ok: false, error: 'oczekiwano liczby' };
      if (field.integer && !Number.isInteger(n)) return { ok: false, error: 'oczekiwano liczby całkowitej' };
      if (field.min !== undefined && n < field.min) return { ok: false, error: `minimum ${field.min}` };
      if (field.max !== undefined && n > field.max) return { ok: false, error: `maksimum ${field.max}` };
      return { ok: true, value: n };
    }
    case 'select':
      return typeof v === 'string' && field.options?.some((o) => o.value === v)
        ? { ok: true, value: v }
        : { ok: false, error: 'wartość spoza listy' };
    case 'color':
      return typeof v === 'string' && COLOR_RE.test(v) ? { ok: true, value: v.toLowerCase() } : { ok: false, error: 'kolor w formacie #rrggbb' };
    case 'channel': {
      if (typeof v !== 'string' || !SNOWFLAKE_RE.test(v)) return { ok: false, error: 'nieprawidłowy kanał' };
      if (guild) {
        const ch = guild.channels.find((c) => c.id === v);
        if (!ch) return { ok: false, error: 'kanał nie istnieje na serwerze' };
        if (field.channelTypes?.length && !field.channelTypes.includes(ch.type as ChannelKind)) {
          return { ok: false, error: 'niedozwolony typ kanału' };
        }
      }
      return { ok: true, value: v };
    }
    case 'role': {
      if (typeof v !== 'string' || !SNOWFLAKE_RE.test(v)) return { ok: false, error: 'nieprawidłowa rola' };
      if (guild && !guild.roles.some((r) => r.id === v)) return { ok: false, error: 'rola nie istnieje na serwerze' };
      return { ok: true, value: v };
    }
  }
}

/** Waliduje jedno pole (obsługuje „multiple” i null jako „wyczyść”). */
export function validateField(field: SchemaField, v: unknown, guild: GuildData | null): Check {
  if (v === null || v === undefined || (v === '' && field.type !== 'text' && field.type !== 'textarea')) {
    return field.required ? { ok: false, error: 'pole wymagane' } : { ok: true, value: null };
  }
  if (field.multiple) {
    if (!Array.isArray(v)) return { ok: false, error: 'oczekiwano listy' };
    if (v.length > LIMITS.multiple) return { ok: false, error: `maksymalnie ${LIMITS.multiple} pozycji` };
    const out: unknown[] = [];
    for (const item of v) {
      const r = one(field, item, guild);
      if (!r.ok) return r;
      if (!out.includes(r.value)) out.push(r.value);
    }
    if (field.required && !out.length) return { ok: false, error: 'pole wymagane' };
    return { ok: true, value: out };
  }
  return one(field, v, guild);
}

export interface ValidationError {
  path: string;
  message: string;
}

/**
 * Waliduje wartości z panelu względem schematu i danych serwera.
 * Nieznane moduły/pola są odrzucane. Zwraca znormalizowane wartości albo listę błędów.
 */
export function validateValues(
  schema: BotSchema,
  input: unknown,
  guild: GuildData | null,
): { values: ConfigValues; errors: ValidationError[] } {
  const values: ConfigValues = {};
  const errors: ValidationError[] = [];
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;

  for (const mod of schema.modules) {
    const raw = src[mod.key];
    if (raw === undefined) continue;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      errors.push({ path: mod.key, message: 'oczekiwano obiektu' });
      continue;
    }
    const mv = raw as Record<string, unknown>;
    const out: ModuleValues = {};
    if (mod.toggle && mv.enabled !== undefined) {
      if (typeof mv.enabled !== 'boolean') errors.push({ path: `${mod.key}.enabled`, message: 'oczekiwano tak/nie' });
      else out.enabled = mv.enabled;
    }
    for (const field of mod.fields) {
      if (!(field.key in mv)) continue;
      const r = validateField(field, mv[field.key], guild);
      if (r.ok) out[field.key] = r.value;
      else errors.push({ path: `${mod.key}.${field.key}`, message: r.error });
    }
    values[mod.key] = out;
  }
  return { values, errors };
}

/** Uprawnienia komend: { komenda: { roles: [id] } } – tylko znane komendy i istniejące role. */
export function validatePermissions(
  input: unknown,
  commands: string[],
  guild: GuildData | null,
): { permissions: Record<string, { roles: string[] }>; errors: ValidationError[] } {
  const permissions: Record<string, { roles: string[] }> = {};
  const errors: ValidationError[] = [];
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  for (const [cmd, rule] of Object.entries(src)) {
    if (!commands.includes(cmd)) {
      errors.push({ path: cmd, message: 'bot nie ma takiej komendy' });
      continue;
    }
    const roles = (rule as { roles?: unknown })?.roles;
    if (!Array.isArray(roles)) {
      errors.push({ path: cmd, message: 'oczekiwano listy ról' });
      continue;
    }
    const ok = roles.filter((r): r is string => typeof r === 'string' && SNOWFLAKE_RE.test(r));
    const missing = guild ? ok.filter((r) => !guild.roles.some((g) => g.id === r)) : [];
    if (missing.length) errors.push({ path: cmd, message: 'część ról nie istnieje na serwerze' });
    else if (ok.length) permissions[cmd] = { roles: [...new Set(ok)].slice(0, LIMITS.multiple) };
  }
  return { permissions, errors };
}

/** Czyści dane serwera przysłane przez bota. */
export function sanitizeGuild(g: Record<string, unknown>): { id: string; name: string; icon: string | null; data: GuildData } | null {
  const id = str(g?.id, 20);
  if (!id || !SNOWFLAKE_RE.test(id)) return null;
  const channels = (Array.isArray(g.channels) ? g.channels : [])
    .slice(0, 500)
    .map((c: Record<string, unknown>) => ({
      id: str(c?.id, 20) ?? '',
      name: str(c?.name, 100) ?? '',
      type: (CHANNEL_TYPES as readonly string[]).includes(String(c?.type)) ? (c.type as ChannelKind) : ('other' as const),
      parentId: str(c?.parentId, 20) ?? null,
      position: Number(c?.position) || 0,
    }))
    .filter((c) => SNOWFLAKE_RE.test(c.id));
  const roles = (Array.isArray(g.roles) ? g.roles : [])
    .slice(0, 250)
    .map((r: Record<string, unknown>) => ({
      id: str(r?.id, 20) ?? '',
      name: str(r?.name, 100) ?? '',
      color: Number(r?.color) || 0,
      position: Number(r?.position) || 0,
      managed: r?.managed === true,
    }))
    .filter((r) => SNOWFLAKE_RE.test(r.id));
  return { id, name: str(g.name, 100) || id, icon: str(g.icon, 300) ?? null, data: { channels, roles } };
}
