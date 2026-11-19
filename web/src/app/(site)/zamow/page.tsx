import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { Arrow, Check, Reveal } from '@/components/site/primitives';
import { PageHero } from '@/components/site/Sections';
import { env } from '@/lib/env';

export const metadata: Metadata = {
  title: 'Zamów',
  description: 'Zamów stronę internetową lub bota Discord – bezpłatna wycena.',
};

export default function OrderPage() {
  const invite = env.discordInvite;
  return (
    <>
      <PageHero
        kicker="Bezpłatna wycena"
        title={
          <>
            Co dla Ciebie <span className="grad">zbudujemy?</span>
          </>
        }
        lead="Wybierz usługę – wycena jest bezpłatna i do niczego nie zobowiązuje."
      />
      <section className="wrap order-choice">
        <Reveal>
          <Link href="/zamow/strona" className="choice web">
            <span className="tile-icon">
              <Icon name="laptop" size={24} />
            </span>
            <h2>Strona internetowa</h2>
            <p>Wizytówka, strona firmowa, sklep albo aplikacja WWW.</p>
            <ul>
              <li>
                <Check /> Krótki formularz – 2 minuty
              </li>
              <li>
                <Check /> Bez konta na Discordzie
              </li>
              <li>
                <Check /> Odpowiedź na e-mail
              </li>
            </ul>
            <span className="choice-cta cta-btn">
              Wyceń stronę <Arrow />
            </span>
          </Link>
        </Reveal>
        <Reveal delay={0.08}>
          <a
            href={invite ?? '/boty-discord'}
            className="choice bot"
            target={invite ? '_blank' : undefined}
            rel={invite ? 'noreferrer noopener' : undefined}
          >
            <span className="tile-icon">
              <Icon name="bot" size={24} />
            </span>
            <h2>Bot Discord</h2>
            <p>Tickety, ekonomia, RP, moderacja i integracje.</p>
            <ul>
              <li>
                <Check /> Ticket „Zamówienie bota”
              </li>
              <li>
                <Check /> Rozmowa i wycena na Discordzie
              </li>
              <li>
                <Check /> Postęp w panelu klienta
              </li>
            </ul>
            <span className="choice-cta ghost-btn">
              <Icon name="discord" size={20} /> Przejdź na Discorda <Arrow />
            </span>
          </a>
        </Reveal>
      </section>
    </>
  );
}
