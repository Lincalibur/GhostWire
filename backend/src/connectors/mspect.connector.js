import { fetchJson } from './httpClient.js';

const DOH_ENDPOINT = 'https://cloudflare-dns.com/dns-query';
const CRTSH_ENDPOINT = 'https://crt.sh/';
const RECORD_TYPES = ['A', 'AAAA', 'MX', 'NS', 'TXT'];
const DOMAIN_RE = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z0-9-]{1,63})+$/;

/**
 * Query a single DNS record type via Cloudflare DNS-over-HTTPS.
 * @param {string} domain
 * @param {string} type
 * @returns {Promise<string[]>} record values
 */
async function queryRecord(domain, type) {
  const url = `${DOH_ENDPOINT}?name=${encodeURIComponent(domain)}&type=${type}`;
  const data = await fetchJson(url, { headers: { Accept: 'application/dns-json' } });
  if (!data?.Answer) return [];
  return data.Answer.map((a) => a.data);
}

/**
 * Enumerate historical subdomains via Certificate Transparency logs (crt.sh).
 * Free, keyless, and passive — every cert ever issued for the domain is public.
 * @param {string} domain
 * @returns {Promise<string[]>} sorted, de-duplicated subdomain list
 */
async function queryCertTransparency(domain) {
  const url = `${CRTSH_ENDPOINT}?q=${encodeURIComponent(`%.${domain}`)}&output=json`;
  const data = await fetchJson(url);
  if (!Array.isArray(data)) return [];

  const names = new Set();
  for (const entry of data) {
    const value = entry?.name_value;
    if (!value) continue;
    for (const name of value.split('\n')) {
      const clean = name.trim().toLowerCase().replace(/^\*\./, '');
      if (clean && clean.endsWith(domain)) names.add(clean);
    }
  }
  return [...names].sort();
}

/**
 * µspect — Target footprinting via DNS-over-HTTPS infrastructure resolution.
 */
export const mspectConnector = {
  id: 'mspect',
  label: 'µspect',
  title: 'µspect // TARGET FOOTPRINTING',
  inputLabel: 'TARGET DOMAIN',
  placeholder: 'e.g., example.com',

  /**
   * @param {string} query domain to footprint
   * @returns {Promise<{ lines: string[], data: object }>}
   */
  async run(query) {
    const domain = query.toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
    if (!DOMAIN_RE.test(domain)) {
      return { lines: [`  [x] Invalid domain format: ${query}`], data: { error: 'INVALID_DOMAIN' } };
    }

    const lines = [`  -> Resolving infrastructure records for ${domain}...`];
    const records = {};

    // Per-type DNS lookups run concurrently rather than sequentially — each
    // is individually timeout-bounded by fetchWithTimeout, so this also
    // bounds the connector's worst-case latency to one timeout window
    // instead of stacking five of them.
    const recordResults = await Promise.all(
      RECORD_TYPES.map(async (type) => [type, await queryRecord(domain, type)]),
    );
    for (const [type, values] of recordResults) {
      records[type] = values;
      if (values.length) {
        lines.push(`  -> ${type.padEnd(4)}: ${values.slice(0, 5).join(', ')}`);
      }
    }

    const total = Object.values(records).reduce((n, v) => n + v.length, 0);
    lines.push(
      total > 0
        ? `  -> Footprint mapped. ${total} record(s) resolved.`
        : '  [!] No public DNS records resolved for target.',
    );

    lines.push('  -> Cross-referencing Certificate Transparency logs...');
    const subdomains = await queryCertTransparency(domain);
    if (subdomains.length) {
      lines.push(`  -> ${subdomains.length} subdomain(s) surfaced via issued certificates:`);
      for (const s of subdomains.slice(0, 12)) lines.push(`  ->   ${s}`);
      if (subdomains.length > 12) lines.push(`  ->   ...and ${subdomains.length - 12} more.`);
    } else {
      lines.push('  -> No certificate-log subdomains found.');
    }

    return { lines, data: { domain, records, subdomains } };
  },
};
