import type { Metadata } from 'next';
import { Icon } from '@/components/Icon';

export const metadata: Metadata = { title: 'Logowanie', robots: { index: false } };

const ERRORS: Record<string, string> = {
  anulowano: 'Logowanie zostało anulowane.',
  sesja: 'Sesja logowania wygasła. Spróbuj jeszcze raz.',
  discord: 'Discord nie potwierdził logowania. Spróbuj jeszcze raz.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ blad?: string }> }) {
  const { blad } = await searchParams;
  return (
    <section className="page-hero" style={{ minHeight: '70vh' }}>
      <div className="wrap" style={{ maxWidth: 520 }}>
        <div className="card empty">
          <Icon name={blad ? 'shield_x' : 'discord'} size={56} />
          <h2>{blad ? 'Nie udało się zalogować' : 'Zaloguj się przez Discord'}</h2>
          <p>{blad ? (ERRORS[blad] ?? 'Spróbuj jeszcze raz.') : 'Panel klienta jest dostępny po zalogowaniu kontem Discord.'}</p>
          <a href="/api/auth/login" className="cta-btn">
            <Icon name="discord" size={20} /> Zaloguj przez Discord
          </a>
        </div>
      </div>
    </section>
  );
}
