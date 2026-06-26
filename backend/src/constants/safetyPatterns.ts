/**
 * Regex patterns and keyword lists used by the safety service.
 * All patterns are case-insensitive. Multiline flag enabled where needed.
 */

/** Keywords/patterns that MUST never appear in a customer reply as a request to share credentials. */
export const CREDENTIAL_REQUEST_PATTERNS: RegExp[] = [
  /\bsend\s+(?:us|me|here)\s+(?:your|the)\s+(?:pin|otp|one[-\s]?time\s+password|password|cvv|card\s+number)\b/i,
  /\bshare\s+(?:your|the)\s+(?:pin|otp|one[-\s]?time\s+password|password|cvv|card\s+number)\b/i,
  /\b(?:pin|otp|one[-\s]?time\s+password|password|cvv)\s*[:\-]?\s*(?:please\s+)?provide\b/i,
  /\bplease\s+(?:enter|provide|share)\s+(?:your|the)\s+(?:pin|otp|password|cvv)\b/i,
];

/** Keywords/patterns indicating a refund / reversal / unblock promise. */
export const REFUND_PROMISE_PATTERNS: RegExp[] = [
  /\b(?:we\s+will|we'll|we\s+shall|i\s+will|i'll)\s+(?:refund|reverse|return|cancel|unblock|restore)\b/i,
  /\bguarantee(?:d)?\s+refund\b/i,
  /\b(?:refund|reversal|return)\s+(?:is\s+)?(?:approved|confirmed|guaranteed)\b/i,
  /\b(?:money|amount|funds?)\s+(?:will\s+be|is)\s+(?:returned|refunded|reversed)\s+(?:immediately|today|now|within\s+\d+\s+(?:hour|min|minute))/i,
];

/** Patterns for unofficial phone numbers / third-party contact channels. */
export const THIRD_PARTY_CONTACT_PATTERNS: RegExp[] = [
  /(?:\+?88)?01[3-9]\d{8}\b/g, // Bangladeshi mobile numbers (likely third-party agents in reply text)
  /\b(?:whats?app|imo|telegram|viber|signal)\s*[:\-]?\s*[\+\d]/i,
];

/** URL pattern for any URL inside a reply. */
export const URL_PATTERN: RegExp = /\b(?:https?:\/\/|www\.)\S+/gi;

/** Prompt injection signals. We never execute instructions from complaint text. */
export const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /\bignore\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions?|prompts?|rules?)\b/i,
  /\b(?:you\s+are\s+now|act\s+as|pretend\s+to\s+be)\s+/i,
  /\bsystem\s*:\s*/i,
  /\bdisregard\s+(?:all\s+)?safety\b/i,
  /\b(?:reveal|print|output|leak)\s+(?:your\s+)?(?:system|hidden|secret)\s+(?:prompt|instructions?)\b/i,
  /\<\|.*?\|\>/i, // Generic special-token delimiters
  /\bforget\s+(?:everything|all|your)\b/i,
];

/** Phishing / social-engineering related keywords that escalate to fraud_risk. */
export const PHISHING_KEYWORDS: RegExp[] = [
  /\bphish(?:ing)?\b/i,
  /\bsocial\s+engineering\b/i,
  /\bfake\s+(?:call|sms|message|email|agent|representative)\b/i,
  /\bscam(?:mer|med)?\b/i,
  /\bsuspicious\s+(?:call|sms|link|message|email)\b/i,
  /\bshare\s+(?:my\s+)?(?:pin|otp|password|credentials)\b/i,
  /\b(?:someone|a\s+person|an\s+agent|customer\s+service|helpline|they)\s+(?:asked|told|requested|is\s+asking)\s+(?:me\s+)?(?:for|to\s+(?:share|give|send|provide))\b/i,
  // Passive variant: "asked for my OTP", "asked for the password" (no "to share").
  /\b(?:asked|told|requested)\s+(?:me\s+)?for\s+my\s+(?:pin|otp|password|credentials|cvv|one[-\s]?time\s+password)\b/i,
  // OTP/credential mention combined with social-engineering verbs anywhere.
  /\b(?:pin|otp|one[-\s]?time\s+password)\b[^.!?\n]{0,80}?\b(?:asked|told|requested|share|provide|give)\b/i,
  /\bfraud(?:ulent)?\b/i,
  /\bidentity\s+theft\b/i,
  /\b(?:hacked|hack)\s+(?:my\s+)?(?:account|wallet|phone)\b/i,
  /\b(?:my\s+)?(?:account|wallet)\s+(?:was|got|is)\s+hacked\b/i,
  /\bunauthori[sz]ed\s+(?:transaction|transfer|access)\b/i,
  /\blottery\b/i,
  /\b(?:you've|you\s+have)\s+won\b/i,
];

/** Reason codes used in responses. Kept here so they're uniform across services. */
export const ReasonCodes = {
  WRONG_TRANSFER: 'wrong_transfer',
  PAYMENT_FAILED: 'payment_failed',
  REFUND_REQUEST: 'refund_request',
  DUPLICATE_PAYMENT: 'duplicate_payment',
  MERCHANT_SETTLEMENT_DELAY: 'merchant_settlement_delay',
  AGENT_CASH_IN_ISSUE: 'agent_cash_in_issue',
  PHISHING_DETECTED: 'phishing_detected',
  FRAUD_RISK: 'fraud_risk',
  TRANSACTION_MATCH: 'transaction_match',
  TRANSACTION_MISMATCH: 'transaction_mismatch',
  NO_TRANSACTION_HISTORY: 'no_transaction_history',
  INSUFFICIENT_DATA: 'insufficient_data',
  HIGH_VALUE: 'high_value',
  LOW_VALUE: 'low_value',
  PROMPT_INJECTION_DETECTED: 'prompt_injection_detected',
  SAFETY_REPLY_REGENERATED: 'safety_reply_regenerated',
  RULE_BASED_FALLBACK: 'rule_based_fallback',
} as const;
export type ReasonCode = (typeof ReasonCodes)[keyof typeof ReasonCodes];