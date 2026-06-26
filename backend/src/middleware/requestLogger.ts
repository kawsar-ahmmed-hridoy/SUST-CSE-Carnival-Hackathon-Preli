/**
 * Request logger middleware (Pino).
 * Assigns a request ID to every request, logs start/finish, and exposes
 * the ID on the response so agents can correlate with logs.
 */

import type { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import logger from '@/utils/logger';
import { LOG_PAYLOAD_TRUNCATE } from '@/config/constants';

export const REQUEST_ID_HEADER = 'x-request-id';

export interface IRequestContext {
  requestId: string;
  startTimeMs: number;
  ip: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __requestContext: IRequestContext | undefined;
}

export function withRequestContext(
  request: NextRequest,
  handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
  const incoming = request.headers.get(REQUEST_ID_HEADER);
  const requestId = incoming && incoming.length <= 128 ? incoming : uuidv4();
  const start = Date.now();
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  globalThis.__requestContext = { requestId, startTimeMs: start, ip };

  logger.info(
    {
      requestId,
      method: request.method,
      path: new URL(request.url).pathname,
      ip,
    },
    'request.start',
  );

  return handler()
    .then((response) => {
      const duration = Date.now() - start;
      logger.info(
        {
          requestId,
          method: request.method,
          path: new URL(request.url).pathname,
          status: response.status,
          durationMs: duration,
        },
        'request.end',
      );
      response.headers.set(REQUEST_ID_HEADER, requestId);
      return response;
    })
    .catch((err) => {
      const duration = Date.now() - start;
      logger.error(
        {
          requestId,
          method: request.method,
          path: new URL(request.url).pathname,
          durationMs: duration,
          err: err instanceof Error ? err.message : String(err),
        },
        'request.error',
      );
      throw err;
    })
    .finally(() => {
      globalThis.__requestContext = undefined;
    });
}

export function getCurrentRequestContext(): IRequestContext | undefined {
  return globalThis.__requestContext;
}

export function truncate(value: string, max = LOG_PAYLOAD_TRUNCATE): string {
  if (!value) return value;
  return value.length <= max ? value : `${value.slice(0, max)}…[truncated]`;
}