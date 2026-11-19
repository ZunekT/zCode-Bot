import type { Metadata } from 'next';
import Link from 'next/link';
import { FinalCta, PageHero, PortfolioGrid } from '@/components/site/Sections';
import { EmptyState } from '@/components/ui/EmptyState';
import { byKind, getSite } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Realizacje',
  description: 'Strony internetowe i boty Discord, które zrobiliśmy dla naszych klientów.',
};

const FILTERS = [
  { key: '', label: 'Wszystkie' },
  { key: 'strony', label: 'Strony internetowe' },
  { key: 'boty', label: 'Boty Discord' },
] as const;

export default async function WorksPage({ searchParams }: { searchParams: Promise<{ typ?: string }> }) {
  const [{ portfolio }, { typ }] = await Promise.all([getSite(), searchParams]);
  const filter = typ === 'strony' || typ === 'boty' ? typ : '';
  const items = filter ? byKind(portfolio, filter === 'strony' ? 'WEBSITE' : 'BOT') : portfolio;
  const count = (k: string) => (k ? byKind(portfolio, k === 'strony' ? 'WEBSITE' : 'BOT').length : portfolio.length);
  return (
    <>
      <PageHero
        kicker="Realizacje"
        title={
          <>
            Projekty, które <span className="grad">już działają</span>
          </>
        }
        lead="Wybrane strony i boty dla naszych klientów – od wizytówek i sklepów po rozbudowane systemy na Discordzie."
      >
        <nav className="filter-pills" aria-label="Rodzaj realizacji">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={f.key ? `/realizacje?typ=${f.key}` : '/realizacje'}
              aria-current={filter === f.key ? 'page' : undefined}
              scroll={false}
            >
              {f.label} <span>{count(f.key)}</span>
            </Link>
          ))}
        </nav>
      </PageHero>
      <section className="wrap" style={{ paddingBottom: 40 }}>
        <div key={filter} className="tab-in">
          {items.length ? (
            <PortfolioGrid items={items} />
          ) : (
            <EmptyState
              icon={filter === 'boty' ? 'bot' : 'laptop'}
              title="Portfolio w przygotowaniu"
              text="Wkrótce pokażemy tu kolejne realizacje. Chcesz zobaczyć przykłady? Napisz do nas."
            >
              <Link href="/zamow" className="cta-btn">
                Bezpłatna wycena
              </Link>
            </EmptyState>
          )}
        </div>
      </section>
      <FinalCta
        title={
          <>
            Twój projekt może być <span className="grad">następny</span>
          </>
        }
      />
    </>
  );
}
