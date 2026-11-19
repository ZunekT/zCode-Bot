import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const site = (process.env.SITE_URL ?? 'https://zxcode.pl').replace(/\/$/, '');
  return [
    '',
    '/strony-internetowe',
    '/boty-discord',
    '/realizacje',
    '/cennik',
    '/zamow',
    '/zamow/strona',
    '/opinie',
    '/faq',
    '/regulamin',
    '/polityka-prywatnosci',
    '/cookies',
  ].map((p) => ({
    url: `${site}${p}`,
    changeFrequency: 'weekly',
    priority: p === '' ? 1 : 0.6,
  }));
}
