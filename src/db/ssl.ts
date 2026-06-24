import type { PoolConfig } from 'pg';
import { env } from '../config/env';

const sslModePattern = /[?&]sslmode=(?!disable)([^&]+)/i;

export function getPgSslConfig(): Pick<PoolConfig, 'ssl'> | Record<string, never> {
  if (env.DB_TYPE === 'neon' || sslModePattern.test(env.DATABASE_URL)) {
    return {
      ssl: { rejectUnauthorized: false },
    };
  }

  return {};
}
