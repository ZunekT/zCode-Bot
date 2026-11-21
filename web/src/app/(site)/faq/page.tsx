import type { Metadata } from 'next';
import { FaqList, FinalCta, PageHero } from '@/components/site/Sections';
import { getContent } from '@/lib/content';
import { renderRichText } from '@/lib/richtext';
import { getSite } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'FAQ', description: 'Najczęstsze pytania o zamawianie botów Discord, panel, hosting i wsparcie.' };

export default async function FaqPage() {
  const [{ faq }, { faq: c }] = await Promise.all([getSite(), getContent()]);
  const GROUPS = [
    { id: 'zamowienie', title: 'Zamówienie i płatności', items: c.zamowienie },
    { id: 'strony', title: 'Strony internetowe', items: c.strony },
    { id: 'boty', title: 'Boty Discord', items: c.boty },
    { id: 'hosting', title: 'Hosting i wsparcie', items: c.hosting },
  ];
  const groups = [
    ...GROUPS.filter((g) => g.items.length).map((g) => ({
      id: g.id,
      title: g.title,
      items: g.items.map((q, i) => ({ id: `${g.id}-${i}`, question: q.pytanie, answer: q.odpowiedz, html: renderRichText(q.odpowiedz) })),
    })),
    ...(faq.length ? [{ id: 'inne', title: 'Inne pytania', items: faq }] : []),
  ];
  return (
    <>
      <PageHero
        kicker="FAQ"
        title={
          <>
            Najczęstsze <span className="grad">pytania</span>
          </>
        }
        lead={c.opis}
      >
        <div className="jump">
          {groups.map((g) => (
            <a key={g.id} href={`#${g.id}`}>
              {g.title}
            </a>
          ))}
        </div>
      </PageHero>
      <section className="wrap" style={{ paddingBottom: 40 }}>
        {groups.map((g, i) => (
          <div key={g.id} id={g.id} className="faq-group" style={i === 0 ? { marginTop: 8 } : undefined}>
            <h2>{g.title}</h2>
            <FaqList items={g.items} firstOpen={i === 0} />
          </div>
        ))}
      </section>
      <FinalCta title={<>Masz inne pytanie? <span className="grad">Napisz do nas.</span></>} lead="Odpowiemy mailowo albo na Discordzie." />
    </>
  );
}
