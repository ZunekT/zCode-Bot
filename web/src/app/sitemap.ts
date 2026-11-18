import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const site = (process.env.SITE_URL ?? 'https://zxcode.pl').replace(/\/$/, '');
  return ['', '/realizacje', '/opinie', '/cennik', '/faq', '/regulamin', '/polityka-prywatnosci', '/cookies'].map((p) => ({
    url: `${site}${p}`,
    changeFrequency: 'weekly',
    priority: p === '' ? 1 : 0.6,
  }));
}
