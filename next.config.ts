import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * Allow the dev server to be opened from other devices on the LAN — testing
   * the RTL layout and the kitchen screens on a real phone and tablet is not
   * optional for this product. Dev only; has no effect on a build.
   */
  allowedDevOrigins: ['192.168.1.12', '*.local'],

  experimental: {
    /**
     * Server actions default to a 1MB body. Every image upload on this site
     * promised 2-10MB and failed silently above one, surfacing only as a
     * redacted React #441. Raised so the framework is not the binding
     * limit — but note Vercel caps a serverless request body at 4.5MB
     * regardless, which is why files now go straight to Storage from the
     * browser with a signed token instead of through an action.
     */
    serverActions: { bodySizeLimit: '12mb' },
  },

  images: {
    remotePatterns: [
      // Supabase Storage serves the dish photos.
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
    ],
  },
};

export default nextConfig;
