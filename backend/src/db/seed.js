import { runMigrations, closeDb } from './index.js';
import { userRepository } from './repositories.js';
import { hashSecret } from '../utils/crypto.js';
import { logger } from '../utils/logger.js';

/**
 * Seed a demo operator so the portal can be exercised immediately.
 * Credentials (development only):
 *   handle:   ghost
 *   password: wire
 */
async function seed() {
  runMigrations();

  const handle = 'ghost';
  const existing = userRepository.findByHandle(handle);
  if (existing) {
    logger.info('Demo operator already present; skipping seed.', { handle });
    return;
  }

  const passwordHash = await hashSecret('wire');
  userRepository.create({
    operatorHandle: handle,
    email: 'ghost@ghostwire.local',
    passwordHash,
  });

  logger.info('Seeded demo operator.', { handle, password: 'wire' });
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
