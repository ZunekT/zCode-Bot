import { Hero } from '@/components/site/Hero';
import {
  ClientPanelShowcase,
  FinalCta,
  PortfolioPreview,
  Process,
  ReviewsPreview,
  ServicesSplit,
  Stats,
  TechStrip,
  WhyUs,
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
      <ServicesSplit packages={data.packages} />
      <WhyUs />
      <Process />
      <PortfolioPreview items={data.portfolio} />
      <ClientPanelShowcase />
      <ReviewsPreview reviews={data.reviews} />
      <FinalCta />
    </>
  );
}
