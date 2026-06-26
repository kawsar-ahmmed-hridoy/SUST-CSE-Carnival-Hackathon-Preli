/**
 * Security headers middleware.
 *
 * Adds OWASP-recommended security headers to every response:
 *   - Strict-Transport-Security (HSTS)
 *   - X-Content-Type-Options
 *   - X-Frame-Options
 *   - Referrer-Policy
 *   - Content-Security-Policy
 *   - Permissions-Policy
 *   - X-DNS-Prefetch-Control
 *   - X-Permitted-Cross-Domain-Policies
 *
 * These run alongside Helmet for defense-in-depth and to ensure they are
 * always present even if the deployment proxy strips Helmet's defaults.
 */

const SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy':
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  'Permissions-Policy': 'geolocation=(), camera=(), microphone=(), payment=()',
  'X-DNS-Prefetch-Control': 'off',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

export function applySecurityHeaders<T extends Response>(res: T): T {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    // Only set if the response hasn't already set it.
    if (!res.headers.has(k)) res.headers.set(k, v);
  }
  return res;
}
