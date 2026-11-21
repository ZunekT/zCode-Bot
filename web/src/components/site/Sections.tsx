import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { SiteData } from '@/lib/site';
import { Icon } from '../Icon';
import { FaqList, LiveSwitches, PanelMock, Spotlight } from './islands';
import { Arrow, Check, Grad, Reveal, Stars } from './primitives';

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

export function BotServices({ title, lead, chips }: { title: string; lead: string; chips: string[] }) {
  return (
    <section id="uslugi" className="section cv">
      <div className="wrap">
        <SectionHead
          kicker="Co robimy"
          title={<Grad text={title} />}
          lead={lead}
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
                {chips.map((c) => (
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

export function Process({ steps, title }: { steps: Step[]; title: React.ReactNode }) {
  return (
    <section id="proces" className="section cv">
      <div className="wrap">
        <SectionHead
          kicker="Jak pracujemy"
          title={title}
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

type Item = { ikona: string; tytul: string; opis: string };

export function SiteTypes({ title, lead, items }: { title: string; lead: string; items: Item[] }) {
  return (
    <section className="section cv">
      <div className="wrap">
        <SectionHead
          kicker="Co budujemy"
          title={<Grad text={title} />}
          lead={lead}
        />
        <div className="types">
          {items.map(({ ikona: icon, tytul: title, opis: text }, i) => (
            <Reveal key={`${i}-${title}`} delay={i * 0.06}>
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

export function WebIncluded({ title, items }: { title: string; items: Item[] }) {
  return (
    <section className="section cv">
      <div className="wrap">
        <SectionHead
          kicker="W standardzie"
          title={<Grad text={title} />}
        />
        <Reveal>
          <div className="included">
            {items.map(({ ikona: icon, tytul: b, opis: t }, i) => (
              <div key={`${i}-${b}`} className="included-item">
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

export function MoreLinks({ items }: { items: { href: string; icon: string; title: string; text: string }[] }) {
  return (
    <section className="section cv" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <div className="wrap">
        <div className="more-links">
          {items.map((it, i) => (
            <Reveal key={it.href} delay={i * 0.06}>
              <Link href={it.href} className="more-link">
                <span className="tile-icon">
                  <Icon name={it.icon} size={24} />
                </span>
                <span>
                  <b>{it.title}</b>
                  <small>{it.text}</small>
                </span>
                <Arrow />
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
