import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Project root (two levels up from backend/src/config). */
export const ROOT_DIR = path.resolve(__dirname, '..', '..', '..');

/**
 * Read an environment variable, falling back to a default.
 * @param {string} key
 * @param {string} [fallback]
 * @returns {string}
 */
function env(key, fallback = '') {
  const value = process.env[key];
  return value === undefined || value === '' ? fallback : value;
}

const nodeEnv = env('NODE_ENV', 'development');
const isProduction = nodeEnv === 'production';

// Dev conveniences are only ever active outside production, and only when
// explicitly opted in via DEV_MODE. In production this is forced off.
const devModeEnabled = !isProduction && env('DEV_MODE', 'false') === 'true';

const jwtSecret = env('JWT_SECRET', '');
if (isProduction && (!jwtSecret || jwtSecret === 'change_me_to_a_long_random_value')) {
  throw new Error('[config] JWT_SECRET must be set to a strong value in production.');
}

/**
 * Centralised, immutable application configuration.
 * All access to environment variables should flow through this object.
 */
export const config = Object.freeze({
  nodeEnv,
  isProduction,
  port: Number.parseInt(env('PORT', '8080'), 10),

  db: {
    path: path.resolve(ROOT_DIR, env('DB_PATH', './backend/data/ghostwire.db')),
  },

  security: {
    jwtSecret: jwtSecret || 'insecure-dev-secret-do-not-use-in-production',
    sessionTtlMinutes: Number.parseInt(env('SESSION_TTL_MINUTES', '15'), 10),
    corsOrigins: env('CORS_ORIGINS', '*')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },

  otp: {
    ttlSeconds: Number.parseInt(env('OTP_TTL_SECONDS', '300'), 10),
    channel: env('OTP_CHANNEL', 'console'),
    length: 6,
  },

  dev: {
    enabled: devModeEnabled,
    operatorHandle: env('DEV_OPERATOR_HANDLE', 'ghost'),
    operatorPassword: env('DEV_OPERATOR_PASSWORD', 'wire'),
    operatorEmail: env('DEV_OPERATOR_EMAIL', 'ghost@ghostwire.local'),
  },

  gateways: {
    smsApiKey: env('SMS_API_KEY'),
    mailgunApiKey: env('MAILGUN_API_KEY'),
    mailgunDomain: env('MAILGUN_DOMAIN'),
  },

  connectors: {
    shodanApiKey: env('SHODAN_API_KEY'),
    grayhatWarfareApiKey: env('GRAYHATWARFARE_API_KEY'),
  },

  paths: {
    frontend: path.resolve(ROOT_DIR, 'frontend'),
  },
});
