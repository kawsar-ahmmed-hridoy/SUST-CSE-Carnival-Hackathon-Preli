/**
 * Safety service.
 *
 * Enforces fintech safety rules on:
 *   - Complaint text (prompt-injection detection — used by investigator to wrap input).
 *   - LLM-generated customer_reply / recommended_next_action (post-generation sanitization).
 *
 * This is the single chokepoint. NO LLM output bypasses these checks.
 */

import {
  CREDENTIAL_REQUEST_PATTERNS,
  PHISHING_KEYWORDS,
  PROMPT_INJECTION_PATTERNS,
  REFUND_PROMISE_PATTERNS,
  ReasonCode,
  ReasonCodes,
  THIRD_PARTY_CONTACT_PATTERNS,
  URL_PATTERN,
} from '@/constants/safetyPatterns';
import logger from '@/utils/logger';

export interface ISafetyFlag {
  code: ReasonCode | string;
  message: string;
}

export interface ISafetyCheckResult {
  isSafe: boolean;
  flags: ISafetyFlag[];
}

const SAFE_FALLBACK_REPLY =
  'Thank you for reaching out. We have received your report. Our team will review the matter carefully. ' +
  'Any eligible resolution will be processed through our official channels. ' +
  'Please do not share your PIN, OTP, password, or card details with anyone, including our representatives.';

const SAFE_FALLBACK_ACTION =
  'Review the case with the assigned department. Do not commit to a resolution until policy checks are complete.';

/** Detect prompt-injection attempts inside the customer's complaint text. */
export function detectPromptInjection(complaint: string): ISafetyCheckResult {
  const flags: ISafetyFlag[] = [];
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(complaint)) {
      flags.push({
        code: ReasonCodes.PROMPT_INJECTION_DETECTED,
        message: 'Possible prompt-injection attempt detected in complaint text.',
      });
      break;
    }
  }
  return { isSafe: flags.length === 0, flags };
}

/** Detect phishing / social-engineering language in the complaint. */
export function detectPhishing(complaint: string): ISafetyCheckResult {
  const flags: ISafetyFlag[] = [];
  for (const pattern of PHISHING_KEYWORDS) {
    if (pattern.test(complaint)) {
      flags.push({
        code: ReasonCodes.PHISHING_DETECTED,
        message: 'Phishing / social-engineering language detected.',
      });
      break;
    }
  }
  return { isSafe: flags.length === 0, flags };
}

/** Check the customer_reply text for credential requests. */
function hasCredentialRequest(text: string): boolean {
  return CREDENTIAL_REQUEST_PATTERNS.some((p) => p.test(text));
}

/** Check the reply or action for a refund / reversal / unblock promise. */
function hasRefundPromise(text: string): boolean {
  return REFUND_PROMISE_PATTERNS.some((p) => p.test(text));
}

/** Check for unofficial phone numbers / URLs. */
function hasThirdPartyContact(text: string): boolean {
  if (URL_PATTERN.test(text)) return true;
  URL_PATTERN.lastIndex = 0;
  for (const pattern of THIRD_PARTY_CONTACT_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) return true;
  }
  return false;
}

/** Strip third-party phone numbers / URLs from the reply text. */
function stripThirdPartyContacts(text: string): string {
  let cleaned = text.replace(URL_PATTERN, '[official channel only]');
  for (const pattern of THIRD_PARTY_CONTACT_PATTERNS) {
    pattern.lastIndex = 0;
    cleaned = cleaned.replace(pattern, '[official channel only]');
  }
  return cleaned;
}

/** Replace a hard promise with a conditional statement. */
function neutralizePromise(text: string): string {
  let cleaned = text;
  cleaned = cleaned.replace(
    /\b(?:we\s+will|we'll|we\s+shall|i\s+will|i'll)\s+(refund|reverse|return|cancel|unblock|restore)\b/gi,
    'any eligible amount will be processed through official channels to',
  );
  cleaned = cleaned.replace(/\bguarantee(?:d)?\s+refund\b/gi, 'eligible refund per policy');
  cleaned = cleaned.replace(
    /\b(refund|reversal|return)\s+(is\s+)?(approved|confirmed|guaranteed)\b/gi,
    'will be reviewed under the standard process',
  );
  return cleaned;
}

