/**
 * Zod schema for POST /analyze-ticket request body.
 *
 * Returns 400 on malformed JSON / wrong types.
 * Returns 422 on semantically invalid content (e.g. empty complaint).
 */

import { z } from 'zod';
import {
  Channel,
  Language,
  TransactionStatus,
  TransactionType,
  UserType,
} from '@/constants/enums';
import { MAX_COMPLAINT_LENGTH, MAX_TRANSACTION_HISTORY_LENGTH } from '@/config/constants';

export const transactionSchema = z.object({
  transaction_id: z.string().min(1).max(128),
  timestamp: z
    .string()
    .datetime({ offset: true, message: 'timestamp must be ISO 8601 with offset' })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/)),
  type: z.enum([
    TransactionType.TRANSFER,
    TransactionType.PAYMENT,
    TransactionType.CASH_IN,
    TransactionType.CASH_OUT,
    TransactionType.SETTLEMENT,
    TransactionType.REFUND,
  ]),
  amount: z.number().finite().nonnegative(),
  counterparty: z.string().min(1).max(128),
  status: z.enum([
    TransactionStatus.COMPLETED,
    TransactionStatus.FAILED,
    TransactionStatus.PENDING,
    TransactionStatus.REVERSED,
  ]),
});

export const ticketRequestSchema = z.object({
  ticket_id: z.string().min(1, 'ticket_id is required').max(128),
  complaint: z
    .string({
      required_error: 'complaint is required',
      invalid_type_error: 'complaint must be a string',
    })
    .min(1, 'complaint is required')
    .max(MAX_COMPLAINT_LENGTH, `complaint must be at most ${MAX_COMPLAINT_LENGTH} characters`),
  language: z
    .enum([Language.EN, Language.BN, Language.MIXED])
    .optional(),
  channel: z
    .enum([
      Channel.IN_APP_CHAT,
      Channel.CALL_CENTER,
      Channel.EMAIL,
      Channel.MERCHANT_PORTAL,
      Channel.FIELD_AGENT,
    ])
    .optional(),
  user_type: z
    .enum([UserType.CUSTOMER, UserType.MERCHANT, UserType.AGENT, UserType.UNKNOWN])
    .optional(),
  campaign_context: z.string().max(128).optional(),
  transaction_history: z
    .array(transactionSchema)
    .max(MAX_TRANSACTION_HISTORY_LENGTH, `at most ${MAX_TRANSACTION_HISTORY_LENGTH} entries allowed`)
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type TicketRequestSchemaType = z.infer<typeof ticketRequestSchema>;