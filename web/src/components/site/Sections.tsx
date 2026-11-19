import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { Kind, SiteData } from '@/lib/site';
import { Icon } from '../Icon';
import { CountUp, FaqList, LiveSwitches, PanelMock, Spotlight } from './islands';
import { Arrow, Check, Marquee, Reveal, Stars } from './primitives';
import { BotMock, WebMock } from './WebMock';

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

export function PageHero({
  kicker,
  title,
  lead,
  children,
}: {
  kicker: string;
  title: React.ReactNode;
  lead?: string;
  children?: React.ReactNode;
}) {
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

const TECH = [
  'Next.js',
  'React',
  'TypeScript',
  'Node.js',
  'discord.js v14',
  'PostgreSQL',
  'Redis',
  'Docker',
  'Prisma',
  'SEO',
  'Core Web Vitals',
  'REST API',
  'Webhooki',
];

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

export function Stats({ stats }: { stats: SiteData['stats'] }) {
  const uptimeDecimals = stats.uptime !== null && stats.uptime < 99.995 ? (stats.uptime >= 99 ? 2 : 1) : 0;
  const items = [
    stats.ordersCompleted >= 1 && { v: stats.ordersCompleted, label: 'zrealizowanych zleceń' },
    stats.clients >= 1 && { v: stats.clients, label: 'zadowolonych klientów' },
    stats.rating !== null &&
      stats.reviews >= 1 && { v: stats.rating, d: 1, s: '/5', label: `średnia z ${stats.reviews} opinii` },
    stats.uptime !== null &&
      stats.botsMonitored + (stats.sitesMonitored ?? 0) >= 1 && {
        v: stats.uptime,
        d: uptimeDecimals,
        s: '%',
        label: stats.sitesMonitored ? 'dostępności stron i botów' : 'dostępności botów',
      },
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

function UptimeBars() {
  const bars = Array.from({ length: 36 }, (_, i) => (i === 24 ? 0.45 : 0.75 + ((i * 37) % 25) / 100));
  return (
    <div className="tile-visual" aria-hidden>
      <div className="uptime-bars">
        {bars.map((h, i) => (
          <i
            key={i}
            className={h < 0.6 ? 'bad' : undefined}
            style={{ height: `${h * 100}%`, '--i': i } as CSSProperties}
          />
        ))}
      </div>
      <div
        className="small muted"
        style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between' }}
      >
        <span>30 dni temu</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="live-dot" /> teraz
        </span>
      </div>
    </div>
  );
}

export function BotServices() {
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
                <Icon name="bot" size={24} />
              </div>
              <h3>Boty na zamówienie</h3>
              <p>
                Projektujemy bota pod Twoją społeczność – od prostych narzędzi po rozbudowane systemy z bazą
                danych.
              </p>
              <div className="chips2">
                {[
                  'Tickety',
                  'Ekonomia',
                  'Serwery RP',
                  'Moderacja',
                  'Weryfikacja',
                  'Giveaway',
                  'Statystyki',
                  'Logi',
                  'Sklep',
                  'Poziomy',
                ].map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
            </Spotlight>
          </Reveal>
          <Reveal className="cell" delay={0.06}>
            <Spotlight>
              <div className="tile-icon">
                <Icon name="tools" size={24} />
              </div>
              <h3>Panel ustawień</h3>
              <p>Kanały, role, teksty i moduły zmieniasz na stronie. Bez restartu.</p>
              <LiveSwitches />
            </Spotlight>
          </Reveal>
          <Reveal className="cell wide">
            <Spotlight>
              <div className="tile-icon">
                <Icon name="server" size={24} />
              </div>
              <h3>Monitoring 24/7</h3>
              <p>
                Sprawdzamy bota co minutę. Przy awarii dostajemy alert i reagujemy, zanim zauważą to
                użytkownicy.
              </p>
              <UptimeBars />
            </Spotlight>
          </Reveal>
          <Reveal className="cell wide" delay={0.06}>
            <Spotlight>
              <div className="tile-icon">
                <Icon name="code" size={24} />
              </div>
              <h3>Czysty, nowoczesny kod</h3>
              <p>TypeScript, discord.js v14 i najnowsze komponenty Discorda. Kod, który da się rozwijać.</p>
              <div className="code-mini tile-visual">
                <span className="k">const</span> zx = <span className="f">zxcode</span>(client, {'{'}
                {'\n'} modules: {'{'} <span className="s">powitania</span>,{' '}
                <span className="s">ekonomia</span> {'}'},{'\n'}
                {'}'});{'\n'}
                <span className="c">{'// ustawienia z panelu – na żywo'}</span>
                {'\n'}zx.<span className="f">get</span>(guild.id,{' '}
                <span className="s">&apos;ekonomia.waluta&apos;</span>);
              </div>
            </Spotlight>
          </Reveal>
          {[
            [
              'cloud_upload',
              'Hosting i wdrożenie',
              'Uruchamiamy bota na stabilnym serwerze i dbamy o aktualizacje.',
            ],
            [
              'git_branch',
              'Integracje',
              'API, webhooki, płatności, GitHub – bot połączy się z tym, czego używasz.',
            ],
            [
              'support',
              'Opieka i rozwój',
              'Poprawki, nowe funkcje i changelog. Jesteśmy dostępni na Discordzie.',
            ],
          ].map(([icon, title, text], i) => (
            <Reveal key={title} className="cell" delay={i * 0.06}>
              <Spotlight>
                <div className="tile-icon">
                  <Icon name={icon!} size={24} />
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

type Step = { title: string; text: string };

export const STEPS: Step[] = [
  {
    title: 'Zapytanie',
    text: 'Wypełniasz krótki formularz wyceny albo otwierasz ticket na Discordzie. Dopytamy o szczegóły.',
  },
  { title: 'Wycena i termin', text: 'Dostajesz konkretną cenę, zakres i termin. Zaczynamy po akceptacji.' },
  {
    title: 'Projekt i realizacja',
    text: 'Najpierw projekt, potem kod. Postęp widzisz na żywo w panelu klienta i testujesz przed odbiorem.',
  },
  {
    title: 'Start i opieka',
    text: 'Uruchamiamy projekt, monitorujemy go 24/7 i pomagamy w dalszym rozwoju.',
  },
];

export const WEB_STEPS: Step[] = [
  { title: 'Brief i wycena', text: 'Poznajemy Twoją firmę, cele i konkurencję. Dostajesz zakres, cenę i termin.' },
  {
    title: 'Projekt graficzny',
    text: 'Projektujemy wygląd strony na komputery i telefony. Wprowadzamy poprawki, aż będzie idealnie.',
  },
  {
    title: 'Kodowanie i testy',
    text: 'Zamieniamy projekt w szybką stronę, dodajemy treści i testujemy na różnych urządzeniach.',
  },
  {
    title: 'Start i opieka',
    text: 'Podpinamy domenę, SSL i analitykę. Pilnujemy, żeby strona działała i była aktualna.',
  },
];

export const BOT_STEPS: Step[] = [
  { title: 'Ticket na Discordzie', text: 'Opisujesz, czego potrzebujesz. Dopytamy o szczegóły i zaproponujemy rozwiązanie.' },
  { title: 'Wycena i termin', text: 'Dostajesz konkretną cenę, zakres i termin. Zaczynamy po akceptacji.' },
  { title: 'Realizacja', text: 'Postęp widzisz w panelu zlecenia. Testujesz bota na swoim serwerze przed odbiorem.' },
  { title: 'Wdrożenie i opieka', text: 'Uruchamiamy bota, dajemy dostęp do panelu i pilnujemy, żeby działał.' },
];

export function Process({ steps = STEPS, title }: { steps?: Step[]; title?: React.ReactNode }) {
  return (
    <section id="proces" className="section cv">
      <div className="wrap">
        <SectionHead
          kicker="Jak pracujemy"
          title={
            title ?? (
              <>
                Od pomysłu do gotowego projektu <span className="grad">w 4 krokach</span>
              </>
            )
          }
        />
        <div className="steps">
          <div className="steps-line" aria-hidden>
            <span />
          </div>
          {steps.map((s, i) => (
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

export function PortfolioGrid({ items, compact }: { items: SiteData['portfolio']; compact?: boolean }) {
  return (
    <div className="works">
      {items.map((p, i) => (
        <Reveal key={p.id} delay={(i % 3) * 0.06}>
          <article className={`work${compact ? ' compact' : ''}${p.kind === 'WEBSITE' ? ' work-web' : ''}`}>
            {p.kind === 'WEBSITE' && (
              <div className="work-chrome" aria-hidden>
                <i />
                <i />
                <i />
                {p.url && <span>{p.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>}
              </div>
            )}
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
                  <img src={`/emojis/${p.kind === 'WEBSITE' ? 'laptop' : 'bot'}.png`} alt="" width={72} height={72} />
                </div>
              )}
              {p.url && (
                <a className="work-link" href={p.url} target="_blank" rel="noreferrer noopener">
                  {p.kind === 'WEBSITE' ? 'Odwiedź stronę' : 'Zobacz'} <Arrow />
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
              <span className={`work-kind ${p.kind === 'WEBSITE' ? 'web' : 'bot'}`}>
                {p.kind === 'WEBSITE' ? 'Strona internetowa' : 'Bot Discord'}
              </span>
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

export function PortfolioPreview({
  items,
  title,
  lead = 'Wybrane strony i boty, które zrobiliśmy dla naszych klientów.',
  href = '/realizacje',
}: {
  items: SiteData['portfolio'];
  title?: React.ReactNode;
  lead?: string;
  href?: string;
}) {
  if (!items.length) return null;
  return (
    <section className="section cv">
      <div className="wrap">
        <SectionHead
          kicker="Realizacje"
          title={
            title ?? (
              <>
                Projekty, które <span className="grad">już działają</span>
              </>
            )
          }
          lead={lead}
        />
        <PortfolioGrid items={items.slice(0, 3)} compact />
        {items.length > 3 && (
          <div className="more">
            <Link href={href} className="ghost-btn">
              Wszystkie realizacje ({items.length}) <Arrow />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

export function PricingCards({ packages, orderHref = '/zamow' }: { packages: SiteData['packages']; orderHref?: string }) {
  if (!packages.length) {
    return (
      <Reveal>
        <div className="more">
          <a href={orderHref} className="cta-btn">
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
            <a
              href={orderHref.startsWith('/zamow/strona') ? `${orderHref}?pakiet=${encodeURIComponent(p.name)}` : orderHref}
              className={i === featured ? 'cta-btn' : 'ghost-btn'}
            >
              Zamów <Arrow />
            </a>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

export function Addons({
  addons,
  title = 'Dodatki i moduły',
  lead = 'Do każdego pakietu możesz dobrać dodatkowe funkcje.',
}: {
  addons: SiteData['addons'];
  title?: string;
  lead?: string;
}) {
  if (!addons.length) return null;
  return (
    <Reveal>
      <div className="panel-box">
        <h3>{title}</h3>
        <p className="muted small">{lead}</p>
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

export function ReviewCard({ r }: { r: SiteData['reviews'][number] }) {
  return (
    <figure className="review">
      <Stars n={r.rating} />
      <blockquote style={{ margin: 0 }}>
        <p>{r.content}</p>
      </blockquote>
      <figcaption className="review-author">
        <img
          src={r.avatar && DISCORD_CDN.test(r.avatar) ? r.avatar : '/emojis/user.png'}
          alt=""
          loading="lazy"
          width={36}
          height={36}
        />
        <span>
          {r.author}
          <small>
            {new Date(r.createdAt).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}
          </small>
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
                  <Icon name={icon!} size={24} />
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

export interface FaqEntry {
  id: number | string;
  question: string;
  answer: string;
}

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
                  Masz pomysł? <span className="grad">Zróbmy go razem.</span>
                </>
              )}
            </h2>
            <p className="lead" style={{ margin: '0 auto' }}>
              {lead ?? 'Opisz, czego potrzebujesz – przygotujemy bezpłatną wycenę.'}
            </p>
            <div className="final-actions">
              <a href="/zamow" className="cta-btn">
                Bezpłatna wycena <Arrow />
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

const minPrice = (packages: SiteData['packages'], kind: Kind) => {
  const list = packages.filter((p) => p.kind === kind).map((p) => p.price);
  return list.length ? Math.min(...list) : null;
};

export function ServicesSplit({ packages }: { packages: SiteData['packages'] }) {
  const cards = [
    {
      kind: 'WEBSITE' as const,
      href: '/strony-internetowe',
      icon: 'laptop',
      title: 'Strony internetowe',
      text: 'Wizytówki, strony firmowe, sklepy i aplikacje WWW. Szybkie, piękne na każdym ekranie i gotowe na Google.',
      points: ['Projekt graficzny na miarę', 'Wersja na telefony', 'SEO i PageSpeed 90+', 'Domena, SSL i hosting'],
      visual: <WebMock compact url="twojafirma.pl" />,
    },
    {
      kind: 'BOT' as const,
      href: '/boty-discord',
      icon: 'bot',
      title: 'Boty Discord',
      text: 'Tickety, ekonomia, RP, moderacja i integracje. Ustawienia zmieniasz sam w panelu na stronie.',
      points: ['Bot szyty na miarę', 'Panel ustawień online', 'Monitoring 24/7', 'Opieka i rozwój'],
      visual: <BotMock />,
    },
  ];
  return (
    <section id="uslugi" className="section cv">
      <div className="wrap">
        <SectionHead
          kicker="Co robimy"
          title={
            <>
              Dwie usługi, <span className="grad">jedna jakość</span>
            </>
          }
          lead="Od pomysłu, przez projekt i kod, po wdrożenie i opiekę. Wybierz, czego potrzebujesz – albo połącz jedno z drugim."
        />
        <div className="split">
          {cards.map((c, i) => {
            const from = minPrice(packages, c.kind);
            return (
              <Reveal key={c.kind} delay={i * 0.08}>
                <Spotlight className={`split-card ${c.kind === 'WEBSITE' ? 'web' : 'bot'}`}>
                  <div className="split-top">
                    <div className="tile-icon">
                      <Icon name={c.icon} size={24} />
                    </div>
                    {from !== null && (
                      <span className="split-from">
                        od <b>{money(from)} zł</b>
                      </span>
                    )}
                  </div>
                  <h3>{c.title}</h3>
                  <p>{c.text}</p>
                  <ul className="split-points">
                    {c.points.map((pt) => (
                      <li key={pt}>
                        <Check /> {pt}
                      </li>
                    ))}
                  </ul>
                  <div className="split-visual">{c.visual}</div>
                  <Link href={c.href} className="split-link">
                    Poznaj ofertę <Arrow />
                  </Link>
                </Spotlight>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function WhyUs() {
  const items = [
    ['lightning', 'Szybkość', 'Strony ładują się w ułamku sekundy, a boty odpowiadają od razu. Optymalizujemy każdy szczegół.'],
    ['mobile', 'Na każdym ekranie', 'Projektujemy najpierw na telefony, potem na komputery. Wszystko wygląda i działa świetnie.'],
    ['star', 'Dopracowany design', 'Nowoczesny wygląd, płynne animacje i spójna identyfikacja – bez szablonów z marketu.'],
    ['shield_check', 'Bezpieczeństwo', 'HTTPS, aktualne biblioteki, testy bezpieczeństwa i kopie zapasowe w standardzie.'],
    ['server', 'Monitoring 24/7', 'Sprawdzamy strony i boty co minutę, pilnujemy certyfikatów SSL i reagujemy przy awarii.'],
    ['support', 'Opieka po wdrożeniu', 'Nie znikamy po oddaniu projektu. Poprawki, nowe funkcje i doradztwo – jesteśmy w kontakcie.'],
  ];
  return (
    <section className="section cv">
      <div className="wrap">
        <SectionHead
          center
          kicker="Dlaczego zxCode"
          title={
            <>
              Robimy to <span className="grad">porządnie</span>
            </>
          }
        />
        <div className="why">
          {items.map(([icon, title, text], i) => (
            <Reveal key={title} delay={(i % 3) * 0.06}>
              <Spotlight className="why-card">
                <div className="tile-icon">
                  <Icon name={icon!} size={24} />
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

export function SiteTypes() {
  const types = [
    ['idea', 'Wizytówka i landing page', 'Jedna, dopracowana strona, która przedstawia Twoją firmę lub produkt i zbiera zapytania.'],
    ['partnership', 'Strona firmowa', 'Kilka podstron, oferta, realizacje, blog i kontakt. Treści zmieniasz sam w panelu.'],
    ['store', 'Sklep internetowy', 'Produkty, koszyk, płatności online i panel zamówień – gotowe do sprzedaży od pierwszego dnia.'],
    ['code', 'Aplikacje i panele WWW', 'Panele klienta, systemy rezerwacji, dashboardy i integracje – także z Discordem.'],
  ];
  return (
    <section className="section cv">
      <div className="wrap">
        <SectionHead
          kicker="Co budujemy"
          title={
            <>
              Strona dopasowana <span className="grad">do Twojego celu</span>
            </>
          }
          lead="Niezależnie od tego, czy potrzebujesz prostej wizytówki, czy rozbudowanej aplikacji – zaprojektujemy i zbudujemy ją od zera."
        />
        <div className="types">
          {types.map(([icon, title, text], i) => (
            <Reveal key={title} delay={i * 0.06}>
              <Spotlight className="type-card">
                <span className="type-num">0{i + 1}</span>
                <div className="tile-icon">
                  <Icon name={icon!} size={24} />
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

export function WebIncluded() {
  const items = [
    ['mobile', 'Responsywność', 'idealny wygląd na telefonach, tabletach i komputerach'],
    ['lightning', 'Szybkość', 'wynik 90+ w Google PageSpeed i lekki kod'],
    ['documentation', 'SEO od podstaw', 'meta, mapa strony, dane strukturalne, podgląd w social media'],
    ['lock', 'HTTPS i bezpieczeństwo', 'certyfikat SSL, aktualne biblioteki, ochrona formularzy'],
    ['checklist', 'RODO i cookies', 'polityka prywatności i informacja o plikach cookies'],
    ['coins', 'Analityka', 'statystyki odwiedzin, żeby wiedzieć, co działa'],
    ['tools', 'Panel do edycji', 'treści, zdjęcia i wpisy zmieniasz bez programisty (opcjonalnie)'],
    ['server', 'Monitoring i opieka', 'pilnujemy, żeby strona działała, a certyfikat był ważny'],
  ];
  return (
    <section className="section cv">
      <div className="wrap">
        <SectionHead
          kicker="W standardzie"
          title={
            <>
              Wszystko, czego potrzebuje <span className="grad">nowoczesna strona</span>
            </>
          }
        />
        <Reveal>
          <div className="included">
            {items.map(([icon, b, t]) => (
              <div key={b} className="included-item">
                <Icon name={icon!} size={24} />
                <span>
                  <b>{b}</b>
                  {t}
                </span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function ClientPanelShowcase() {
  return (
    <section id="panel" className="section cv" style={{ scrollMarginTop: 60 }}>
      <div className="wrap showcase">
        <div>
          <SectionHead
            kicker="Panel klienta"
            title={
              <>
                Wszystko <span className="grad">w jednym miejscu</span>
              </>
            }
            lead="Logujesz się przez Discord i widzisz swoje projekty: postęp zleceń, płatności, ustawienia botów i stan stron."
          />
          <Reveal delay={0.08}>
            <ul className="bullets">
              {[
                ['package', 'Postęp na żywo', 'etapy, zadania i terminy Twojego zlecenia'],
                ['invoice', 'Płatności i dokumenty', 'proformy i dane do przelewu zawsze pod ręką'],
                ['tools', 'Ustawienia botów', 'kanały, role, teksty i moduły – bez czekania na nas'],
                ['laptop', 'Stan Twoich stron', 'dostępność, czas odpowiedzi i ważność certyfikatu SSL'],
              ].map(([icon, b, t]) => (
                <li key={b}>
                  <Icon name={icon!} size={24} />
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
