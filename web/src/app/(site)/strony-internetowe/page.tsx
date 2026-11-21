import type { Metadata } from 'next';
import Link from 'next/link';
import { Reveal, Arrow, Grad } from '@/components/site/primitives';
import { FinalCta, MoreLinks, PageHero, Process, SiteTypes, WebIncluded } from '@/components/site/Sections';
import { getContent } from '@/lib/content';
import { WebMock } from '@/components/site/WebMock';

export const metadata: Metadata = {
  title: 'Strony internetowe',
  description:
    'Nowoczesne strony internetowe na zamówienie: wizytówki, strony firmowe, sklepy i aplikacje WWW. Szybkie, responsywne, z SEO i opieką po wdrożeniu.',
};

export default async function WebsitesPage() {
  const { strony: c } = await getContent();
  return (
    <>
      <PageHero
        kicker="Strony internetowe"
        title={<Grad text={c.naglowek} />}
        lead={c.opis}
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

      <SiteTypes title={c.rodzajeNaglowek} lead={c.rodzajeOpis} items={c.rodzaje} />
      <WebIncluded title={c.standardNaglowek} items={c.standard} />
      <Process steps={c.kroki.map((s) => ({ title: s.tytul, text: s.opis }))} title={<Grad text={c.krokiNaglowek} />} />
      <MoreLinks
        items={[
          { href: '/cennik#strony', icon: 'coins', title: 'Cennik stron', text: 'Pakiety i dodatki z cenami' },
          { href: '/realizacje?typ=strony', icon: 'package', title: 'Nasze strony', text: 'Przykłady stron, które zbudowaliśmy' },
          { href: '/faq#strony', icon: 'idea', title: 'Pytania o strony', text: 'Domena, edycja treści, SEO, RODO' },
        ]}
      />

      <FinalCta title={<Grad text={c.ctaNaglowek} />} lead={c.ctaOpis} />
    </>
  );
}
