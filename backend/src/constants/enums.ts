/**
 * Centralized enum definitions for the entire application.
 * Changing a value here updates every reference (validators, services, models).
 */

export const CaseType = {
  WRONG_TRANSFER: 'wrong_transfer',
  PAYMENT_FAILED: 'payment_failed',
  REFUND_REQUEST: 'refund_request',
  DUPLICATE_PAYMENT: 'duplicate_payment',
  MERCHANT_SETTLEMENT_DELAY: 'merchant_settlement_delay',
  AGENT_CASH_IN_ISSUE: 'agent_cash_in_issue',
  PHISHING_OR_SOCIAL_ENGINEERING: 'phishing_or_social_engineering',
  OTHER: 'other',
} as const;
export type CaseType = (typeof CaseType)[keyof typeof CaseType];
export const CASE_TYPE_VALUES: readonly CaseType[] = Object.values(CaseType);

export const Department = {
  CUSTOMER_SUPPORT: 'customer_support',
  DISPUTE_RESOLUTION: 'dispute_resolution',
  PAYMENTS_OPS: 'payments_ops',
  MERCHANT_OPERATIONS: 'merchant_operations',
  AGENT_OPERATIONS: 'agent_operations',
  FRAUD_RISK: 'fraud_risk',
} as const;
export type Department = (typeof Department)[keyof typeof Department];
export const DEPARTMENT_VALUES: readonly Department[] = Object.values(Department);

export const Severity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;
export type Severity = (typeof Severity)[keyof typeof Severity];
export const SEVERITY_VALUES: readonly Severity[] = Object.values(Severity);

export const EvidenceVerdict = {
  CONSISTENT: 'consistent',
  INCONSISTENT: 'inconsistent',
  INSUFFICIENT_DATA: 'insufficient_data',
} as const;
export type EvidenceVerdict = (typeof EvidenceVerdict)[keyof typeof EvidenceVerdict];
export const EVIDENCE_VERDICT_VALUES: readonly EvidenceVerdict[] = Object.values(EvidenceVerdict);

export const Language = {
  EN: 'en',
  BN: 'bn',
  MIXED: 'mixed',
} as const;
export type Language = (typeof Language)[keyof typeof Language];

export const Channel = {
  IN_APP_CHAT: 'in_app_chat',
  CALL_CENTER: 'call_center',
  EMAIL: 'email',
  MERCHANT_PORTAL: 'merchant_portal',
  FIELD_AGENT: 'field_agent',
} as const;
export type Channel = (typeof Channel)[keyof typeof Channel];

export const UserType = {
  CUSTOMER: 'customer',
  MERCHANT: 'merchant',
  AGENT: 'agent',
  UNKNOWN: 'unknown',
} as const;
export type UserType = (typeof UserType)[keyof typeof UserType];

export const TransactionType = {
  TRANSFER: 'transfer',
  PAYMENT: 'payment',
  CASH_IN: 'cash_in',
  CASH_OUT: 'cash_out',
  SETTLEMENT: 'settlement',
  REFUND: 'refund',
} as const;
export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

export const TransactionStatus = {
  COMPLETED: 'completed',
  FAILED: 'failed',
  PENDING: 'pending',
  REVERSED: 'reversed',
} as const;
export type TransactionStatus = (typeof TransactionStatus)[keyof typeof TransactionStatus];

export const AIProvider = {
  PRIMARY: 'primary',
  GROQ: 'groq',
  RULE_ONLY: 'rule_only',
} as const;
export type AIProvider = (typeof AIProvider)[keyof typeof AIProvider];