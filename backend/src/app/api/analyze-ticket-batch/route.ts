/**
 * POST /analyze-ticket-batch
 *
 * Accepts a batch of complaints and returns a batch of analyses.
 * Used by the evaluation harness to score the model on Dataset A/B.
 *
 * Request:
 *   { "tickets": [ { ...ticket1 }, { ...ticket2 }, ... ] }   (max 100)
 *
 * Response:
 *   { "success": true, "data": { "results": [ {...analysis1}, ... ], "count": N } }
 *
 * The endpoint processes tickets in parallel (bounded) and never crashes on
 * a single bad ticket — invalid items return an error entry in `results`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { analyzeTicketController } from '@/controllers/ticketController';
import { handleError } from '@/middleware/errorHandler';
import { withRequestContext } from '@/middleware/requestLogger';
import { checkRateLimit } from '@/middleware/rateLimiter';
import { authenticateRequest } from '@/middleware/auth';
import { applySecurityHeaders } from '@/middleware/securityHeaders';
import { successResponse, errorResponse } from '@/utils/responseBuilder';
import { ITicketResponse } from '@/interfaces/ITicketResponse';
import logger from '@/utils/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BATCH_MAX = 100;
const BATCH_CONCURRENCY = 5;

const batchRequestSchema = z.object({
  tickets: z
    .array(z.record(z.string(), z.unknown()))
    .min(1)
    .max(BATCH_MAX, `at most ${BATCH_MAX} tickets per batch`),
});

interface IBatchResult {
  index: number;
  ticket_id: string | null;
  ok: boolean;
  result?: ITicketResponse;
  error?: { message: string; code: string; statusCode: number };
}

async function handle(req: NextRequest): Promise<NextResponse> {
  const authError = authenticateRequest(req);
  if (authError) return authError;

  const rateLimited = await checkRateLimit(req);
  if (rateLimited) return rateLimited as NextResponse;

  const raw = (await req.json()) as unknown;
  const parsed = batchRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return applySecurityHeaders(
      NextResponse.json(
        errorResponse('Validation failed', 400, 'VALIDATION_FAILED', parsed.error.errors),
        { status: 400 },
      ),
    );
  }

  const tickets = parsed.data.tickets;
  const results: IBatchResult[] = new Array(tickets.length);
  let cursor = 0;

  // Bounded-concurrency worker pool — never spawns more than BATCH_CONCURRENCY
  // simultaneous upstream LLM calls.
  async function worker(): Promise<void> {
    while (true) {
      const idx = cursor++;
      if (idx >= tickets.length) return;
      const item = tickets[idx];
      const itemReq = new Request(req.url, {
        method: 'POST',
        headers: req.headers,
        body: JSON.stringify(item),
      });
      try {
        const ctrl = await analyzeTicketController(itemReq);
        const body = ctrl.body as { success: boolean; data: ITicketResponse };
        results[idx] = {
          index: idx,
          ticket_id: body.data?.ticket_id ?? null,
          ok: true,
          result: body.data,
        };
      } catch (err) {
        const { body, status } = handleError(err);
        const e = body as { message?: string; error?: string; statusCode?: number };
        results[idx] = {
          index: idx,
          ticket_id:
            (item && typeof item === 'object' && 'ticket_id' in item
              ? String((item as { ticket_id: unknown }).ticket_id)
              : null) ?? null,
          ok: false,
          error: {
            message: e.message ?? 'unknown error',
            code: e.error ?? 'INTERNAL_ERROR',
            statusCode: status,
          },
        };
        logger.warn(
          { index: idx, code: e.error, statusCode: status },
          'batch item failed',
        );
      }
    }
  }

  const workers = Array.from({ length: Math.min(BATCH_CONCURRENCY, tickets.length) }, () =>
    worker(),
  );
  await Promise.all(workers);

  return applySecurityHeaders(
    NextResponse.json(
      successResponse({
        count: results.length,
        success_count: results.filter((r) => r.ok).length,
        failure_count: results.filter((r) => !r.ok).length,
        results,
      }),
      { status: 200 },
    ),
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    return await withRequestContext(req, async () => handle(req));
  } catch (err) {
    const { body, status } = handleError(err);
    return applySecurityHeaders(NextResponse.json(body, { status }));
  }
}