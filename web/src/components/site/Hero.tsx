'use client';

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { useEffect, useState } from 'react';
import { Icon } from '../Icon';
import { Arrow, Stars } from './primitives';

const EASE = [0.21, 0.8, 0.3, 1] as const;
const TITLE = ['Boty', 'Discord,', 'które', 'pracują', 'za', 'Ciebie'];
const GRAD_FROM = 3;

/** Sekwencja „na żywo” na podglądzie: postęp zlecenia rośnie. */
const PROGRESS = [35, 60, 85, 100];

export function Hero({
  orderUrl,
  rating,
  reviews,
  avatars,
}: {
  orderUrl: string;
  rating: number | null;
  reviews: number;
  avatars: string[];
}) {
  const reduce = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [7, -7]), { stiffness: 120, damping: 18 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-9, 9]), { stiffness: 120, damping: 18 });
  const fx = useSpring(useTransform(mx, [-0.5, 0.5], [-18, 18]), { stiffness: 80, damping: 20 });
  const fy = useSpring(useTransform(my, [-0.5, 0.5], [-14, 14]), { stiffness: 80, damping: 20 });
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setStep((s) => (s + 1) % PROGRESS.length), 2200);
    return () => clearInterval(t);
  }, [reduce]);

  const pct = PROGRESS[step]!;
  const done = pct === 100;

  return (
    <section
      className="hero2"
      onPointerMove={(e) => {
        if (reduce || e.pointerType !== 'mouse') return;
        mx.set(e.clientX / window.innerWidth - 0.5);
        my.set(e.clientY / window.innerHeight - 0.5);
      }}
    >
      <div className="bg" aria-hidden>
        <div className="aurora aurora-1" />
        <div className="aurora aurora-2" />
        <div className="aurora aurora-3" />
        <div className="grid-bg" />
        <div className="noise" />
      </div>

      <div className="wrap hero2-grid">
        <div>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
            <span className="pill-badge">
              <b>NOWE</b> Panel ustawień bota na zxcode.pl
            </span>
          </motion.div>

          <h1>
            {TITLE.map((w, i) => (
              <motion.span
                key={i}
                className={`word${i >= GRAD_FROM ? ' grad' : ''}`}
                initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.8, delay: 0.1 + i * 0.07, ease: EASE }}
              >
                {w}
                {i < TITLE.length - 1 ? ' ' : ''}
              </motion.span>
            ))}
          </h1>

          <motion.p
            className="hero2-sub"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.55, ease: EASE }}
          >
            Tickety, ekonomia, RP, moderacja i integracje – projektujemy, piszemy i utrzymujemy boty dla Twojej społeczności. Ustawienia
            zmieniasz sam w panelu, a my pilnujemy, żeby bot działał 24/7.
          </motion.p>

          <motion.div
            className="hero2-actions"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.7, ease: EASE }}
          >
            <a href={orderUrl} className="cta-btn" target={orderUrl.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
              <Icon name="discord" size={20} /> Zamów bota <Arrow />
            </a>
            <a href="#realizacje" className="ghost-btn">
              Zobacz realizacje <Arrow />
            </a>
          </motion.div>

          {rating !== null && reviews > 0 && (
            <motion.div className="hero2-trust" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1, duration: 0.8 }}>
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
                  <b style={{ color: 'var(--text)' }}>{rating.toLocaleString('pl-PL', { maximumFractionDigits: 2 })}/5</b> ·{' '}
                  {reviews} {reviews === 1 ? 'opinia' : reviews < 5 ? 'opinie' : 'opinii'} klientów
                </div>
              </div>
            </motion.div>
          )}
        </div>

        <motion.div
          className="stage"
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, delay: 0.35, ease: EASE }}
        >
          <motion.div className="dc" style={{ rotateX: rx, rotateY: ry }}>
            <div className="dc-top">
              <span className="hash">#</span> zamowienia
            </div>
            <div className="dc-body">
              <div className="dc-msg">
                <img className="dc-avatar" src="/emojis/logo_round.png" alt="" />
                <div>
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
                    <div className="dc-field">
                      <b>Termin:</b> 14 dni
                    </div>
                    <div className="dc-code dc-progress">
                      <span>Postęp</span>
                      <span className={`dc-bar${done ? ' done' : ''}`}>
                        <span style={{ width: `${pct}%` }} />
                      </span>
                      <span>{pct}%</span>
                    </div>
                    <div className="dc-buttons">
                      <span className="dc-btn primary">
                        <img src="/emojis/checklist.png" width={16} height={16} alt="" /> Panel zlecenia
                      </span>
                      <span className="dc-btn">
                        <img src="/emojis/invoice.png" width={16} height={16} alt="" /> Proforma
                      </span>
                    </div>
                    <div className="dc-foot">zxCode · programowanie botów Discord</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="float-card float-1"
            style={{ x: fx, y: fy }}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.1, duration: 0.8, ease: EASE }}
          >
            <span className="live-dot" />
            <div>
              <strong>Bot RP działa</strong>
              <small>uptime 99,98% · monitoring 24/7</small>
            </div>
          </motion.div>
          <motion.div
            className="float-card float-2"
            style={{ x: useTransform(fx, (v) => -v), y: useTransform(fy, (v) => -v) }}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.3, duration: 0.8, ease: EASE }}
          >
            <Icon name="verified" size={22} />
            <div>
              <strong>Zapisano w panelu</strong>
              <small>Bot już używa nowych ustawień</small>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
