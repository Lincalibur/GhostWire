import { fetchWithTimeout } from './httpClient.js';
import { sha1Hex } from '../utils/crypto.js';

const HIBP_RANGE = 'https://api.pwnedpasswords.com/range/';

/**
 * v0id — Breach archive indexer.
 *
 * Uses the HaveIBeenPwned "Pwned Passwords" range API with the k-anonymity
 * model: only the first 5 characters of the SHA-1 hash ever leave the host,
 * so the checked secret is never disclosed. Input is treated as a candidate
 * credential/passphrase to assess exposure.
 */
export const v0idConnector = {
  id: 'v0id',
  label: 'v0id',
  title: 'v0id // BREACH ARCHIVE INDEXER',
  inputLabel: 'CREDENTIAL OR PASSPHRASE TO ASSESS',
  placeholder: 'e.g., password123',

  /**
   * @param {string} query candidate secret to assess
   * @returns {Promise<{ lines: string[], data: object }>}
   */
  async run(query) {
    const hash = sha1Hex(query);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const lines = ['  -> Computing SHA-1 digest (k-anonymity range query)...'];

    try {
      const res = await fetchWithTimeout(`${HIBP_RANGE}${prefix}`, {
        headers: { 'Add-Padding': 'true' },
      });
      if (!res.ok) throw new Error(`HIBP responded ${res.status}`);

      const body = await res.text();
      const match = body
        .split('\n')
        .map((l) => l.trim().split(':'))
        .find(([hashSuffix]) => hashSuffix === suffix);

      const count = match ? Number.parseInt(match[1], 10) : 0;

      if (count > 0) {
        lines.push(`  -> MATCH: exposure confirmed in known breach corpora.`);
        lines.push(`  -> Seen ${count.toLocaleString()} time(s) across indexed dumps.`);
        lines.push('  -> STATUS: CRITICAL — credential compromised. Rotate immediately.');
      } else {
        lines.push('  -> No exposure found in indexed breach corpora.');
        lines.push('  -> STATUS: CLEAR (absence of evidence is not evidence of absence).');
      }

      return { lines, data: { prefix, exposed: count > 0, count } };
    } catch (err) {
      lines.push(`  [x] Breach index unreachable: ${err.message}`);
      return { lines, data: { error: 'UPSTREAM_UNAVAILABLE' } };
    }
  },
};
