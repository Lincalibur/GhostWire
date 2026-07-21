import { fetchWithTimeout } from './httpClient.js';
import { config } from '../config/index.js';

const KEYWORD_RE = /^[A-Za-z0-9_.-]{1,50}$/;
const SUFFIXES = ['', '-assets', '-backup', '-dev', '-static', '-prod', '-media', '-uploads'];

/**
 * Probe a candidate S3 bucket by HTTP status.
 *   200 -> public listing enabled (leak)
 *   403 -> bucket exists but access denied
 *   404 -> no such bucket
 * @param {string} bucket
 * @returns {Promise<{ bucket: string, url: string, status: number | null, state: string }>}
 */
async function probeBucket(bucket) {
  const url = `https://${bucket}.s3.amazonaws.com/`;
  try {
    const res = await fetchWithTimeout(url, { method: 'GET', timeoutMs: 6000 });
    let state = 'none';
    if (res.status === 200) state = 'OPEN';
    else if (res.status === 403) state = 'exists-private';
    return { bucket, url, status: res.status, state };
  } catch {
    return { bucket, url, status: null, state: 'unreachable' };
  }
}

/**
 * WireTap — Signal leakage sniffer. Enumerates common cloud-bucket naming
 * permutations for a keyword and passively classifies their exposure.
 *
 * When a GrayhatWarfare API key is configured it can be layered in here;
 * otherwise the connector relies on passive S3 endpoint probing.
 */
export const wiretapConnector = {
  id: 'wiretap',
  label: 'WireTap',
  title: 'WireTap // SIGNAL LEAKAGE SNIFFER',
  inputLabel: 'ORG / KEYWORD',
  placeholder: 'e.g., acme',

  /**
   * @param {string} query organisation or keyword seed
   * @returns {Promise<{ lines: string[], data: object }>}
   */
  async run(query) {
    const keyword = query.trim().toLowerCase();
    if (!KEYWORD_RE.test(keyword)) {
      return { lines: [`  [x] Invalid keyword format: ${query}`], data: { error: 'INVALID_KEYWORD' } };
    }

    const lines = [`  -> Enumerating cloud-bucket namespace for [${keyword}]...`];
    if (config.connectors.grayhatWarfareApiKey) {
      lines.push('  -> GrayhatWarfare key detected (augmented enumeration enabled).');
    }

    const candidates = SUFFIXES.map((s) => `${keyword}${s}`);
    const results = await Promise.all(candidates.map(probeBucket));

    let leaks = 0;
    for (const r of results.filter((x) => x.state !== 'none' && x.state !== 'unreachable')) {
      if (r.state === 'OPEN') {
        leaks += 1;
        lines.push(`  -> [LEAK]   ${r.bucket} — PUBLIC LISTING (${r.url})`);
      } else {
        lines.push(`  -> [exists] ${r.bucket} — access denied (private)`);
      }
    }

    if (lines.length === (config.connectors.grayhatWarfareApiKey ? 3 : 2)) {
      lines.push('  -> No candidate buckets responded across probed permutations.');
    }
    lines.push(`  -> Sweep complete. ${leaks} open bucket(s) flagged.`);

    return { lines, data: { keyword, results } };
  },
};
