import { fetchJson } from './httpClient.js';

const DOH_ENDPOINT = 'https://cloudflare-dns.com/dns-query';
const INTERNETDB_ENDPOINT = 'https://internetdb.shodan.io/';
const IP_RE = /^(\d{1,3}\.){3}\d{1,3}$/;
const DOMAIN_RE = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z0-9-]{1,63})+$/;

/**
 * Resolve a domain to its first A record via Cloudflare DNS-over-HTTPS.
 * @param {string} domain
 * @returns {Promise<string|null>}
 */
async function resolveToIp(domain) {
  const url = `${DOH_ENDPOINT}?name=${encodeURIComponent(domain)}&type=A`;
  const data = await fetchJson(url, { headers: { Accept: 'application/dns-json' } });
  const answer = data?.Answer?.find((a) => a.type === 1);
  return answer?.data || null;
}

/**
 * Shodan — Infrastructure exposure via Shodan's free, keyless InternetDB
 * endpoint: open ports, known CVEs, hostnames, and CPEs indexed for a host.
 * No API key required for this endpoint.
 */
export const shodanConnector = {
  id: 'shodan',
  label: 'Shodan',
  title: 'Shodan // INFRASTRUCTURE EXPOSURE',
  inputLabel: 'TARGET IP OR DOMAIN',
  placeholder: 'e.g., 1.1.1.1 or example.com',

  /**
   * @param {string} query IP address or domain to look up
   * @returns {Promise<{ lines: string[], data: object }>}
   */
  async run(query) {
    const raw = query.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
    const lines = [];
    let ip = raw;

    if (!IP_RE.test(raw)) {
      if (!DOMAIN_RE.test(raw)) {
        return { lines: [`  [x] Invalid IP or domain format: ${query}`], data: { error: 'INVALID_TARGET' } };
      }
      lines.push(`  -> Resolving ${raw} to an IP address...`);
      ip = await resolveToIp(raw);
      if (!ip) {
        lines.push('  [x] Could not resolve target to an IP address.');
        return { lines, data: { error: 'RESOLUTION_FAILED' } };
      }
      lines.push(`  -> Resolved to ${ip}.`);
    }

    lines.push(`  -> Querying Shodan InternetDB for ${ip}...`);
    const result = await fetchJson(`${INTERNETDB_ENDPOINT}${ip}`);

    if (!result) {
      lines.push('  -> No indexed data for this host.');
      return { lines, data: { ip, indexed: false } };
    }

    const { ports = [], vulns = [], hostnames = [], cpes = [], tags = [] } = result;
    if (ports.length) lines.push(`  -> OPEN PORTS: ${ports.join(', ')}`);
    if (hostnames.length) lines.push(`  -> HOSTNAMES: ${hostnames.join(', ')}`);
    if (tags.length) lines.push(`  -> TAGS: ${tags.join(', ')}`);
    if (vulns.length) {
      lines.push(
        `  -> [!] ${vulns.length} known vulnerability(ies): ${vulns.slice(0, 10).join(', ')}${vulns.length > 10 ? ', ...' : ''}`,
      );
      lines.push('  -> STATUS: CRITICAL — unpatched exposure indexed.');
    } else {
      lines.push('  -> No known vulnerabilities indexed for this host.');
    }

    return { lines, data: { ip, indexed: true, ports, vulns, hostnames, cpes, tags } };
  },
};
