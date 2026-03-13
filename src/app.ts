import { sql } from 'drizzle-orm';
import app from './server';
import { env } from './config/env';
import { db } from './db';
import logger from './utils/logger';

const BANNER = `
╔══════════════════════════════════════════════════════╗
║        CRUD Factory Registry API  🏭                 ║
╚══════════════════════════════════════════════════════╝`;

async function bootstrap(): Promise<void> {
  console.log(BANNER);

  //  Database connectivity check
  logger.info('\n🔄 Connecting to database...');
  try {
    await db.execute(sql`SELECT 1`);
    logger.info(`✅ Database connected  (${env.DB_TYPE.toUpperCase()})`);
  } catch (err) {
    logger.error('❌ Database connection failed:', err);
    process.exit(1);
  }

  //  Start HTTP server
  const server = app.listen(env.PORT, () => {
    logger.info(`\n🚀 Server running!`);
    logger.info(`   📍 URL         : http://localhost:${env.PORT}`);
    logger.info(`   🌿 Environment : ${env.NODE_ENV}`);
    logger.info(`   💾 Database    : ${env.DB_TYPE}`);
    logger.info(`   📋 Base route  : ${env.API_BASE_URL}/api/v1/mongo-apis`);
    logger.info(`   💚 Health      : http://localhost:${env.PORT}/health\n`);
  });

  //  Graceful shutdown
  const shutdown = (signal: string) => {
    logger.info(`\n⚠️  ${signal} received — shutting down gracefully...`);
    server.close(() => {
      logger.info('✅ HTTP server closed.');
      process.exit(0);
    });

    // Force-kill after 10 seconds if graceful shutdown hangs
    setTimeout(() => {
      logger.error('❌ Forced shutdown after timeout.');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  //  Unhandled rejections
  process.on('unhandledRejection', (reason) => {
    logger.error('💥 Unhandled Promise Rejection:', reason);
  });

  process.on('uncaughtException', (err) => {
    logger.error('💥 Uncaught Exception:', err);
    process.exit(1);
  });
}

bootstrap();
export default app;
