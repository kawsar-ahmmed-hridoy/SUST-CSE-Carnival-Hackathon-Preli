/**
 * MongoDB index definitions applied at startup.
 * Calling ensureIndexes is idempotent — Mongoose skips indexes that already exist.
 */

import { TicketAnalysis } from '@/models/ticketAnalysis.model';
import logger from '@/utils/logger';

export async function ensureIndexes(): Promise<void> {
  try {
    await TicketAnalysis.syncIndexes();
    logger.info('MongoDB indexes ensured');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    logger.error({ err: message }, 'Failed to ensure MongoDB indexes');
    throw err;
  }
}