import type { Metadata } from 'next';
import Link from 'next/link';
import { Reveal, Arrow } from '@/components/site/primitives';
import {
  Addons,
  FaqList,
  FinalCta,
  PageHero,
  PortfolioPreview,
  PricingCards,
  Process,
  SectionHead,
  SiteTypes,
  WEB_STEPS,
  WebIncluded,
} from '@/components/site/Sections';
import { WebMock } from '@/components/site/WebMock';
import { FAQ_GROUPS } from '@/lib/faq';
import { byKind, getSite } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Strony internetowe',
  description:
    'Nowoczesne strony internetowe na zamówienie: wizytówki, strony firmowe, sklepy i aplikacje WWW. Szybkie, responsywne, z SEO i opieką po wdrożeniu.',
};

export default async function WebsitesPage() {
  const data = await getSite();
  const packages = byKind(data.packages, 'WEBSITE');
  const addons = byKind(data.addons, 'WEBSITE');
  const works = byKind(data.portfolio, 'WEBSITE');
  const faq = FAQ_GROUPS.find((g) => g.title === 'Strony internetowe')?.items ?? [];
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
      <PortfolioPreview
        items={works}
        title={
          <>
            Strony, które <span className="grad">już działają</span>
          </>
        }
        lead="Wybrane strony, które zaprojektowaliśmy i zbudowaliśmy dla naszych klientów."
        href="/realizacje?typ=strony"
      />

      <section id="ceny" className="section cv">
        <div className="wrap">
          <SectionHead
            center
            kicker="Cennik"
            title={
              <>
                Pakiety <span className="grad">stron internetowych</span>
              </>
            }
            lead="Ceny są orientacyjne – dokładną wycenę dostajesz bezpłatnie, zanim cokolwiek zapłacisz."
          />
          <PricingCards packages={packages} orderHref="/zamow/strona" />
          <Addons addons={addons} title="Dodatki" lead="Rozbuduj stronę o to, czego potrzebujesz." />
        </div>
      </section>

      {faq.length > 0 && (
        <section className="section cv">
          <div className="wrap">
            <SectionHead
              center
              kicker="FAQ"
              title={
                <>
                  Pytania o <span className="grad">strony</span>
                </>
              }
            />
            <FaqList items={faq} />
          </div>
        </section>
      )}

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
