/**
 * Zod schema for the response shape of POST /analyze-ticket.
 * Used to validate responses produced by AI providers before they leave the system.
 */

import { z } from 'zod';
import {
  CaseType,
  CASE_TYPE_VALUES,
  Department,
  DEPARTMENT_VALUES,
  EvidenceVerdict,
  EVIDENCE_VERDICT_VALUES,
  Severity,
  SEVERITY_VALUES,
} from '@/constants/enums';

export const ticketResponseSchema = z.object({
  ticket_id: z.string().min(1),
  relevant_transaction_id: z.string().nullable(),
  evidence_verdict: z.enum([
    EvidenceVerdict.CONSISTENT,
    EvidenceVerdict.INCONSISTENT,
    EvidenceVerdict.INSUFFICIENT_DATA,
  ] as [string, ...string[]]).refine(
    (v): v is EvidenceVerdict => EVIDENCE_VERDICT_VALUES.includes(v as EvidenceVerdict),
    { message: 'invalid evidence_verdict' },
  ),
  case_type: z.string().refine(
    (v): v is CaseType => CASE_TYPE_VALUES.includes(v as CaseType),
    { message: 'invalid case_type' },
  ),
  severity: z.string().refine(
    (v): v is Severity => SEVERITY_VALUES.includes(v as Severity),
    { message: 'invalid severity' },
  ),
  department: z.string().refine(
    (v): v is Department => DEPARTMENT_VALUES.includes(v as Department),
    { message: 'invalid department' },
  ),
  agent_summary: z.string().min(1),
  recommended_next_action: z.string().min(1),
  customer_reply: z.string().min(1),
  human_review_required: z.boolean(),
  confidence: z.number().min(0).max(1),
  reason_codes: z.array(z.string()),
});

export type TicketResponseSchemaType = z.infer<typeof ticketResponseSchema>;