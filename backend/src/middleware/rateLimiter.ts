/**
 * Rate limiter middleware.
 *
 * In-memory store by default — fine for a single instance. For multi-instance
 * production deploys, swap the store for rate-limit-redis.
 *
 * Exposes a Next.js-friendly wrapper (`checkRateLimit`) that can be called
 * directly from route handlers without depending on express types.
 */

import rateLimit from 'express-rate-limit';
import { NextRequest } from 'next/server';
import config from '@/config';
import { errorResponse } from '@/utils/responseBuilder';
import { RateLimitError } from '@/utils/errors';

const windowMs = config.rateLimit.windowMs;
const max = config.rateLimit.maxRequests;

const baseLimiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Trust x-forwarded-for if behind a load balancer; fall back to socket address.
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0].trim();
    const ip = (req as { ip?: string }).ip;
    if (ip) return ip;
    const sock = (req as { socket?: { remoteAddress?: string } }).socket;
    if (sock?.remoteAddress) return sock.remoteAddress;
    return 'unknown';
  },
  handler: (_req, res) => {
    const err = new RateLimitError('Too many requests — please try again later');
    res.status(err.statusCode).json(errorResponse(err.message, err.statusCode, err.code));
  },
  skip: (req) => {
    const path = (req as { path?: string }).path ?? '';
    return path === '/health' || path === '/api/health';
  },
});

/**
 * Next.js-friendly wrapper. Returns null if allowed, or a 429 NextResponse
 * if the rate limit has been exceeded.
 */
export async function checkRateLimit(req: NextRequest): Promise<Response | null> {
  return new Promise<Response | null>((resolve) => {
    const fakeRes = {
      statusCode: 200,
      headersSent: false,
      headers: {} as Record<string, string>,
      body: undefined as unknown,
      status(code: number) {
        (fakeRes as { statusCode: number }).statusCode = code;
        return fakeRes;
      },
      setHeader(k: string, v: string) {
        fakeRes.headers[k] = v;
        return fakeRes;
      },
      getHeader(k: string) {
        return fakeRes.headers[k];
      },
      json(body: unknown) {
        (fakeRes as { body: unknown }).body = body;
        return fakeRes;
      },
      end() {
        return fakeRes;
      },
      on: () => fakeRes,
      once: () => fakeRes,
      emit: () => false,
    };
    const next = (err?: unknown) => {
      if (err) {
        const status = fakeRes.statusCode || 429;
        const body =
          (fakeRes as { body?: unknown }).body ??
          errorResponse('Too many requests', 429, 'RATE_LIMIT_EXCEEDED');
        resolve(
          new Response(JSON.stringify(body), {
            status,
            headers: { 'content-type': 'application/json', ...fakeRes.headers },
          }),
        );
        return;
      }
      resolve(null);
    };
    baseLimiter(
      req as unknown as Parameters<typeof baseLimiter>[0],
      fakeRes as unknown as Parameters<typeof baseLimiter>[1],
      next,
    );
  });
}

/**
 * Reset the in-memory rate-limit store. Used by the test setup to avoid
 * cross-test pollution.
 */
export function resetRateLimitStore(): void {
  const limiter = baseLimiter as unknown as {
    resetKey?: (key: string) => void;
    store?: { resetAll?: () => void; resetKey?: (key: string) => void };
  };
  if (limiter.resetKey) limiter.resetKey('unknown');
  if (limiter.store?.resetAll) limiter.store.resetAll();
  if (limiter.store?.resetKey) limiter.store.resetKey('unknown');
}

// Re-export the underlying limiter for advanced use cases.
export const analyzeTicketRateLimiter = baseLimiter;