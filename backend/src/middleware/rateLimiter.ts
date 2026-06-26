/**
 * Rate limiter middleware.
 *
 * In-memory store by default — fine for a single instance. For multi-instance
 * production deploys, swap the store for rate-limit-redis.
 */

import rateLimit from 'express-rate-limit';
import config from '@/config';
import { errorResponse } from '@/utils/responseBuilder';
import { RateLimitError } from '@/utils/errors';

const windowMs = config.rateLimit.windowMs;
const max = config.rateLimit.maxRequests;

export const analyzeTicketRateLimiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Trust x-forwarded-for if behind a load balancer; fall back to socket address.
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0].trim();
    // Express-style request has req.ip; NextRequest has neither — fall through.
    const ip = (req as { ip?: string }).ip;
    if (ip) return ip;
    const sock = (req as { socket?: { remoteAddress?: string } }).socket;
    if (sock?.remoteAddress) return sock.remoteAddress;
    return 'unknown';
  },
  handler: (_req, res) => {
    const err = new RateLimitError('Too many requests — please try again later');
    res.status(err.statusCode).json(
      errorResponse(err.message, err.statusCode, err.code),
    );
  },
  skip: (req) => {
    // /health is exempt — liveness probes from orchestrators should never be rate-limited.
    const path = (req as { path?: string }).path ?? '';
    return path === '/health' || path === '/api/health';
  },
});

export const healthRateLimiter = rateLimit({
  windowMs: 1000,
  max: 30,
  standardHeaders: false,
  legacyHeaders: false,
  skip: () => true,
});
