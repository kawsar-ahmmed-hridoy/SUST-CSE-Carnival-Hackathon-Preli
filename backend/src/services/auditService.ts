/**
 * Audit service.
 *
 * Persists every analyzed ticket to MongoDB for compliance and observability.
 * Persistence failures never block the response — the analysis is still returned.
 */

import { ITicketRequest } from '@/interfaces/ITicketRequest';
import { ITicketResponse } from '@/interfaces/ITicketResponse';
import { persistTicketAnalysis } from '@/repositories/ticketRepository';
import logger from '@/utils/logger';
import { connectMongo } from '@/lib/mongodb';

export interface IAuditArgs {
  request: ITicketRequest;
  response: ITicketResponse;
  processingMs: number;
  requestId?: string;
  ip?: string;
}

export async function auditTicket(args: IAuditArgs): Promise<void> {
  try {
    await connectMongo();
    const doc = await persistTicketAnalysis({
      request: args.request,
      response: args.response,
      processingMs: args.processingMs,
      requestId: args.requestId,
      ip: args.ip,
    });
    if (!doc) {
      logger.warn(
        { ticket_id: args.request.ticket_id },
        'Audit persistence returned null — check repository logs',
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    logger.error(
      { err: message, ticket_id: args.request.ticket_id },
      'Audit persistence failed — continuing without blocking response',
    );
  }
}