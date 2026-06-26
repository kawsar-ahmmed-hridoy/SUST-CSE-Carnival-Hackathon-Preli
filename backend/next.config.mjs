/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Next.js 15 moved `serverComponentsExternalPackages` out of `experimental`
  // and renamed it `serverExternalPackages` at the top level. Using the old
  // key triggers a warning AND — on some webpack versions — a silent module
  // resolution failure for native modules like `mongoose` and `pino`.
  serverExternalPackages: ['mongoose', 'pino', '@google/generative-ai', 'groq-sdk'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;