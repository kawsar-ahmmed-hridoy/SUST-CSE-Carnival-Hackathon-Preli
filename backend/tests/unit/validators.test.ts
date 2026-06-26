import { ticketRequestSchema } from '@/validators/ticketRequest.schema';

describe('ticketRequestSchema', () => {
  it('accepts a minimal valid request', () => {
    const r = ticketRequestSchema.safeParse({
      ticket_id: 'TKT-1',
      complaint: 'I sent money to the wrong number.',
    });
    expect(r.success).toBe(true);
  });

  it('rejects when ticket_id is missing', () => {
    const r = ticketRequestSchema.safeParse({ complaint: 'Hi' });
    expect(r.success).toBe(false);
  });

  it('rejects when complaint is empty', () => {
    const r = ticketRequestSchema.safeParse({ ticket_id: 'TKT-1', complaint: '' });
    expect(r.success).toBe(false);
  });

  it('rejects when transaction_history has too many entries', () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
      transaction_id: `TXN-${i}`,
      timestamp: '2026-04-14T14:08:22Z',
      type: 'transfer',
      amount: 100,
      counterparty: '+8801700000000',
      status: 'completed',
    }));
    const r = ticketRequestSchema.safeParse({
      ticket_id: 'TKT-1',
      complaint: 'Help me.',
      transaction_history: history,
    });
    expect(r.success).toBe(false);
  });

  it('rejects invalid transaction type', () => {
    const r = ticketRequestSchema.safeParse({
      ticket_id: 'TKT-1',
      complaint: 'Help.',
      transaction_history: [
        {
          transaction_id: 'TXN-1',
          timestamp: '2026-04-14T14:08:22Z',
          type: 'invalid_type',
          amount: 100,
          counterparty: '+8801700000000',
          status: 'completed',
        },
      ],
    });
    expect(r.success).toBe(false);
  });

  it('rejects negative amounts', () => {
    const r = ticketRequestSchema.safeParse({
      ticket_id: 'TKT-1',
      complaint: 'Help.',
      transaction_history: [
        {
          transaction_id: 'TXN-1',
          timestamp: '2026-04-14T14:08:22Z',
          type: 'transfer',
          amount: -50,
          counterparty: '+8801700000000',
          status: 'completed',
        },
      ],
    });
    expect(r.success).toBe(false);
  });
});