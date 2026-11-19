import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { Reveal } from '@/components/site/primitives';
import { Addons, FaqList, FinalCta, PageHero, PricingCards, SectionHead } from '@/components/site/Sections';
import { env } from '@/lib/env';
import { FAQ_GROUPS } from '@/lib/faq';
import { byKind, getSite } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Cennik',
  description: 'Ceny stron internetowych i botów Discord na zamówienie – pakiety, dodatki i to, co zawiera każdy projekt.',
};

const INCLUDED = [
  ['mobile', 'Na każdym ekranie', 'Strony i panele dopracowane na telefonach i komputerach.'],
  ['tools', 'Panel klienta', 'Postęp zlecenia, płatności, ustawienia botów i stan stron.'],
  ['code', 'Nowoczesny kod', 'TypeScript, Next.js, discord.js – kod, który da się rozwijać.'],
  ['checklist', 'Testy przed odbiorem', 'Sprawdzasz wszystko, zanim odbierzesz projekt.'],
];

export default async function PricingPage() {
  const { packages, addons } = await getSite();
  const payFaq = FAQ_GROUPS[0]!.items;
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

      <section className="wrap price-section">
        <Reveal>
          <div className="panel-box">
            <h3>W każdym projekcie</h3>
            <div className="includes">
              {INCLUDED.map(([icon, b, t]) => (
                <div key={b} className="include">
                  <Icon name={icon!} size={24} />
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
