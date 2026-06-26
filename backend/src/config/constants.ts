/**
 * Application-wide numeric / string constants.
 * These are NOT user-configurable. For tunable values, use config/index.ts.
 */

import { Severity } from '@/constants/enums';

/** Threshold (BDT) above which transfers are flagged for mandatory human review. */
export const HIGH_VALUE_THRESHOLD_BDT = 10000;

/** Threshold (BDT) below which transactions are low-severity. */
export const LOW_VALUE_THRESHOLD_BDT = 100;

/** Maximum number of transaction_history entries allowed in a request. */
export const MAX_TRANSACTION_HISTORY_LENGTH = 5;

/** Maximum allowed length (chars) for the complaint text. */
export const MAX_COMPLAINT_LENGTH = 4000;

/** Minimum allowed length (chars) for a non-empty complaint. */
export const MIN_COMPLAINT_LENGTH = 3;

/** Confidence score returned when the rule-based engine answers without LLM help. */
export const RULE_BASED_DEFAULT_CONFIDENCE = 0.7;

/** Confidence score returned for fully LLM-driven analyses. */
export const LLM_DEFAULT_CONFIDENCE = 0.85;

/** Time tolerance (ms) when matching a complaint timestamp against a transaction. */
export const TXN_TIME_TOLERANCE_MS = 6 * 60 * 60 * 1000; // 6 hours

/** Tolerance when matching amounts (percentage). */
export const TXN_AMOUNT_TOLERANCE_PCT = 0.05; // 5%

/** Severity score map used when computing severity from evidence and amount. */
export const SEVERITY_RANK: Record<Severity, number> = {
  [Severity.LOW]: 1,
  [Severity.MEDIUM]: 2,
  [Severity.HIGH]: 3,
  [Severity.CRITICAL]: 4,
};

/** Default LLM temperature for both providers. */
export const LLM_TEMPERATURE = 0.2;

/** Max tokens for LLM responses. */
export const LLM_MAX_OUTPUT_TOKENS = 1024;

/** Hard ceiling on per-request time — kept under the 30s service limit. */
export const REQUEST_TIMEOUT_MS = 28000;

/** Default character cap for log lines of large payloads (e.g. complaints). */
export const LOG_PAYLOAD_TRUNCATE = 500;