import crypto from 'crypto';

/**
 * Generates a secure cryptographically random 32-byte hex string.
 * This is the raw API key returned to the user ONCE on creation/regeneration.
 */
export const generateApiKey = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * One-way SHA-256 hash — used to store the API key securely.
 * The hash is what's persisted; the plaintext is never stored.
 */
export const hashString = (input: string): string => {
  return crypto.createHash('sha256').update(input).digest('hex');
};

/**
 * Timing-attack resistant comparison of two strings of equal length.
 * Used when verifying an incoming API key against a stored hash.
 */
export const timingSafeCompare = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(a, 'utf8'),
      Buffer.from(b, 'utf8'),
    );
  } catch {
    return false;
  }
};

/**
 * Generates a short random hex ID (16 chars = 64 bits).
 * Matches CrudFactory's own apiId format.
 */
export const generateApiId = (): string => {
  return crypto.randomBytes(8).toString('hex');
};
