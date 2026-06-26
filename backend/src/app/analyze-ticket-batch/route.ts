/**
 * POST /analyze-ticket-batch — top-level alias for /api/analyze-ticket-batch.
 *
 * Matches the literal path documented in instruction_and_evaluation.pdf.
 */

import { POST as apiBatchPOST } from '@/app/api/analyze-ticket-batch/route';
import { applySecurityHeaders } from '@/middleware/securityHeaders';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const res = await apiBatchPOST(req as unknown as import('next/server').NextRequest);
  return applySecurityHeaders(res);
}