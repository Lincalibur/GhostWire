import { config } from '../config/index.js';
import { userRepository } from '../db/repositories.js';
import { hashSecret } from '../utils/crypto.js';
import { logger } from '../utils/logger.js';

/**
 * Idempotently ensure the configured development operator exists.
 * Intended for dev mode only — never invoke in production paths.
 *
 * @returns {Promise<object>} the existing or newly created operator row
 */
export async function ensureDevOperator() {
  const handle = config.dev.operatorHandle;
  const existing = userRepository.findByHandle(handle);
  if (existing) return existing;

  const passwordHash = await hashSecret(config.dev.operatorPassword);
  const user = userRepository.create({
    operatorHandle: handle,
    email: config.dev.operatorEmail,
    passwordHash,
  });

  logger.warn('DEV MODE: default operator seeded', {
    handle,
    password: config.dev.operatorPassword,
  });
  return user;
}
