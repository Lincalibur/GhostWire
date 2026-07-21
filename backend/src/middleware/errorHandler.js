import { ApiError } from '../utils/ApiError.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

/**
 * 404 handler for unmatched API routes.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Route not found: ${req.method} ${req.path}` },
  });
}

/**
 * Global error handler. Emits RFC-7807-ish JSON and never leaks stack traces
 * to clients in production.
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  const isApiError = err instanceof ApiError;
  const statusCode = isApiError ? err.statusCode : 500;
  const code = isApiError ? err.code : 'INTERNAL_ERROR';

  if (statusCode >= 500) {
    logger.error('Unhandled error', { path: req.path, message: err.message, stack: err.stack });
  } else {
    logger.warn('Request rejected', { path: req.path, code, message: err.message });
  }

  const message = isApiError || !config.isProduction ? err.message : 'An unexpected error occurred.';

  res.status(statusCode).json({ error: { code, message } });
}

/**
 * Wrap an async route handler so rejected promises reach the error handler.
 * @param {Function} handler
 * @returns {import('express').RequestHandler}
 */
export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
