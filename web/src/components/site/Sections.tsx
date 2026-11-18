'use client';

import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { SiteData } from '@/lib/site';
import { Icon } from '../Icon';
import { Arrow, Check, CountUp, Marquee, Reveal, Spotlight, Stars } from './primitives';

const ext = (url: string) => (url.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {});
const money = (v: number) =>
  v.toLocaleString('pl-PL', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });

function SectionHead({ kicker, title, lead, center }: { kicker: string; title: React.ReactNode; lead?: string; center?: boolean }) {
  return (
    <Reveal className={center ? 'center' : undefined}>
      <span className="kicker">{kicker}</span>
      <h2 className="h2">{title}</h2>
      {lead && <p className="lead">{lead}</p>}
    </Reveal>
  );
}

// ───────────────────────────── Technologie ─────────────────────────────

const TECH = ['discord.js v14', 'TypeScript', 'Node.js', 'PostgreSQL', 'Redis', 'Docker', 'Prisma', 'Components v2', 'REST API', 'Webhooki', 'GitHub'];

export function TechStrip() {
  return (
    <div className="section-tight" style={{ paddingTop: 0 }}>
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
  const items = [
    stats.ordersCompleted >= 1 && { v: stats.ordersCompleted, label: 'zrealizowanych zleceń' },
    stats.clients >= 1 && { v: stats.clients, label: 'zadowolonych klientów' },
    stats.rating !== null && stats.reviews >= 1 && { v: stats.rating, d: 1, s: '/5', label: `średnia z ${stats.reviews} opinii` },
    stats.uptime !== null && stats.botsMonitored >= 1 && { v: stats.uptime, d: 2, s: '%', label: 'dostępności botów w monitoringu' },
    stats.members !== null && stats.members >= 10 && { v: stats.members, label: 'osób na serwerze zxCode' },
  ].filter(Boolean) as { v: number; d?: number; s?: string; label: string }[];
  if (items.length < 2) return null;
  const shown = items.slice(0, 4);
  return (
    <div className="wrap section-tight">
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

function LiveSwitches() {
  const reduce = useReducedMotion();
  const [on, setOn] = useState([true, false, true]);
  useEffect(() => {
    if (reduce) return;
    let i = 0;
    const t = setInterval(() => {
      setOn((s) => s.map((v, j) => (j === i % 3 ? !v : v)));
      i++;
    }, 1400);
    return () => clearInterval(t);
  }, [reduce]);
  return (
    <div className="mini-switches tile-visual">
      {['Powitania', 'Ekonomia', 'Logi serwera'].map((l, i) => (
        <div key={l} className="mini-row">
          {l}
          <span className={`mini-switch${on[i] ? ' on' : ''}`} />
        </div>
      ))}
    </div>
  );
}

function UptimeBars() {
  const bars = Array.from({ length: 40 }, (_, i) => (i === 27 ? 0.45 : 0.75 + ((i * 37) % 25) / 100));
  return (
    <div className="tile-visual">
      <div className="uptime-bars" aria-hidden>
        {bars.map((h, i) => (
          <motion.i
            key={i}
            className={h < 0.6 ? 'bad' : undefined}
            initial={{ scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.015, duration: 0.5, ease: [0.21, 0.8, 0.3, 1] }}
            style={{ height: `${h * 100}%`, transformOrigin: 'bottom' }}
          />
        ))}
      </div>
      <div className="small muted" style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between' }}>
        <span>30 dni temu</span>
        <span>
          <span className="live-dot" style={{ display: 'inline-block', marginRight: 6 }} />
          teraz
        </span>
      </div>
    </div>
  );
}

export function Services() {
  return (
    <section id="uslugi" className="section">
      <div className="wrap">
        <SectionHead
          kicker="Co robimy"
          title={
            <>
              Wszystko, czego potrzebuje <span className="grad">Twój serwer</span>
            </>
          }
          lead="Od pomysłu, przez kod, po wdrożenie i opiekę. Dostajesz gotowego bota, panel do jego ustawień i spokój, że ktoś pilnuje, żeby działał."
        />
        <div className="bento">
          <Reveal className="cell xl" delay={0}>
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
          <Reveal className="cell" delay={0.08}>
            <Spotlight>
              <div className="tile-icon">
                <Icon name="tools" size={26} />
              </div>
              <h3>Panel ustawień</h3>
              <p>Kanały, role, teksty i moduły zmieniasz na stronie. Bez restartu.</p>
              <LiveSwitches />
            </Spotlight>
          </Reveal>
          <Reveal className="cell wide" delay={0.04}>
            <Spotlight>
              <div className="tile-icon">
                <Icon name="server" size={26} />
              </div>
              <h3>Monitoring 24/7</h3>
              <p>Sprawdzamy bota co minutę. Przy awarii dostajemy alert i reagujemy, zanim zauważą to użytkownicy.</p>
              <UptimeBars />
            </Spotlight>
          </Reveal>
          <Reveal className="cell wide" delay={0.12}>
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
          <Reveal className="cell" delay={0.04}>
            <Spotlight>
              <div className="tile-icon">
                <Icon name="cloud_upload" size={26} />
              </div>
              <h3>Hosting i wdrożenie</h3>
              <p>Uruchamiamy bota na stabilnym serwerze i dbamy o aktualizacje.</p>
            </Spotlight>
          </Reveal>
          <Reveal className="cell" delay={0.08}>
            <Spotlight>
              <div className="tile-icon">
                <Icon name="git_branch" size={26} />
              </div>
              <h3>Integracje</h3>
              <p>API, webhooki, płatności, GitHub, arkusze – bot połączy się z tym, czego używasz.</p>
            </Spotlight>
          </Reveal>
          <Reveal className="cell" delay={0.12}>
            <Spotlight>
              <div className="tile-icon">
                <Icon name="support" size={26} />
              </div>
              <h3>Opieka i rozwój</h3>
              <p>Poprawki, nowe funkcje i changelog. Jesteśmy dostępni na Discordzie.</p>
            </Spotlight>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ───────────────────────────── Proces ─────────────────────────────

const STEPS = [
  { title: 'Ticket na Discordzie', text: 'Opisujesz, czego potrzebujesz. Dopytamy o szczegóły i zaproponujemy rozwiązanie.' },
  { title: 'Wycena i termin', text: 'Dostajesz konkretną cenę, zakres i termin. Zaczynamy po akceptacji i wpłacie.' },
  { title: 'Realizacja', text: 'Postęp widzisz w panelu zlecenia. Testujesz bota na swoim serwerze przed odbiorem.' },
  { title: 'Wdrożenie i opieka', text: 'Uruchamiamy bota, dajemy dostęp do panelu i pilnujemy, żeby działał.' },
];

export function Process() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 85%', 'end 55%'] });
  const scaleX = useSpring(scrollYProgress, { stiffness: 90, damping: 24 });
  return (
    <section id="proces" className="section">
      <div className="wrap">
        <SectionHead
          kicker="Jak pracujemy"
          title={
            <>
              Od pomysłu do działającego bota <span className="grad">w 4 krokach</span>
            </>
          }
        />
        <div className="steps" ref={ref}>
          <div className="steps-line" aria-hidden>
            <motion.span style={{ scaleX }} />
          </div>
          {STEPS.map((s, i) => (
            <Reveal key={s.title} className="step" delay={i * 0.1}>
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

export function Portfolio({ items }: { items: SiteData['portfolio'] }) {
  if (!items.length) return null;
  return (
    <section id="realizacje" className="section">
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
        <div className="works">
          {items.map((p, i) => (
            <Reveal key={p.id} delay={(i % 3) * 0.08}>
              <motion.article className="work" whileHover={{ y: -6 }} transition={{ type: 'spring', stiffness: 300, damping: 24 }}>
                <div className="work-media">
                  {p.images[0] ? (
                    <img src={`/api/portfolio/${p.images[0]}`} alt={p.title} loading="lazy" />
                  ) : (
                    <div className="ph">
                      <Icon name="bot" size={64} />
                    </div>
                  )}
                  {p.url && (
                    <a className="work-link" href={p.url} target="_blank" rel="noreferrer">
                      Zobacz ↗
                    </a>
                  )}
                </div>
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
              </motion.article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ───────────────────────────── Cennik ─────────────────────────────

export function Pricing({ packages, addons, orderUrl }: { packages: SiteData['packages']; addons: SiteData['addons']; orderUrl: string }) {
  const featured = packages.length >= 3 ? 1 : -1;
  return (
    <section id="cennik" className="section">
      <div className="wrap">
        <SectionHead
          center
          kicker="Cennik"
          title={
            <>
              Przejrzyste ceny, <span className="grad">bez niespodzianek</span>
            </>
          }
          lead={
            packages.length
              ? 'Ceny pakietów są orientacyjne – dokładną wycenę dostajesz w tickecie, zanim cokolwiek zapłacisz.'
              : 'Każdy bot jest inny, dlatego wyceniamy indywidualnie. Opisz pomysł w tickecie – wycena jest bezpłatna.'
          }
        />
        {packages.length > 0 ? (
          <div className="prices" style={{ '--n': Math.min(packages.length, 3) } as React.CSSProperties}>
            {packages.slice(0, 3).map((p, i) => (
              <Reveal key={p.id} delay={i * 0.08}>
                <div className={`price${i === featured ? ' featured' : ''}`} style={{ height: '100%' }}>
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
                  <a href={orderUrl} className={i === featured ? 'cta-btn' : 'ghost-btn'} {...ext(orderUrl)}>
                    Zamów <Arrow />
                  </a>
                </div>
              </Reveal>
            ))}
          </div>
        ) : (
          <Reveal>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 36 }}>
              <a href={orderUrl} className="cta-btn" {...ext(orderUrl)}>
                Poproś o bezpłatną wycenę <Arrow />
              </a>
            </div>
          </Reveal>
        )}
        {addons.length > 0 && (
          <Reveal>
            <div className="addons">
              <b>Dodatki i moduły</b>
              <div className="addons-grid">
                {addons.map((a) => (
                  <div key={a.id} className="addon" title={a.description ?? undefined}>
                    <span>{a.label}</span>
                    <b>{money(a.price)} zł</b>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}

// ───────────────────────────── Opinie ─────────────────────────────

function ReviewCard({ r }: { r: SiteData['reviews'][number] }) {
  return (
    <figure className="review" style={{ margin: 0 }}>
      <Stars n={r.rating} />
      <blockquote style={{ margin: 0 }}>
        <p>{r.content}</p>
      </blockquote>
      <figcaption className="review-author">
        <img src={r.avatar && /^https:\/\/cdn\.discordapp\.com\//.test(r.avatar) ? r.avatar : '/emojis/user.png'} alt="" loading="lazy" />
        <span>
          {r.author}
          <small>{new Date(r.createdAt).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}</small>
        </span>
      </figcaption>
    </figure>
  );
}

export function Reviews({ reviews }: { reviews: SiteData['reviews'] }) {
  if (!reviews.length) return null;
  const marquee = reviews.length >= 6;
  const half = Math.ceil(reviews.length / 2);
  return (
    <section id="opinie" className="section">
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
          <Marquee speed={60}>
            {reviews.slice(0, half).map((r) => (
              <ReviewCard key={r.id} r={r} />
            ))}
          </Marquee>
          <Marquee speed={70} reverse>
            {reviews.slice(half).map((r) => (
              <ReviewCard key={r.id} r={r} />
            ))}
          </Marquee>
        </div>
      ) : (
        <div className="wrap">
          <div className="reviews-grid">
            {reviews.map((r, i) => (
              <Reveal key={r.id} delay={i * 0.06}>
                <ReviewCard r={r} />
              </Reveal>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ───────────────────────────── Panel (pokaz) ─────────────────────────────

const CHANNELS = ['# powitania', '# ogloszenia', '# lobby'];

export function PanelShowcase() {
  const reduce = useReducedMotion();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setTick((v) => v + 1), 1800);
    return () => clearInterval(t);
  }, [reduce]);
  const dirty = tick % 3 === 1;

  return (
    <section id="panel" className="section">
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
          <Reveal delay={0.1}>
            <ul className="bullets">
              {[
                ['tools', 'Wszystkie ustawienia', 'kanały, role, teksty, kolory i moduły – z podpowiedziami i walidacją'],
                ['shield_check', 'Uprawnienia komend', 'wybierasz, które role mogą używać poszczególnych komend'],
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

        <Reveal delay={0.1}>
          <div className="browser" aria-hidden>
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
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={tick % 3}
                          className="bm-input"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.25 }}
                        >
                          {CHANNELS[tick % 3]}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                    <div className="bm-field">
                      Rola na start
                      <div className="bm-input">
                        <span style={{ width: 8, height: 8, borderRadius: 9, background: '#2ecc8f', marginRight: 8 }} />
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
                <AnimatePresence>
                  {dirty && (
                    <motion.div
                      className="bm-save"
                      initial={{ opacity: 0, y: 12, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 12, scale: 0.96 }}
                    >
                      <span>Masz niezapisane zmiany</span>
                      <span>Zapisz</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ───────────────────────────── FAQ ─────────────────────────────

const DEFAULT_FAQ = [
  {
    id: -1,
    question: 'Jak zamówić bota?',
    answer: 'Dołącz do naszego serwera Discord i otwórz ticket „Zamówienie”. Opisz, czego potrzebujesz – odpowiemy, dopytamy o szczegóły i przygotujemy wycenę.',
  },
  {
    id: -2,
    question: 'Ile kosztuje bot?',
    answer: 'To zależy od zakresu. Wycena jest bezpłatna i dostajesz ją, zanim cokolwiek zapłacisz. Prostsze boty są tańsze, rozbudowane systemy wyceniamy indywidualnie.',
  },
  {
    id: -3,
    question: 'Czy mogę sam zmieniać ustawienia bota?',
    answer: 'Tak. Po wdrożeniu logujesz się na zxcode.pl przez Discord i w panelu zmieniasz kanały, role, teksty, moduły oraz uprawnienia komend. Zmiany działają od razu.',
  },
  {
    id: -4,
    question: 'Co jeśli bot przestanie działać?',
    answer: 'Boty naszych klientów są monitorowane co minutę. Przy awarii dostajemy alert i od razu się tym zajmujemy, a Ty dostajesz informację na Discordzie.',
  },
  {
    id: -5,
    question: 'Czy zajmujecie się hostingiem?',
    answer: 'Tak, możemy uruchomić i utrzymywać bota na naszym serwerze. Możesz też hostować go samodzielnie – wtedy pomożemy we wdrożeniu.',
  },
];

export function Faq({ items }: { items: SiteData['faq'] }) {
  const list = items.length >= 3 ? items : DEFAULT_FAQ;
  const [open, setOpen] = useState<number | null>(list[0]?.id ?? null);
  return (
    <section id="faq" className="section">
      <div className="wrap">
        <SectionHead
          center
          kicker="FAQ"
          title={
            <>
              Najczęstsze <span className="grad">pytania</span>
            </>
          }
        />
        <div className="faq-list">
          {list.map((f, i) => {
            const isOpen = open === f.id;
            return (
              <Reveal key={f.id} delay={i * 0.05}>
                <div className={`faq-item${isOpen ? ' open' : ''}`}>
                  <button className="faq-q" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : f.id)}>
                    {f.question}
                    <span className="faq-plus" aria-hidden />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.21, 0.8, 0.3, 1] }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div className="faq-a">{f.answer}</div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ───────────────────────────── CTA + stopka ─────────────────────────────

export function FinalCta({ orderUrl, loggedIn }: { orderUrl: string; loggedIn: boolean }) {
  return (
    <section className="section" style={{ paddingTop: 40 }}>
      <div className="wrap">
        <Reveal>
          <div className="final">
            <img src="/emojis/logo_round.png" alt="" className="final-logo" />
            <h2>
              Masz pomysł na bota? <span className="grad">Zróbmy go razem.</span>
            </h2>
            <p className="lead">Napisz na Discordzie – opisz pomysł, a przygotujemy bezpłatną wycenę.</p>
            <div className="final-actions">
              <a href={orderUrl} className="cta-btn" {...ext(orderUrl)}>
                <Icon name="discord" size={20} /> Otwórz ticket na Discordzie <Arrow />
              </a>
              <a href={loggedIn ? '/panel' : '/api/auth/login'} className="ghost-btn">
                {loggedIn ? 'Przejdź do panelu' : 'Zaloguj się do panelu'}
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function Footer({ orderUrl }: { orderUrl: string }) {
  return (
    <footer className="sfooter">
      <div className="wrap">
        <div className="sfooter-grid">
          <div style={{ maxWidth: 320 }}>
            <div className="brand" style={{ marginBottom: 12 }}>
              <Icon name="logo_round" size={30} />
              <span>
                zx<b>Code</b>
              </span>
            </div>
            <p>Programowanie botów Discord. Projekt, kod, wdrożenie i opieka – w jednym miejscu.</p>
          </div>
          <nav aria-label="Stopka">
            <div>
              <b>Oferta</b>
              <a href="#uslugi">Usługi</a>
              <a href="#cennik">Cennik</a>
              <a href="#realizacje">Realizacje</a>
            </div>
            <div>
              <b>Klient</b>
              <a href="/panel">Panel</a>
              <a href={orderUrl} {...ext(orderUrl)}>
                Zamów bota
              </a>
              <a href="#faq">FAQ</a>
            </div>
          </nav>
        </div>
        <div className="sfooter-bottom">
          <span>© {new Date().getFullYear()} zxCode</span>
          <span>Nie jesteśmy powiązani z Discord Inc.</span>
        </div>
      </div>
    </footer>
  );
}
