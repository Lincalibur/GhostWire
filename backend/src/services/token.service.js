import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

const COOKIE_NAME = 'gw_session';

/**
 * Issue a signed session JWT for an authenticated operator.
 * @param {{ id: string, operatorHandle: string }} operator
 * @returns {string} signed JWT
 */
export function issueSessionToken(operator) {
  return jwt.sign(
    { sub: operator.id, handle: operator.operatorHandle, authLevel: 4 },
    config.security.jwtSecret,
    { expiresIn: `${config.security.sessionTtlMinutes}m` },
  );
}

/**
 * Verify and decode a session JWT.
 * @param {string} token
 * @returns {{ sub: string, handle: string, authLevel: number }}
 * @throws {jwt.JsonWebTokenError} when invalid or expired
 */
export function verifySessionToken(token) {
  return jwt.verify(token, config.security.jwtSecret);
}

/**
 * Attach the session token as a hardened, HTTP-only cookie.
 * @param {import('express').Response} res
 * @param {string} token
 * @returns {void}
 */
export function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    maxAge: config.security.sessionTtlMinutes * 60 * 1000,
    path: '/',
  });
}

/**
 * Clear the session cookie (logout).
 * @param {import('express').Response} res
 * @returns {void}
 */
export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

export { COOKIE_NAME };
