import type { Metadata } from 'next';
import { Icon } from '@/components/Icon';
import { Addons, FinalCta, MoreLinks, PageHero, PricingCards, SectionHead } from '@/components/site/Sections';
import { env } from '@/lib/env';
import { byKind, getSite } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Cennik',
  description: 'Ceny stron internetowych i botów Discord na zamówienie – pakiety, dodatki i to, co zawiera każdy projekt.',
};

export default async function PricingPage() {
  const { packages, addons } = await getSite();
  const botOrder = env.discordInvite ?? '/zamow';
  return (
    <>
      <PageHero
        kicker="Cennik"
        title={
          <>
            Przejrzyste ceny, <span className="grad">bez niespodzianek</span>
          </>
        }
        lead="Ceny pakietów są orientacyjne – dokładną, bezpłatną wycenę dostajesz, zanim cokolwiek zapłacisz."
      >
        <div className="jump">
          <a href="#strony">
            <Icon name="laptop" size={20} /> Strony internetowe
          </a>
          <a href="#boty">
            <Icon name="bot" size={20} /> Boty Discord
          </a>
        </div>
      </PageHero>

      <section id="strony" className="wrap price-section">
        <SectionHead
          kicker="Strony internetowe"
          title={
            <>
              Pakiety <span className="grad">stron</span>
            </>
          }
        />
        <PricingCards packages={byKind(packages, 'WEBSITE')} orderHref="/zamow/strona" />
        <Addons addons={byKind(addons, 'WEBSITE')} title="Dodatki do strony" lead="Rozbuduj stronę o to, czego potrzebujesz." />
      </section>

      <section id="boty" className="wrap price-section">
        <SectionHead
          kicker="Boty Discord"
          title={
            <>
              Pakiety <span className="grad">botów</span>
            </>
          }
        />
        <PricingCards packages={byKind(packages, 'BOT')} orderHref={botOrder} />
        <Addons addons={byKind(addons, 'BOT')} title="Moduły bota" />
      </section>

      <MoreLinks
        items={[
          { href: '/faq#zamowienie', icon: 'idea', title: 'Pytania o płatności', text: 'Proforma, zaliczka, terminy' },
          { href: '/realizacje', icon: 'package', title: 'Realizacje', text: 'Zobacz, co już zrobiliśmy' },
          { href: '/zamow', icon: 'cart', title: 'Bezpłatna wycena', text: 'Dokładna cena dla Twojego projektu' },
        ]}
      />
      <FinalCta />
    </>
  );
}
