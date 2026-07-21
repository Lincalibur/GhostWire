import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;

/**
 * Hash a plaintext secret (password or OTP) using bcrypt.
 * @param {string} plaintext
 * @returns {Promise<string>} bcrypt hash
 */
export function hashSecret(plaintext) {
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS);
}

/**
 * Compare a plaintext secret against a bcrypt hash in constant time.
 * @param {string} plaintext
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
export function verifySecret(plaintext, hash) {
  if (!hash) return Promise.resolve(false);
  return bcrypt.compare(plaintext, hash);
}

/**
 * Generate a cryptographically secure, zero-padded numeric OTP.
 * @param {number} [length=6]
 * @returns {string}
 */
export function generateOtp(length = 6) {
  const max = 10 ** length;
  const value = crypto.randomInt(0, max);
  return value.toString().padStart(length, '0');
}

/**
 * Produce an uppercase SHA-1 hex digest (used for HIBP k-anonymity queries).
 * @param {string} input
 * @returns {string}
 */
export function sha1Hex(input) {
  return crypto.createHash('sha1').update(input).digest('hex').toUpperCase();
}
