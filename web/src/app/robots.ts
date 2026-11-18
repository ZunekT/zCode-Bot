import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const site = (process.env.SITE_URL ?? 'https://zxcode.pl').replace(/\/$/, '');
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/panel', '/admin', '/api/', '/logowanie', '/wkrotce'] },
    sitemap: `${site}/sitemap.xml`,
  };
}
