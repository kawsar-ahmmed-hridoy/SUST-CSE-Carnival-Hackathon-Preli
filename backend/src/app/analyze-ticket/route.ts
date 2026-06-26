/**
 * POST /analyze-ticket — top-level alias for /api/analyze-ticket.
 *
 * Matches the literal path documented in instruction_and_evaluation.pdf.
 */

import { POST as apiAnalyzePOST } from '@/app/api/analyze-ticket/route';
import { applySecurityHeaders } from '@/middleware/securityHeaders';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const res = await apiAnalyzePOST(req as unknown as import('next/server').NextRequest);
  return applySecurityHeaders(res);
}