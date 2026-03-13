import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { sendError } from '../utils/api-response';

/**
 * Global rate limiter applied to all routes.
 * Configurable via RATE_LIMIT_WINDOW_MS and RATE_LIMIT_MAX env vars.
 */
export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(
      res,
      '⏳ Too many requests. Please slow down and try again later.',
      429,
    );
  },
});

/**
 * Stricter limiter for the API creation endpoint.
 * Creating APIs is expensive — limit to 20 per hour per IP.
 */
export const createApiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(
      res,
      '⏳ API creation limit reached. You can create a maximum of 20 APIs per hour.',
      429,
    );
  },
});

/**
 * Limiter for the key regeneration endpoint.
 * Prevents excessive key churning — limit to 10 regenerations per hour per IP.
 */
export const regenerateKeyRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(
      res,
      '⏳ Key regeneration limit reached. Maximum 10 regenerations per hour.',
      429,
    );
  },
});
