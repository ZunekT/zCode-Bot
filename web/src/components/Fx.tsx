'use client';

import { useEffect } from 'react';

const PRESSABLE = '.btn, .cta-btn, .ghost-btn, .segm > a, .segm > button, .side a, [role="tab"], .switch';
const RIPPLE = '.btn, .cta-btn, .ghost-btn';
const TAB = '.segm > a, .segm > button, .side a, [role="tab"]';

export function Fx() {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const touch = window.matchMedia('(pointer: coarse)');
    const buzz = (pattern: number | number[]) => {
      if (!touch.matches || typeof navigator.vibrate !== 'function') return;
      try {
        navigator.vibrate(pattern);
      } catch {}
    };

    let last: { el: HTMLElement; at: number } | null = null;

    const ripple = (el: HTMLElement, x: number, y: number) => {
      const r = el.getBoundingClientRect();
      const size = Math.max(r.width, r.height) * 2.2;
      const dot = document.createElement('span');
      dot.className = 'fx-ripple';
      dot.style.width = dot.style.height = `${size}px`;
      dot.style.left = `${x - r.left - size / 2}px`;
      dot.style.top = `${y - r.top - size / 2}px`;
      dot.addEventListener('animationend', () => dot.remove(), { once: true });
      el.appendChild(dot);
    };

    const onDown = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>(PRESSABLE);
      if (!el || el.matches(':disabled, [aria-disabled="true"]')) return;
      last = { el, at: Date.now() };
      buzz(el.matches(TAB) ? 8 : 5);
      if (!reduce.matches && el.matches(RIPPLE)) ripple(el, e.clientX, e.clientY);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const el = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>(PRESSABLE);
      if (el) last = { el, at: Date.now() };
    };

    const onResult = (e: Event) => {
      const ok = (e as CustomEvent<{ ok: boolean }>).detail?.ok === true;
      buzz(ok ? 14 : [22, 60, 22]);
      const el = last && Date.now() - last.at < 20_000 && last.el.isConnected ? last.el : null;
      last = null;
      if (!el || reduce.matches) return;
      const cls = ok ? 'fx-ok' : 'fx-err';
      el.classList.remove('fx-ok', 'fx-err');
      void el.offsetWidth;
      el.classList.add(cls);
      window.setTimeout(() => el.classList.remove(cls), 1000);
    };

    document.addEventListener('pointerdown', onDown, { passive: true });
    document.addEventListener('keydown', onKey);
    window.addEventListener('zx:result', onResult);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('zx:result', onResult);
    };
  }, []);

  return null;
}
