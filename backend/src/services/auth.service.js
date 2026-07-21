import { config } from '../config/index.js';
import { ApiError } from '../utils/ApiError.js';
import { generateOtp, hashSecret, verifySecret } from '../utils/crypto.js';
import { userRepository, otpRepository } from '../db/repositories.js';
import { dispatchOtp } from './dispatch.service.js';
import { issueSessionToken } from './token.service.js';
import { ensureDevOperator } from './devMode.service.js';

const MAX_OTP_ATTEMPTS = 5;

/**
 * Stage 1 — verify operator credentials and dispatch a fresh OTP.
 *
 * To avoid user enumeration, credential failures return the same generic
 * error regardless of whether the handle exists.
 *
 * @param {{ handle: string, password: string }} credentials
 * @returns {Promise<{ channel: string }>}
 * @throws {ApiError} 401 on invalid credentials
 */
export async function initiateLogin({ handle, password }) {
  const user = userRepository.findByHandle(handle);

  // Constant-ish work even when the user is absent, to blunt timing/enumeration.
  const passwordHash = user?.password_hash ?? '$2a$12$0000000000000000000000000000000000000000000000000000';
  const passwordOk = await verifySecret(password, passwordHash);

  if (!user || !passwordOk) {
    throw ApiError.unauthorized('Invalid operator credentials.', 'INVALID_CREDENTIALS');
  }

  const otpCode = generateOtp(config.otp.length);
  const otpCodeHash = await hashSecret(otpCode);
  const expiresAt = new Date(Date.now() + config.otp.ttlSeconds * 1000).toISOString();

  // Enforce a single active OTP per operator.
  otpRepository.invalidateForUser(user.id);
  otpRepository.create({ userId: user.id, otpCodeHash, expiresAt });

  const { channel } = await dispatchOtp({ handle: user.operator_handle, email: user.email }, otpCode);
  return { channel };
}

/**
 * Stage 2 — validate an OTP and mint an operator session token.
 *
 * @param {{ handle: string, otp: string }} data
 * @returns {Promise<{ token: string, operator: { id: string, operatorHandle: string } }>}
 * @throws {ApiError} 401 when the OTP is missing, expired, or incorrect
 */
export async function verifyOtp({ handle, otp }) {
  const user = userRepository.findByHandle(handle);
  if (!user) {
    throw ApiError.unauthorized('No active challenge for this operator.', 'OTP_NOT_FOUND');
  }

  const session = otpRepository.findActiveForUser(user.id);
  if (!session) {
    throw ApiError.unauthorized('OTP expired or not issued. Restart authentication.', 'OTP_EXPIRED');
  }

  if (session.attempts >= MAX_OTP_ATTEMPTS) {
    otpRepository.markVerified(session.id); // burn the session
    throw ApiError.tooManyRequests('Too many OTP attempts. Challenge invalidated.', 'OTP_LOCKED');
  }

  const match = await verifySecret(otp, session.otp_code_hash);
  if (!match) {
    otpRepository.incrementAttempts(session.id);
    throw ApiError.unauthorized('Invalid OTP token.', 'OTP_INVALID');
  }

  otpRepository.markVerified(session.id);

  const operator = { id: user.id, operatorHandle: user.operator_handle };
  const token = issueSessionToken(operator);
  return { token, operator };
}

/**
 * Development-only shortcut: authenticate the configured dev operator without
 * a password or OTP, minting a session token directly.
 *
 * @returns {Promise<{ token: string, operator: { id: string, operatorHandle: string } }>}
 * @throws {ApiError} 403 when dev mode is not enabled
 */
export async function devLogin() {
  if (!config.dev.enabled) {
    throw ApiError.forbidden('Development login is disabled.', 'DEV_DISABLED');
  }

  const user = await ensureDevOperator();
  const operator = { id: user.id, operatorHandle: user.operator_handle };
  const token = issueSessionToken(operator);
  return { token, operator };
}
