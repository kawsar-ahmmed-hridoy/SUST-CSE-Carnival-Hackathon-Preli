/**
 * Integration tests for POST /api/analyze-ticket-batch (bonus endpoint).
 *
 * Per instruction_and_evaluation.pdf:
 *   - Accepts a batch (max 100 tickets)
 *   - Bounded concurrency
 *   - Per-item failure isolation (a single bad ticket must not crash the batch)
 *   - Returns success_count, failure_count, and full results array
 */

import { POST as batchPOST } from '@/app/api/analyze-ticket-batch/route';

jest.mock('@/lib/mongodb', () => ({
  connectMongo: jest.fn().mockResolvedValue(undefined),
  disconnectMongo: jest.fn().mockResolvedValue(undefined),
  isMongoConnected: jest.fn().mockReturnValue(false),
}));

jest.mock('@/services/auditService', () => ({
  auditTicket: jest.fn().mockResolvedValue(undefined),
}));

function makeBatchRequest(tickets: unknown[]): Request {
  return new Request('http://localhost:8000/api/analyze-ticket-batch', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tickets }),
  });
}

function baselineTicket(suffix: string): Record<string, unknown> {
  return {
    ticket_id: `TKT-BATCH-${suffix}`,
    complaint: 'I sent 500 taka to a wrong number around 2pm today.',
    language: 'en',
    channel: 'in_app_chat',
    user_type: 'customer',
    transaction_history: [
      {
        transaction_id: `TXN-BATCH-${suffix}`,
        timestamp: '2026-06-26T14:08:22Z',
        type: 'transfer',
        amount: 500,
        counterparty: '+8801719876543',
        status: 'completed',
      },
    ],
  };
}

describe('POST /analyze-ticket-batch', () => {
  it('processes a small batch and reports success/failure counts', async () => {
    const req = makeBatchRequest([baselineTicket('A'), baselineTicket('B'), baselineTicket('C')]);
    const res = await batchPOST(req as unknown as import('next/server').NextRequest);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.count).toBe(3);
    expect(body.data.success_count).toBe(3);
    expect(body.data.failure_count).toBe(0);
    expect(body.data.results).toHaveLength(3);
    expect(body.data.results[0].index).toBe(0);
    expect(body.data.results[0].ok).toBe(true);
    expect(body.data.results[0].result).toBeDefined();
    expect(body.data.results[0].result.ticket_id).toBe('TKT-BATCH-A');
  });

  it('isolates per-item failures — bad tickets do not poison the batch', async () => {
    const tickets = [
      baselineTicket('OK1'),
      { ...baselineTicket('BAD'), ticket_id: 12345 }, // wrong type
      baselineTicket('OK2'),
    ];
    const req = makeBatchRequest(tickets);
    const res = await batchPOST(req as unknown as import('next/server').NextRequest);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.count).toBe(3);
    expect(body.data.success_count).toBe(2);
    expect(body.data.failure_count).toBe(1);
    const bad = body.data.results.find((r: { index: number }) => r.index === 1);
    expect(bad.ok).toBe(false);
    expect(bad.error).toBeDefined();
    expect(bad.error.code).toBeDefined();
  });

  it('rejects empty batches with 400', async () => {
    const req = makeBatchRequest([]);
    const res = await batchPOST(req as unknown as import('next/server').NextRequest);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('VALIDATION_FAILED');
  });

  it('rejects batches exceeding 100 tickets with 400', async () => {
    const tickets = Array.from({ length: 101 }, (_, i) => baselineTicket(`X${i}`));
    const req = makeBatchRequest(tickets);
    const res = await batchPOST(req as unknown as import('next/server').NextRequest);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('returns 400 on malformed JSON body', async () => {
    const req = new Request('http://localhost:8000/api/analyze-ticket-batch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json{',
    });
    const res = await batchPOST(req as unknown as import('next/server').NextRequest);
    // Either 400 from validation or 500 from JSON parse — must not be 200.
    expect([400, 500]).toContain(res.status);
  });

  it('preserves result order matching input order', async () => {
    const tickets = [
      { ...baselineTicket('ORD-1'), ticket_id: 'ORDER-A' },
      { ...baselineTicket('ORD-2'), ticket_id: 'ORDER-B' },
      { ...baselineTicket('ORD-3'), ticket_id: 'ORDER-C' },
    ];
    const req = makeBatchRequest(tickets);
    const res = await batchPOST(req as unknown as import('next/server').NextRequest);
    const body = await res.json();
    const ids = body.data.results.map((r: { result: { ticket_id: string } }) => r.result.ticket_id);
    expect(ids).toEqual(['ORDER-A', 'ORDER-B', 'ORDER-C']);
  });
});
