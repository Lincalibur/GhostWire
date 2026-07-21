import rateLimit from 'express-rate-limit';

/**
 * Build a JSON-emitting rate limiter.
 * @param {{ windowMs: number, max: number, code: string, message: string }} options
 * @returns {import('express').RequestHandler}
 */
function build({ windowMs, max, code, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ error: { code, message } });
    },
  });
}

/** Aggressive limiter for authentication endpoints (brute-force protection). */
export const authLimiter = build({
  windowMs: 10 * 60 * 1000,
  max: 10,
  code: 'AUTH_RATE_LIMITED',
  message: 'Too many authentication attempts. Cool-down engaged.',
});

/** Limiter guarding recon endpoints against resource exhaustion. */
export const reconLimiter = build({
  windowMs: 60 * 1000,
  max: 20,
  code: 'RECON_RATE_LIMITED',
  message: 'Recon throughput limit reached. Throttle your queries.',
});

/** Baseline limiter applied to the whole API surface. */
export const globalLimiter = build({
  windowMs: 60 * 1000,
  max: 120,
  code: 'RATE_LIMITED',
  message: 'Request rate limit exceeded.',
});
