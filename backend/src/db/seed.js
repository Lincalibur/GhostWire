import { runMigrations, closeDb } from './index.js';
import { ensureDevOperator } from '../services/devMode.service.js';
import { logger } from '../utils/logger.js';

/**
 * Explicitly seed the default operator (handle/password from config, default
 * ghost/wire). Useful for exercising the real login + OTP flow without dev
 * mode. Idempotent. Do not run against a production database.
 */
async function seed() {
  runMigrations();
  await ensureDevOperator();
}

seed()
  .then(() => {
    closeDb();
    process.exit(0);
  })
  .catch((err) => {
    logger.error('Seed failed', { error: err.message });
    process.exit(1);
  });
