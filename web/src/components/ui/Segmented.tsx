'use client';

import Link from 'next/link';
import { useLayoutEffect, useRef, useState } from 'react';

interface Item {
  value: string;
  label: string;
  href?: string;
  count?: number;
}

/**
 * Przełącznik segmentowy / zakładki z przesuwanym wskaźnikiem (transform, bez re-layoutu).
 * Z `href` – linki (nawigacja), bez – przyciski (onChange).
 */
export function Segmented({
  items,
  value,
  onChange,
  variant = 'pill',
  ariaLabel,
}: {
  items: Item[];
  value: string;
  onChange?: (v: string) => void;
  variant?: 'pill' | 'tabs';
  ariaLabel?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = wrap.current?.querySelector<HTMLElement>('[data-on="true"]');
      if (el) setThumb({ x: el.offsetLeft, w: el.offsetWidth });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [value, items.length]);

  return (
    <div ref={wrap} className={`segm ${variant}`} role={onChange ? 'tablist' : undefined} aria-label={ariaLabel}>
      {thumb && <span className="segm-thumb" style={{ transform: `translateX(${thumb.x}px)`, width: thumb.w }} aria-hidden />}
      {items.map((it) => {
        const on = it.value === value;
        const inner = (
          <>
            {it.label}
            {it.count !== undefined && <span className="segm-count">{it.count}</span>}
          </>
        );
        return it.href ? (
          <Link key={it.value} href={it.href} data-on={on} aria-current={on ? 'page' : undefined} scroll={false}>
            {inner}
          </Link>
        ) : (
          <button key={it.value} type="button" role="tab" aria-selected={on} data-on={on} onClick={() => onChange?.(it.value)}>
            {inner}
          </button>
        );
      })}
    </div>
  );
}
