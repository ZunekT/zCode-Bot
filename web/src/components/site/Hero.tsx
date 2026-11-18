'use client';

import Link from 'next/link';
import { m, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Icon } from '../Icon';
import { Arrow, EASE, Stars, useVisible } from './primitives';

const LINE_1 = ['Boty', 'Discord,'];
const LINE_2 = ['które', 'pracują', 'za', 'Ciebie'];
const PROGRESS = [35, 60, 85, 100];

const word = (i: number) => ({
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay: 0.08 + i * 0.06, ease: EASE },
});

export function Hero({ rating, reviews, avatars }: { rating: number | null; reviews: number; avatars: string[] }) {
  const reduce = useReducedMotion();
  const [stageRef, visible] = useVisible<HTMLDivElement>();
  const [step, setStep] = useState(1);

  // Postęp zlecenia „na żywo” – tylko gdy podgląd jest na ekranie.
  useEffect(() => {
    if (reduce || !visible) return;
    const t = setInterval(() => setStep((s) => (s + 1) % PROGRESS.length), 2200);
    return () => clearInterval(t);
  }, [reduce, visible]);

  const pct = PROGRESS[step]!;
  const done = pct === 100;

  return (
    <section className="hero2">
      <div className="bg" aria-hidden>
        <div className="bg-glow" />
        <div className="grid-bg" />
      </div>

      <div className="wrap">
        <div className="hero2-head">
          <m.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
            <Link href="/#panel" className="pill-badge">
              <b>NOWE</b>
              <span>Panel klienta – ustawienia bota online</span>
              <Arrow />
            </Link>
          </m.div>

          <h1>
            {LINE_1.map((w, i) => (
              <m.span key={w} className="word" {...word(i)}>
                {w}&nbsp;
              </m.span>
            ))}
            <br />
            {LINE_2.map((w, i) => (
              <m.span key={w} className="word grad" {...word(i + LINE_1.length)}>
                {w}
                {i < LINE_2.length - 1 ? ' ' : ''}
              </m.span>
            ))}
          </h1>

          <m.p
            className="hero2-sub"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.45, ease: EASE }}
          >
            Tickety, ekonomia, RP, moderacja i integracje. Projektujemy, piszemy i utrzymujemy boty dla Twojej społeczności –
            a ustawienia zmieniasz sam w panelu.
          </m.p>

          <m.div
            className="hero2-actions"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.55, ease: EASE }}
          >
            <a href="/zamow" className="cta-btn">
              <Icon name="discord" size={20} /> Zamów bota <Arrow />
            </a>
            <Link href="/realizacje" className="ghost-btn">
              Zobacz realizacje <Arrow />
            </Link>
          </m.div>

          {rating !== null && reviews > 0 && (
            <m.div className="hero2-trust" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8, duration: 0.6 }}>
              {avatars.length > 0 && (
                <div className="avatars">
                  {avatars.slice(0, 5).map((a, i) => (
                    <img key={i} src={a} alt="" width={32} height={32} />
                  ))}
                </div>
              )}
              <div>
                <Stars n={Math.round(rating)} />
                <div>
                  <b style={{ color: 'var(--text)' }}>{rating.toLocaleString('pl-PL', { maximumFractionDigits: 1 })}/5</b> ·{' '}
                  <Link href="/opinie" style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>
                    {reviews} {reviews === 1 ? 'opinia' : reviews < 5 ? 'opinie' : 'opinii'}
                  </Link>
                </div>
              </div>
            </m.div>
          )}
        </div>

        <m.div
          ref={stageRef}
          className="stage"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.35, ease: EASE }}
        >
          <div className="float-card float-1">
            <span className="live-dot" />
            <div>
              <strong>Bot działa</strong>
              <small>monitoring co minutę, 24/7</small>
            </div>
          </div>
          <div className="float-card float-2">
            <Icon name="verified" size={22} />
            <div>
              <strong>Zapisano w panelu</strong>
              <small>Bot już używa nowych ustawień</small>
            </div>
          </div>
          <div className="float-card float-3">
            <Icon name="ticket" size={22} />
            <div>
              <strong>Nowy ticket #128</strong>
              <small>Zamówienie · odpowiedź w drodze</small>
            </div>
          </div>

          <div className="dc" aria-label="Przykładowa wiadomość bota zxCode na Discordzie" role="img">
            <div className="dc-top">
              <span className="hash">#</span> zamowienia
              <span className="dc-online">
                <span className="live-dot" /> online
              </span>
            </div>
            <div className="dc-body">
              <div className="dc-msg">
                <img className="dc-avatar" src="/emojis/logo_round.png" alt="" />
                <div style={{ minWidth: 0 }}>
                  <div className="dc-name">
                    zxCode <span className="dc-app">APP</span> <span className="dc-time">Dzisiaj o 14:32</span>
                  </div>
                  <div className="dc-card">
                    <h4>
                      <img src="/emojis/package.png" width={20} height={20} alt="" /> Zlecenie ZX-0042
                    </h4>
                    <div style={{ color: '#b5bac1' }}>Bot RP dla serwera Miasto Nocą</div>
                    <div className="dc-sep" />
                    <div className="dc-field">
                      <b>Status:</b> {done ? 'Gotowe do odbioru' : 'W realizacji'}
                    </div>
                    <div className="dc-field">
                      <b>Moduły:</b> ekonomia, praca, tickety, logi
                    </div>
                    <div className="dc-progress">
                      <span>Postęp</span>
                      <span className={`dc-bar${done ? ' done' : ''}`}>
                        <span style={{ transform: `scaleX(${pct / 100})` }} />
                      </span>
                      <span className="dc-pct">{pct}%</span>
                    </div>
                    <div className="dc-buttons">
                      <span className="dc-btn primary">
                        <img src="/emojis/checklist.png" width={16} height={16} alt="" /> Panel
                      </span>
                      <span className="dc-btn">
                        <img src="/emojis/invoice.png" width={16} height={16} alt="" /> Proforma
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </m.div>
      </div>
    </section>
  );
}
