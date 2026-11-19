import { Hero } from '@/components/site/Hero';
import { getSite } from '@/lib/site';

export const dynamic = 'force-dynamic';

export default async function Home() {
  return <Hero data={await getSite()} />;
}
