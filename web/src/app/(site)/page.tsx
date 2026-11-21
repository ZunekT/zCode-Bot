import { Hero } from '@/components/site/Hero';
import { getContent } from '@/lib/content';
import { getSite } from '@/lib/site';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [data, content] = await Promise.all([getSite(), getContent()]);
  return <Hero data={data} c={content.glowna} />;
}
