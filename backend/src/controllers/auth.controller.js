import { ApiError } from '../utils/ApiError.js';
import { initiateLogin, verifyOtp } from '../services/auth.service.js';
import { setSessionCookie, clearSessionCookie } from '../services/token.service.js';

/**
 * Coerce a request field to a trimmed string.
 * @param {unknown} value
 * @returns {string}
 */
const str = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * POST /api/auth/login — verify credentials and dispatch an OTP.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function login(req, res) {
  const handle = str(req.body?.handle);
  const password = str(req.body?.password);

  if (!handle || !password) {
    throw ApiError.badRequest('Operator handle and password are required.', 'MISSING_CREDENTIALS');
  }

  const { channel } = await initiateLogin({ handle, password });
  res.json({
    status: 'OTP_DISPATCHED',
    channel,
    message: 'Time-sensitive OTP routed to out-of-band channel.',
  });
}

/**
 * POST /api/auth/verify — validate an OTP and establish a session.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function verify(req, res) {
  const handle = str(req.body?.handle);
  const otp = str(req.body?.otp).replace(/[\s-]/g, '');

  if (!handle || !otp) {
    throw ApiError.badRequest('Operator handle and OTP token are required.', 'MISSING_OTP');
  }

  const { token, operator } = await verifyOtp({ handle, otp });
  setSessionCookie(res, token);

  res.json({
    status: 'AUTHORIZED',
    operator: { handle: operator.operatorHandle, authLevel: 4 },
  });
}

/**
 * POST /api/auth/logout — tear down the current session.
 * @param {import('express').Request} _req
 * @param {import('express').Response} res
 */
export async function logout(_req, res) {
  clearSessionCookie(res);
  res.json({ status: 'SESSION_TERMINATED' });
}

/**
 * GET /api/auth/session — report the current session state.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function session(req, res) {
  res.json({ operator: { handle: req.operator.handle, authLevel: req.operator.authLevel } });
}
