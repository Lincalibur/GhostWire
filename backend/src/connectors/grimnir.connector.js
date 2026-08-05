import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchWithTimeout } from './httpClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const HANDLE_RE = /^[A-Za-z0-9_.-]{1,39}$/;
const PROBE_TIMEOUT_MS = 6000;

/**
 * Platform-detection dataset — a filtered, vendored snapshot of the
 * WhatsMyName project (github.com/WebBreacher/WhatsMyName, CC BY-SA 4.0),
 * limited to GET-only, unprotected entries so unattended server-side
 * probing stays reliable. See backend/src/connectors/data/wmn-platforms.json.
 * @type {Array<{ name: string, uri_check: string, e_code: number, e_string: string, m_code: number|null, m_string: string }>}
 */
const PLATFORMS = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'wmn-platforms.json'), 'utf8'),
).sites;

/**
 * Probe a single platform: existence is determined by matching both the
 * expected HTTP status code and (when present) a substring expected in the
 * response body — status alone is not reliable since many platforms return
 * 200 for both a real profile and a generic "not found" page.
 * @param {{ name: string, uri_check: string, e_code: number, e_string: string }} site
 * @param {string} handle
 * @returns {Promise<{ platform: string, found: boolean, status: number | null }>}
 */
async function probe(site, handle) {
  const url = site.uri_check.replace('{account}', encodeURIComponent(handle));
  try {
    const res = await fetchWithTimeout(url, { method: 'GET', timeoutMs: PROBE_TIMEOUT_MS });
    const body = site.e_string ? await res.text() : '';
    const found = res.status === site.e_code && (!site.e_string || body.includes(site.e_string));
    return { platform: site.name, found, status: res.status };
  } catch {
    return { platform: site.name, found: false, status: null };
  }
}

/**
 * Grimnir — Alias tracker. Maps a username across public developer/social
 * surfaces via non-intrusive HTTP probing, using the vendored WhatsMyName
 * platform-detection dataset for coverage.
 */
export const grimnirConnector = {
  id: 'grimnir',
  label: 'Grimnir',
  title: 'Grimnir // ALIAS TRACKER',
  inputLabel: 'OPERATOR HANDLE / USERNAME',
  placeholder: 'e.g., net_phantom',

  /**
   * @param {string} query username to trace
   * @returns {Promise<{ lines: string[], data: object }>}
   */
  async run(query) {
    const handle = query.trim();
    if (!HANDLE_RE.test(handle)) {
      return { lines: [`  [x] Invalid handle format: ${query}`], data: { error: 'INVALID_HANDLE' } };
    }

    const lines = [`  -> Traversing ${PLATFORMS.length} public directories for [${handle}]...`];
    const results = await Promise.all(PLATFORMS.map((site) => probe(site, handle)));

    const hits = results.filter((r) => r.found);
    for (const r of hits) {
      lines.push(`  -> [FOUND]  ${r.platform}`);
    }
    lines.push(`  -> Trace complete. ${hits.length}/${results.length} surface(s) matched.`);

    return { lines, data: { handle, results } };
  },
};
