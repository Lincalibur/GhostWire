const BASE = '/api';

/**
 * Perform a JSON API request against the GhostWire backend.
 * Credentials (the session cookie) are always included.
 *
 * @param {string} path e.g. "/auth/login"
 * @param {{ method?: string, body?: object }} [options]
 * @returns {Promise<any>} parsed JSON response
 * @throws {Error} with `.code` and `.status` on non-2xx responses
 */
async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

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

/** GhostWire API surface. */
export const api = {
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
    query: (module, query) => request('/recon/query', { method: 'POST', body: { module, query } }),
    history: () => request('/recon/history'),
  },
};
