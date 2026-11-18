import type { Metadata } from 'next';
import { FinalCta, PageHero, PortfolioGrid } from '@/components/site/Sections';
import { Icon } from '@/components/Icon';
import { getSite } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Realizacje', description: 'Boty Discord, które zrobiliśmy dla naszych klientów.' };

export default async function WorksPage() {
  const { portfolio } = await getSite();
  return (
    <>
      <PageHero
        kicker="Realizacje"
        title={
          <>
            Boty, które <span className="grad">już działają</span>
          </>
        }
        lead="Wybrane projekty dla serwerów naszych klientów – od systemów ticketów po rozbudowane serwery RP."
      />
      <section className="wrap" style={{ paddingBottom: 40 }}>
        {portfolio.length ? (
          <PortfolioGrid items={portfolio} />
        ) : (
          <div className="card empty">
            <Icon name="package" size={56} />
            <h2>Portfolio w przygotowaniu</h2>
            <p>Wkrótce pokażemy tu nasze realizacje. Chcesz zobaczyć przykłady? Zapytaj w tickecie.</p>
          </div>
        )}
      </section>
      <FinalCta title={<>Twój bot może być <span className="grad">następny</span></>} />
    </>
  );
}
