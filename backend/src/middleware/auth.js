import { ApiError } from '../utils/ApiError.js';
import { verifySessionToken, COOKIE_NAME } from '../services/token.service.js';

/**
 * Extract a bearer token from the Authorization header, if present.
 * @param {import('express').Request} req
 * @returns {string | null}
 */
function bearerFromHeader(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

/**
 * Require a valid operator session. Accepts the HTTP-only session cookie or a
 * bearer token. On success, populates `req.operator`.
 * @param {import('express').Request} req
 * @param {import('express').Response} _res
 * @param {import('express').NextFunction} next
 */
export function requireOperator(req, _res, next) {
  const token = req.cookies?.[COOKIE_NAME] || bearerFromHeader(req);
  if (!token) {
    return next(ApiError.unauthorized('No active operator session.'));
  }

  try {
    const payload = verifySessionToken(token);
    req.operator = { id: payload.sub, handle: payload.handle, authLevel: payload.authLevel };
    return next();
  } catch {
    return next(ApiError.unauthorized('Session expired or invalid. Re-authenticate.', 'SESSION_INVALID'));
  }
}
