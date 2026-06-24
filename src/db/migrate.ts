import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();

async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set in environment');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ...(process.env.DB_TYPE === 'neon' && {
      ssl: { rejectUnauthorized: false },
    }),
  });

  const db = drizzle(pool);

  console.log('🔄 Running database migrations...');

  const migrationsFolder = path.resolve(process.cwd(), 'drizzle');

  await migrate(db, {
    migrationsFolder,
  });

  console.log('✅ Migrations completed successfully!');

  await pool.end();
}

runMigrations().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
