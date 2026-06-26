/**
 * GET /tickets/:ticket_id
 *
 * Returns the audit trail (all analyses) for a given ticket_id.
 * Used by judges to verify that every processed ticket is properly logged.
 *
 * Response (200):
 *   { "success": true, "data": { "ticket_id": "...", "count": N, "records": [ ... ] } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import { findTicketAnalysesByTicketId } from '@/repositories/ticketRepository';
import { authenticateRequest } from '@/middleware/auth';
import { checkRateLimit } from '@/middleware/rateLimiter';
import { applySecurityHeaders } from '@/middleware/securityHeaders';
import { withRequestContext } from '@/middleware/requestLogger';
import { handleError } from '@/middleware/errorHandler';
import { successResponse, errorResponse } from '@/utils/responseBuilder';
import logger from '@/utils/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticket_id: string }> },
): Promise<NextResponse> {
  try {
    return await withRequestContext(req, async () => {
      const authError = authenticateRequest(req);
      if (authError) return authError;

      const rateLimited = await checkRateLimit(req);
      if (rateLimited) return rateLimited as NextResponse;

      const { ticket_id } = await params;
      if (!ticket_id || ticket_id.length > 256) {
        return applySecurityHeaders(
          NextResponse.json(
            errorResponse('Invalid ticket_id', 400, 'BAD_REQUEST'),
            { status: 400 },
          ),
        );
      }

      try {
        await connectMongo();
      } catch (err) {
        logger.warn(
          { err: err instanceof Error ? err.message : 'unknown' },
          'MongoDB unavailable on audit query',
        );
        return applySecurityHeaders(
          NextResponse.json(
            errorResponse('Audit log unavailable', 503, 'SERVICE_UNAVAILABLE'),
            { status: 503 },
          ),
        );
      }

      const limitRaw = new URL(req.url).searchParams.get('limit');
      const limit = limitRaw ? Math.min(200, Math.max(1, Number.parseInt(limitRaw, 10))) : 50;
      const records = await findTicketAnalysesByTicketId(ticket_id, limit);
      const safe = records.map((r) => ({
        id: r._id?.toString(),
        ticket_id: r.ticket_id,
        createdAt: r.createdAt,
        processingMs: r.processingMs,
        response: r.response,
      }));
      return applySecurityHeaders(
        NextResponse.json(
          successResponse({ ticket_id, count: safe.length, records: safe }),
          { status: 200 },
        ),
      );
    });
  } catch (err) {
    const { body, status } = handleError(err);
    return applySecurityHeaders(NextResponse.json(body, { status }));
  }
}