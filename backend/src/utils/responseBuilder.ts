/**
 * Centralized JSON response factories.
 * Ensures every endpoint returns the same envelope shape.
 */

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

export interface ErrorEnvelope {
  success: false;
  message: string;
  error?: string;
  statusCode: number;
  details?: unknown;
}

export function successResponse<T>(data: T): SuccessEnvelope<T> {
  return { success: true, data };
}

export function errorResponse(
  message: string,
  statusCode: number,
  error?: string,
  details?: unknown,
): ErrorEnvelope {
  return {
    success: false,
    message,
    error,
    statusCode,
    ...(details !== undefined ? { details } : {}),
  };
}