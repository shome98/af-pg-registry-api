import type { PoolConfig } from 'pg';
import { env } from '../config/env';

const sslModePattern = /[?&]sslmode=(?!disable)([^&]+)/i;
const sslQueryParams = new Set(['sslmode', 'sslcert', 'sslkey', 'sslrootcert']);

export function getPgSslConfig(): Pick<PoolConfig, 'ssl'> | Record<string, never> {
  if (env.DB_TYPE === 'neon' || sslModePattern.test(env.DATABASE_URL)) {
    return {
      ssl: { rejectUnauthorized: false },
    };
  }

  return {};
}

export function getPgConnectionString() {
  const url = new URL(env.DATABASE_URL);

  for (const param of sslQueryParams) {
    url.searchParams.delete(param);
  }

  return url.toString();
}
