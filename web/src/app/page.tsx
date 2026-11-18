import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { Topbar } from '@/components/Topbar';
import { env } from '@/lib/env';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  anulowano: 'Logowanie zostało anulowane.',
  sesja: 'Sesja logowania wygasła. Spróbuj jeszcze raz.',
  discord: 'Discord nie potwierdził logowania. Spróbuj jeszcze raz.',
};

const FEATURES = [
  {
    icon: 'tools',
    title: 'Panel ustawień',
    text: 'Kanały, role, teksty i moduły bota zmieniasz na stronie. Bot dostaje zmiany od razu, bez restartu.',
  },
  {
    icon: 'shield_check',
    title: 'Uprawnienia komend',
    text: 'Decydujesz, które role na Twoim serwerze mogą używać poszczególnych komend bota.',
  },
  {
    icon: 'server',
    title: 'Monitoring 24/7',
    text: 'Pilnujemy, żeby bot działał. Przy awarii dostajemy alert i od razu się tym zajmujemy.',
  },
];

export default async function Home({ searchParams }: { searchParams: Promise<{ blad?: string }> }) {
  const [session, { blad }] = await Promise.all([getSession(), searchParams]);
  const invite = env.discordInvite;

  return (
    <>
      <Topbar session={session} />
      <main className="container">
        {blad && ERRORS[blad] && (
          <div className="notice notice-err" style={{ marginTop: 24 }}>
            <Icon name="shield_x" />
            <p>{ERRORS[blad]}</p>
          </div>
        )}
        <section className="hero">
          <img src="/emojis/logo_round.png" alt="zxCode" className="hero-logo" />
          <div className="eyebrow">
            &lt; Programowanie botów <b>Discord</b> /&gt;
          </div>
          <h1>
            Boty Discord <span>szyte na miarę</span>
          </h1>
          <p>Projektujemy, piszemy i utrzymujemy boty dla Twojej społeczności. Wszystkie ustawienia masz w jednym panelu.</p>
          <div className="hero-actions">
            {session ? (
              <Link href="/panel" className="btn btn-primary btn-lg">
                <Icon name="bot" size={20} /> Przejdź do panelu
              </Link>
            ) : (
              <a href="/api/auth/login" className="btn btn-primary btn-lg">
                <Icon name="discord" size={20} /> Zaloguj przez Discord
              </a>
            )}
            {invite && (
              <a href={invite} className="btn btn-lg" target="_blank" rel="noreferrer">
                <Icon name="cart" size={20} /> Zamów bota
              </a>
            )}
          </div>
        </section>
        <section className="features">
          {FEATURES.map((f) => (
            <div key={f.title} className="card feature">
              <Icon name={f.icon} size={40} />
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </section>
      </main>
      <footer className="footer">
        <div className="container">© {new Date().getFullYear()} zxCode · Programowanie botów Discord</div>
      </footer>
    </>
  );
}
