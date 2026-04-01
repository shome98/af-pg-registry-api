import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ApiError } from '../utils/api-error';

type ValidationTarget = 'body' | 'query' | 'params';

// Extend Express Request to include validated data
declare global {
  namespace Express {
    interface Request {
      validatedQuery?: unknown;
      validatedBody?: unknown;
      validatedParams?: unknown;
    }
  }
}

/**
 * Zod validation middleware factory.
 *
 * @param schema  - Zod schema to validate against
 * @param target  - Which part of the request to validate (default: "body")
 *
 * On success, attaches parsed+coerced Zod output to `req.validated*` properties
 * so controllers always receive typed, transformed values.
 *
 * On failure, calls next(ApiError.badRequest) with per-field error details.
 */
export function validate(schema: ZodSchema, target: ValidationTarget = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const errors = (result.error as ZodError).issues.map((i) => ({
        path: i.path.map(String).join(' → '),
        message: i.message,
      }));
      next(ApiError.badRequest('❌ Validation failed', errors));
      return;
    }

    // Attach validated data to a separate property to avoid read-only issues
    // req.query is read-only on IncomingMessage, so we use validatedQuery instead
    switch (target) {
      case 'query':
        req.validatedQuery = result.data;
        break;
      case 'body':
        req.body = result.data;
        break;
      case 'params':
        req.validatedParams = result.data;
        break;
    }
    next();
  };
}