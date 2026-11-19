import type { Metadata } from 'next';
import { QuoteForm } from '@/components/site/QuoteForm';
import { PageHero } from '@/components/site/Sections';

export const metadata: Metadata = {
  title: 'Wycena strony internetowej',
  description: 'Opisz swój projekt w krótkim formularzu – przygotujemy bezpłatną wycenę strony internetowej.',
};

export default async function QuotePage({ searchParams }: { searchParams: Promise<{ pakiet?: string }> }) {
  const { pakiet } = await searchParams;
  const pkg = typeof pakiet === 'string' ? pakiet.replace(/[^\p{L}\p{N} /&.-]/gu, '').slice(0, 40) : undefined;
  return (
    <>
      <PageHero
        kicker="Wycena strony"
        title={
          <>
            Opowiedz nam <span className="grad">o swojej stronie</span>
          </>
        }
        lead="Kilka pytań, dwie minuty. Odezwiemy się z bezpłatną wyceną – bez zobowiązań."
      />
      <section className="wrap" style={{ paddingBottom: 72 }}>
        <QuoteForm pkg={pkg || undefined} />
      </section>
    </>
  );
}
