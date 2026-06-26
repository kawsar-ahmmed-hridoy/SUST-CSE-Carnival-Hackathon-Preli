/**
 * Jest setup file. Loaded before each test file.
 */

// Silence Pino during tests — keeps output clean. Set to 'error' to debug.
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';

// Increase rate limit headroom for tests so a single test file running 80+
// requests from the same IP does not hit the 100/min cap.
process.env.RATE_LIMIT_MAX_REQUESTS = process.env.RATE_LIMIT_MAX_REQUESTS || '10000';

// Reset the rate limiter's in-memory store between tests so concurrent and
// repeat-request tests do not interfere with each other.
import { analyzeTicketRateLimiter } from '../src/middleware/rateLimiter';

beforeEach(() => {
  // express-rate-limit exposes resetKey() and has an internal store.
  const limiter = analyzeTicketRateLimiter as unknown as {
    resetKey?: (key: string) => void;
    store?: { resetAll?: () => void; resetKey?: (key: string) => void };
  };
  if (limiter.resetKey) limiter.resetKey('unknown');
  if (limiter.store?.resetAll) limiter.store.resetAll();
  if (limiter.store?.resetKey) limiter.store.resetKey('unknown');
});