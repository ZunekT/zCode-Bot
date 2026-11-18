import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { SiteData } from '@/lib/site';
import { Icon } from '../Icon';
import { CountUp, FaqList, LiveSwitches, PanelMock, Spotlight } from './islands';
import { Arrow, Check, Marquee, Reveal, Stars } from './primitives';

export { FaqList };

const money = (v: number) =>
  v.toLocaleString('pl-PL', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
const DISCORD_CDN = /^https:\/\/cdn\.discordapp\.com\//;

export function SectionHead({
  kicker,
  title,
  lead,
  center,
}: {
  kicker: string;
  title: React.ReactNode;
  lead?: string;
  center?: boolean;
}) {
  return (
    <Reveal className={center ? 'center' : undefined}>
      <span className="kicker">{kicker}</span>
      <h2 className="h2">{title}</h2>
      {lead && <p className="lead">{lead}</p>}
    </Reveal>
  );
}

export function PageHero({ kicker, title, lead, children }: { kicker: string; title: React.ReactNode; lead?: string; children?: React.ReactNode }) {
  return (
    <section className="page-hero">
      <div className="bg" aria-hidden style={{ height: 700 }}>
        <div className="bg-glow" />
        <div className="grid-bg" />
      </div>
      <div className="wrap">
        <div className="enter">
          <span className="kicker center">{kicker}</span>
          <h1>{title}</h1>
          {lead && <p className="lead">{lead}</p>}
          {children}
        </div>
      </div>
    </section>
  );
}

// ───────────────────────────── Technologie ─────────────────────────────

const TECH = ['discord.js v14', 'TypeScript', 'Node.js', 'PostgreSQL', 'Redis', 'Docker', 'Prisma', 'Components v2', 'REST API', 'Webhooki', 'GitHub'];

export function TechStrip() {
  return (
    <div className="tech-strip" aria-label="Technologie">
      <Marquee speed={45}>
        {TECH.map((t) => (
          <span key={t} className="tech">
            <i /> {t}
          </span>
        ))}
      </Marquee>
    </div>
  );
}

// ───────────────────────────── Statystyki ─────────────────────────────

export function Stats({ stats }: { stats: SiteData['stats'] }) {
  const uptimeDecimals = stats.uptime !== null && stats.uptime < 99.995 ? (stats.uptime >= 99 ? 2 : 1) : 0;
  const items = [
    stats.ordersCompleted >= 1 && { v: stats.ordersCompleted, label: 'zrealizowanych zleceń' },
    stats.clients >= 1 && { v: stats.clients, label: 'zadowolonych klientów' },
    stats.rating !== null && stats.reviews >= 1 && { v: stats.rating, d: 1, s: '/5', label: `średnia z ${stats.reviews} opinii` },
    stats.uptime !== null && stats.botsMonitored >= 1 && { v: stats.uptime, d: uptimeDecimals, s: '%', label: 'dostępności botów' },
    stats.members !== null && stats.members >= 10 && { v: stats.members, label: 'osób na serwerze zxCode' },
  ].filter(Boolean) as { v: number; d?: number; s?: string; label: string }[];
  if (items.length < 2) return null;
  const shown = items.slice(0, 4);
  return (
    <div className="wrap" style={{ paddingTop: 24 }}>
      <Reveal>
        <div className="stats2" style={{ '--n': shown.length } as React.CSSProperties}>
          {shown.map((i) => (
            <div key={i.label} className="stat2">
              <div className="stat2-value">
                <CountUp to={i.v} decimals={i.d ?? 0} suffix={i.s} />
              </div>
              <div className="stat2-label">{i.label}</div>
            </div>
          ))}
        </div>
      </Reveal>
    </div>
  );
}

// ───────────────────────────── Usługi (bento) ─────────────────────────────

function UptimeBars() {
  const bars = Array.from({ length: 36 }, (_, i) => (i === 24 ? 0.45 : 0.75 + ((i * 37) % 25) / 100));
  return (
    <div className="tile-visual" aria-hidden>
      <div className="uptime-bars">
        {bars.map((h, i) => (
          <i key={i} className={h < 0.6 ? 'bad' : undefined} style={{ height: `${h * 100}%`, '--i': i } as CSSProperties} />
        ))}
      </div>
      <div className="small muted" style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between' }}>
        <span>30 dni temu</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="live-dot" /> teraz
        </span>
      </div>
    </div>
  );
}

export function Services() {
  return (
    <section id="uslugi" className="section cv">
      <div className="wrap">
        <SectionHead
          kicker="Co robimy"
          title={
            <>
              Wszystko, czego potrzebuje <span className="grad">Twój serwer</span>
            </>
          }
          lead="Od pomysłu, przez kod, po wdrożenie i opiekę. Dostajesz gotowego bota, panel do jego ustawień i pewność, że ktoś pilnuje, żeby działał."
        />
        <div className="bento">
          <Reveal className="cell xl">
            <Spotlight>
              <div className="tile-icon">
                <Icon name="bot" size={26} />
              </div>
              <h3>Boty na zamówienie</h3>
              <p>Projektujemy bota pod Twoją społeczność – od prostych narzędzi po rozbudowane systemy z bazą danych.</p>
              <div className="chips2">
                {['Tickety', 'Ekonomia', 'Serwery RP', 'Moderacja', 'Weryfikacja', 'Giveaway', 'Statystyki', 'Logi', 'Sklep', 'Poziomy'].map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
            </Spotlight>
          </Reveal>
          <Reveal className="cell" delay={0.06}>
            <Spotlight>
              <div className="tile-icon">
                <Icon name="tools" size={26} />
              </div>
              <h3>Panel ustawień</h3>
              <p>Kanały, role, teksty i moduły zmieniasz na stronie. Bez restartu.</p>
              <LiveSwitches />
            </Spotlight>
          </Reveal>
          <Reveal className="cell wide">
            <Spotlight>
              <div className="tile-icon">
                <Icon name="server" size={26} />
              </div>
              <h3>Monitoring 24/7</h3>
              <p>Sprawdzamy bota co minutę. Przy awarii dostajemy alert i reagujemy, zanim zauważą to użytkownicy.</p>
              <UptimeBars />
            </Spotlight>
          </Reveal>
          <Reveal className="cell wide" delay={0.06}>
            <Spotlight>
              <div className="tile-icon">
                <Icon name="code" size={26} />
              </div>
              <h3>Czysty, nowoczesny kod</h3>
              <p>TypeScript, discord.js v14 i najnowsze komponenty Discorda. Kod, który da się rozwijać.</p>
              <div className="code-mini tile-visual">
                <span className="k">const</span> zx = <span className="f">zxcode</span>(client, {'{'}
                {'\n'}  modules: {'{'} <span className="s">powitania</span>, <span className="s">ekonomia</span> {'}'},{'\n'}
                {'}'});{'\n'}
                <span className="c">{'// ustawienia z panelu – na żywo'}</span>
                {'\n'}zx.<span className="f">get</span>(guild.id, <span className="s">&apos;ekonomia.waluta&apos;</span>);
              </div>
            </Spotlight>
          </Reveal>
          {[
            ['cloud_upload', 'Hosting i wdrożenie', 'Uruchamiamy bota na stabilnym serwerze i dbamy o aktualizacje.'],
            ['git_branch', 'Integracje', 'API, webhooki, płatności, GitHub – bot połączy się z tym, czego używasz.'],
            ['support', 'Opieka i rozwój', 'Poprawki, nowe funkcje i changelog. Jesteśmy dostępni na Discordzie.'],
          ].map(([icon, title, text], i) => (
            <Reveal key={title} className="cell" delay={i * 0.06}>
              <Spotlight>
                <div className="tile-icon">
                  <Icon name={icon!} size={26} />
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </Spotlight>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ───────────────────────────── Proces ─────────────────────────────

const STEPS = [
  { title: 'Ticket na Discordzie', text: 'Opisujesz, czego potrzebujesz. Dopytamy o szczegóły i zaproponujemy rozwiązanie.' },
  { title: 'Wycena i termin', text: 'Dostajesz konkretną cenę, zakres i termin. Zaczynamy po akceptacji.' },
  { title: 'Realizacja', text: 'Postęp widzisz w panelu zlecenia. Testujesz bota na swoim serwerze przed odbiorem.' },
  { title: 'Wdrożenie i opieka', text: 'Uruchamiamy bota, dajemy dostęp do panelu i pilnujemy, żeby działał.' },
];

export function Process() {
  return (
    <section id="proces" className="section cv">
      <div className="wrap">
        <SectionHead
          kicker="Jak pracujemy"
          title={
            <>
              Od pomysłu do działającego bota <span className="grad">w 4 krokach</span>
            </>
          }
        />
        <div className="steps">
          <div className="steps-line" aria-hidden>
            <span />
          </div>
          {STEPS.map((s, i) => (
            <Reveal key={s.title} className="step" delay={i * 0.08}>
              <div className="step-num">0{i + 1}</div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ───────────────────────────── Realizacje ─────────────────────────────

export function PortfolioGrid({ items, compact }: { items: SiteData['portfolio']; compact?: boolean }) {
  return (
    <div className="works">
      {items.map((p, i) => (
        <Reveal key={p.id} delay={(i % 3) * 0.06}>
          <article className={`work${compact ? ' compact' : ''}`}>
            <div className="work-media">
              {p.images[0] ? (
                <Image
                  className="cover"
                  src={`/api/portfolio/${p.images[0]}`}
                  alt={p.title}
                  fill
                  sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 380px"
                />
              ) : (
                <div className="ph">
                  <img src="/emojis/bot.png" alt="" width={72} height={72} />
                </div>
              )}
              {p.url && (
                <a className="work-link" href={p.url} target="_blank" rel="noreferrer">
                  Zobacz ↗
                </a>
              )}
            </div>
            {!compact && p.images.length > 1 && (
              <div className="work-gallery" style={{ marginTop: 14 }}>
                {p.images.slice(1, 6).map((id) => (
                  <a key={id} href={`/api/portfolio/${id}`} target="_blank" rel="noreferrer">
                    <Image src={`/api/portfolio/${id}`} alt="" width={56} height={36} sizes="56px" />
                  </a>
                ))}
              </div>
            )}
            <div className="work-body">
              <h3>{p.title}</h3>
              <p>{p.description}</p>
              {p.technologies.length > 0 && (
                <div className="tags">
                  {p.technologies.slice(0, 6).map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
              )}
            </div>
          </article>
        </Reveal>
      ))}
    </div>
  );
}

export function PortfolioPreview({ items }: { items: SiteData['portfolio'] }) {
  if (!items.length) return null;
  return (
    <section className="section cv">
      <div className="wrap">
        <SectionHead
          kicker="Realizacje"
          title={
            <>
              Boty, które <span className="grad">już działają</span>
            </>
          }
          lead="Wybrane projekty dla serwerów naszych klientów."
        />
        <PortfolioGrid items={items.slice(0, 3)} compact />
        {items.length > 3 && (
          <div className="more">
            <Link href="/realizacje" className="ghost-btn">
              Wszystkie realizacje ({items.length}) <Arrow />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

// ───────────────────────────── Cennik ─────────────────────────────

export function PricingCards({ packages }: { packages: SiteData['packages'] }) {
  if (!packages.length) {
    return (
      <Reveal>
        <div className="more">
          <a href="/zamow" className="cta-btn">
            Poproś o bezpłatną wycenę <Arrow />
          </a>
        </div>
      </Reveal>
    );
  }
  const list = packages.slice(0, 3);
  const featured = list.length === 3 ? 1 : -1;
  return (
    <div className="prices" style={{ '--n': list.length } as React.CSSProperties}>
      {list.map((p, i) => (
        <Reveal key={p.id} delay={i * 0.06}>
          <div className={`price${i === featured ? ' featured' : ''}`}>
            {i === featured && <span className="price-tag">Najczęściej wybierany</span>}
            <h3>{p.name}</h3>
            <p className="price-desc">{p.description}</p>
            <div className="price-amount">
              <span className="from">od</span>
              {money(p.price)}
              <small>zł</small>
            </div>
            <ul>
              {p.features.map((f) => (
                <li key={f}>
                  <Check />
                  {f}
                </li>
              ))}
            </ul>
            <a href="/zamow" className={i === featured ? 'cta-btn' : 'ghost-btn'}>
              Zamów <Arrow />
            </a>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

export function Addons({ addons }: { addons: SiteData['addons'] }) {
  if (!addons.length) return null;
  return (
    <Reveal>
      <div className="panel-box">
        <h3>Dodatki i moduły</h3>
        <p className="muted small">Do każdego pakietu możesz dobrać dodatkowe funkcje.</p>
        <div className="addons-grid">
          {addons.map((a) => (
            <div key={a.id} className="addon">
              <span>
                {a.label}
                {a.description && <small>{a.description}</small>}
              </span>
              <b>{money(a.price)} zł</b>
            </div>
          ))}
        </div>
      </div>
    </Reveal>
  );
}

// ───────────────────────────── Opinie ─────────────────────────────

export function ReviewCard({ r }: { r: SiteData['reviews'][number] }) {
  return (
    <figure className="review">
      <Stars n={r.rating} />
      <blockquote style={{ margin: 0 }}>
        <p>{r.content}</p>
      </blockquote>
      <figcaption className="review-author">
        <img src={r.avatar && DISCORD_CDN.test(r.avatar) ? r.avatar : '/emojis/user.png'} alt="" loading="lazy" width={36} height={36} />
        <span>
          {r.author}
          <small>{new Date(r.createdAt).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}</small>
        </span>
      </figcaption>
    </figure>
  );
}

export function ReviewsPreview({ reviews }: { reviews: SiteData['reviews'] }) {
  if (!reviews.length) return null;
  const marquee = reviews.length >= 6;
  const half = Math.ceil(reviews.length / 2);
  return (
    <section className="section cv">
      <div className="wrap">
        <SectionHead
          center
          kicker="Opinie"
          title={
            <>
              Co mówią <span className="grad">nasi klienci</span>
            </>
          }
        />
      </div>
      {marquee ? (
        <div className="reviews-rows">
          <Marquee speed={70} gap={18}>
            {reviews.slice(0, half).map((r) => (
              <ReviewCard key={r.id} r={r} />
            ))}
          </Marquee>
          <Marquee speed={80} gap={18} reverse>
            {reviews.slice(half).map((r) => (
              <ReviewCard key={r.id} r={r} />
            ))}
          </Marquee>
        </div>
      ) : (
        <div className="wrap">
          <ReviewsGrid reviews={reviews} />
        </div>
      )}
      <div className="more">
        <Link href="/opinie" className="ghost-btn">
          Wszystkie opinie <Arrow />
        </Link>
      </div>
    </section>
  );
}

export function ReviewsGrid({ reviews }: { reviews: SiteData['reviews'] }) {
  return (
    <div className="reviews-grid">
      {reviews.map((r, i) => (
        <Reveal key={r.id} delay={(i % 3) * 0.05}>
          <ReviewCard r={r} />
        </Reveal>
      ))}
    </div>
  );
}

// ───────────────────────────── Pokaz panelu ─────────────────────────────

export function PanelShowcase() {
  return (
    <section id="panel" className="section cv" style={{ scrollMarginTop: 60 }}>
      <div className="wrap showcase">
        <div>
          <SectionHead
            kicker="Panel klienta"
            title={
              <>
                Ustawiasz bota <span className="grad">jednym kliknięciem</span>
              </>
            }
            lead="Logujesz się przez Discord i widzisz swoje boty. Każda zmiana trafia do bota od razu – bez czekania na nas."
          />
          <Reveal delay={0.08}>
            <ul className="bullets">
              {[
                ['tools', 'Wszystkie ustawienia', 'kanały, role, teksty, kolory i moduły – z walidacją'],
                ['shield_check', 'Uprawnienia komend', 'które role mogą używać poszczególnych komend'],
                ['user', 'Profil bota', 'status, aktywność, nazwa i avatar'],
                ['lightning', 'Monitoring', 'czy bot działa, uptime i historia awarii'],
              ].map(([icon, b, t]) => (
                <li key={b}>
                  <Icon name={icon!} size={22} />
                  <span>
                    <b>{b}</b> – {t}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <Reveal delay={0.08}>
          <PanelMock />
        </Reveal>
      </div>
    </section>
  );
}

// ───────────────────────────── FAQ ─────────────────────────────

export interface FaqEntry {
  id: number | string;
  question: string;
  answer: string;
}

// ───────────────────────────── CTA ─────────────────────────────

export function FinalCta({ title, lead }: { title?: React.ReactNode; lead?: string }) {
  return (
    <section className="section cv" style={{ paddingTop: 32 }}>
      <div className="wrap">
        <Reveal>
          <div className="final">
            <img src="/emojis/logo_round.png" alt="" className="final-logo" width={64} height={64} />
            <h2>
              {title ?? (
                <>
                  Masz pomysł na bota? <span className="grad">Zróbmy go razem.</span>
                </>
              )}
            </h2>
            <p className="lead" style={{ margin: '0 auto' }}>
              {lead ?? 'Opisz pomysł w tickecie na Discordzie – przygotujemy bezpłatną wycenę.'}
            </p>
            <div className="final-actions">
              <a href="/zamow" className="cta-btn">
                <Icon name="discord" size={20} /> Otwórz ticket na Discordzie <Arrow />
              </a>
              <Link href="/cennik" className="ghost-btn">
                Zobacz cennik
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
