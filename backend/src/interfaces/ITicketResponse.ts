import { CaseType, Department, EvidenceVerdict, Severity } from '@/constants/enums';
import { ReasonCode } from '@/constants/safetyPatterns';

/** The final response shape returned by POST /analyze-ticket. */
export interface ITicketResponse {
  ticket_id: string;
  relevant_transaction_id: string | null;
  evidence_verdict: EvidenceVerdict;
  case_type: CaseType;
  severity: Severity;
  department: Department;
  agent_summary: string;
  recommended_next_action: string;
  customer_reply: string;
  human_review_required: boolean;
  confidence: number;
  reason_codes: ReasonCode[];
}