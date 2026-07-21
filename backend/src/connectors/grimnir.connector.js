import { fetchWithTimeout } from './httpClient.js';

const HANDLE_RE = /^[A-Za-z0-9_.-]{1,39}$/;

/** Public profile surfaces probed by passive HTTP status checks. */
const PLATFORMS = [
  { name: 'GitHub', url: (h) => `https://github.com/${h}` },
  { name: 'Reddit', url: (h) => `https://www.reddit.com/user/${h}/about.json` },
  { name: 'GitLab', url: (h) => `https://gitlab.com/${h}` },
  { name: 'Keybase', url: (h) => `https://keybase.io/${h}` },
];

/**
 * Probe a single platform for the presence of a handle.
 * @param {{ name: string, url: (h: string) => string }} platform
 * @param {string} handle
 * @returns {Promise<{ platform: string, found: boolean, status: number | null }>}
 */
async function probe(platform, handle) {
  try {
    const res = await fetchWithTimeout(platform.url(handle), { method: 'GET', timeoutMs: 6000 });
    return { platform: platform.name, found: res.status === 200, status: res.status };
  } catch {
    return { platform: platform.name, found: false, status: null };
  }
}

/**
 * Grimnir — Alias tracker. Maps a username across public developer/social
 * surfaces via non-intrusive HTTP status probing.
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

    const lines = [`  -> Traversing public directories for [${handle}]...`];
    const results = await Promise.all(PLATFORMS.map((p) => probe(p, handle)));

    for (const r of results) {
      lines.push(
        r.found
          ? `  -> [FOUND]  ${r.platform}`
          : `  -> [clear]  ${r.platform} (${r.status ?? 'no response'})`,
      );
    }

    const hits = results.filter((r) => r.found).length;
    lines.push(`  -> Trace complete. ${hits}/${results.length} surface(s) matched.`);

    return { lines, data: { handle, results } };
  },
};
