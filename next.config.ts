import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * Allow the dev server to be opened from other devices on the LAN — testing
   * the RTL layout and the kitchen screens on a real phone and tablet is not
   * optional for this product. Dev only; has no effect on a build.
   */
  allowedDevOrigins: ['192.168.1.12', '*.local'],

  images: {
    remotePatterns: [
      // Supabase Storage serves the dish photos.
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
    ],
  },
};

export default nextConfig;
