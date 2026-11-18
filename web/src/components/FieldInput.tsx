'use client';

import type { GuildChannel, GuildRole, SchemaField } from '@/lib/types';
import { roleColor } from '@/lib/format';
import { Select, type Option } from './ui/Select';

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


/** Kanały jako opcje listy wyboru: pogrupowane po kategoriach, jak na Discordzie. */
export function channelOptions(channels: GuildChannel[], types?: string[]): Option[] {
  const out: Option[] = [];
  for (const g of channelGroups(channels, types)) {
    for (const c of g.items) {
      out.push({
        value: c.id,
        label: c.type === 'category' ? c.name.toUpperCase() : c.name,
        prefix: c.type === 'category' || c.type === 'voice' || c.type === 'stage' ? undefined : '#',
        group: g.label ?? 'Bez kategorii',
        hint: KIND_LABEL[c.type],
      });
    }
  }
  return out;
}

/** Role od najwyższej, z kolorem; bez ról zarządzanych przez integracje. */
export function roleOptions(roles: GuildRole[]): Option[] {
  return [...roles]
    .filter((r) => !r.managed)
    .sort((a, b) => (b.position ?? 0) - (a.position ?? 0))
    .map((r) => ({ value: r.id, label: r.name, color: roleColor(r.color), prefix: '@' }));
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
      const opts = (field.options ?? []).map((o) => ({ value: o.value, label: o.label }));
      return field.multiple ? (
        <Select id={id} multiple value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} options={opts} placeholder="Dodaj…" />
      ) : (
        <Select id={id} value={typeof value === 'string' ? value : null} onChange={onChange} options={opts} clearable={!field.required} placeholder="— brak —" />
      );
    }

    case 'channel': {
      const opts = channelOptions(channels, field.channelTypes);
      return field.multiple ? (
        <Select id={id} multiple value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} options={opts} placeholder="Dodaj kanał…" searchable />
      ) : (
        <Select id={id} value={typeof value === 'string' ? value : null} onChange={onChange} options={opts} clearable placeholder="— nie ustawiono —" searchable />
      );
    }

    case 'role': {
      const opts = roleOptions(roles);
      return field.multiple ? (
        <Select id={id} multiple value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} options={opts} placeholder="Dodaj rolę…" searchable />
      ) : (
        <Select id={id} value={typeof value === 'string' ? value : null} onChange={onChange} options={opts} clearable placeholder="— nie ustawiono —" searchable />
      );
    }
  }
}
