import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, 'src');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Next.js 15 moved `serverComponentsExternalPackages` out of `experimental`
  // and renamed it `serverExternalPackages` at the top level.
  serverExternalPackages: ['mongoose', 'pino', '@google/generative-ai', 'groq-sdk'],
  // Belt-and-suspenders: re-declare the `@/*` path alias for webpack. The
  // tsconfig.json paths map is consumed by tsc / ts-jest, but the Next.js
  // production webpack pass on a fresh container (e.g. Render) occasionally
  // fails to read it, especially for files outside `src/app/`. Adding the
  // alias here ensures consistent module resolution.
  webpack(config) {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': SRC_DIR,
    };
    return config;
  },
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