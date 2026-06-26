/**
 * Centralized error handler.
 *
 * - Converts thrown AppError instances to uniform JSON.
 * - Catches raw Zod errors, Mongoose errors, and JSON parse errors.
 * - Never exposes stack traces or secrets to the client.
 */

import { ZodError } from 'zod';
import { AppError, BadRequestError, ValidationError } from '@/utils/errors';
import { errorResponse } from '@/utils/responseBuilder';
import logger from '@/utils/logger';

export function handleError(err: unknown): {
  body: ReturnType<typeof errorResponse>;
  status: number;
} {
  if (err instanceof AppError) {
    logger.warn({ code: err.code, statusCode: err.statusCode, message: err.message }, 'Handled AppError');
    return {
      body: errorResponse(err.message, err.statusCode, err.code, err.details),
      status: err.statusCode,
    };
  }

  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({ path: e.path.join('.'), message: e.message }));
    logger.warn({ details }, 'Zod validation failed');
    // Per PDF: 400 = "Malformed JSON or missing required fields",
    //          422 = "Valid schema but semantically invalid".
    // Zod errors are predominantly missing/invalid fields → 400.
    return {
      body: errorResponse('Validation failed', 400, 'VALIDATION_FAILED', details),
      status: 400,
    };
  }

  if (err instanceof SyntaxError) {
    // Most likely a JSON parse error from the request body.
    logger.warn({ message: err.message }, 'Malformed JSON');
    return {
      body: errorResponse('Malformed JSON in request body', 400, 'BAD_JSON'),
      status: 400,
    };
  }

  if (typeof err === 'object' && err !== null && 'name' in err) {
    const name = (err as { name?: string }).name;
    if (name === 'CastError' || name === 'ValidationError') {
      return {
        body: errorResponse('Invalid input data', 400, 'BAD_REQUEST'),
        status: 400,
      };
    }
  }

  // Anything else: log full detail server-side, return generic message to client.
  const message = err instanceof Error ? err.message : 'unknown error';
  const stack = err instanceof Error ? err.stack : undefined;
  logger.error({ err: message, stack }, 'Unhandled error');
  return {
    body: errorResponse('Internal server error', 500, 'INTERNAL_ERROR'),
    status: 500,
  };
}

export { ValidationError, BadRequestError };