import type { MetadataRoute } from 'next';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lancenest.com').replace(/\/$/, '');
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/dashboard', '/admin', '/employer', '/messages', '/settings', '/api', '/network', '/people', '/freelance', '/jobs', '/transition', '/training', '/notifications', '/veterans'] }],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
