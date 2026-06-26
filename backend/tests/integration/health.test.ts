/**
 * Integration tests for GET /health.
 * Uses a fetch stub to avoid actually starting a server in unit tests.
 */

describe('health endpoint contract', () => {
  it('returns the expected response shape from the controller', async () => {
    const { healthController } = await import('@/controllers/ticketController');
    const r = await healthController();
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('ok');
    expect(typeof r.body.timestamp).toBe('string');
  });
});