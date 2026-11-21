'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

export function Track() {
  const path = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (!path) return;
    const body = JSON.stringify({ p: path, r: first.current ? document.referrer : '' });
    first.current = false;
    try {
      if (!navigator.sendBeacon?.('/api/t', new Blob([body], { type: 'application/json' })))
        void fetch('/api/t', { method: 'POST', body, keepalive: true, headers: { 'content-type': 'application/json' } });
    } catch {}
  }, [path]);
  return null;
}
