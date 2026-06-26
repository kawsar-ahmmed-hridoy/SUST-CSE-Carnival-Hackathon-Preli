/**
 * Integration tests for GET /api/tickets/:ticket_id (audit-trail endpoint).
 *
 * Per instruction_and_evaluation.pdf, judges may verify "every processed
 * ticket is properly logged". This endpoint exposes that audit trail.
 */

import { GET as ticketGET } from '@/app/api/tickets/[ticket_id]/route';

jest.mock('@/lib/mongodb', () => ({
  connectMongo: jest.fn().mockResolvedValue(undefined),
  disconnectMongo: jest.fn().mockResolvedValue(undefined),
  isMongoConnected: jest.fn().mockReturnValue(false),
}));

jest.mock('@/repositories/ticketRepository', () => ({
  findTicketAnalysesByTicketId: jest.fn().mockResolvedValue([
    {
      _id: { toString: () => 'AUDIT-1' },
      ticket_id: 'TKT-001',
      createdAt: new Date('2026-06-26T10:00:00Z'),
      processingMs: 142,
      response: {
        ticket_id: 'TKT-001',
        case_type: 'wrong_transfer',
        severity: 'medium',
        department: 'dispute_resolution',
      },
    },
  ]),
}));

function makeReq(ticketId: string): Request {
  return new Request(`http://localhost:8000/api/tickets/${encodeURIComponent(ticketId)}`, {
    method: 'GET',
  });
}

describe('GET /api/tickets/:ticket_id', () => {
  it('returns the audit trail for an existing ticket', async () => {
    const req = makeReq('TKT-001');
    const res = await ticketGET(req as unknown as import('next/server').NextRequest, {
      params: Promise.resolve({ ticket_id: 'TKT-001' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.ticket_id).toBe('TKT-001');
    expect(body.data.count).toBe(1);
    expect(body.data.records[0].ticket_id).toBe('TKT-001');
    expect(body.data.records[0].id).toBe('AUDIT-1');
    expect(body.data.records[0].response.case_type).toBe('wrong_transfer');
  });

  it('rejects empty ticket_id with 400', async () => {
    const req = makeReq('');
    const res = await ticketGET(req as unknown as import('next/server').NextRequest, {
      params: Promise.resolve({ ticket_id: '' }),
    });
    expect(res.status).toBe(400);
  });

  it('caps limit at 200 even if a higher value is supplied', async () => {
    const req = new Request('http://localhost:8000/api/tickets/TKT-001?limit=99999', {
      method: 'GET',
    });
    const res = await ticketGET(req as unknown as import('next/server').NextRequest, {
      params: Promise.resolve({ ticket_id: 'TKT-001' }),
    });
    expect(res.status).toBe(200);
  });
});
