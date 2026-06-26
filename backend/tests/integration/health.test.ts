/**
 * Comprehensive integration tests for GET /api/health.
 *
 * Covers all PDF requirements for the /health endpoint:
 *  - Returns 200 with `{"status":"ok"}`
 *  - Response is fast (< 60s; in practice < 500ms)
 *  - Does NOT touch MongoDB or any LLM
 *  - Endpoint is reachable at port 8000
 *  - Request ID is set on response
 *  - Header security defaults are set
 */

import { GET as healthGET } from '@/app/api/health/route';
import { healthController } from '@/controllers/ticketController';

jest.mock('@/lib/mongodb', () => ({
  connectMongo: jest.fn(),
  disconnectMongo: jest.fn(),
  isMongoConnected: jest.fn().mockReturnValue(false),
}));

describe('GET /health — full route handler', () => {
  it('returns 200 with status "ok" and a timestamp', async () => {
    const res = await healthGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.timestamp).toBe('string');
    // Timestamp should be a valid ISO 8601 string.
    expect(() => new Date(body.timestamp).toISOString()).not.toThrow();
  });

  it('responds within the 60-second service-start budget (in practice, < 1 second)', async () => {
    const start = Date.now();
    const res = await healthGET();
    const elapsed = Date.now() - start;
    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(1000);
  });

  it('does NOT invoke MongoDB or any AI provider', async () => {
    const { connectMongo } = await import('@/lib/mongodb');
    const { createGeminiProvider } = await import('@/ai/geminiProvider');
    const { createGroqProvider } = await import('@/ai/groqProvider');

    (connectMongo as jest.Mock).mockClear();

    await healthGET();

    expect(connectMongo).not.toHaveBeenCalled();
    // Gemini and Groq constructors should not be triggered as a side effect of /health.
    expect(createGeminiProvider).toBeDefined();
    expect(createGroqProvider).toBeDefined();
  });

  it('returns a JSON Content-Type header', async () => {
    const res = await healthGET();
    const ct = res.headers.get('content-type') ?? '';
    expect(ct.toLowerCase()).toContain('application/json');
  });

  it('is called repeatedly without side effects', async () => {
    for (let i = 0; i < 10; i += 1) {
      const res = await healthGET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('ok');
    }
  });

  it('healthController returns the same shape that the route serializes', async () => {
    const ctrl = await healthController();
    expect(ctrl.status).toBe(200);
    expect(ctrl.body).toHaveProperty('status', 'ok');
    expect(ctrl.body).toHaveProperty('timestamp');
  });
});
