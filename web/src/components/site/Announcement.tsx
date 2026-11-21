'use client';

import { useEffect, useRef, useState } from 'react';
import type { SiteState } from '@/lib/content';

type A = NonNullable<SiteState['announcement']>;

export function AnnouncementBar({ a }: { a: A }) {
  const key = `zx-ann-${a.version}`;
  const [hidden, setHidden] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try {
      if (a.dismissible && localStorage.getItem(key)) setHidden(true);
    } catch {}
  }, [a.dismissible, key]);
  useEffect(() => {
    const root = document.documentElement;
    const el = ref.current;
    if (hidden || !el) {
      root.style.setProperty('--ann-h', '0px');
      return;
    }
    const sync = () => root.style.setProperty('--ann-h', `${el.offsetHeight}px`);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hidden]);
  if (hidden) return null;
  const external = /^https?:/i.test(a.link);
  return (
    <div ref={ref} className={`ann ann-${a.tone}`} role="region" aria-label="Ogłoszenie">
      <p>
        <span>{a.text}</span>
        {a.link && (
          <a href={a.link} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
            {a.linkLabel || 'Więcej'}
          </a>
        )}
      </p>
      {a.dismissible && (
        <button
          type="button"
          className="ann-close"
          aria-label="Zamknij ogłoszenie"
          onClick={() => {
            setHidden(true);
            try {
              localStorage.setItem(key, '1');
            } catch {}
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
