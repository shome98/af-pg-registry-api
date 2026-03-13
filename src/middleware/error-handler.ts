import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/api-error';
import { sendError } from '../utils/api-response';
import { ZodError } from 'zod';
import { env } from '../config/env';

/**
 * Global error handler — must be registered LAST in Express middleware chain.
 *
 * Handles:
 *  - ApiError     → structured HTTP errors from the app
 *  - ZodError     → validation failures (unlikely here since validate middleware runs first)
 *  - PG error 23505 → unique constraint violations
 *  - Unknown      → generic 500 in production, detailed in development
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // Guard: if headers already sent, delegate to default Express error handler
  if (res.headersSent) return;

  // ── Known operational error ───────────────────────────────────────────────
  if (err instanceof ApiError) {
    sendError(res, err.message, err.statusCode, err.errors);
    return;
  }

  // ── Zod validation error (unlikely after validate middleware, but safe) ──
  if (err instanceof ZodError) {
    const errors = err.issues.map((i) => ({
      path: i.path.map(String).join(' → '),
      message: i.message,
    }));
    sendError(res, '❌ Validation failed', 400, errors);
    return;
  }

  // ── PostgreSQL unique constraint violation ─────────────────────────────────
  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === '23505'
  ) {
    const detail = (err as { detail?: string }).detail ?? '';
    const match = detail.match(/\(([^)]+)\)/);
    const field = match ? match[1] : 'field';
    sendError(res, `⚠️ A record with this ${field} already exists.`, 409);
    return;
  }

  // ── PostgreSQL foreign key violation ──────────────────────────────────────
  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === '23503'
  ) {
    sendError(res, '⚠️ Referenced resource does not exist.', 409);
    return;
  }

  // ── Unknown error ─────────────────────────────────────────────────────────
  if (env.NODE_ENV === 'development') {
    console.error('💥 Unhandled error:', err);
  } else {
    // Log to your observability platform here (e.g. Sentry)
    console.error('💥 Internal server error');
  }

  sendError(res, '💥 Something went wrong. Please try again later.', 500);
}
