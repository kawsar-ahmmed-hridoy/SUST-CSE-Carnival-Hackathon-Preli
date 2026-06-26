import mongoose, { Schema, Document, Model } from 'mongoose';
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
import { ITransaction } from '@/interfaces/ITransaction';

export interface ITicketAnalysisDoc extends Document {
  ticket_id: string;
  complaint: string;
  language: string;
  channel: string;
  user_type: string;
  campaign_context?: string;
  transaction_history: ITransaction[];
  response: {
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
    reason_codes: string[];
  };
  requestId?: string;
  ip?: string;
  processingMs: number;
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
  {
    transaction_id: { type: String, required: true },
    timestamp: { type: String, required: true },
    type: { type: String, required: true },
    amount: { type: Number, required: true },
    counterparty: { type: String, required: true },
    status: { type: String, required: true },
  },
  { _id: false },
);

const responseSchema = new Schema(
  {
    relevant_transaction_id: { type: String, default: null },
    evidence_verdict: { type: String, enum: EVIDENCE_VERDICT_VALUES, required: true },
    case_type: { type: String, enum: CASE_TYPE_VALUES, required: true },
    severity: { type: String, enum: SEVERITY_VALUES, required: true },
    department: { type: String, enum: DEPARTMENT_VALUES, required: true },
    agent_summary: { type: String, required: true },
    recommended_next_action: { type: String, required: true },
    customer_reply: { type: String, required: true },
    human_review_required: { type: Boolean, required: true, default: false },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    reason_codes: { type: [String], default: [] },
  },
  { _id: false },
);

const ticketAnalysisSchema = new Schema<ITicketAnalysisDoc>(
  {
    ticket_id: { type: String, required: true, index: true },
    complaint: { type: String, required: true },
    language: { type: String, default: 'en' },
    channel: { type: String, default: 'in_app_chat' },
    user_type: { type: String, default: 'customer' },
    campaign_context: { type: String },
    transaction_history: { type: [transactionSchema], default: [] },
    response: { type: responseSchema, required: true },
    requestId: { type: String },
    ip: { type: String },
    processingMs: { type: Number, required: true },
  },
  {
    timestamps: true,
    collection: 'ticket_analyses',
  },
);

// Compound index supports audit queries like "show me all cases for this ticket
// in the last 30 days" without a full collection scan.
ticketAnalysisSchema.index({ ticket_id: 1, createdAt: -1 });
ticketAnalysisSchema.index({ 'response.case_type': 1, createdAt: -1 });
ticketAnalysisSchema.index({ 'response.department': 1, createdAt: -1 });
ticketAnalysisSchema.index({ 'response.severity': 1, createdAt: -1 });
ticketAnalysisSchema.index({ createdAt: -1 });

export const TicketAnalysis: Model<ITicketAnalysisDoc> =
  mongoose.models.TicketAnalysis ||
  mongoose.model<ITicketAnalysisDoc>('TicketAnalysis', ticketAnalysisSchema);