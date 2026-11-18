import 'server-only';
import { env } from './env';

export interface SiteData {
  stats: {
    ordersCompleted: number;
    clients: number;
    rating: number | null;
    reviews: number;
    members: number | null;
    botsMonitored: number;
    uptime: number | null;
  };
  packages: { id: number; name: string; description: string; price: number; features: string[] }[];
  addons: { id: number; label: string; description: string | null; price: number }[];
  portfolio: { id: number; title: string; description: string; technologies: string[]; url: string | null; images: number[] }[];
  reviews: { id: number; rating: number; content: string; createdAt: string; author: string; avatar: string | null }[];
  faq: { id: number; question: string; answer: string }[];
}

const EMPTY: SiteData = {
  stats: { ordersCompleted: 0, clients: 0, rating: null, reviews: 0, members: null, botsMonitored: 0, uptime: null },
  packages: [],
  addons: [],
  portfolio: [],
  reviews: [],
  faq: [],
};

export async function getSite(): Promise<SiteData> {
  try {
    const res = await fetch(`${env.internalUrl}/internal/public/site`, {
      headers: { 'x-internal-secret': env.internalSecret },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000),
    });
    return res.ok ? ((await res.json()) as SiteData) : EMPTY;
  } catch {
    return EMPTY;
  }
}
