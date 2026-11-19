'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';

const reduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function RevealObserver() {
  const pathname = usePathname();
  useEffect(() => {
    const els = () => document.querySelectorAll<HTMLElement>('[data-reveal]:not(.in)');
    if (reduced() || !('IntersectionObserver' in window)) {
      els().forEach((el) => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.01 },
    );
    const observe = () => els().forEach((el) => io.observe(el));
    observe();
    const mo = new MutationObserver(observe);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, [pathname]);
  return null;
}

export function useOnScreen<T extends Element>(margin = '100px') {
  const ref = useRef<T>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOn(!!e?.isIntersecting), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return [ref, on] as const;
}

export function useTicker(ms: number, active: boolean) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active || reduced()) return;
    const t = setInterval(() => !document.hidden && setTick((v) => v + 1), ms);
    return () => clearInterval(t);
  }, [ms, active]);
  return tick;
}

export function CountUp({
  to,
  decimals,
  suffix = '',
  money = false,
}: {
  to: number;
  decimals?: number;
  suffix?: string;
  money?: boolean;
}) {
  const dec = decimals ?? (money && to % 1 ? 2 : 0);
  const fmt = (v: number) =>
    v.toLocaleString('pl-PL', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + (money ? ' zł' : '');
  const [ref, on] = useOnScreen<HTMLSpanElement>('0px');
  const [text, setText] = useState(fmt(to));
  const [ready, setReady] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    if (reduced() || to === 0) done.current = true;
    else setText(fmt(0));
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (done.current) {
      setText(fmt(to));
      return;
    }
    if (!on) return;
    done.current = true;
    const start = performance.now();
    const dur = Math.min(1600, 700 + Math.log10(Math.abs(to) + 1) * 250);
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 4);
      setText(fmt(p < 1 ? (dec ? to * eased : Math.round(to * eased)) : to));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, ready, to]);

  return (
    <span ref={ref} className={`cu${ready ? ' cu-ready' : ''}`}>
      {text}
      {suffix && <small>{suffix}</small>}
    </span>
  );
}

export function TypeRotate({ words, delay = 1400 }: { words: string[]; delay?: number }) {
  const [ref, on] = useOnScreen<HTMLSpanElement>('0px');
  const [text, setText] = useState(words[0] ?? '');
  const state = useRef({ i: 0, len: (words[0] ?? '').length, del: true, started: false });

  useEffect(() => {
    if (!on || reduced() || words.length < 2) return;
    let t: ReturnType<typeof setTimeout>;
    const st = state.current;
    const tick = () => {
      if (document.hidden) return (t = setTimeout(tick, 500));
      const word = words[st.i]!;
      if (st.del) {
        st.len--;
        if (st.len <= 0) {
          st.del = false;
          st.i = (st.i + 1) % words.length;
          st.len = 0;
          setText('');
          return (t = setTimeout(tick, 260));
        }
        setText(word.slice(0, st.len));
        return (t = setTimeout(tick, 28));
      }
      const next = words[st.i]!;
      st.len++;
      setText(next.slice(0, st.len));
      if (st.len >= next.length) {
        st.del = true;
        return (t = setTimeout(tick, 2400));
      }
      return (t = setTimeout(tick, 48 + Math.random() * 40));
    };
    t = setTimeout(tick, st.started ? 1200 : delay + 1800);
    st.started = true;
    return () => clearTimeout(t);
  }, [on, words, delay]);

  return (
    <span ref={ref} className="tw" aria-hidden>
      {words.map((w) => (
        <span key={w} className="tw-sizer">
          {w}
        </span>
      ))}
      <span className="tw-live">
        {text}
        <i className="tw-caret" />
      </span>
    </span>
  );
}

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

export function FaqList({
  items,
  firstOpen = true,
}: {
  items: { id: number | string; question: string; answer: string }[];
  firstOpen?: boolean;
}) {
  const [open, setOpen] = useState<number | string | null>(firstOpen ? (items[0]?.id ?? null) : null);
  return (
    <div className="faq-list">
      {items.map((f) => {
        const isOpen = open === f.id;
        const id = `faq-${f.id}`;
        return (
          <div key={f.id} className={`faq-item${isOpen ? ' open' : ''}`}>
            <button
              className="faq-q"
              aria-expanded={isOpen}
              aria-controls={id}
              onClick={() => setOpen(isOpen ? null : f.id)}
            >
              {f.question}
              <span className="faq-plus" aria-hidden />
            </button>
            <div id={id} className="faq-body" role="region">
              <div>
                <div className="faq-a">{f.answer}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function LiveSwitches() {
  const [ref, on] = useOnScreen<HTMLDivElement>();
  const tick = useTicker(1500, on);
  const states = [true, false, true].map((v, i) => (Math.floor((tick + 2 - i) / 3) % 2 === 0 ? v : !v));
  return (
    <div ref={ref} className="mini-switches tile-visual" aria-hidden>
      {['Powitania', 'Ekonomia', 'Logi serwera'].map((l, i) => (
        <div key={l} className="mini-row">
          {l}
          <span className={`mini-switch${states[i] ? ' on' : ''}`} />
        </div>
      ))}
    </div>
  );
}

const CHANNELS = ['# powitania', '# ogloszenia', '# lobby'];

export function PanelMock() {
  const [ref, on] = useOnScreen<HTMLDivElement>();
  const tick = useTicker(1800, on);
  return (
    <div ref={ref} className="browser" aria-hidden>
      <div className="browser-bar">
        <i />
        <i />
        <i />
        <div className="browser-url">zxcode.pl/panel</div>
      </div>
      <div className="browser-body">
        <div className="browser-side">
          {['Ogólne', 'Powitania', 'Ekonomia', 'Tickety', 'Logi'].map((s, i) => (
            <span key={s} className={i === 1 ? 'on' : undefined}>
              <i /> {s}
            </span>
          ))}
        </div>
        <div className="browser-main">
          <div className="bm-card">
            <h5>
              Powitania <span className={`mini-switch${tick % 6 < 5 ? ' on' : ''}`} />
            </h5>
            <div className="bm-fields">
              <div className="bm-field">
                Kanał powitań
                <div key={tick % 3} className="bm-input bm-swap">
                  {CHANNELS[tick % 3]}
                </div>
              </div>
              <div className="bm-field">
                Rola na start
                <div className="bm-input">
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 9,
                      background: '#2ecc8f',
                      marginRight: 8,
                      flexShrink: 0,
                    }}
                  />
                  @Gracz
                </div>
              </div>
            </div>
            <div className="bm-field" style={{ marginTop: 10 }}>
              Treść
              <div className="bm-input">Witaj {'{user}'} na serwerze!</div>
            </div>
          </div>
          <div className="bm-card">
            <h5>
              Ekonomia <span className="mini-switch on" />
            </h5>
            <div className="bm-fields">
              <div className="bm-field">
                Nazwa waluty
                <div className="bm-input">monety</div>
              </div>
              <div className="bm-field">
                Nagroda dzienna
                <div className="bm-input">250</div>
              </div>
            </div>
          </div>
          <div style={{ minHeight: 46, display: 'flex', justifyContent: 'center' }}>
            <div className={`bm-save${tick % 3 === 1 ? ' show' : ''}`}>
              <span>Masz niezapisane zmiany</span>
              <span>Zapisz</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


export function useScrolled(threshold = 16) {
  const [s, setS] = useState(false);
  useEffect(() => {
    const on = () => setS(window.scrollY > threshold);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [threshold]);
  return s;
}
