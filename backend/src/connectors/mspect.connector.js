import { fetchJson } from './httpClient.js';

const DOH_ENDPOINT = 'https://cloudflare-dns.com/dns-query';
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

    for (const type of RECORD_TYPES) {
      // eslint-disable-next-line no-await-in-loop
      const values = await queryRecord(domain, type);
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

    return { lines, data: { domain, records } };
  },
};
