import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { SiteContent } from '@/lib/content';
import { byKind, type SiteData } from '@/lib/site';
import { Icon } from '../Icon';
import { CountUp, TypeRotate } from './islands';
import { Arrow, Stars } from './primitives';

const d = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;
const DISCORD_CDN = /^https:\/\/cdn\.discordapp\.com\//;

const money = (v: number) => v.toLocaleString('pl-PL', { maximumFractionDigits: 0 });
const from = (list: SiteData['packages']) => (list.length ? Math.min(...list.map((p) => p.price)) : null);
const plural = (n: number, one: string, few: string, many: string) =>
  n === 1 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many;

export function Hero({ data, c }: { data: SiteData; c: SiteContent['glowna'] }) {
  const phrases = c.hasla.split('\n').map((p) => p.trim()).filter(Boolean);
  const PHRASES = phrases.length ? phrases : ['strony internetowe'];
  const TYPED = PHRASES.map((p) => `${p},`);
  const { stats, packages, portfolio, reviews } = data;
  const webFrom = from(byKind(packages, 'WEBSITE'));
  const botFrom = from(byKind(packages, 'BOT'));
  const thumbs = portfolio.filter((p) => p.images[0]).slice(0, 3);
  const avatars = reviews
    .map((r) => r.avatar)
    .filter((a): a is string => !!a && DISCORD_CDN.test(a))
    .slice(0, 4);
  const uptimeDec = stats.uptime !== null && stats.uptime < 99.995 ? 2 : 0;
  const facts = [
    stats.ordersCompleted > 0 && { v: stats.ordersCompleted, label: 'zrealizowanych zleceń' },
    stats.clients > 0 && { v: stats.clients, label: 'zadowolonych klientów' },
    stats.uptime !== null && { v: stats.uptime, dec: uptimeDec, suffix: '%', label: 'dostępności' },
  ].filter(Boolean) as { v: number; dec?: number; suffix?: string; label: string }[];

  return (
    <section className="home">
      <div className="bg" aria-hidden>
        <div className="bg-glow" />
        <div className="grid-bg" />
      </div>
      <div className="wrap home-grid">
        <div className="home-copy">
          {c.plakietka && (
            <Link href={c.plakietkaLink.startsWith('/') ? c.plakietkaLink : '/strony-internetowe'} className="pill-badge enter" style={d(0)}>
              {c.etykieta && <b>{c.etykieta}</b>}
              <span>{c.plakietka}</span>
              <Arrow />
            </Link>
          )}
          <h1>
            <span className="word enter" style={d(80)}>
              Tworzymy
            </span>
            <br />
            <span className="sr-only">{PHRASES.join(', ')}, </span>
            <span className="word grad enter" style={d(160)}>
              <TypeRotate words={TYPED} />
            </span>
            <br />
            <span className="word enter" style={d(240)}>
              które pracują
            </span>{' '}
            <span className="word enter" style={d(300)}>
              dla Ciebie
            </span>
          </h1>
          <p className="home-sub enter" style={d(380)}>
            {c.podtytul}
          </p>
          <div className="home-actions enter" style={d(460)}>
            <Link href="/zamow" className="cta-btn">
              {c.przycisk} <Arrow />
            </Link>
            <Link href="/realizacje" className="ghost-btn">
              Realizacje
            </Link>
          </div>
          {facts.length > 1 && (
            <dl className="home-facts enter" style={d(540)}>
              {facts.map((f) => (
                <div key={f.label}>
                  <dt>{f.label}</dt>
                  <dd>
                    <CountUp to={f.v} decimals={f.dec ?? 0} suffix={f.suffix} />
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <nav className="hub enter" style={d(300)} aria-label="Na skróty">
          <Link href="/strony-internetowe" className="hub-tile hub-web">
            <span className="hub-top">
              <span className="tile-icon">
                <Icon name="laptop" size={24} />
              </span>
              {webFrom !== null && <span className="hub-chip">od {money(webFrom)} zł</span>}
            </span>
            <span className="hub-mini-site" aria-hidden>
              <i className="b1" />
              <i className="b2" />
              <i className="b3" />
              <i className="btn" />
            </span>
            <b>Strony internetowe</b>
            <small>{c.kafelekStrony}</small>
            <Arrow />
          </Link>

          <Link href="/boty-discord" className="hub-tile hub-bot">
            <span className="hub-top">
              <span className="tile-icon">
                <Icon name="bot" size={24} />
              </span>
              {botFrom !== null && <span className="hub-chip">od {money(botFrom)} zł</span>}
            </span>
            <span className="hub-mini-chat" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            <b>Boty Discord</b>
            <small>{c.kafelekBoty}</small>
            <Arrow />
          </Link>

          <Link href="/realizacje" className="hub-tile hub-works">
            {thumbs.length > 0 ? (
              <span className="hub-thumbs" aria-hidden>
                {thumbs.map((p) => (
                  <Image key={p.id} src={`/api/portfolio/${p.images[0]}`} alt="" width={120} height={80} sizes="120px" />
                ))}
              </span>
            ) : (
              <span className="tile-icon">
                <Icon name="package" size={24} />
              </span>
            )}
            <b>Realizacje</b>
            <small>
              {portfolio.length
                ? `${portfolio.length} ${plural(portfolio.length, 'projekt', 'projekty', 'projektów')}`
                : 'Wkrótce'}
            </small>
            <Arrow />
          </Link>

          <Link href="/opinie" className="hub-tile hub-reviews">
            {stats.rating !== null && stats.reviews > 0 ? (
              <>
                <span className="hub-rating">
                  <Stars n={Math.round(stats.rating)} size={14} />
                  <span className="hub-avatars" aria-hidden>
                    {avatars.map((a) => (
                      <img key={a} src={a} alt="" width={26} height={26} loading="lazy" />
                    ))}
                  </span>
                </span>
                <b>{stats.rating.toLocaleString('pl-PL', { maximumFractionDigits: 1 })}/5</b>
                <small>
                  {stats.reviews} {plural(stats.reviews, 'opinia', 'opinie', 'opinii')} klientów
                </small>
              </>
            ) : (
              <>
                <span className="tile-icon">
                  <Icon name="star" size={24} />
                </span>
                <b>Opinie</b>
                <small>Co mówią klienci</small>
              </>
            )}
            <Arrow />
          </Link>

          <Link href="/cennik" className="hub-tile hub-price">
            <span className="tile-icon">
              <Icon name="coins" size={24} />
            </span>
            <b>Cennik</b>
            <small>Pakiety i dodatki – strony i boty</small>
            <Arrow />
          </Link>

          <Link href="/faq" className="hub-tile hub-faq">
            <span className="tile-icon">
              <Icon name="idea" size={24} />
            </span>
            <b>Pytania</b>
            <small>Terminy, płatności, hosting</small>
            <Arrow />
          </Link>

          <Link href="/panel" prefetch={false} className="hub-tile hub-panel">
            <span className="tile-icon">
              <Icon name="desktop" size={24} />
            </span>
            <span className="hub-panel-text">
              <b>Panel klienta</b>
              <small>Postęp zleceń, płatności, ustawienia botów i stan stron – po zalogowaniu przez Discord</small>
            </span>
            <Arrow />
          </Link>
        </nav>
      </div>
    </section>
  );
}
