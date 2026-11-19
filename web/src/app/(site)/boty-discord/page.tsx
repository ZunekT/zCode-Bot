import type { Metadata } from 'next';
import Link from 'next/link';
import { Arrow } from '@/components/site/primitives';
import {
  Addons,
  BOT_STEPS,
  BotServices,
  FaqList,
  FinalCta,
  PageHero,
  PanelShowcase,
  PortfolioPreview,
  PricingCards,
  Process,
  SectionHead,
} from '@/components/site/Sections';
import { FAQ_GROUPS } from '@/lib/faq';
import { env } from '@/lib/env';
import { byKind, getSite } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Boty Discord',
  description:
    'Boty Discord na zamówienie: tickety, ekonomia, RP, moderacja i integracje. Panel ustawień online, monitoring 24/7 i opieka po wdrożeniu.',
};

export default async function BotsPage() {
  const data = await getSite();
  const packages = byKind(data.packages, 'BOT');
  const addons = byKind(data.addons, 'BOT');
  const works = byKind(data.portfolio, 'BOT');
  const faq = FAQ_GROUPS.find((g) => g.title === 'Boty Discord')?.items ?? [];
  const order = env.discordInvite ?? '/zamow';
  return (
    <>
      <PageHero
        kicker="Boty Discord"
        title={
          <>
            Boty, które <span className="grad">pracują za Ciebie</span>
          </>
        }
        lead="Tickety, ekonomia, RP, moderacja i integracje. Projektujemy, piszemy i utrzymujemy boty dla Twojej społeczności – a ustawienia zmieniasz sam w panelu."
      >
        <div className="hero2-actions">
          <a href={order} className="cta-btn" target={env.discordInvite ? '_blank' : undefined} rel="noreferrer">
            Zamów bota na Discordzie <Arrow />
          </a>
          <Link href="/cennik#boty" className="ghost-btn">
            Zobacz ceny <Arrow />
          </Link>
        </div>
      </PageHero>

      <BotServices />
      <PanelShowcase />
      <Process steps={BOT_STEPS} title={<>Od pomysłu do działającego bota <span className="grad">w 4 krokach</span></>} />
      <PortfolioPreview
        items={works}
        title={
          <>
            Boty, które <span className="grad">już działają</span>
          </>
        }
        lead="Wybrane boty dla serwerów naszych klientów."
        href="/realizacje?typ=boty"
      />

      <section id="ceny" className="section cv">
        <div className="wrap">
          <SectionHead
            center
            kicker="Cennik"
            title={
              <>
                Pakiety <span className="grad">botów Discord</span>
              </>
            }
            lead="Ceny są orientacyjne – dokładną wycenę dostajesz w tickecie, zanim cokolwiek zapłacisz."
          />
          <PricingCards packages={packages} orderHref={order} />
          <Addons addons={addons} />
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
                  Pytania o <span className="grad">boty</span>
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
            Masz pomysł na bota? <span className="grad">Zróbmy go razem.</span>
          </>
        }
        lead="Opisz pomysł w tickecie na Discordzie – przygotujemy bezpłatną wycenę."
      />
    </>
  );
}
