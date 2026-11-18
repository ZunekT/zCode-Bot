'use client';

import { useEffect, useMemo, useState } from 'react';
import { put } from '@/lib/client';
import type { BotSchema, ConfigValues, GuildChannel, GuildRole, SchemaField, SchemaModule, ValidationError } from '@/lib/types';
import { FieldInput } from './FieldInput';
import { Icon } from './Icon';
import { useToast } from './Toast';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Wartość wyświetlana: zapisana albo domyślna z definicji pola. */
function shown(field: SchemaField, stored: Record<string, unknown> | undefined) {
  const v = stored?.[field.key];
  if (v !== undefined) return v;
  return field.default ?? (field.multiple ? [] : field.type === 'boolean' ? false : null);
}

const isEnabled = (mod: SchemaModule, stored: Record<string, unknown> | undefined) =>
  !mod.toggle || (typeof stored?.enabled === 'boolean' ? stored.enabled : mod.defaultEnabled !== false);

export function SettingsEditor({
  botId,
  guildId,
  schema,
  initial,
  channels,
  roles,
}: {
  botId: number;
  guildId: string;
  schema: BotSchema;
  initial: ConfigValues;
  channels: GuildChannel[];
  roles: GuildRole[];
}) {
  const [saved, setSaved] = useState<ConfigValues>(() => clone(initial));
  const [values, setValues] = useState<ConfigValues>(() => clone(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [barError, setBarError] = useState<string | null>(null);
  const [active, setActive] = useState(schema.modules[0]?.key);
  const toast = useToast();

  const dirtyModules = useMemo(
    () => schema.modules.filter((m) => !same(values[m.key] ?? {}, saved[m.key] ?? {})).map((m) => m.key),
    [schema, values, saved],
  );
  const dirty = dirtyModules.length > 0;

  // Ostrzeżenie przy zamykaniu karty z niezapisanymi zmianami.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  // Podświetlenie modułu w menu przy przewijaniu.
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const v = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (v) setActive(v.target.id.replace(/^m-/, ''));
      },
      { rootMargin: '-80px 0px -60% 0px' },
    );
    document.querySelectorAll('.module').forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  function set(mod: SchemaModule, key: string, v: unknown) {
    setValues((prev) => {
      const next = { ...prev, [mod.key]: { ...(prev[mod.key] ?? {}), [key]: v } };
      // Pole wróciło do zapisanej wartości, której nie było w bazie → usuwamy, żeby nie liczyło się jako zmiana.
      if (saved[mod.key]?.[key] === undefined && same(v, key === 'enabled' ? mod.defaultEnabled !== false : shown(mod.fields.find((f) => f.key === key)!, undefined))) {
        delete next[mod.key]![key];
      }
      return next;
    });
    setErrors((e) => {
      const { [`${mod.key}.${key}`]: _, ...rest } = e;
      return rest;
    });
    setBarError(null);
  }

  async function save() {
    setSaving(true);
    setBarError(null);
    const payload: ConfigValues = {};
    for (const key of dirtyModules) payload[key] = values[key] ?? {};
    const res = await put<{ values: ConfigValues }>(`/api/bots/${botId}/guilds/${guildId}/config`, { values: payload });
    setSaving(false);
    if (!res.ok) {
      const map: Record<string, string> = {};
      for (const e of res.errors ?? ([] as ValidationError[])) map[e.path] = e.message;
      setErrors(map);
      setBarError(res.error ?? 'Nie udało się zapisać.');
      const first = Object.keys(map)[0];
      if (first) document.getElementById(`f-${first}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const fresh = res.data?.values ?? values;
    setSaved(clone(fresh));
    setValues(clone(fresh));
    setErrors({});
    toast.show(true, 'Zapisano. Bot już używa nowych ustawień.');
  }

  function reset() {
    setValues(clone(saved));
    setErrors({});
    setBarError(null);
  }

  if (!schema.modules.length) {
    return (
      <div className="card empty">
        <Icon name="tools" size={56} />
        <h2>Brak ustawień</h2>
        <p>Ten bot nie udostępnia jeszcze żadnych ustawień do edycji w panelu.</p>
      </div>
    );
  }

  return (
    <div className="settings">
      <nav className="side" aria-label="Moduły">
        <div className="side-title">Moduły</div>
        {schema.modules.map((m) => (
          <a key={m.key} href={`#m-${m.key}`} aria-current={active === m.key}>
            <span
              className={`dot ${dirtyModules.includes(m.key) ? 'dirty' : m.toggle && isEnabled(m, values[m.key]) ? 'on' : ''}`}
            />
            {m.label}
          </a>
        ))}
      </nav>

      <div>
        {schema.modules.map((mod) => {
          const stored = values[mod.key];
          const enabled = isEnabled(mod, stored);
          return (
            <section key={mod.key} id={`m-${mod.key}`} className={`card module${enabled ? '' : ' off'}`}>
              <div className="module-head">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2>{mod.label}</h2>
                  {mod.description && <p>{mod.description}</p>}
                </div>
                {mod.toggle && (
                  <button
                    type="button"
                    role="switch"
                    className="switch"
                    aria-checked={enabled}
                    aria-label={`${mod.label}: ${enabled ? 'włączony' : 'wyłączony'}`}
                    onClick={() => set(mod, 'enabled', !enabled)}
                  />
                )}
              </div>
              {mod.fields.length > 0 && (
                <div className="module-fields">
                  {mod.fields.map((f) => {
                    const path = `${mod.key}.${f.key}`;
                    const err = errors[path];
                    const wide = f.type === 'textarea' || f.multiple;
                    const id = `f-${path}`;
                    const input = (
                      <FieldInput
                        id={id}
                        field={f}
                        value={shown(f, stored)}
                        onChange={(v) => set(mod, f.key, v)}
                        channels={channels}
                        roles={roles}
                      />
                    );
                    return (
                      <div key={f.key} className={`field${wide ? ' wide' : ''}${err ? ' invalid' : ''}`}>
                        {f.type === 'boolean' ? (
                          <div className="field-row">
                            <label className="field-label" htmlFor={id}>
                              {f.label}
                            </label>
                            {input}
                          </div>
                        ) : (
                          <label className="field-label" htmlFor={id}>
                            {f.label}
                            {f.required && <span className="req">*</span>}
                          </label>
                        )}
                        {f.description && <span className="field-desc">{f.description}</span>}
                        {f.type !== 'boolean' && input}
                        {err && <span className="field-error">{err}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <div className={`savebar${dirty ? ' show' : ''}${barError ? ' error' : ''}`} role="region" aria-label="Niezapisane zmiany">
        <p className={barError ? '' : undefined} style={barError ? { color: 'var(--err)' } : undefined}>
          {barError ?? 'Masz niezapisane zmiany'}
        </p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={reset} disabled={saving}>
          Cofnij
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
          {saving ? 'Zapisywanie…' : 'Zapisz zmiany'}
        </button>
      </div>
      {toast.node}
    </div>
  );
}
