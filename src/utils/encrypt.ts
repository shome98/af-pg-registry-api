import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm' as const;
const IV_LENGTH = 16; // bytes

/**
 * Encrypts a string using AES-256-GCM.
 * Returns a colon-separated string: iv:authTag:ciphertext (all hex encoded).
 *
 * Used to encrypt sensitive fields like dbUri before storing in the database.
 */
export function encrypt(plaintext: string, key: string): string {
  const keyBuffer = Buffer.from(key, 'utf8');
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a string produced by `encrypt()`.
 * Throws if the ciphertext has been tampered with (GCM auth tag mismatch).
 */
export function decrypt(encryptedText: string, key: string): string {
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted value format');
  }

  const [ivHex, authTagHex, ciphertext] = parts;
  const keyBuffer = Buffer.from(key, 'utf8');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Returns true when a value looks like an encrypted blob (iv:authTag:cipher).
 * Useful for idempotent encryption checks.
 */
export function isEncrypted(value: string): boolean {
  return value.split(':').length === 3;
}
