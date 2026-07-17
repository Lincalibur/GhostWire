import { runMigrations, closeDb } from './index.js';
import { logger } from '../utils/logger.js';

/**
 * Standalone migration entrypoint: `npm run migrate`.
 * Applies the schema and exits.
 */
try {
  runMigrations();
  logger.info('Migration complete.');
  closeDb();
  process.exit(0);
} catch (err) {
  logger.error('Migration failed', { error: err.message });
  process.exit(1);
}
