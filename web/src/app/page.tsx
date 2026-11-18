import { MotionConfig } from 'motion/react';
import { Icon } from '@/components/Icon';
import { Hero } from '@/components/site/Hero';
import { Nav } from '@/components/site/Nav';
import {
  Faq,
  FinalCta,
  Footer,
  PanelShowcase,
  Portfolio,
  Pricing,
  Process,
  Reviews,
  Services,
  Stats,
  TechStrip,
} from '@/components/site/Sections';
import '@/components/site/site.css';
import { env } from '@/lib/env';
import { getSession } from '@/lib/session';
import { getSite, type SiteData } from '@/lib/site';

export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  anulowano: 'Logowanie zostało anulowane.',
  sesja: 'Sesja logowania wygasła. Spróbuj jeszcze raz.',
  discord: 'Discord nie potwierdził logowania. Spróbuj jeszcze raz.',
};

const EMPTY: SiteData = {
  stats: { ordersCompleted: 0, clients: 0, rating: null, reviews: 0, members: null, botsMonitored: 0, uptime: null },
  packages: [],
  addons: [],
  portfolio: [],
  reviews: [],
  faq: [],
};

export default async function Home({ searchParams }: { searchParams: Promise<{ blad?: string }> }) {
  const [session, { blad }, site] = await Promise.all([getSession(), searchParams, getSite()]);
  const data = site ?? EMPTY;
  // Zamówienie: zaproszenie na serwer Discord, a bez niego – logowanie (panel).
  const orderUrl = env.discordInvite ?? '/api/auth/login';
  const avatars = data.reviews
    .map((r) => r.avatar)
    .filter((a): a is string => !!a && /^https:\/\/cdn\.discordapp\.com\//.test(a));
  const sections = ['uslugi', 'proces', data.portfolio.length ? 'realizacje' : '', 'cennik', 'panel', 'faq'].filter(Boolean);

  return (
    <MotionConfig reducedMotion="user">
      <div className="site">
        <Nav loggedIn={!!session} orderUrl={orderUrl} sections={sections} />
        {blad && ERRORS[blad] && (
          <div className="wrap" style={{ position: 'relative', zIndex: 5, paddingTop: 96 }}>
            <div className="notice notice-err">
              <Icon name="shield_x" />
              <p>{ERRORS[blad]}</p>
            </div>
          </div>
        )}
        <main>
          <Hero orderUrl={orderUrl} rating={data.stats.rating} reviews={data.stats.reviews} avatars={avatars} />
          <TechStrip />
          <Stats stats={data.stats} />
          <Services />
          <Process />
          <Portfolio items={data.portfolio} />
          <Pricing packages={data.packages} addons={data.addons} orderUrl={orderUrl} />
          <Reviews reviews={data.reviews} />
          <PanelShowcase />
          <Faq items={data.faq} />
          <FinalCta orderUrl={orderUrl} loggedIn={!!session} />
        </main>
        <Footer orderUrl={orderUrl} />
      </div>
    </MotionConfig>
  );
}
