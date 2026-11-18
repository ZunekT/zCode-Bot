import Link from 'next/link';
import type { CSSProperties } from 'react';
import { Icon } from '../Icon';
import { OrderProgress } from './islands';
import { Arrow, Stars } from './primitives';

const LINE_1 = ['Boty', 'Discord,'];
const LINE_2 = ['które', 'pracują', 'za', 'Ciebie'];
const d = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;

export function Hero({ rating, reviews, avatars }: { rating: number | null; reviews: number; avatars: string[] }) {
  return (
    <section className="hero2">
      <div className="bg" aria-hidden>
        <div className="bg-glow" />
        <div className="grid-bg" />
      </div>

      <div className="wrap">
        <div className="hero2-head">
          <Link href="/#panel" className="pill-badge enter" style={d(0)}>
            <b>NOWE</b>
            <span>Panel klienta – ustawienia bota online</span>
            <Arrow />
          </Link>

          <h1>
            {LINE_1.map((w, i) => (
              <span key={w} className="word enter" style={d(80 + i * 60)}>
                {w}&nbsp;
              </span>
            ))}
            <br />
            {LINE_2.map((w, i) => (
              <span key={w} className="word grad enter" style={d(200 + i * 60)}>
                {w}
                {i < LINE_2.length - 1 ? ' ' : ''}
              </span>
            ))}
          </h1>

          <p className="hero2-sub enter" style={d(420)}>
            Tickety, ekonomia, RP, moderacja i integracje. Projektujemy, piszemy i utrzymujemy boty dla Twojej społeczności – a
            ustawienia zmieniasz sam w panelu.
          </p>

          <div className="hero2-actions enter" style={d(520)}>
            <a href="/zamow" className="cta-btn">
              <Icon name="discord" size={20} /> Zamów bota <Arrow />
            </a>
            <Link href="/realizacje" className="ghost-btn">
              Zobacz realizacje <Arrow />
            </Link>
          </div>

          {rating !== null && reviews > 0 && (
            <div className="hero2-trust enter" style={d(700)}>
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
            </div>
          )}
        </div>

        <div className="stage enter" style={d(350)}>
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
                <img className="dc-avatar" src="/emojis/logo_round.png" alt="" width={40} height={40} />
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
                    <OrderProgress />
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
        </div>
      </div>
    </section>
  );
}
