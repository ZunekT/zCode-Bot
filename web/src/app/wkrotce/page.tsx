import type { Metadata } from 'next';
import { env } from '@/lib/env';
import './wkrotce.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Start wkrótce',
  description: 'zxCode – strony internetowe i boty Discord na zamówienie. Nowa odsłona zxcode.pl startuje wkrótce.',
  robots: { index: false, follow: false },
};

const WORDS = ['strony internetowe', 'boty Discord', 'sklepy online', 'panele klienta'];

const CARDS = [
  {
    icon: 'laptop',
    title: 'Strony internetowe',
    text: 'Wizytówki, strony firmowe, sklepy i aplikacje WWW – szybkie, dopracowane na telefonach i przygotowane pod Google.',
  },
  {
    icon: 'bot',
    title: 'Boty Discord',
    text: 'Tickety, ekonomia, serwery RP, moderacja i integracje. Ustawienia bota zmieniasz sam w panelu, bez restartu.',
  },
  {
    icon: 'desktop',
    title: 'Panel klienta',
    text: 'Postęp zlecenia na żywo, płatności, ustawienia botów i stan Twoich stron – wszystko w jednym miejscu.',
  },
];

const SOON = [
  ['checklist', 'Bezpłatna wycena przez krótki formularz'],
  ['tools', 'Edycja treści strony bez programisty'],
  ['lightning', 'Monitoring stron i botów co minutę'],
  ['shield_check', 'Certyfikat SSL i bezpieczeństwo w standardzie'],
];

const Icon = ({ name, size = 22 }: { name: string; size?: number }) => <img src={`/emojis/${name}.png`} width={size} height={size} alt="" aria-hidden />;

export default function ComingSoon() {
  const discord = env.discordInvite;
  return (
    <main className="soon">
      <div className="soon-bg" aria-hidden>
        <div className="soon-glow g1" />
        <div className="soon-glow g2" />
        <div className="soon-glow g3" />
        <div className="soon-grid" />
      </div>

      <header className="soon-top">
        <span className="soon-brand">
          <img src="/emojis/logo_round.png" alt="" width={30} height={30} />
          <span>
            zx<b>Code</b>
          </span>
        </span>
        <span className="soon-status">
          <span className="soon-dot" />
          Pracujemy nad nową stroną
        </span>
      </header>

      <section className="soon-hero">
        <div className="soon-logo-wrap" aria-hidden>
          <span className="soon-ring r1" />
          <span className="soon-ring r2" />
          <img src="/emojis/logo_round.png" alt="" width={92} height={92} className="soon-logo" />
        </div>

        <h1>
          Start <span className="soon-grad">wkrótce</span>
        </h1>

        <p className="soon-rotate" aria-label={`Tworzymy ${WORDS.join(', ')}`}>
          <span aria-hidden>Tworzymy</span>
          <span className="soon-words" aria-hidden>
            {WORDS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </span>
        </p>

        <p className="soon-lead">
          Szykujemy nową odsłonę zxcode.pl. Już niedługo znajdziesz tu pełną ofertę stron internetowych i botów Discord, nasze realizacje, cennik
          i panel, w którym na bieżąco śledzisz swoje zamówienie.
        </p>

        <div className="soon-actions">
          <a href="mailto:kontakt@zxcode.pl" className="soon-btn primary">
            <Icon name="notification" size={18} />
            Napisz do nas
          </a>
          {discord && (
            <a href={discord} className="soon-btn" target="_blank" rel="noopener noreferrer">
              <Icon name="discord" size={18} />
              Dołącz do Discorda
            </a>
          )}
        </div>
      </section>

      <section className="soon-cards" aria-label="Czym się zajmujemy">
        {CARDS.map((c, i) => (
          <article key={c.title} className="soon-card" style={{ animationDelay: `${0.35 + i * 0.1}s` }}>
            <span className="soon-ico">
              <Icon name={c.icon} size={24} />
            </span>
            <h2>{c.title}</h2>
            <p>{c.text}</p>
          </article>
        ))}
      </section>

      <section className="soon-list-wrap" aria-label="Co znajdziesz po starcie">
        <h2>Co znajdziesz po starcie</h2>
        <ul className="soon-list">
          {SOON.map(([icon, text]) => (
            <li key={text}>
              <Icon name={icon!} size={20} />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="soon-foot">
        <span>© {new Date().getFullYear()} zxCode · kontakt@zxcode.pl</span>
        <a href="/zaloguj">Masz dostęp do podglądu? Zaloguj się</a>
      </footer>
    </main>
  );
}
