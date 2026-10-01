import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site-url';

/**
 * Crawlers are welcome on the public side and nowhere else.
 *
 * /admin and /kitchen are behind a login, but a disallow keeps them out of
 * search results entirely rather than relying on a redirect. /r and /order
 * carry a per-customer token — those URLs should never be indexed, and a
 * crawler that followed one from a shared screenshot would publish it.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/kitchen', '/r/', '/order/'],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
