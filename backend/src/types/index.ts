import { CaseType, Department, EvidenceVerdict, Severity } from '@/constants/enums';

/**
 * Internal working record used inside investigatorService.
 * Captures the output of every step so tests can assert on partial states.
 */
export interface IInvestigationContext {
  ticketId: string;
  complaint: string;
  language: string;
  channel: string;
  userType: string;

  matchedTransactionId: string | null;
  verdict: EvidenceVerdict;
  caseType: CaseType;
  severity: Severity;
  department: Department;
  reasonCodes: string[];

  agentSummary: string;
  recommendedNextAction: string;
  customerReply: string;

  humanReviewRequired: boolean;
  confidence: number;
}