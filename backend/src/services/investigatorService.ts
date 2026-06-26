/**
 * Investigator service — the brain of the application.
 *
 * Pipeline:
 *   1. Detect prompt injection / phishing on the complaint.
 *   2. Match a transaction from history (rule-based).
 *   3. Decide preliminary case_type / severity / department (rule-based).
 *   4. Ask the AI provider for narrative fields (agent_summary, reply, etc.).
 *   5. Sanitize AI output through safetyService.
 *   6. Enforce escalation rules (phishing → fraud_risk; high-value → human review).
 *   7. Return final ticket response.
 */

import { ITicketRequest } from '@/interfaces/ITicketRequest';
import { ITicketResponse } from '@/interfaces/ITicketResponse';
import { ITransaction } from '@/interfaces/ITransaction';
import {
  CaseType,
  Department,
  EvidenceVerdict,
  Severity,
} from '@/constants/enums';
import {
  HIGH_VALUE_THRESHOLD_BDT,
  LOW_VALUE_THRESHOLD_BDT,
  LLM_DEFAULT_CONFIDENCE,
  RULE_BASED_DEFAULT_CONFIDENCE,
  TXN_AMOUNT_TOLERANCE_PCT,
} from '@/config/constants';
import { ReasonCodes } from '@/constants/safetyPatterns';
import { runInvestigation } from '@/ai/aiServiceFactory';
import {
  detectPhishing,
  detectPromptInjection,
  sanitizeOutput,
} from '@/services/safetyService';
import logger from '@/utils/logger';

// -----------------------------------------------------------------------------
// Step 1+2: Transaction matching (rule-based)
// -----------------------------------------------------------------------------

function extractAmountsFromComplaint(text: string): number[] {
  const matches: number[] = [];
  const regex = /(?:taka|tk|৳|bdt|rs|inr|\$)?\s*(\d{2,7}(?:[.,]\d+)?)/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    const raw = m[1].replace(/,/g, '');
    const n = Number.parseFloat(raw);
    if (!Number.isNaN(n) && n >= 1 && n <= 1000000) matches.push(n);
  }
  return matches;
}

function extractCounterpartyFromComplaint(text: string): string | null {
  // Match Bangladeshi phone numbers with optional +88.
  const phone = text.match(/(?:\+?88)?01[3-9]\d{8}/);
  if (phone) return phone[0];
  return null;
}

function amountsMatch(a: number, b: number, tolerancePct = TXN_AMOUNT_TOLERANCE_PCT): boolean {
  if (a === 0 || b === 0) return false;
  const diff = Math.abs(a - b);
  const avg = (a + b) / 2;
  return diff / avg <= tolerancePct;
}

interface IMatchResult {
  transaction: ITransaction | null;
  confidence: number;
}

function matchTransaction(request: ITicketRequest): IMatchResult {
  const history = request.transaction_history ?? [];
  if (history.length === 0) {
    return { transaction: null, confidence: 0 };
  }

  const amounts = extractAmountsFromComplaint(request.complaint);
  const counterparty = extractCounterpartyFromComplaint(request.complaint);

  // Score each entry.
  let best: { transaction: ITransaction; score: number } | null = null;
  for (const txn of history) {
    let score = 0;
    if (amounts.length > 0 && amounts.some((a) => amountsMatch(a, txn.amount))) score += 0.5;
    if (counterparty && counterparty === txn.counterparty) score += 0.4;
    if (txn.status === 'completed' || txn.status === 'pending') score += 0.05;
    if (amounts.length === 0 && !counterparty) score += 0.1; // vague complaint
    if (score > 0 && (best === null || score > best.score)) {
      best = { transaction: txn, score };
    }
  }
  if (!best) return { transaction: null, confidence: 0 };
  return { transaction: best.transaction, confidence: Math.min(1, best.score) };
}

// -----------------------------------------------------------------------------
// Step 3: Preliminary classification
// -----------------------------------------------------------------------------

