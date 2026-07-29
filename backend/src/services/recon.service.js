import { ApiError } from '../utils/ApiError.js';
import { getConnector } from '../connectors/index.js';
import { queryLogRepository } from '../db/repositories.js';
import { logger } from '../utils/logger.js';

const MAX_QUERY_LENGTH = 255;

/**
 * v0id's query payload may carry a raw password (JSON `{ email, password }`).
 * Never persist that plaintext to the audit log — redact it before storage.
 * @param {string} module
 * @param {string} query
 * @returns {string}
 */
function redactForLog(module, query) {
  if (module !== 'v0id') return query;
  try {
    const parsed = JSON.parse(query);
    if (typeof parsed.password === 'string' && parsed.password) {
      parsed.password = '[REDACTED]';
      return JSON.stringify(parsed);
    }
    return query;
  } catch {
    return query;
  }
}

/**
 * Execute a recon query against the requested connector, persisting an audit
 * log entry for the operator.
 *
 * @param {{ operatorId: string, module: string, query: string }} params
 * @returns {Promise<{ module: string, query: string, lines: string[], data: object }>}
 * @throws {ApiError} 400 for invalid input or unknown module
 */
export async function executeQuery({ operatorId, module, query }) {
  const connector = getConnector(module);
  if (!connector) {
    throw ApiError.badRequest(`Unknown recon module: ${module}`, 'UNKNOWN_MODULE');
  }

  const trimmed = query.trim();
  if (!trimmed) {
    throw ApiError.badRequest('Query cannot be empty.', 'EMPTY_QUERY');
  }
  if (trimmed.length > MAX_QUERY_LENGTH) {
    throw ApiError.badRequest('Query exceeds maximum length.', 'QUERY_TOO_LONG');
  }

  logger.info('Recon query dispatched', { operatorId, module });
  const { lines, data } = await connector.run(trimmed);

  queryLogRepository.create({
    operatorId,
    toolUsed: module,
    searchQuery: redactForLog(module, trimmed),
    resultsCached: data,
  });

  return { module, query: trimmed, lines, data };
}

/**
 * Retrieve recent query history for an operator.
 * @param {string} operatorId
 * @returns {object[]}
 */
export function recentHistory(operatorId) {
  return queryLogRepository.listRecent(operatorId);
}
