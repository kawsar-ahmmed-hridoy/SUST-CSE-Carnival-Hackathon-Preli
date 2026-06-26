/**
 * Integration tests for POST /analyze-ticket (controller-level).
 * Mocks MongoDB so the test does not need a running database.
 */

import { analyzeTicketController } from '@/controllers/ticketController';
import { connectMongo } from '@/lib/mongodb';
import { disconnectMongo } from '@/lib/mongodb';

// Mock the MongoDB connection so we don't require a running database.
jest.mock('@/lib/mongodb', () => ({
  connectMongo: jest.fn().mockResolvedValue(undefined),
  disconnectMongo: jest.fn().mockResolvedValue(undefined),
  isMongoConnected: jest.fn().mockReturnValue(false),
}));

// Mock the audit service so it doesn't actually write to Mongo.
jest.mock('@/services/auditService', () => ({
  auditTicket: jest.fn().mockResolvedValue(undefined),
}));

function makeRequest(body: unknown, contentType = 'application/json'): Request {
  return new Request('http://localhost:8000/analyze-ticket', {
    method: 'POST',
    headers: { 'content-type': contentType },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /analyze-ticket', () => {
  afterAll(async () => {
    await disconnectMongo();
  });

  it('returns 200 with a complete analysis for a wrong-transfer case', async () => {
    const request = makeRequest({
      ticket_id: 'TKT-100',
      complaint: 'I sent 5000 taka to the wrong number around 2pm.',
      transaction_history: [
        {
          transaction_id: 'TXN-100',
          timestamp: '2026-04-14T14:08:22Z',
          type: 'transfer',
          amount: 5000,
          counterparty: '+8801719876543',
          status: 'completed',
        },
      ],
    });

    const r = await analyzeTicketController(request);
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
    expect(r.body.data.case_type).toBe('wrong_transfer');
    expect(r.body.data.relevant_transaction_id).toBe('TXN-100');
    expect(r.body.data.human_review_required).toBe(true);
  });

  it('returns 400 for malformed JSON', async () => {
    const request = new Request('http://localhost:8000/analyze-ticket', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not valid json',
    });
    await expect(analyzeTicketController(request)).rejects.toThrow();
  });

  it('returns 422 for missing ticket_id', async () => {
    const request = makeRequest({ complaint: 'Help' });
    await expect(analyzeTicketController(request)).rejects.toThrow();
  });

  it('returns 400 when Content-Type is wrong', async () => {
    const request = new Request('http://localhost:8000/analyze-ticket', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'hello',
    });
    await expect(analyzeTicketController(request)).rejects.toThrow(/Content-Type/);
  });
});