function classifyCaseType(request: ITicketRequest, match: IMatchResult): CaseType {
  const text = request.complaint.toLowerCase();

  // Phishing / social-engineering wins — it's the highest priority signal.
  if (!detectPhishing(request.complaint).isSafe) {
    return CaseType.PHISHING_OR_SOCIAL_ENGINEERING;
  }

  // Wrong transfer signals. Check AFTER duplicate because "by mistake twice"
// contains both signals and duplicate is more specific.
  if (/\b(wrong|incorrect)\s+(number|recipient|account)\b/i.test(request.complaint)) {
    return CaseType.WRONG_TRANSFER;
  }
  if (
    /\b(wrong|incorrect|mistake|mistakenly|accidentally|by\s+mistake)\b/i.test(request.complaint) &&
    /\b(send|sent|transfer|transferred|number|recipient|account|person)\b/i.test(request.complaint) &&
    !/\b(twice|two\s+times|duplicate|charged\s+twice|double\s+(?:charge|payment))\b/i.test(request.complaint)
  ) {
    return CaseType.WRONG_TRANSFER;
  }
  // Bangla / Banglish wrong-transfer signals.
  if (/(ভুল|ভুলভাবে|ভুলে)/.test(request.complaint) && /(পাঠি|পাঠিয়ে|নাম্বার|নাম্বারে|নম্বর)/.test(request.complaint)) {
    return CaseType.WRONG_TRANSFER;
  }
  if (/\b(wrong|vul)\b.*\b(number|numbere|number.e)\b/i.test(request.complaint)) {
    return CaseType.WRONG_TRANSFER;
  }

  // Merchant settlement — must come before payment_failed because a complaint
  // like "My merchant settlement was not received" contains "not received".
  if (
    /\b(merchant|seller|vendor)\b.*\b(settlement|payout|paid\s+me)\b/i.test(text) ||
    /\bsettlement\s+(?:not\s+received|delay|pending)\b/i.test(text)
  ) {
    return CaseType.MERCHANT_SETTLEMENT_DELAY;
  }

  // Merchant dispute — "merchant denied receiving" or "claimed didn't get it"
  // indicates a payment-vs-merchant dispute, route to dispute_resolution.
  if (/\b(merchant|seller|restaurant|shop|store)\s+(?:denied|denies|denying|claimed|said\s+(?:he|she|they)\s+didn['\s]?t|hasn['\s]?t\s+received|not\s+received)\b/i.test(text)) {
    return CaseType.WRONG_TRANSFER;
  }

  // Agent cash-in.
  if (
    /\b(agent|cash\s*in|deposit)\b/i.test(text) &&
    /\b(didn['\s]?t\s+(?:receive|get|reflect)|not\s+(?:receive|reflect|credited)|missing|absent)\b/i.test(text)
  ) {
    return CaseType.AGENT_CASH_IN_ISSUE;
  }

  // Payment failed (balance deducted but transfer not received).
  if (
    /\b(fail(?:ed|ure)?|didn['\s]?t\s+(?:receive|get|reach)|not\s+(?:receive|received)|deduct(?:ed)?\s+but)\b/i.test(
      text,
    )
  ) {
    return CaseType.PAYMENT_FAILED;
  }
  // Bangla / Banglish payment-failed signals.
  if (/(কাট|কাটে|কাটছে|কেটে|হয়নি|পাইনি|পাইছি না)/.test(text)) {
    return CaseType.PAYMENT_FAILED;
  }
  if (/\b(kach?e|katch?e|katch?e\s+na|kate|kete|hoyni|paini)\b/i.test(text)) {
    return CaseType.PAYMENT_FAILED;
  }

  // Duplicate payment — must come before refund_request because the complaint
  // "refund the duplicate" contains both keywords.
  if (/\b(duplicate|twice|two\s+times|charged\s+twice|double\s+(?:charge|payment)|same\s+(?:payment|transfer)\s+twice|by\s+mistake\s+twice)\b/i.test(text)) {
    return CaseType.DUPLICATE_PAYMENT;
  }

  // Refund request.
  if (/\brefund\b|\bmoney\s+back\b|\breturn\s+my\s+money\b/i.test(text)) {
    return CaseType.REFUND_REQUEST;
  }

  // Match-driven fallback: if a transaction was matched, infer from its type/status.
  if (match.transaction) {
    const t = match.transaction;
    if (t.type === 'payment' && t.status === 'failed') return CaseType.PAYMENT_FAILED;
    if (t.type === 'cash_in' && t.status !== 'completed') return CaseType.AGENT_CASH_IN_ISSUE;
    if (t.type === 'settlement' && t.status !== 'completed') return CaseType.MERCHANT_SETTLEMENT_DELAY;
  }

  return CaseType.OTHER;
}

function decideSeverity(request: ITicketRequest, match: IMatchResult, caseType: CaseType): Severity {
  const txn = match.transaction;
  const amount = txn?.amount ?? 0;

  if (caseType === CaseType.PHISHING_OR_SOCIAL_ENGINEERING) return Severity.CRITICAL;
  if (caseType === CaseType.WRONG_TRANSFER && amount >= HIGH_VALUE_THRESHOLD_BDT) return Severity.HIGH;
  if (amount >= HIGH_VALUE_THRESHOLD_BDT) return Severity.HIGH;
  if (caseType === CaseType.PAYMENT_FAILED && amount > 0) return Severity.MEDIUM;
  if (caseType === CaseType.DUPLICATE_PAYMENT && amount > 0) return Severity.MEDIUM;
  if (amount > 0 && amount < LOW_VALUE_THRESHOLD_BDT) return Severity.LOW;
  return Severity.MEDIUM;
}

function decideDepartment(caseType: CaseType): Department {
  switch (caseType) {
    case CaseType.WRONG_TRANSFER:
    case CaseType.DUPLICATE_PAYMENT:
    case CaseType.REFUND_REQUEST:
      return Department.DISPUTE_RESOLUTION;
    case CaseType.PAYMENT_FAILED:
      return Department.PAYMENTS_OPS;
    case CaseType.MERCHANT_SETTLEMENT_DELAY:
      return Department.MERCHANT_OPERATIONS;
    case CaseType.AGENT_CASH_IN_ISSUE:
      return Department.AGENT_OPERATIONS;
    case CaseType.PHISHING_OR_SOCIAL_ENGINEERING:
      return Department.FRAUD_RISK;
    case CaseType.OTHER:
    default:
      return Department.CUSTOMER_SUPPORT;
  }
}

function decideVerdict(match: IMatchResult, caseType: CaseType): EvidenceVerdict {
  if (match.transaction && match.confidence >= 0.4) return EvidenceVerdict.CONSISTENT;
  if (match.transaction && match.confidence > 0 && match.confidence < 0.4) {
    return EvidenceVerdict.INCONSISTENT;
  }
  // No transaction matched at all.
  if (caseType === CaseType.PHISHING_OR_SOCIAL_ENGINEERING) return EvidenceVerdict.INSUFFICIENT_DATA;
  if (caseType === CaseType.OTHER) return EvidenceVerdict.INSUFFICIENT_DATA;
  return EvidenceVerdict.INSUFFICIENT_DATA;
}

// -----------------------------------------------------------------------------
// Public entry point
// -----------------------------------------------------------------------------

export interface IInvestigateResult {
  response: ITicketResponse;
  providerUsed: string;
  flags: string[];
}

export async function investigateTicket(request: ITicketRequest): Promise<IInvestigateResult> {
  const flags: string[] = [];

  // 1. Prompt-injection / phishing detection.
  const injection = detectPromptInjection(request.complaint);
  if (!injection.isSafe) flags.push(ReasonCodes.PROMPT_INJECTION_DETECTED);

  const phishing = detectPhishing(request.complaint);
  if (!phishing.isSafe) flags.push(ReasonCodes.PHISHING_DETECTED);

  // 2. Match a transaction.
  const match = matchTransaction(request);

  // 3. Preliminary classification.
  const caseType = classifyCaseType(request, match);
  const severity = decideSeverity(request, match, caseType);
  const department = decideDepartment(caseType);
  const verdict = decideVerdict(match, caseType);

  // 4. Build reason codes from rules so far.
  const reasonCodes: string[] = [];
  if (caseType === CaseType.PHISHING_OR_SOCIAL_ENGINEERING) reasonCodes.push(ReasonCodes.PHISHING_DETECTED);
  else reasonCodes.push(caseType);
  if (match.transaction && verdict === EvidenceVerdict.CONSISTENT) reasonCodes.push(ReasonCodes.TRANSACTION_MATCH);
  if (!match.transaction) reasonCodes.push(ReasonCodes.NO_TRANSACTION_HISTORY);
  if (verdict === EvidenceVerdict.INSUFFICIENT_DATA) reasonCodes.push(ReasonCodes.INSUFFICIENT_DATA);
  const matchedTxnAmount = match.transaction?.amount ?? 0;
  if (matchedTxnAmount >= HIGH_VALUE_THRESHOLD_BDT) reasonCodes.push(ReasonCodes.HIGH_VALUE);
  if (matchedTxnAmount > 0 && matchedTxnAmount < LOW_VALUE_THRESHOLD_BDT) reasonCodes.push(ReasonCodes.LOW_VALUE);
  if (!injection.isSafe) reasonCodes.push(ReasonCodes.PROMPT_INJECTION_DETECTED);

  // 5. Ask the AI for narrative fields.
  let providerUsed = 'rule_only';
  let aiOutput: {
    agent_summary: string;
    recommended_next_action: string;
    customer_reply: string;
    refined_case_type?: CaseType;
    refined_severity?: Severity;
    refined_department?: Department;
    confidence?: number;
    reason_codes?: string[];
  };

  try {
    const result = await runInvestigation({
      ticket_id: request.ticket_id,
      complaint: request.complaint,
      language: request.language,
      matchedTransaction: match.transaction,
      verdict,
      preliminaryCaseType: caseType,
      preliminarySeverity: severity,
      preliminaryDepartment: department,
    });
    providerUsed = result.providerUsed;
    aiOutput = result.output;
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : 'unknown' },
      'All AI providers failed including rule-based — this should not happen',
    );
    // Last-resort hard fallback (should be unreachable because ruleBased always succeeds).
    aiOutput = {
      agent_summary: 'AI service unavailable. Manual review required.',
      recommended_next_action: 'Escalate to a human agent for manual handling.',
      customer_reply:
        'Thank you for contacting us. We have received your report. Our team will review it and respond as soon as possible.',
    };
  }

  // 6. Sanitize the AI output.
  const sanitized = sanitizeOutput({
    customer_reply: aiOutput.customer_reply,
    recommended_next_action: aiOutput.recommended_next_action,
  });
  flags.push(...sanitized.flags.map((f) => f.code));

  // 7. Apply LLM refinements (only if safe enum values).
  const finalCaseType = (aiOutput.refined_case_type as CaseType) ?? caseType;
  const finalSeverity = (aiOutput.refined_severity as Severity) ?? severity;
  let finalDepartment = (aiOutput.refined_department as Department) ?? department;

  // 8. Hard escalation rules that ALWAYS win over the LLM.
  //    - Phishing → fraud_risk.
  //    - High-value → human review.
  if (!phishing.isSafe) {
    finalDepartment = Department.FRAUD_RISK;
  }
  const humanReview =
    !phishing.isSafe ||
    matchedTxnAmount >= HIGH_VALUE_THRESHOLD_BDT ||
    finalSeverity === Severity.CRITICAL ||
    finalSeverity === Severity.HIGH ||
    verdict === EvidenceVerdict.INSUFFICIENT_DATA;

  // 9. Confidence — LLM if available, else rule-based default.
  const confidence =
    typeof aiOutput.confidence === 'number'
      ? Math.max(0, Math.min(1, aiOutput.confidence))
      : providerUsed === 'rule_only'
        ? RULE_BASED_DEFAULT_CONFIDENCE
        : LLM_DEFAULT_CONFIDENCE;

  // 10. Merge reason codes.
  const mergedReasons = Array.from(
    new Set([
      ...reasonCodes,
      ...(aiOutput.reason_codes ?? []),
      ...(sanitized.wasRegenerated ? [ReasonCodes.SAFETY_REPLY_REGENERATED] : []),
      ...(providerUsed === 'rule_only' ? [ReasonCodes.RULE_BASED_FALLBACK] : []),
    ]),
  );

  const response: ITicketResponse = {
    ticket_id: request.ticket_id,
    relevant_transaction_id: match.transaction?.transaction_id ?? null,
    evidence_verdict: verdict,
    case_type: finalCaseType,
    severity: finalSeverity,
    department: finalDepartment,
    agent_summary: aiOutput.agent_summary,
    recommended_next_action: sanitized.recommended_next_action,
    customer_reply: sanitized.customer_reply,
    human_review_required: humanReview,
    confidence,
    reason_codes: mergedReasons as ITicketResponse['reason_codes'],
  };

  logger.info(
    {
      ticket_id: request.ticket_id,
      provider: providerUsed,
      case_type: finalCaseType,
      severity: finalSeverity,
      department: finalDepartment,
      verdict,
      humanReview,
    },
    'Investigation completed',
  );

  return { response, providerUsed, flags };
}