/**
 * POST /analyze-ticket
 *
 * Analyzes a customer support ticket against the provided transaction history.
 * Returns evidence-grounded classification, routing, and a safe customer reply.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Request, Response, NextFunction } from 'express';
import { analyzeTicketController } from '@/controllers/ticketController';
import { handleError } from '@/middleware/errorHandler';
import { withRequestContext } from '@/middleware/requestLogger';
import { analyzeTicketRateLimiter } from '@/middleware/rateLimiter';
import { REQUEST_TIMEOUT_MS } from '@/config/constants';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function handle(req: NextRequest): Promise<NextResponse> {
  // Apply rate limiting (wraps a counter; throws a 429 if exceeded).
  await new Promise<void>((resolve, reject) => {
    const fakeRes = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: undefined as unknown,
      status(code: number) {
        (this as { statusCode: number }).statusCode = code;
        return this as unknown as Response;
      },
      setHeader(k: string, v: string) {
        (this as { headers: Record<string, string> }).headers[k] = v;
        return this as unknown as Response;
      },
      getHeader(k: string) {
        return (this as { headers: Record<string, string> }).headers[k];
      },
      json(body: unknown) {
        (this as { body: unknown }).body = body;
        return this as unknown as Response;
      },
      on: () => fakeRes,
      once: () => fakeRes,
      emit: () => false,
    } as unknown as Response;
    const next: NextFunction = (err?: unknown) => (err ? reject(err) : resolve());
    analyzeTicketRateLimiter(req as unknown as Request, fakeRes, next);
  });

  // Enforce hard timeout so we never exceed the 30s service limit.
  const work = analyzeTicketController(req);
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Request timed out')), REQUEST_TIMEOUT_MS),
  );
  const result = await Promise.race([work, timeout]);

  return NextResponse.json(result.body, {
    status: result.status,
    headers: result.headers,
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    return await withRequestContext(req, async () => handle(req));
  } catch (err) {
    const { body, status } = handleError(err);
    return NextResponse.json(body, { status });
  }
}
