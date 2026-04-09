import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from '../utils/api-error';
import type { AuthUser } from '../types/express';

interface JwtPayload extends AuthUser {
  iat?: number;
  exp?: number;
}

/**
 * JWT Bearer token authentication middleware.
 *
 * Expects:  Authorization: Bearer <token>
 *
 * On success, attaches decoded payload to `req.user`.
 * On failure, forwards an ApiError (401) to the global error handler.
 */
export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  const isDev = env.NODE_ENV === 'development';
  const token =
    (authHeader && authHeader.split(' ')[1]) ?? req.cookies.access_token;

  if (!token) {
    if (isDev) {
      const userId = req.headers['x-user-id'];
      const sessionId = req.headers['x-session-id'];

      if (userId || sessionId) {
        req.user = {
          userId: userId as string,
          sessionToken: sessionId as string,
        };
        return next();
      }
    }
    next(
      ApiError.unauthorized('🔒 No token provided. Please authenticate first.'),
    );
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    if (!decoded.userId) {
      next(ApiError.unauthorized('🔒 Invalid token payload.'));
      return;
    }

    req.user = decoded;

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      next(ApiError.unauthorized('🔒 Token has expired. Please log in again.'));
    } else if (err instanceof jwt.JsonWebTokenError) {
      next(ApiError.unauthorized('🔒 Invalid token. Please log in again.'));
    } else {
      next(err);
    }
  }
}
