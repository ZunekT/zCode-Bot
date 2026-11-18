'use client';

import { animate, domAnimation, LazyMotion, m, MotionConfig, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

export const EASE = [0.21, 0.8, 0.3, 1] as const;

/** Lżejsza wersja motion (tylko potrzebne funkcje) + szacunek dla „ogranicz ruch”. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}

/** Płynne pojawienie się przy przewinięciu (raz). Tylko transform + opacity – tanie dla GPU. */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -60px 0px' }}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >
      {children}
    </m.div>
  );
}

/** Czy element jest na ekranie (do wstrzymywania animacji w tle). */
export function useVisible<T extends Element>() {
  const ref = useRef<T>(null);
  const visible = useInView(ref, { margin: '100px' });
  return [ref, visible] as const;
}

/** Licznik od 0 do wartości, gdy pojawi się na ekranie. */
export function CountUp({ to, decimals = 0, suffix = '' }: { to: number; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const fmt = (v: number) =>
    v.toLocaleString('pl-PL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const [text, setText] = useState(fmt(to));

  useEffect(() => {
    if (!inView || reduce) return;
    const c = animate(0, to, { duration: 1.6, ease: EASE, onUpdate: (v) => setText(fmt(v)) });
    return () => c.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, to, reduce]);

  return (
    <span ref={ref}>
      {text}
      {suffix && <small>{suffix}</small>}
    </span>
  );
}

/** Karta z poświatą za kursorem (tylko urządzenia z myszką – CSS). */
export function Spotlight({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className={`tile ${className}`}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse') return;
        const r = ref.current!.getBoundingClientRect();
        ref.current!.style.setProperty('--mx', `${e.clientX - r.left}px`);
        ref.current!.style.setProperty('--my', `${e.clientY - r.top}px`);
      }}
    >
      {children}
    </div>
  );
}

/** Nieskończony pasek – animacja CSS, wstrzymana poza ekranem. */
export function Marquee({
  children,
  speed = 40,
  reverse = false,
  gap,
}: {
  children: ReactNode;
  speed?: number;
  reverse?: boolean;
  gap?: number;
}) {
  const [ref, visible] = useVisible<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`marquee${reverse ? ' reverse' : ''}${visible ? '' : ' paused'}`}
      style={{ '--speed': `${speed}s`, ...(gap !== undefined && { '--gap': `${gap}px` }) } as React.CSSProperties}
    >
      <div className="marquee-track">{children}</div>
      <div className="marquee-track" aria-hidden>
        {children}
      </div>
    </div>
  );
}

export function Stars({ n, size = 15 }: { n: number; size?: number }) {
  return (
    <span className="stars" role="img" aria-label={`Ocena ${n} na 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 20 20"
          fill={i < n ? 'currentColor' : 'rgba(255,255,255,.15)'}
          aria-hidden
        >
          <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z" />
        </svg>
      ))}
    </span>
  );
}

export const Arrow = () => (
  <svg className="arrow" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Check = () => (
  <span className="check" aria-hidden>
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
      <path d="M2.5 6.2l2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
);
