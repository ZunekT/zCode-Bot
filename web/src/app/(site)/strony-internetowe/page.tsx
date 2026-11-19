import type { Metadata } from 'next';
import Link from 'next/link';
import { Reveal, Arrow } from '@/components/site/primitives';
import { FinalCta, MoreLinks, PageHero, Process, SiteTypes, WEB_STEPS, WebIncluded } from '@/components/site/Sections';
import { WebMock } from '@/components/site/WebMock';

export const metadata: Metadata = {
  title: 'Strony internetowe',
  description:
    'Nowoczesne strony internetowe na zamówienie: wizytówki, strony firmowe, sklepy i aplikacje WWW. Szybkie, responsywne, z SEO i opieką po wdrożeniu.',
};

export default function WebsitesPage() {
  return (
    <>
      <PageHero
        kicker="Strony internetowe"
        title={
          <>
            Strony, które <span className="grad">robią wrażenie</span> i sprzedają
          </>
        }
        lead="Projektujemy i kodujemy nowoczesne strony od zera – szybkie, piękne na każdym ekranie i przygotowane pod Google. Bez gotowych szablonów."
      >
        <div className="hero2-actions">
          <Link href="/zamow/strona" className="cta-btn">
            Bezpłatna wycena strony <Arrow />
          </Link>
          <Link href="/cennik#strony" className="ghost-btn">
            Zobacz ceny <Arrow />
          </Link>
        </div>
      </PageHero>

      <section className="wrap" style={{ marginTop: 8 }}>
        <Reveal>
          <WebMock url="twojafirma.pl" />
        </Reveal>
      </section>

      <SiteTypes />
      <WebIncluded />
      <Process
        steps={WEB_STEPS}
        title={
          <>
            Jak powstaje <span className="grad">Twoja strona</span>
          </>
        }
      />
      <MoreLinks
        items={[
          { href: '/cennik#strony', icon: 'coins', title: 'Cennik stron', text: 'Pakiety i dodatki z cenami' },
          { href: '/realizacje?typ=strony', icon: 'package', title: 'Nasze strony', text: 'Przykłady stron, które zbudowaliśmy' },
          { href: '/faq#strony', icon: 'idea', title: 'Pytania o strony', text: 'Domena, edycja treści, SEO, RODO' },
        ]}
      />

      <FinalCta
        title={
          <>
            Gotowy na nową stronę? <span className="grad">Porozmawiajmy.</span>
          </>
        }
        lead="Opisz swój pomysł w krótkim formularzu – odezwiemy się z bezpłatną wyceną."
      />
    </>
  );
}
