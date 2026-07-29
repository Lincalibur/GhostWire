import { getRuntimeConfig } from './config.js';
import { staticApi } from './staticApi.js';

const BASE = '/api';
const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Perform a JSON API request against the GhostWire backend.
 * Credentials (the session cookie) are always included. The request is
 * aborted after `timeoutMs` so a stalled connector/network hang surfaces as
 * a clear timeout error instead of leaving a caller waiting forever.
 *
 * @param {string} path e.g. "/auth/login"
 * @param {{ method?: string, body?: object, timeoutMs?: number }} [options]
 * @returns {Promise<any>} parsed JSON response
 * @throws {Error} with `.code` ('TIMEOUT' on abort, otherwise the server's error code) and `.status`
 */
async function request(path, { method = 'GET', body, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      const timeoutErr = new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s.`);
      timeoutErr.code = 'TIMEOUT';
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const err = new Error(payload?.error?.message || `Request failed (${res.status})`);
    err.code = payload?.error?.code || 'ERROR';
    err.status = res.status;
    throw err;
  }
  return payload;
}

const liveApi = {
  health: () => request('/health'),

  auth: {
    login: (handle, password) => request('/auth/login', { method: 'POST', body: { handle, password } }),
    verify: (handle, otp) => request('/auth/verify', { method: 'POST', body: { handle, otp } }),
    devLogin: () => request('/auth/dev-login', { method: 'POST' }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    session: () => request('/auth/session'),
  },

  recon: {
    modules: () => request('/recon/modules'),
    query: (module, query) =>
      request('/recon/query', { method: 'POST', body: { module, query }, timeoutMs: 25000 }),
    history: () => request('/recon/history'),
  },
};

/** GhostWire API surface — live backend, or static demo on GitHub Pages. */
export const api = getRuntimeConfig().staticDemo ? staticApi : liveApi;
