import { Hero } from '@/components/site/Hero';
import {
  FinalCta,
  PanelShowcase,
  PortfolioPreview,
  Process,
  ReviewsPreview,
  Services,
  Stats,
  TechStrip,
} from '@/components/site/Sections';
import { getSite } from '@/lib/site';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const data = await getSite();
  const avatars = data.reviews
    .map((r) => r.avatar)
    .filter((a): a is string => !!a && /^https:\/\/cdn\.discordapp\.com\//.test(a));

  return (
    <>
      <Hero rating={data.stats.rating} reviews={data.stats.reviews} avatars={avatars} />
      <TechStrip />
      <Stats stats={data.stats} />
      <Services />
      <Process />
      <PortfolioPreview items={data.portfolio} />
      <PanelShowcase />
      <ReviewsPreview reviews={data.reviews} />
      <FinalCta />
    </>
  );
}
