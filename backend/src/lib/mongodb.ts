/**
 * MongoDB connection singleton.
 *
 * - Reuses the same connection across Next.js hot reloads (development).
 * - Uses Mongoose's built-in connection pool (default max 100).
 * - Lazy connect: we connect on first DB operation, not on import.
 */

import mongoose from 'mongoose';
import config from '@/config';
import logger from '@/utils/logger';

interface MongooseGlobal {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __mongooseCache: MongooseGlobal | undefined;
}

const cache: MongooseGlobal = globalThis.__mongooseCache ?? {
  conn: null,
  promise: null,
};
if (!globalThis.__mongooseCache) {
  globalThis.__mongooseCache = cache;
}

export async function connectMongo(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    const uri = config.mongo.uri;
    cache.promise = mongoose
      .connect(uri, {
        dbName: config.mongo.dbName,
        serverSelectionTimeoutMS: 10000,
        maxPoolSize: 50,
        minPoolSize: 5,
      })
      .then((m) => {
        logger.info({ uri: redactUri(uri) }, 'MongoDB connected');
        return m;
      })
      .catch((err) => {
        cache.promise = null;
        logger.error({ err: err.message }, 'MongoDB connection failed');
        throw err;
      });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}

export async function disconnectMongo(): Promise<void> {
  if (cache.conn) {
    await cache.conn.disconnect();
    cache.conn = null;
    cache.promise = null;
    logger.info('MongoDB disconnected');
  }
}

export function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

function redactUri(uri: string): string {
  return uri.replace(/(mongodb(?:\+srv)?:\/\/)([^:]+):([^@]+)@/, '$1$2:***@');
}