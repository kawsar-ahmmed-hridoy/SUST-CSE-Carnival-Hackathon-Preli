/**
 * Rule-based AI provider.
 *
 * Always available — no network or API key needed.
 * Used:
 *   1. As the final fallback if Gemini/Groq both fail.
 *   2. As a deterministic, low-latency source when AI_PROVIDER=rule_only.
 *
 * Produces a safe, conservative reply by template. Cannot match LLM quality
 * but guarantees the service never breaks.
 */

import { IAIService, IInvestigationInput, IInvestigationOutput } from '@/ai/aiService';
import { ReasonCodes, ReasonCode } from '@/constants/safetyPatterns';
import { CaseType, Department, Severity } from '@/constants/enums';
import { HIGH_VALUE_THRESHOLD_BDT } from '@/config/constants';

function safeCustomerReply(caseType: CaseType, language: 'en' | 'bn' | 'mixed'): string {
  const en =
    'Thank you for reaching out. We have received your report. Our team will review the matter carefully. ' +
    'Any eligible resolution will be processed through our official channels. ' +
    'Please do not share your PIN, OTP, password, or card details with anyone, including our representatives.';

  const bn =
    'আমাদের সাথে যোগাযোগ করার জন্য ধন্যবাদ। আমরা আপনার অভিযোগ পেয়েছি। ' +
    'আমাদের দল এই বিষয়টি সাবধানতার সাথে পর্যালোচনা করবে। ' +
    'যেকোনো যোগ্য সমাধান আমাদের অফিসিয়াল চ্যানেলের মাধ্যমে প্রক্রিয়া করা হবে। ' +
    'অনুগ্রহ করে আপনার পিন, ওটিপি, পাসওয়ার্ড বা কার্ডের তথ্য কারো সাথে শেয়ার করবেন না।';

  if (language === 'bn') return bn;
  if (language === 'mixed') return `${en}\n\n${bn}`;
  return en;
}

function safeNextAction(caseType: CaseType, txnId: string | null): string {
  const ref = txnId ? `for ${txnId}` : 'for this case';
  switch (caseType) {
    case CaseType.WRONG_TRANSFER:
      return `Open a wrong-transfer investigation ${ref}. Verify recipient details. Do not initiate reversal without completing the standard dispute resolution process.`;
    case CaseType.PAYMENT_FAILED:
      return `Review the transaction ${ref} with payments operations. Verify whether the customer's balance was deducted. Follow the standard payment-failure playbook.`;
    case CaseType.REFUND_REQUEST:
      return `Evaluate eligibility for the refund request ${ref} per the published refund policy. Do not promise a refund in advance of approval.`;
    case CaseType.DUPLICATE_PAYMENT:
      return `Confirm whether duplicate charges ${ref} occurred by reviewing gateway logs. Escalate to payments operations if confirmed.`;
    case CaseType.MERCHANT_SETTLEMENT_DELAY:
      return `Check merchant settlement status ${ref} with merchant operations. Provide an expected timeline only after confirmation.`;
    case CaseType.AGENT_CASH_IN_ISSUE:
      return `Verify the agent cash-in ${ref} with the agent's reconciliation records. Escalate to agent operations if a mismatch is confirmed.`;
    case CaseType.PHISHING_OR_SOCIAL_ENGINEERING:
      return `Escalate immediately to fraud_risk. Do not engage further with the suspected fraudster. Advise the customer to stop communication.`;
    default:
      return `Review the case with the assigned department. Do not commit to a resolution until policy checks are complete.`;
  }
}

function safeAgentSummary(input: IInvestigationInput): string {
  const tx = input.matchedTransaction;
  if (!tx) {
    return `Customer reports: "${input.complaint.slice(0, 200)}". No matching transaction found in the provided history.`;
  }
  return `Customer reports: "${input.complaint.slice(0, 160)}". Transaction ${tx.transaction_id} (${tx.type}, ${tx.amount} BDT, status=${tx.status}) at ${tx.timestamp} was matched. Verdict=${input.verdict}.`;
}

class RuleBasedProvider implements IAIService {
  public readonly providerName = 'rule_only';

  async generateInvestigation(input: IInvestigationInput): Promise<IInvestigationOutput> {
    const lang = (input.language === 'bn' ? 'bn' : input.language === 'mixed' ? 'mixed' : 'en') as
      | 'en'
      | 'bn'
      | 'mixed';

    const reasonCodes: ReasonCode[] = [ReasonCodes.RULE_BASED_FALLBACK];
    if (input.preliminarySeverity === Severity.HIGH || input.preliminarySeverity === Severity.CRITICAL) {
      reasonCodes.push(ReasonCodes.HIGH_VALUE);
    }
    if (input.matchedTransaction && input.matchedTransaction.amount >= HIGH_VALUE_THRESHOLD_BDT) {
      reasonCodes.push(ReasonCodes.HIGH_VALUE);
    }

    return {
      agent_summary: safeAgentSummary(input),
      recommended_next_action: safeNextAction(
        input.preliminaryCaseType,
        input.matchedTransaction?.transaction_id ?? null,
      ),
      customer_reply: safeCustomerReply(input.preliminaryCaseType, lang),
      refined_case_type: input.preliminaryCaseType,
      refined_severity: input.preliminarySeverity,
      refined_department:
        input.preliminaryCaseType === CaseType.PHISHING_OR_SOCIAL_ENGINEERING
          ? Department.FRAUD_RISK
          : input.preliminaryDepartment,
      confidence: 0.7,
      reason_codes: reasonCodes,
    };
  }
}

export const ruleBasedProvider: IAIService = new RuleBasedProvider();