import type { Metadata } from 'next';
import Link from 'next/link';
import { Arrow, Grad } from '@/components/site/primitives';
import { Reveal } from '@/components/site/primitives';
import { BotServices, FinalCta, MoreLinks, PageHero, PanelShowcase, Process } from '@/components/site/Sections';
import { getContent, lines } from '@/lib/content';
import { BotMock } from '@/components/site/WebMock';
import { env } from '@/lib/env';

export const metadata: Metadata = {
  title: 'Boty Discord',
  description:
    'Boty Discord na zamówienie: tickety, ekonomia, RP, moderacja i integracje. Panel ustawień online, monitoring 24/7 i opieka po wdrożeniu.',
};

export default async function BotsPage() {
  const { boty: c } = await getContent();
  const order = env.discordInvite ?? '/zamow';
  return (
    <>
      <PageHero
        kicker="Boty Discord"
        title={<Grad text={c.naglowek} />}
        lead={c.opis}
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

      <BotServices title={c.uslugiNaglowek} lead={c.uslugiOpis} chips={lines(c.funkcje)} />
      <PanelShowcase />
      <Process steps={c.kroki.map((s) => ({ title: s.tytul, text: s.opis }))} title={<Grad text={c.krokiNaglowek} />} />
      <MoreLinks
        items={[
          { href: '/cennik#boty', icon: 'coins', title: 'Cennik botów', text: 'Pakiety i moduły z cenami' },
          { href: '/realizacje?typ=boty', icon: 'package', title: 'Nasze boty', text: 'Boty działające na serwerach klientów' },
          { href: '/faq#boty', icon: 'idea', title: 'Pytania o boty', text: 'Panel, poprawki, kod źródłowy' },
        ]}
      />

      <FinalCta title={<Grad text={c.ctaNaglowek} />} lead={c.ctaOpis} />
    </>
  );
}
