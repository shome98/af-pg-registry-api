import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema/mongo-api.schema';
import { env } from '../config/env';

/**
 * Single shared Pool — supports both local PostgreSQL and Neon.
 * For Neon, DB_TYPE=neon enables SSL with rejectUnauthorized:false.
 */
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ...(env.DB_TYPE === 'neon' && {
    ssl: { rejectUnauthorized: false },
  }),
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database pool error:', err.message);
});

export const db = drizzle(pool, { schema });

// Re-export schema types for convenience
export * from './schema/mongo-api.schema';
