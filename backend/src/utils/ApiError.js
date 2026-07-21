/**
 * Operational error carrying an HTTP status code.
 * Thrown by services/controllers and translated into a JSON
 * problem response by the global error handler.
 */
export class ApiError extends Error {
  /**
   * @param {number} statusCode HTTP status code
   * @param {string} message Client-safe error message
   * @param {string} [code] Machine-readable error code
   */
  constructor(statusCode, message, code = 'ERROR') {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }

  static badRequest(message, code = 'BAD_REQUEST') {
    return new ApiError(400, message, code);
  }

  static unauthorized(message = 'Authentication required', code = 'UNAUTHORIZED') {
    return new ApiError(401, message, code);
  }

  static forbidden(message = 'Access denied', code = 'FORBIDDEN') {
    return new ApiError(403, message, code);
  }

  static tooManyRequests(message = 'Rate limit exceeded', code = 'RATE_LIMITED') {
    return new ApiError(429, message, code);
  }
}
