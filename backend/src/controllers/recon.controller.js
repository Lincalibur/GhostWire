import { ApiError } from '../utils/ApiError.js';
import { executeQuery, recentHistory } from '../services/recon.service.js';
import { listConnectorMeta } from '../connectors/index.js';

/**
 * GET /api/recon/modules — list available recon modules and their metadata.
 * @param {import('express').Request} _req
 * @param {import('express').Response} res
 */
export async function modules(_req, res) {
  res.json({ modules: listConnectorMeta() });
}

/**
 * POST /api/recon/query — run a recon module for the authenticated operator.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function query(req, res) {
  const module = typeof req.body?.module === 'string' ? req.body.module.trim() : '';
  const q = typeof req.body?.query === 'string' ? req.body.query : '';

  if (!module) {
    throw ApiError.badRequest('A recon module must be specified.', 'MISSING_MODULE');
  }

  const result = await executeQuery({ operatorId: req.operator.id, module, query: q });
  res.json(result);
}

/**
 * GET /api/recon/history — recent query history for the operator.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function history(req, res) {
  res.json({ history: recentHistory(req.operator.id) });
}
