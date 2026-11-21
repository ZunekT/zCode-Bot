'use client';

import Link from 'next/link';
import { useLayoutEffect, useRef, useState } from 'react';

interface Item {
  value: string;
  label: string;
  href?: string;
  count?: number;
}

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
  const [thumb, setThumb] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [edges, setEdges] = useState({ l: false, r: false });

  useLayoutEffect(() => {
    const box = wrap.current;
    const measure = () => {
      const el = box?.querySelector<HTMLElement>('[data-on="true"]');
      if (el) setThumb({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });
      else setThumb(null);
      if (box) setEdges({ l: box.scrollLeft > 2, r: box.scrollLeft + box.clientWidth < box.scrollWidth - 2 });
    };
    measure();
    const el = box?.querySelector<HTMLElement>('[data-on="true"]');
    if (box && el && box.scrollWidth > box.clientWidth) {
      const left = el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2;
      box.scrollTo({ left: Math.max(0, left), behavior: 'instant' as ScrollBehavior });
      measure();
    }
    box?.addEventListener('scroll', measure, { passive: true });
    const ro = new ResizeObserver(measure);
    if (wrap.current) ro.observe(wrap.current);
    return () => {
      ro.disconnect();
      box?.removeEventListener('scroll', measure);
    };
  }, [value, items.length]);

  return (
    <div ref={wrap} className={`segm segm-${variant}${edges.l ? ' fade-l' : ''}${edges.r ? ' fade-r' : ''}`} role={onChange ? 'tablist' : undefined} aria-label={ariaLabel}>
      {thumb && <span className="segm-thumb" style={
            variant === 'tabs'
              ? { transform: `translateX(${thumb.x}px)`, width: thumb.w }
              : { transform: `translate(${thumb.x}px, ${thumb.y}px)`, width: thumb.w, height: thumb.h }
          } aria-hidden />}
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
