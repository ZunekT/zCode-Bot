import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { Reveal } from '@/components/site/primitives';
import { Addons, FaqList, FinalCta, PageHero, PricingCards } from '@/components/site/Sections';
import { FAQ_GROUPS } from '@/lib/faq';
import { getSite } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Cennik', description: 'Ceny botów Discord na zamówienie – pakiety, dodatki i co zawiera każdy bot.' };

const INCLUDED = [
  ['tools', 'Panel ustawień', 'Kanały, role, teksty i moduły zmieniasz sam na zxcode.pl.'],
  ['shield_check', 'Uprawnienia komend', 'Decydujesz, które role mogą używać komend.'],
  ['code', 'Nowoczesny kod', 'TypeScript, discord.js v14, komponenty Discorda.'],
  ['checklist', 'Testy przed odbiorem', 'Sprawdzasz bota na swoim serwerze, zanim go odbierzesz.'],
];

export default async function PricingPage() {
  const { packages, addons } = await getSite();
  const payFaq = FAQ_GROUPS[0]!.items;
  return (
    <>
      <PageHero
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
      <section className="wrap">
        <PricingCards packages={packages} />
        <Addons addons={addons} />
        <Reveal>
          <div className="panel-box">
            <h3>W każdym bocie</h3>
            <div className="includes">
              {INCLUDED.map(([icon, b, t]) => (
                <div key={b} className="include">
                  <Icon name={icon!} size={22} />
                  <span>
                    <b>{b}</b>
                    {t}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>
      <section className="wrap" style={{ paddingTop: 72 }}>
        <div className="center">
          <span className="kicker">Płatności</span>
          <h2 className="h2">Pytania o zamówienie</h2>
        </div>
        <FaqList items={payFaq} firstOpen={false} />
        <div className="more">
          <Link href="/faq" className="ghost-btn">
            Wszystkie pytania
          </Link>
        </div>
      </section>
      <FinalCta />
    </>
  );
}
