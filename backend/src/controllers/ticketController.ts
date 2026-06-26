/**
 * Ticket controller.
 *
 * Thin layer that:
 *   1. Parses the request.
 *   2. Validates input via Zod.
 *   3. Calls the investigator service.
 *   4. Persists the audit record (best-effort).
 *   5. Returns the shaped response.
 */

import { ticketRequestSchema, TicketRequestSchemaType } from '@/validators/ticketRequest.schema';
import { ITicketResponse } from '@/interfaces/ITicketResponse';
import { investigateTicket } from '@/services/investigatorService';
import { auditTicket } from '@/services/auditService';
import { connectMongo } from '@/lib/mongodb';
import { parseJsonBody, validateBody } from '@/middleware/validateRequest';
import { BadRequestError } from '@/utils/errors';
import { successResponse } from '@/utils/responseBuilder';
import { getCurrentRequestContext } from '@/middleware/requestLogger';
import logger from '@/utils/logger';
import { MAX_TRANSACTION_HISTORY_LENGTH, MIN_COMPLAINT_LENGTH } from '@/config/constants';

export interface IAnalyzeTicketControllerResult {
  body: ReturnType<typeof successResponse<ITicketResponse>>;
  status: number;
  headers: Record<string, string>;
}

export async function analyzeTicketController(request: Request): Promise<IAnalyzeTicketControllerResult> {
  // 1. Parse JSON.
  const raw = await parseJsonBody<unknown>(request);

  // 2. Validate.
  const validated: TicketRequestSchemaType = validateBody(ticketRequestSchema, raw);

  // 3. Semantic checks that Zod can't easily express.
  if (validated.complaint.trim().length < MIN_COMPLAINT_LENGTH) {
    throw new BadRequestError(`complaint must be at least ${MIN_COMPLAINT_LENGTH} characters`);
  }
  if (validated.transaction_history && validated.transaction_history.length > MAX_TRANSACTION_HISTORY_LENGTH) {
    throw new BadRequestError(
      `transaction_history supports at most ${MAX_TRANSACTION_HISTORY_LENGTH} entries`,
    );
  }

  // 4. Connect to Mongo (lazy).
  try {
    await connectMongo();
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : 'unknown' },
      'MongoDB unavailable — continuing without audit persistence',
    );
  }

  // 5. Investigate.
  const start = Date.now();
  const { response } = await investigateTicket(validated);
  const processingMs = Date.now() - start;

  // 6. Audit (best-effort).
  const ctx = getCurrentRequestContext();
  await auditTicket({
    request: validated,
    response,
    processingMs,
    requestId: ctx?.requestId,
    ip: ctx?.ip,
  });

  return {
    body: successResponse<ITicketResponse>(response),
    status: 200,
    headers: {},
  };
}

export async function healthController(): Promise<{
  body: { status: string; timestamp: string };
  status: number;
}> {
  return {
    body: { status: 'ok', timestamp: new Date().toISOString() },
    status: 200,
  };
}