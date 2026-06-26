/**
 * POST /analyze-ticket
 *
 * Analyzes a customer support ticket against the provided transaction history.
 * Returns evidence-grounded classification, routing, and a safe customer reply.
 *
 * Authentication: optional but supported (X-Api-Key header).
 * Rate limit: per IP, 100 req/min by default.
 * Timeout: 30s hard ceiling per request.
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzeTicketController } from '@/controllers/ticketController';
import { handleError } from '@/middleware/errorHandler';
import { withRequestContext } from '@/middleware/requestLogger';
import { checkRateLimit } from '@/middleware/rateLimiter';
import { authenticateRequest } from '@/middleware/auth';
import { applySecurityHeaders } from '@/middleware/securityHeaders';
import { REQUEST_TIMEOUT_MS } from '@/config/constants';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function handle(req: NextRequest): Promise<NextResponse> {
  // 1. Auth (if API key is configured)
  const authError = authenticateRequest(req);
  if (authError) return authError;

  // 2. Rate limiting
  const rateLimited = await checkRateLimit(req);
  if (rateLimited) return rateLimited as NextResponse;

  // 3. Hard timeout so we never exceed the 30s service limit.
  const work = analyzeTicketController(req);
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Request timed out')), REQUEST_TIMEOUT_MS),
  );
  const result = await Promise.race([work, timeout]);

  return applySecurityHeaders(
    NextResponse.json(result.body, { status: result.status, headers: result.headers }),
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