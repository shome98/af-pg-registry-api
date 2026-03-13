import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ApiError } from '../utils/api-error';

type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Zod validation middleware factory.
 *
 * @param schema  - Zod schema to validate against
 * @param target  - Which part of the request to validate (default: "body")
 *
 * On success, replaces `req[target]` with the parsed+coerced Zod output
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

    // Replace with parsed/coerced data (e.g. page:"1" → page:1)
    (req as unknown as Record<string, unknown>)[target] = result.data;
    next();
  };
}
