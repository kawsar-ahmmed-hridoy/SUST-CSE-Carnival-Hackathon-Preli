/**
 * Abstract AI provider contract.
 * All concrete providers (Gemini, Groq, rule-only) implement this.
 * Business logic depends only on this interface — never on a specific vendor SDK.
 */

import { CaseType, Department, EvidenceVerdict, Severity } from '@/constants/enums';
import { ITransaction } from '@/interfaces/ITransaction';

export interface IInvestigationInput {
  ticket_id: string;
  complaint: string;
  language?: string;
  matchedTransaction: ITransaction | null;
  verdict: EvidenceVerdict;
  
  preliminaryCaseType: CaseType;
  preliminarySeverity: Severity;
  preliminaryDepartment: Department;
}

export interface IInvestigationOutput {
  agent_summary: string;
  recommended_next_action: string;
  customer_reply: string;
  refined_case_type?: CaseType;
  refined_severity?: Severity;
  refined_department?: Department;
  confidence?: number;
  reason_codes?: string[];
}

export interface IAIService {
  /** Friendly provider name (gemini, groq, rule_only). */
  readonly providerName: string;

  /**
   * Generate the narrative fields of a ticket analysis.
   * Implementations MUST return values that are safe to expose to a customer.
   */
  generateInvestigation(input: IInvestigationInput): Promise<IInvestigationOutput>;
}