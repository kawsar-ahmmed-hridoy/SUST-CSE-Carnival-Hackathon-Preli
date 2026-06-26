/**
 * Application-wide initialization on server start.
 * - Connects to MongoDB.
 * - Ensures indexes exist.
 * - Registers graceful shutdown handlers.
 *
 * In Next.js, this is invoked from `instrumentation.ts`.
 */

import config from '@/config';
import { connectMongo, disconnectMongo } from '@/lib/mongodb';
import { ensureIndexes } from '@/database/indexes';
import logger from '@/utils/logger';

let initialized = false;

export async function startupInit(): Promise<void> {
  if (initialized) return;
  initialized = true;
  logger.info(
    {
      env: config.nodeEnv,
      port: config.port,
      provider: config.ai.provider,
    },
    'QueueStorm Investigator starting',
  );

  try {
    await connectMongo();
    await ensureIndexes();
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : 'unknown' },
      'Startup MongoDB init failed — service will continue and retry lazily',
    );
  }

  registerShutdownHandlers();
}

function registerShutdownHandlers(): void {
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received');
    try {
      await disconnectMongo();
    } catch (err) {
      logger.error(
        { err: err instanceof Error ? err.message : 'unknown' },
        'Error during MongoDB shutdown',
      );
    }
    process.exit(0);
  };

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
}
