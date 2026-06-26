/**
 * Request body validation middleware.
 *
 * Parses JSON, validates against the provided Zod schema, and either passes the
 * parsed value to the route handler or returns a 400/422 error.
 */

import { ZodSchema } from 'zod';
import { BadRequestError, ValidationError } from '@/utils/errors';

export async function parseJsonBody<T>(request: Request): Promise<T> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new BadRequestError('Content-Type must be application/json');
  }
  const text = await request.text();
  if (!text || text.trim() === '') {
    throw new BadRequestError('Request body is empty');
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new BadRequestError('Request body is not valid JSON');
  }
}

export function validateBody<T>(schema: ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const details = result.error.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }));
    throw new ValidationError('Validation failed', details);
  }
  return result.data;
}