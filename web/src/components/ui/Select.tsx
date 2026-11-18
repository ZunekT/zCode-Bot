'use client';

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export interface Option {
  value: string;
  label: string;
  /** Nagłówek grupy (np. kategoria kanałów). */
  group?: string | null;
  /** Kolorowa kropka (np. kolor roli). */
  color?: string;
  /** Prefiks, np. „#” dla kanałów. */
  prefix?: string;
  hint?: string;
  disabled?: boolean;
}

interface Common {
  options: Option[];
  placeholder?: string;
  id?: string;
  ariaLabel?: string;
  disabled?: boolean;
  /** Pokaż wyszukiwarkę (domyślnie przy > 7 opcjach). */
  searchable?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}
type Single = Common & { multiple?: false; value: string | null; onChange: (v: string | null) => void; clearable?: boolean };
type Multi = Common & { multiple: true; value: string[]; onChange: (v: string[]) => void; max?: number };

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

/**
 * Lista wyboru: popover ze szkła, wyszukiwarka, grupy, kolory, klawiatura (↑↓ Enter Esc Home End),
 * wybór wielu (z chipami), otwieranie w górę, gdy brak miejsca. Opcje renderowane tylko po otwarciu.
 */
export function Select(props: Single | Multi) {
  const { options, placeholder = 'Wybierz…', id, ariaLabel, disabled, size = 'md', className = '' } = props;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [up, setUp] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const listId = useId();
  const searchable = props.searchable ?? options.length > 7;

  const selected = props.multiple ? props.value : props.value ? [props.value] : [];
  const byValue = useMemo(() => new Map(options.map((o) => [o.value, o])), [options]);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = norm(query.trim());
    return options.filter((o) => norm(`${o.label} ${o.group ?? ''}`).includes(q));
  }, [options, query]);
  const selectable = filtered.filter((o) => !o.disabled);

  // Zamknięcie po kliknięciu poza.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  // Kierunek otwarcia + fokus wyszukiwarki + podświetlenie wybranej.
  useLayoutEffect(() => {
    if (!open) return;
    const r = root.current!.getBoundingClientRect();
    setUp(window.innerHeight - r.bottom < 320 && r.top > window.innerHeight - r.bottom);
    const idx = selectable.findIndex((o) => selected.includes(o.value));
    setActive(Math.max(0, idx));
    if (searchable) search.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  function pick(o: Option) {
    if (o.disabled) return;
    if (props.multiple) {
      const has = props.value.includes(o.value);
      if (!has && props.max && props.value.length >= props.max) return;
      props.onChange(has ? props.value.filter((v) => v !== o.value) : [...props.value, o.value]);
    } else {
      props.onChange(o.value);
      setOpen(false);
      setQuery('');
    }
  }

  function onKey(e: React.KeyboardEvent) {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(selectable.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(selectable.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const o = selectable[active];
      if (o) pick(o);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  }

  const label = (o: Option): ReactNode => (
    <>
      {o.color && <i className="sel-dot" style={{ background: o.color }} />}
      {o.prefix && <span className="sel-prefix">{o.prefix}</span>}
      <span className="sel-label">{o.label}</span>
    </>
  );

  // Grupy w kolejności występowania.
  let lastGroup: string | null | undefined;
  let idx = -1;

  return (
    <div ref={root} className={`sel ${size === 'sm' ? 'sel-sm' : ''} ${open ? 'open' : ''} ${className}`} onKeyDown={onKey}>
      <button
        type="button"
        id={id}
        className="sel-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        {props.multiple ? (
          props.value.length ? (
            <span className="sel-chips">
              {props.value.map((v) => {
                const o = byValue.get(v) ?? { value: v, label: 'usunięte' };
                return (
                  <span key={v} className="sel-chip">
                    {label(o)}
                    <span
                      role="button"
                      tabIndex={-1}
                      aria-label={`Usuń ${o.label}`}
                      className="sel-chip-x"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onChange(props.value.filter((x) => x !== v));
                      }}
                    >
                      ×
                    </span>
                  </span>
                );
              })}
            </span>
          ) : (
            <span className="sel-placeholder">{placeholder}</span>
          )
        ) : props.value ? (
          <span className="sel-value">{label(byValue.get(props.value) ?? { value: props.value, label: 'usunięte' })}</span>
        ) : (
          <span className="sel-placeholder">{placeholder}</span>
        )}
        {!props.multiple && props.clearable && props.value && (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Wyczyść"
            className="sel-clear"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              props.onChange(null);
            }}
          >
            ×
          </span>
        )}
        <svg className="sel-chev" width="14" height="14" viewBox="0 0 16 16" aria-hidden>
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className={`sel-pop glass ${up ? 'up' : ''}`}>
          {searchable && (
            <div className="sel-search">
              <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
                <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <input
                ref={search}
                value={query}
                placeholder="Szukaj…"
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                aria-label="Szukaj"
              />
            </div>
          )}
          <div ref={list} id={listId} className="sel-list" role="listbox" aria-multiselectable={props.multiple || undefined}>
            {filtered.length === 0 && <div className="sel-empty">Brak wyników</div>}
            {filtered.map((o) => {
              const header = o.group !== lastGroup && o.group ? <div className="sel-group">{o.group}</div> : null;
              lastGroup = o.group;
              if (!o.disabled) idx++;
              const myIdx = idx;
              const isSel = selected.includes(o.value);
              return (
                <div key={o.value}>
                  {header}
                  <div
                    role="option"
                    aria-selected={isSel}
                    aria-disabled={o.disabled || undefined}
                    data-active={!o.disabled && myIdx === active}
                    className={`sel-opt${isSel ? ' sel' : ''}${o.disabled ? ' dis' : ''}`}
                    onPointerEnter={() => !o.disabled && setActive(myIdx)}
                    onClick={() => pick(o)}
                  >
                    {label(o)}
                    {o.hint && <span className="sel-hint">{o.hint}</span>}
                    {isSel && (
                      <svg className="sel-check" width="14" height="14" viewBox="0 0 16 16" aria-hidden>
                        <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
