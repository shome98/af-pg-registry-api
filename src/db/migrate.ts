import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import path from 'path';
import { getPgConnectionString, getPgSslConfig } from './ssl';

async function runMigrations() {
  const pool = new Pool({
    connectionString: getPgConnectionString(),
    ...getPgSslConfig(),
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
