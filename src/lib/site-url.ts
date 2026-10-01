/**
 * The site's own address.
 *
 * Needed for absolute URLs in metadata: a share card, a sitemap entry and
 * an Open Graph image all have to be absolute, and a relative one silently
 * produces no preview at all rather than an error.
 *
 * Vercel sets VERCEL_PROJECT_PRODUCTION_URL on every deployment, which is
 * the stable production host rather than the per-deploy one — a preview
 * build must not advertise its own throwaway URL as canonical.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;

  return 'http://localhost:3000';
}
