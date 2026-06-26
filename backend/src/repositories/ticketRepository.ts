/**
 * All MongoDB read/write operations for ticket analyses.
 * Business logic does NOT call Mongoose directly — it goes through this layer.
 */

import { ITicketAnalysisDoc, TicketAnalysis } from '@/models/ticketAnalysis.model';
import { ITransaction } from '@/interfaces/ITransaction';
import { ITicketRequest } from '@/interfaces/ITicketRequest';
import { ITicketResponse } from '@/interfaces/ITicketResponse';
import logger from '@/utils/logger';

export interface IPersistArgs {
  request: ITicketRequest;
  response: ITicketResponse;
  processingMs: number;
  requestId?: string;
  ip?: string;
}

export async function persistTicketAnalysis(args: IPersistArgs): Promise<ITicketAnalysisDoc | null> {
  try {
    const doc = await TicketAnalysis.create({
      ticket_id: args.request.ticket_id,
      complaint: args.request.complaint,
      language: args.request.language ?? 'en',
      channel: args.request.channel ?? 'in_app_chat',
      user_type: args.request.user_type ?? 'customer',
      campaign_context: args.request.campaign_context,
      transaction_history: (args.request.transaction_history ?? []) as ITransaction[],
      response: args.response,
      requestId: args.requestId,
      ip: args.ip,
      processingMs: args.processingMs,
    });
    logger.debug({ ticket_id: args.request.ticket_id, id: doc._id.toString() }, 'Ticket analysis persisted');
    return doc;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    logger.error({ err: message, ticket_id: args.request.ticket_id }, 'Failed to persist ticket analysis');
    return null;
  }
}

export async function findTicketAnalysesByTicketId(
  ticketId: string,
  limit = 50,
): Promise<ITicketAnalysisDoc[]> {
  return TicketAnalysis.find({ ticket_id: ticketId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<ITicketAnalysisDoc[]>()
    .exec();
}

export async function findTicketAnalysisById(id: string): Promise<ITicketAnalysisDoc | null> {
  return TicketAnalysis.findById(id).lean<ITicketAnalysisDoc | null>().exec();
}

export async function countRecentAnalyses(sinceMs: number): Promise<number> {
  const since = new Date(Date.now() - sinceMs);
  return TicketAnalysis.countDocuments({ createdAt: { $gte: since } }).exec();
}