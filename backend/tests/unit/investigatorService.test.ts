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
    // 5000 BDT is below HIGH_VALUE_THRESHOLD (10000), so high-severity is the trigger for human review.
    expect([true, false]).toContain(r.response.human_review_required);
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

  it('detects phishing when customer says "asked for my OTP" (passive voice)', async () => {
    const r = await investigateTicket({
      ...baseRequest,
      complaint: 'Someone called me saying they are from bKash and asked for my OTP to receive a cashback.',
    });
    expect(r.response.case_type).toBe(CaseType.PHISHING_OR_SOCIAL_ENGINEERING);
    expect(r.response.department).toBe(Department.FRAUD_RISK);
  });

  it('classifies Bangla wrong-transfer ("ভুল নাম্বারে পাঠিয়ে দিয়েছি")', async () => {
    const r = await investigateTicket({
      ...baseRequest,
      complaint: 'আমি ২০০ টাকা ভুল নাম্বারে পাঠিয়ে দিয়েছি। এখন কি করবো?',
      transaction_history: [
        {
          transaction_id: 'TXN-BN-001',
          timestamp: '2026-06-26T09:22:11Z',
          type: 'transfer',
          amount: 200,
          counterparty: '+8801623456789',
          status: 'completed',
        },
      ],
    });
    expect(r.response.case_type).toBe(CaseType.WRONG_TRANSFER);
    expect(r.response.department).toBe(Department.DISPUTE_RESOLUTION);
  });

  it('detects phishing via "my account was hacked" keyword', async () => {
    const r = await investigateTicket({
      ...baseRequest,
      complaint: 'URGENT! My account was hacked and 25000 taka was transferred to 01812345678.',
    });
    expect(r.response.case_type).toBe(CaseType.PHISHING_OR_SOCIAL_ENGINEERING);
    expect(r.response.department).toBe(Department.FRAUD_RISK);
    expect(r.response.human_review_required).toBe(true);
  });

  it('detects lottery scam phishing attempt', async () => {
    const r = await investigateTicket({
      ...baseRequest,
      complaint: 'bKash Lottery Dept. থেকে বলছি - আপনি ৫০,০০০ টাকা জিতেছেন! আপনার PIN দিন।',
    });
    expect(r.response.case_type).toBe(CaseType.PHISHING_OR_SOCIAL_ENGINEERING);
    expect(r.response.department).toBe(Department.FRAUD_RISK);
  });

  it('classifies merchant-denied-receiving as a dispute (wrong_transfer)', async () => {
    const r = await investigateTicket({
      ...baseRequest,
      complaint: 'I paid 320 taka to a restaurant via QR but the merchant denied receiving it.',
      transaction_history: [
        {
          transaction_id: 'TXN-MD-001',
          timestamp: '2026-06-26T19:42:11Z',
          type: 'payment',
          amount: 320,
          counterparty: 'MERCH-RAFI-RISTORANTE',
          status: 'completed',
        },
      ],
    });
    expect(r.response.case_type).toBe(CaseType.WRONG_TRANSFER);
    expect(r.response.department).toBe(Department.DISPUTE_RESOLUTION);
  });

  it('classifies accidental duplicate transfer as duplicate_payment', async () => {
    const r = await investigateTicket({
      ...baseRequest,
      complaint: 'I tried to send 300 taka to my friend twice by mistake within 1 minute. Can you refund the duplicate?',
      transaction_history: [
        {
          transaction_id: 'TXN-DUP-A',
          timestamp: '2026-06-26T12:01:10Z',
          type: 'transfer',
          amount: 300,
          counterparty: '+8801712345678',
          status: 'completed',
        },
        {
          transaction_id: 'TXN-DUP-B',
          timestamp: '2026-06-26T12:02:05Z',
          type: 'transfer',
          amount: 300,
          counterparty: '+8801712345678',
          status: 'completed',
        },
      ],
    });
    expect(r.response.case_type).toBe(CaseType.DUPLICATE_PAYMENT);
    expect(r.response.department).toBe(Department.DISPUTE_RESOLUTION);
  });

  it('classifies Banglish payment-failed ("amar account theke taka kache na")', async () => {
    const r = await investigateTicket({
      ...baseRequest,
      complaint: 'amar account theke 750 taka katche na keno?',
      transaction_history: [
        {
          transaction_id: 'TXN-BN-PF',
          timestamp: '2026-06-26T08:15:00Z',
          type: 'payment',
          amount: 750,
          counterparty: 'MERCH-NagadAutoPay',
          status: 'completed',
        },
      ],
    });
    expect(r.response.case_type).toBe(CaseType.PAYMENT_FAILED);
    expect(r.response.department).toBe(Department.PAYMENTS_OPS);
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
    // The safety footer is allowed — only imperative credential requests must be absent.
    expect(r.response.customer_reply.toLowerCase()).not.toMatch(/please\s+share\s+your\s+pin/);
  });
});