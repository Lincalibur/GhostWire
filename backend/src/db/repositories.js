import crypto from 'node:crypto';
import { getDb } from './index.js';

/** @returns {string} ISO-8601 UTC timestamp */
const nowIso = () => new Date().toISOString();

/**
 * Repository for operator (user) records.
 */
export const userRepository = {
  /**
   * Look up an active operator by handle (case-insensitive).
   * @param {string} handle
   * @returns {object | undefined}
   */
  findByHandle(handle) {
    return getDb()
      .prepare('SELECT * FROM users WHERE operator_handle = ? COLLATE NOCASE AND is_active = 1')
      .get(handle);
  },

  /**
   * Look up an operator by id.
   * @param {string} id
   * @returns {object | undefined}
   */
  findById(id) {
    return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);
  },

  /**
   * Insert a new operator.
   * @param {{ operatorHandle: string, email: string, passwordHash: string }} data
   * @returns {object} the created user row
   */
  create({ operatorHandle, email, passwordHash }) {
    const id = crypto.randomUUID();
    getDb()
      .prepare(
        `INSERT INTO users (id, operator_handle, email, password_hash, created_at, is_active)
         VALUES (?, ?, ?, ?, ?, 1)`,
      )
      .run(id, operatorHandle, email, passwordHash, nowIso());
    return this.findById(id);
  },
};

/**
 * Repository for time-limited OTP verification sessions.
 */
export const otpRepository = {
  /**
   * Create a new OTP session for an operator.
   * @param {{ userId: string, otpCodeHash: string, expiresAt: string }} data
   * @returns {string} the created session id
   */
  create({ userId, otpCodeHash, expiresAt }) {
    const id = crypto.randomUUID();
    getDb()
      .prepare(
        `INSERT INTO otp_sessions (id, user_id, otp_code_hash, expires_at, verified, attempts, created_at)
         VALUES (?, ?, ?, ?, 0, 0, ?)`,
      )
      .run(id, userId, otpCodeHash, expiresAt, nowIso());
    return id;
  },

  /**
   * Fetch the most recent unverified, unexpired session for a user.
   * @param {string} userId
   * @returns {object | undefined}
   */
  findActiveForUser(userId) {
    return getDb()
      .prepare(
        `SELECT * FROM otp_sessions
         WHERE user_id = ? AND verified = 0 AND expires_at > ?
         ORDER BY created_at DESC LIMIT 1`,
      )
      .get(userId, nowIso());
  },

  /**
   * Increment the failed-attempt counter for a session.
   * @param {string} id
   * @returns {void}
   */
  incrementAttempts(id) {
    getDb().prepare('UPDATE otp_sessions SET attempts = attempts + 1 WHERE id = ?').run(id);
  },

  /**
   * Mark a session as successfully verified.
   * @param {string} id
   * @returns {void}
   */
  markVerified(id) {
    getDb().prepare('UPDATE otp_sessions SET verified = 1 WHERE id = ?').run(id);
  },

  /**
   * Invalidate all outstanding sessions for a user (single active OTP policy).
   * @param {string} userId
   * @returns {void}
   */
  invalidateForUser(userId) {
    getDb().prepare('UPDATE otp_sessions SET verified = 1 WHERE user_id = ? AND verified = 0').run(userId);
  },
};

/**
 * Repository for the audit / query log feed.
 */
export const queryLogRepository = {
  /**
   * Record an executed recon query.
   * @param {{ operatorId: string, toolUsed: string, searchQuery: string, resultsCached?: unknown }} data
   * @returns {string} the created log id
   */
  create({ operatorId, toolUsed, searchQuery, resultsCached }) {
    const id = crypto.randomUUID();
    getDb()
      .prepare(
        `INSERT INTO query_logs (id, operator_id, tool_used, search_query, results_cached, executed_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        operatorId,
        toolUsed,
        searchQuery,
        resultsCached ? JSON.stringify(resultsCached) : null,
        nowIso(),
      );
    return id;
  },

  /**
   * List recent queries for an operator, newest first.
   * @param {string} operatorId
   * @param {number} [limit=25]
   * @returns {object[]}
   */
  listRecent(operatorId, limit = 25) {
    return getDb()
      .prepare(
        `SELECT id, tool_used, search_query, executed_at
         FROM query_logs WHERE operator_id = ?
         ORDER BY executed_at DESC LIMIT ?`,
      )
      .all(operatorId, limit);
  },
};
