/**
 * GET /health
 *
 * Liveness probe. Returns 200 {"status":"ok"} within 60s of service start.
 * Deliberately does NOT touch MongoDB or any LLM — pure in-memory response.
 * Always public (no auth required) so judges' liveness checks work.
 */

import { NextResponse } from 'next/server';
import { healthController } from '@/controllers/ticketController';
import { applySecurityHeaders } from '@/middleware/securityHeaders';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  const { body, status } = await healthController();
  return applySecurityHeaders(NextResponse.json(body, { status }));
}
