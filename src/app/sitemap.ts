import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site-url';
import { getOpenEvents } from '@/lib/data/events';

/**
 * What search engines should know about.
 *
 * The event pages are included because they are the ones people search for
 * — "Chabad Arugam Bay Shabbat" lands on a registration form or nowhere.
 * Tracking pages (/r, /order) are deliberately absent: they are private to
 * one customer and carry a token.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();

  const fixed: { path: string; priority: number; freq: MetadataRoute.Sitemap[0]['changeFrequency'] }[] = [
    { path: '/', priority: 1, freq: 'weekly' },
    { path: '/shabbat', priority: 0.9, freq: 'weekly' },
    { path: '/menu', priority: 0.9, freq: 'weekly' },
    { path: '/zmanim', priority: 0.8, freq: 'daily' },
    { path: '/kosher', priority: 0.8, freq: 'weekly' },
    { path: '/travel', priority: 0.7, freq: 'monthly' },
    { path: '/whats-on', priority: 0.7, freq: 'weekly' },
    { path: '/about', priority: 0.6, freq: 'monthly' },
    { path: '/gallery', priority: 0.5, freq: 'monthly' },
    { path: '/articles', priority: 0.5, freq: 'monthly' },
    { path: '/ask', priority: 0.5, freq: 'monthly' },
    { path: '/donate', priority: 0.4, freq: 'yearly' },
  ];

  const pages: MetadataRoute.Sitemap = fixed.map((f) => ({
    url: `${base}${f.path}`,
    lastModified: new Date(),
    changeFrequency: f.freq,
    priority: f.priority,
  }));

  // A missing table or an unrun migration must not take the sitemap down;
  // an empty one is a far smaller problem than a 500 on a crawler's visit.
  try {
    const events = await getOpenEvents();
    for (const e of events) {
      if (!e.isListed) continue;
      pages.push({
        url: `${base}/f/${e.slug}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }
  } catch {
    // Nothing to add.
  }

  return pages;
}
