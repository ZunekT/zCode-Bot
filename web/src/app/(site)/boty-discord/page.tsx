import type { Metadata } from 'next';
import Link from 'next/link';
import { Arrow } from '@/components/site/primitives';
import { Reveal } from '@/components/site/primitives';
import { BOT_STEPS, BotServices, FinalCta, MoreLinks, PageHero, PanelShowcase, Process } from '@/components/site/Sections';
import { BotMock } from '@/components/site/WebMock';
import { env } from '@/lib/env';

export const metadata: Metadata = {
  title: 'Boty Discord',
  description:
    'Boty Discord na zamówienie: tickety, ekonomia, RP, moderacja i integracje. Panel ustawień online, monitoring 24/7 i opieka po wdrożeniu.',
};

export default function BotsPage() {
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

      <section className="wrap" style={{ marginTop: 8 }}>
        <Reveal>
          <div className="bot-hero-mock">
            <BotMock />
          </div>
        </Reveal>
      </section>

      <BotServices />
      <PanelShowcase />
      <Process steps={BOT_STEPS} title={<>Od pomysłu do działającego bota <span className="grad">w 4 krokach</span></>} />
      <MoreLinks
        items={[
          { href: '/cennik#boty', icon: 'coins', title: 'Cennik botów', text: 'Pakiety i moduły z cenami' },
          { href: '/realizacje?typ=boty', icon: 'package', title: 'Nasze boty', text: 'Boty działające na serwerach klientów' },
          { href: '/faq#boty', icon: 'idea', title: 'Pytania o boty', text: 'Panel, poprawki, kod źródłowy' },
        ]}
      />

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
