import { investigateTicket } from '@/services/investigatorService';
import { ITicketRequest } from '@/interfaces/ITicketRequest';
import { CaseType, Department, Severity } from '@/constants/enums';

const baseRequest: ITicketRequest = {
  ticket_id: 'TKT-1',
  complaint: 'I sent 5000 taka to a wrong number around 2pm today.',
  language: 'en',
  channel: 'in_app_chat',
  user_type: 'customer',
};

describe('investigatorService (rule-based fallback path)', () => {
  it('classifies a wrong transfer with a matching transaction', async () => {
    const r = await investigateTicket({
      ...baseRequest,
      transaction_history: [
        {
          transaction_id: 'TXN-9101',
          timestamp: '2026-04-14T14:08:22Z',
          type: 'transfer',
          amount: 5000,
          counterparty: '+8801719876543',
          status: 'completed',
        },
      ],
    });
    expect(r.response.case_type).toBe(CaseType.WRONG_TRANSFER);
    expect(r.response.relevant_transaction_id).toBe('TXN-9101');
    expect(r.response.department).toBe(Department.DISPUTE_RESOLUTION);
    expect(r.response.human_review_required).toBe(true);
    expect(r.response.customer_reply.length).toBeGreaterThan(20);
  });

  it('routes phishing complaints to fraud_risk', async () => {
    const r = await investigateTicket({
      ...baseRequest,
      complaint: 'A fake agent called and asked me to share my OTP.',
    });
    expect(r.response.case_type).toBe(CaseType.PHISHING_OR_SOCIAL_ENGINEERING);
    expect(r.response.department).toBe(Department.FRAUD_RISK);
    expect(r.response.human_review_required).toBe(true);
  });

  it('returns insufficient_data when no transaction history is provided', async () => {
    const r = await investigateTicket({
      ...baseRequest,
      complaint: 'Something went wrong with my payment.',
    });
    expect(r.response.evidence_verdict).toBe('insufficient_data');
    expect(r.response.relevant_transaction_id).toBeNull();
  });

  it('flags high-value transactions for human review', async () => {
    const r = await investigateTicket({
      ...baseRequest,
      complaint: 'I sent 15000 taka to the wrong person.',
      transaction_history: [
        {
          transaction_id: 'TXN-HV',
          timestamp: '2026-04-14T14:08:22Z',
          type: 'transfer',
          amount: 15000,
          counterparty: '+8801719876543',
          status: 'completed',
        },
      ],
    });
    expect(r.response.human_review_required).toBe(true);
    expect([Severity.HIGH, Severity.CRITICAL]).toContain(r.response.severity);
  });

  it('always returns a safe customer reply', async () => {
    const r = await investigateTicket(baseRequest);
    expect(r.response.customer_reply.toLowerCase()).toMatch(/pin|otp|password/);
    expect(r.response.customer_reply.toLowerCase()).not.toMatch(/we will refund/);
    expect(r.response.customer_reply.toLowerCase()).not.toMatch(/share your pin/);
  });
});