'use client';

import type { GuildChannel, GuildRole, SchemaField } from '@/lib/types';
import { roleColor } from '@/lib/format';

const KIND_LABEL: Record<string, string> = {
  voice: 'głosowy',
  stage: 'scena',
  forum: 'forum',
  announcement: 'ogłoszenia',
  category: 'kategoria',
};

/** Kanały do wyboru, pogrupowane jak na Discordzie (kategorie → kanały). */
function channelGroups(channels: GuildChannel[], types?: string[]) {
  const allowed = (c: GuildChannel) => !types?.length || types.includes(c.type);
  const byPos = (a: GuildChannel, b: GuildChannel) => (a.position ?? 0) - (b.position ?? 0);
  const categories = channels.filter((c) => c.type === 'category').sort(byPos);
  const groups: { label: string | null; items: GuildChannel[] }[] = [];

  if (types?.length === 1 && types[0] === 'category') return [{ label: null, items: categories }];

  const top = channels.filter((c) => c.type !== 'category' && !c.parentId && allowed(c)).sort(byPos);
  if (top.length) groups.push({ label: null, items: top });
  for (const cat of categories) {
    const items = channels.filter((c) => c.parentId === cat.id && allowed(c)).sort(byPos);
    if (allowed(cat)) items.unshift(cat);
    if (items.length) groups.push({ label: cat.name, items });
  }
  return groups;
}

const channelLabel = (c: GuildChannel) =>
  c.type === 'category' ? c.name.toUpperCase() : `# ${c.name}${KIND_LABEL[c.type] ? ` (${KIND_LABEL[c.type]})` : ''}`;

function Chips({ items, onRemove }: { items: { id: string; label: string; color?: string }[]; onRemove: (id: string) => void }) {
  if (!items.length) return null;
  return (
    <div className="chips">
      {items.map((i) => (
        <span key={i.id} className="chip">
          {i.color && <span className="swatch" style={{ background: i.color }} />}
          {i.label}
          <button type="button" onClick={() => onRemove(i.id)} aria-label={`Usuń ${i.label}`}>
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

export function FieldInput({
  id,
  field,
  value,
  onChange,
  channels,
  roles,
}: {
  id: string;
  field: SchemaField;
  value: unknown;
  onChange: (v: unknown) => void;
  channels: GuildChannel[];
  roles: GuildRole[];
}) {
  switch (field.type) {
    case 'boolean':
      return (
        <button
          id={id}
          type="button"
          role="switch"
          className="switch"
          aria-checked={value === true}
          onClick={() => onChange(!(value === true))}
        />
      );

    case 'text':
    case 'textarea': {
      const max = field.maxLength ?? (field.type === 'text' ? 2000 : 6000);
      const text = typeof value === 'string' ? value : '';
      return (
        <>
          {field.type === 'text' ? (
            <input id={id} className="input" value={text} maxLength={max} onChange={(e) => onChange(e.target.value)} />
          ) : (
            <textarea id={id} value={text} maxLength={max} onChange={(e) => onChange(e.target.value)} />
          )}
          {max <= 6000 && text.length > max * 0.8 && (
            <div className="counter">
              {text.length} / {max}
            </div>
          )}
        </>
      );
    }

    case 'number':
      return (
        <input
          id={id}
          className="input"
          type="number"
          inputMode={field.integer ? 'numeric' : 'decimal'}
          min={field.min}
          max={field.max}
          step={field.integer ? 1 : 'any'}
          value={typeof value === 'number' ? value : ''}
          placeholder={field.min !== undefined && field.max !== undefined ? `${field.min}–${field.max}` : undefined}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
      );

    case 'color': {
      const hex = typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : '#1a9fff';
      return (
        <div className="color-row">
          <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} aria-label={field.label} />
          <input
            id={id}
            className="input"
            value={typeof value === 'string' ? value : ''}
            placeholder="#rrggbb"
            maxLength={7}
            onChange={(e) => onChange(e.target.value || null)}
          />
        </div>
      );
    }

    case 'select': {
      const opts = field.options ?? [];
      if (field.multiple) {
        const list = Array.isArray(value) ? (value as string[]) : [];
        return (
          <>
            <Chips
              items={list.map((v) => ({ id: v, label: opts.find((o) => o.value === v)?.label ?? v }))}
              onRemove={(v) => onChange(list.filter((x) => x !== v))}
            />
            <select id={id} value="" onChange={(e) => e.target.value && onChange([...list, e.target.value])}>
              <option value="">Dodaj…</option>
              {opts.filter((o) => !list.includes(o.value)).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </>
        );
      }
      return (
        <select id={id} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value || null)}>
          {!field.required && <option value="">— brak —</option>}
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }

    case 'channel': {
      const groups = channelGroups(channels, field.channelTypes);
      const byId = new Map(channels.map((c) => [c.id, c]));
      const options = (exclude: string[] = []) =>
        groups.map((g, i) => {
          const items = g.items.filter((c) => !exclude.includes(c.id));
          if (!items.length) return null;
          const opts = items.map((c) => (
            <option key={c.id} value={c.id}>
              {channelLabel(c)}
            </option>
          ));
          return g.label ? (
            <optgroup key={i} label={g.label}>
              {opts}
            </optgroup>
          ) : (
            opts
          );
        });

      if (field.multiple) {
        const list = Array.isArray(value) ? (value as string[]) : [];
        return (
          <>
            <Chips
              items={list.map((cid) => ({ id: cid, label: byId.get(cid) ? channelLabel(byId.get(cid)!) : 'usunięty kanał' }))}
              onRemove={(cid) => onChange(list.filter((x) => x !== cid))}
            />
            <select id={id} value="" onChange={(e) => e.target.value && onChange([...list, e.target.value])}>
              <option value="">Dodaj kanał…</option>
              {options(list)}
            </select>
          </>
        );
      }
      const current = typeof value === 'string' ? value : '';
      return (
        <select id={id} value={current} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">— nie ustawiono —</option>
          {current && !byId.has(current) && <option value={current}>usunięty kanał</option>}
          {options()}
        </select>
      );
    }

    case 'role': {
      const sorted = [...roles].filter((r) => !r.managed).sort((a, b) => (b.position ?? 0) - (a.position ?? 0));
      const byId = new Map(roles.map((r) => [r.id, r]));
      if (field.multiple) {
        const list = Array.isArray(value) ? (value as string[]) : [];
        return (
          <>
            <Chips
              items={list.map((rid) => ({ id: rid, label: byId.get(rid)?.name ?? 'usunięta rola', color: roleColor(byId.get(rid)?.color) }))}
              onRemove={(rid) => onChange(list.filter((x) => x !== rid))}
            />
            <select id={id} value="" onChange={(e) => e.target.value && onChange([...list, e.target.value])}>
              <option value="">Dodaj rolę…</option>
              {sorted.filter((r) => !list.includes(r.id)).map((r) => (
                <option key={r.id} value={r.id}>
                  @{r.name}
                </option>
              ))}
            </select>
          </>
        );
      }
      const current = typeof value === 'string' ? value : '';
      return (
        <select id={id} value={current} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">— nie ustawiono —</option>
          {current && !byId.has(current) && <option value={current}>usunięta rola</option>}
          {sorted.map((r) => (
            <option key={r.id} value={r.id}>
              @{r.name}
            </option>
          ))}
        </select>
      );
    }
  }
}
