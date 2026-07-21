import { config } from '../config/index.js';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const activeLevel = config.isProduction ? LEVELS.info : LEVELS.debug;

const COLORS = {
  debug: '\x1b[90m',
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  reset: '\x1b[0m',
};

/**
 * Emit a structured log line to stdout/stderr.
 * @param {'debug'|'info'|'warn'|'error'} level
 * @param {string} message
 * @param {Record<string, unknown>} [meta]
 */
function emit(level, message, meta) {
  if (LEVELS[level] < activeLevel) return;

  const timestamp = new Date().toISOString();
  const tag = `${COLORS[level]}[${level.toUpperCase()}]${COLORS.reset}`;
  const line = `${timestamp} ${tag} ${message}`;
  const stream = level === 'error' ? console.error : console.log;

  if (meta && Object.keys(meta).length > 0) {
    stream(line, meta);
  } else {
    stream(line);
  }
}

/**
 * Minimal, dependency-free application logger.
 * Never log secrets, tokens, or raw credentials.
 */
export const logger = {
  debug: (message, meta) => emit('debug', message, meta),
  info: (message, meta) => emit('info', message, meta),
  warn: (message, meta) => emit('warn', message, meta),
  error: (message, meta) => emit('error', message, meta),
};
