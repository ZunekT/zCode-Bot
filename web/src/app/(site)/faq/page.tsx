import type { Metadata } from 'next';
import { FaqList, FinalCta, PageHero } from '@/components/site/Sections';
import { FAQ_GROUPS } from '@/lib/faq';
import { getSite } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'FAQ', description: 'Najczęstsze pytania o zamawianie botów Discord, panel, hosting i wsparcie.' };

export default async function FaqPage() {
  const { faq } = await getSite();
  const groups = [...FAQ_GROUPS, ...(faq.length ? [{ title: 'Inne pytania', items: faq }] : [])];
  return (
    <>
      <PageHero
        kicker="FAQ"
        title={
          <>
            Najczęstsze <span className="grad">pytania</span>
          </>
        }
        lead="Nie ma tu Twojego pytania? Napisz w tickecie na Discordzie."
      />
      <section className="wrap" style={{ paddingBottom: 40 }}>
        {groups.map((g, i) => (
          <div key={g.title} className="faq-group" style={i === 0 ? { marginTop: 8 } : undefined}>
            <h2>{g.title}</h2>
            <FaqList items={g.items} firstOpen={i === 0} />
          </div>
        ))}
      </section>
      <FinalCta title={<>Masz inne pytanie? <span className="grad">Napisz do nas.</span></>} lead="Odpowiemy w tickecie na naszym serwerze Discord." />
    </>
  );
}
