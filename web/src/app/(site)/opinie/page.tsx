import type { Metadata } from 'next';
import { Icon } from '@/components/Icon';
import { Stars } from '@/components/site/primitives';
import { FinalCta, PageHero, ReviewsGrid } from '@/components/site/Sections';
import { getSite } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Opinie', description: 'Opinie klientów zxCode o botach Discord i współpracy.' };

export default async function ReviewsPage() {
  const { reviews, stats } = await getSite();
  return (
    <>
      <PageHero
        kicker="Opinie"
        title={
          <>
            Co mówią <span className="grad">nasi klienci</span>
          </>
        }
        lead="Opinie wystawiane po zakończonych zleceniach. Publikujemy je po weryfikacji, że pochodzą od prawdziwych klientów."
      >
        {stats.rating !== null && stats.reviews > 0 && (
          <div className="rating-summary">
            <b>{stats.rating.toLocaleString('pl-PL', { maximumFractionDigits: 1 })}</b>
            <div style={{ textAlign: 'left' }}>
              <Stars n={Math.round(stats.rating)} size={17} />
              <div className="muted small">średnia z {stats.reviews} opinii</div>
            </div>
          </div>
        )}
      </PageHero>
      <section className="wrap" style={{ paddingBottom: 40 }}>
        {reviews.length ? (
          <ReviewsGrid reviews={reviews} />
        ) : (
          <div className="card empty">
            <Icon name="star" size={56} />
            <h2>Jeszcze brak opinii</h2>
            <p>Pierwsze opinie pojawią się tu po zakończonych zleceniach.</p>
          </div>
        )}
      </section>
      <FinalCta />
    </>
  );
}
