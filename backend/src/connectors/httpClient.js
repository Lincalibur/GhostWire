const DEFAULT_TIMEOUT_MS = 8000;
const USER_AGENT = 'GhostWire-Recon/1.0 (+passive-osint)';

/**
 * Perform a fetch with an enforced timeout and a consistent User-Agent.
 * @param {string} url
 * @param {RequestInit & { timeoutMs?: number }} [options]
 * @returns {Promise<Response>}
 * @throws {Error} on network failure or timeout
 */
export async function fetchWithTimeout(url, options = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, headers, ...rest } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...rest,
      headers: { 'User-Agent': USER_AGENT, ...headers },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch JSON, returning null on any failure (connectors degrade gracefully).
 * @param {string} url
 * @param {object} [options]
 * @returns {Promise<any|null>}
 */
export async function fetchJson(url, options) {
  try {
    const res = await fetchWithTimeout(url, options);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
