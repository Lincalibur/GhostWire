import { createApp } from './app.js';
import { config } from './config/index.js';
import { runMigrations, closeDb } from './db/index.js';
import { logger } from './utils/logger.js';

/**
 * Bootstrap: apply migrations, start the HTTP listener, and wire graceful
 * shutdown handlers.
 */
function bootstrap() {
  runMigrations();

  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info('GhostWire node online', {
      url: `http://localhost:${config.port}`,
      env: config.nodeEnv,
      otpChannel: config.otp.channel,
    });
  });

  const shutdown = (signal) => {
    logger.info(`Received ${signal}; shutting down node.`);
    server.close(() => {
      closeDb();
      process.exit(0);
    });
    // Force-exit if connections linger.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { reason: String(reason) });
  });
}

bootstrap();
