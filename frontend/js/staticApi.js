/**
 * In-browser mock API for the GitHub Pages static showcase.
 * Mirrors the live `/api` shape so the UI can run without a backend.
 */

const MODULES = [
  {
    id: 'mspect',
    label: 'µspect',
    title: 'µspect // TARGET FOOTPRINTING',
    inputLabel: 'TARGET DOMAIN',
    placeholder: 'e.g., example.com',
  },
  {
    id: 'v0id',
    label: 'v0id',
    title: 'v0id // BREACH ARCHIVE INDEXER',
    inputLabel: 'CREDENTIAL OR PASSPHRASE TO ASSESS',
    placeholder: 'e.g., password123',
  },
  {
    id: 'grimnir',
    label: 'Grimnir',
    title: 'Grimnir // ALIAS TRACKER',
    inputLabel: 'OPERATOR HANDLE / USERNAME',
    placeholder: 'e.g., net_phantom',
  },
  {
    id: 'wiretap',
    label: 'WireTap',
    title: 'WireTap // SIGNAL LEAKAGE SNIFFER',
    inputLabel: 'ORG / KEYWORD',
    placeholder: 'e.g., acme',
  },
];

let sessionHandle = null;
const history = [];

function delay(ms = 280) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Sample console lines + structured data per module, shaped like the live connectors. */
function sampleResult(module, query) {
  const q = query.trim();
  switch (module) {
    case 'mspect': {
      const subdomains = [`dev.${q}`, `mail.${q}`, `www.${q}`];
      return {
        lines: [
          `  -> Resolving infrastructure records for ${q}...`,
          '  -> A   : 93.184.216.34',
          '  -> AAAA: 2606:2800:220:1:248:1893:25c8:1946',
          '  -> MX  : 10 mail.example.net.',
          '  -> NS  : a.iana-servers.net., b.iana-servers.net.',
          '  -> TXT : "v=spf1 -all"',
          '  -> Cross-referencing Certificate Transparency logs...',
          `  -> ${subdomains.length} subdomain(s) surfaced via issued certificates:`,
          ...subdomains.map((s) => `  ->   ${s}`),
          '  -> [ STATIC DEMO ] Live DoH / crt.sh disabled on GitHub Pages.',
        ],
        data: {
          domain: q,
          records: { A: ['93.184.216.34'], AAAA: [], MX: ['10 mail.example.net.'], NS: [], TXT: [] },
          subdomains,
        },
      };
    }
    case 'v0id':
      return {
        lines: [
          '  -> Computing SHA-1 digest (k-anonymity range query)...',
          '  -> MATCH: exposure confirmed in known breach corpora.',
          '  -> Seen 12,481 time(s) across indexed dumps.',
          '  -> STATUS: CRITICAL — credential compromised. Rotate immediately.',
          '  -> [ STATIC DEMO ] HIBP upstream disabled on GitHub Pages.',
        ],
        data: { prefix: 'ABCDE', exposed: true, count: 12481 },
      };
    case 'grimnir': {
      const results = [
        { platform: 'GitHub', found: true, status: 200 },
        { platform: 'Reddit', found: false, status: 404 },
        { platform: 'GitLab', found: true, status: 200 },
        { platform: 'Keybase', found: false, status: 404 },
      ];
      return {
        lines: [
          `  -> Traversing public directories for [${q}]...`,
          '  -> [FOUND]  GitHub',
          '  -> [clear]  Reddit (404)',
          '  -> [FOUND]  GitLab',
          '  -> [clear]  Keybase (404)',
          '  -> Trace complete. 2/4 surface(s) matched.',
          '  -> [ STATIC DEMO ] Live probes disabled on GitHub Pages.',
        ],
        data: { handle: q, results },
      };
    }
    case 'wiretap': {
      const results = [
        { bucket: `${q}-backup`, url: `https://${q}-backup.s3.amazonaws.com/`, status: 403, state: 'exists-private' },
        { bucket: `${q}-assets`, url: `https://${q}-assets.s3.amazonaws.com/`, status: 200, state: 'OPEN' },
      ];
      return {
        lines: [
          `  -> Enumerating cloud-bucket namespace for [${q}]...`,
          `  -> [exists] ${q}-backup — access denied (private)`,
          `  -> [LEAK]   ${q}-assets — PUBLIC LISTING`,
          '  -> Sweep complete. 1 open bucket(s) flagged.',
          '  -> [ STATIC DEMO ] Live S3 probes disabled on GitHub Pages.',
        ],
        data: { keyword: q, results },
      };
    }
    default:
      return { lines: [`  [x] Unknown module in static demo: ${module}`], data: {} };
  }
}

/** @type {import('./api.js').api} */
export const staticApi = {
  health: async () => {
    await delay(80);
    return {
      status: 'ok',
      staticDemo: true,
      devMode: true,
      devOperator: 'ghost',
      devPassword: 'wire',
    };
  },

  auth: {
    login: async (handle) => {
      await delay();
      sessionHandle = handle.trim() || 'ghost';
      return { ok: true, channel: 'console', message: 'OTP dispatched (static demo).' };
    },
    verify: async (handle) => {
      await delay();
      sessionHandle = handle.trim() || sessionHandle || 'ghost';
      return { operator: { handle: sessionHandle } };
    },
    devLogin: async () => {
      await delay(120);
      sessionHandle = 'ghost';
      return { operator: { handle: 'ghost' } };
    },
    logout: async () => {
      sessionHandle = null;
      return { ok: true };
    },
    session: async () => {
      await delay(60);
      if (!sessionHandle) {
        const err = new Error('No active session');
        err.status = 401;
        err.code = 'UNAUTHORIZED';
        throw err;
      }
      return { operator: { handle: sessionHandle } };
    },
  },

  recon: {
    modules: async () => {
      await delay(100);
      return { modules: MODULES };
    },
    query: async (module, query) => {
      await delay(600);
      const { lines, data } = sampleResult(module, query);
      const payload = { module, query, lines, data };
      history.unshift({
        toolUsed: module,
        searchQuery: query,
        createdAt: new Date().toISOString(),
      });
      return payload;
    },
    history: async () => {
      await delay(80);
      return { history: history.slice(0, 20) };
    },
  },
};
