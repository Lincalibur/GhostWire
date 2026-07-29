import { fetchWithTimeout, fetchJson } from './httpClient.js';
import { sha1Hex } from '../utils/crypto.js';

const HIBP_RANGE = 'https://api.pwnedpasswords.com/range/';
const XPOSEDORNOT_CHECK_EMAIL = 'https://api.xposedornot.com/v1/check-email/';

/**
 * Password exposure check via the HaveIBeenPwned "Pwned Passwords" range API.
 * k-anonymity model: only the first 5 characters of the SHA-1 hash ever
 * leave the host, so the checked secret is never disclosed.
 * @param {string} password
 * @returns {Promise<{ lines: string[], data: { checked: true, prefix: string, exposed: boolean, count: number, error?: string } }>}
 */
async function checkPassword(password) {
  const hash = sha1Hex(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  const lines = ['  [PASSWORD] Computing SHA-1 digest (k-anonymity range query)...'];

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
      lines.push('  [PASSWORD] MATCH: exposure confirmed in known breach corpora.');
      lines.push(`  [PASSWORD] Seen ${count.toLocaleString()} time(s) across indexed dumps.`);
      lines.push('  [PASSWORD] STATUS: CRITICAL — credential compromised. Rotate immediately.');
    } else {
      lines.push('  [PASSWORD] No exposure found in indexed breach corpora.');
      lines.push('  [PASSWORD] STATUS: CLEAR (absence of evidence is not evidence of absence).');
    }

    return { lines, data: { checked: true, prefix, exposed: count > 0, count } };
  } catch (err) {
    lines.push(`  [x] Password exposure index unreachable: ${err.message}`);
    return { lines, data: { checked: true, error: 'UPSTREAM_UNAVAILABLE' } };
  }
}

/**
 * Email breach lookup via XposedOrNot's free, keyless check-email endpoint.
 * Not a k-anonymity method — the email address itself is sent to the
 * upstream, unlike the password check above.
 * @param {string} email
 * @returns {Promise<{ lines: string[], data: { checked: true, exposed: boolean, breaches: string[], error?: string } }>}
 */
async function checkEmail(email) {
  const lines = [`  [EMAIL] Querying breach index for ${email}...`];

  const result = await fetchJson(`${XPOSEDORNOT_CHECK_EMAIL}${encodeURIComponent(email)}`);
  if (!result) {
    lines.push('  [x] Email breach index unreachable.');
    return { lines, data: { checked: true, error: 'UPSTREAM_UNAVAILABLE' } };
  }

  const breaches = Array.isArray(result.breaches?.[0]) ? result.breaches[0] : [];

  if (breaches.length > 0) {
    lines.push(`  [EMAIL] MATCH: found in ${breaches.length} breach(es).`);
    lines.push(`  [EMAIL] ${breaches.join(', ')}`);
    lines.push('  [EMAIL] STATUS: CRITICAL — associated accounts may be compromised.');
  } else {
    lines.push('  [EMAIL] No exposure found in indexed breach corpora.');
    lines.push('  [EMAIL] STATUS: CLEAR (absence of evidence is not evidence of absence).');
  }

  return { lines, data: { checked: true, exposed: breaches.length > 0, breaches } };
}

/**
 * v0id — Breach archive indexer. Runs an email breach lookup and/or a
 * password exposure check depending on which inputs are supplied.
 */
export const v0idConnector = {
  id: 'v0id',
  label: 'v0id',
  title: 'v0id // BREACH ARCHIVE INDEXER',
  inputLabel: 'EMAIL AND/OR PASSWORD TO ASSESS',
  placeholder: 'e.g., name@example.com',

  /**
   * @param {string} query JSON-encoded `{ email, password }`; a plain
   *   string is treated as a legacy password-only query for backward
   *   compatibility with malformed/old payloads.
   * @returns {Promise<{ lines: string[], data: object }>}
   */
  async run(query) {
    let email = '';
    let password = '';
    try {
      const parsed = JSON.parse(query);
      email = typeof parsed.email === 'string' ? parsed.email.trim() : '';
      password = typeof parsed.password === 'string' ? parsed.password.trim() : '';
    } catch {
      password = query.trim();
    }

    if (!email && !password) {
      return { lines: ['  [x] No email or password supplied.'], data: { error: 'EMPTY_QUERY' } };
    }

    const [emailResult, passwordResult] = await Promise.all([
      email ? checkEmail(email) : null,
      password ? checkPassword(password) : null,
    ]);

    const lines = [...(emailResult?.lines || []), ...(passwordResult?.lines || [])];

    return {
      lines,
      data: {
        email: emailResult?.data || null,
        password: passwordResult?.data || null,
      },
    };
  },
};