/** Append a credentials safety footer if it is missing. */
function ensureCredentialsFooter(text: string): string {
  const footer =
    'Please do not share your PIN, OTP, password, or card details with anyone, including our representatives.';
  if (/pin|otp|password|cvv|card/i.test(text)) return text;
  return `${text.replace(/\s+$/, '')} ${footer}`;
}

export interface ISanitizedOutput {
  customer_reply: string;
  recommended_next_action: string;
  wasRegenerated: boolean;
  flags: ISafetyFlag[];
}

/**
 * Sanitize AI-generated text. If any rule fails, the offending text is
 * rewritten; if it still cannot be made safe, the safe fallback is used.
 */
export function sanitizeOutput(input: {
  customer_reply: string;
  recommended_next_action: string;
}): ISanitizedOutput {
  const flags: ISafetyFlag[] = [];

  let reply = input.customer_reply ?? '';
  let action = input.recommended_next_action ?? '';
  let wasRegenerated = false;

  // 1. Credential request → strip and append safety footer.
  if (hasCredentialRequest(reply)) {
    flags.push({
      code: ReasonCodes.SAFETY_REPLY_REGENERATED,
      message: 'Credential request detected in customer reply — sanitized.',
    });
    // Strip sentences containing imperative credential asks.
    reply = reply.replace(
      /[^.!?\n]*\b(?:send|share|provide|enter|give|submit)\b[^.!?\n]*\b(?:pin|otp|one[-\s]?time\s+password|password|cvv|card\s+number)\b[^.!?\n]*[.!?\n]?/gi,
      '',
    );
    // Clean up extra whitespace and dangling commas.
    reply = reply.replace(/\s{2,}/g, ' ').replace(/^[,\s]+|[,\s]+$/g, '').trim();
    reply = ensureCredentialsFooter(reply);
    wasRegenerated = true;
  }

  // 2. Refund / reversal promise → neutralize.
  if (hasRefundPromise(reply)) {
    flags.push({
      code: ReasonCodes.SAFETY_REPLY_REGENERATED,
      message: 'Refund/reversal promise detected in customer reply — neutralized.',
    });
    reply = neutralizePromise(reply);
    wasRegenerated = true;
  }
  if (hasRefundPromise(action)) {
    flags.push({
      code: ReasonCodes.SAFETY_REPLY_REGENERATED,
      message: 'Refund/reversal promise detected in next action — neutralized.',
    });
    action = neutralizePromise(action);
    wasRegenerated = true;
  }

  // 3. Third-party contacts → strip.
  if (hasThirdPartyContact(reply)) {
    flags.push({
      code: ReasonCodes.SAFETY_REPLY_REGENERATED,
      message: 'Unofficial contact channel detected in customer reply — stripped.',
    });
    reply = stripThirdPartyContacts(reply);
    wasRegenerated = true;
  }

  // 4. Hard fallback if reply is empty or too short after sanitization.
  if (!reply || reply.trim().length < 20) {
    logger.warn({ originalLength: input.customer_reply?.length ?? 0 }, 'Reply fell back to safe template');
    reply = SAFE_FALLBACK_REPLY;
    wasRegenerated = true;
  }
  if (!action || action.trim().length < 10) {
    action = SAFE_FALLBACK_ACTION;
    wasRegenerated = true;
  }

  // 5. Always ensure a credentials reminder is present in the customer reply.
  if (!/pin|otp|password|cvv/i.test(reply)) {
    reply = ensureCredentialsFooter(reply);
  }

  return {
    customer_reply: reply.trim(),
    recommended_next_action: action.trim(),
    wasRegenerated,
    flags,
  };
}