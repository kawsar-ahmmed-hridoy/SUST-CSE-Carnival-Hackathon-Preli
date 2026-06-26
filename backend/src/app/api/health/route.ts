/**
 * GET /health
 *
 * Liveness probe. Returns 200 {"status":"ok"} within 60s of service start.
 * Deliberately does NOT touch MongoDB or any LLM — pure in-memory response.
 */

import { NextResponse } from 'next/server';
import { healthController } from '@/controllers/ticketController';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  const { body, status } = await healthController();
  return NextResponse.json(body, { status });
}
