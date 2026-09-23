import crypto from 'node:crypto';
import { fetchJson, fetchWithTimeout } from '../httpClient.js';
import { config } from '../../config/index.js';

/**
 * Keyless, API-based data sources shared by the Dossier (company) and
 * Profiler (person) connectors. Nothing here scrapes HTML — every source is a
 * documented public API or a standard machine-readable file. Every function
 * degrades to an empty result on failure so one flaky source never aborts a run.
 */

const DOH = 'https://cloudflare-dns.com/dns-query';

/** @param {string} s */
export const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');

/** @param {string} name @returns {string} lowercase alphanumeric slug */
export const slugify = (name) => name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');

/** Strip legal suffixes so "Acme Holdings (Pty) Ltd" matches "Acme". */
export function normaliseCompanyName(name) {
  return name
    .toLowerCase()
    .replace(/\b(pty|ltd|limited|inc|incorporated|llc|llp|plc|gmbh|corp|corporation|co|company|holdings|group|sa|ag|bv)\b\.?/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Loose name match: one normalised name contains the other. */
export function namesMatch(a, b) {
  const x = normaliseCompanyName(a);
  const y = normaliseCompanyName(b);
  return Boolean(x && y && (x === y || x.includes(y) || y.includes(x)));
}

/** @param {string} input @returns {string|null} bare hostname or null */
export function toDomain(input) {
  const host = String(input || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0];
  return /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})+$/.test(host) ? host : null;
}

// ── DNS ────────────────────────────────────────────────────────

/**
 * @param {string} domain
 * @param {string} type
 * @returns {Promise<string[]>}
 */
export async function dnsQuery(domain, type) {
  const data = await fetchJson(`${DOH}?name=${encodeURIComponent(domain)}&type=${type}`, {
    headers: { Accept: 'application/dns-json' },
  });
  return (data?.Answer || []).filter((a) => a.data).map((a) => a.data.replace(/^"|"$/g, '').replace(/" "/g, ''));
}

const MAIL_PROVIDERS = [
  [/google\.com|googlemail/i, 'Google Workspace'],
  [/outlook\.com|protection\.outlook|microsoft/i, 'Microsoft 365'],
  [/protonmail|proton\.ch/i, 'Proton Mail'],
  [/zoho/i, 'Zoho Mail'],
  [/mimecast/i, 'Mimecast (filtered)'],
  [/pphosted|proofpoint/i, 'Proofpoint (filtered)'],
  [/secureserver|godaddy/i, 'GoDaddy'],
  [/yahoodns/i, 'Yahoo'],
  [/fastmail/i, 'Fastmail'],
];

const TXT_VENDORS = [
  [/google-site-verification/i, 'Google (Search Console / Workspace)'],
  [/atlassian-domain-verification/i, 'Atlassian (Jira/Confluence)'],
  [/MS=ms\d+/i, 'Microsoft 365'],
  [/docusign/i, 'DocuSign'],
  [/facebook-domain-verification/i, 'Meta / Facebook'],
  [/stripe-verification/i, 'Stripe'],
  [/zoom-domain-verification|ZOOM_verify/i, 'Zoom'],
  [/slack-domain-verification/i, 'Slack'],
  [/hubspot/i, 'HubSpot'],
  [/salesforce|pardot/i, 'Salesforce'],
  [/shopify/i, 'Shopify'],
  [/amazonses|aws/i, 'AWS'],
  [/mailchimp|mandrill/i, 'Mailchimp'],
  [/sendgrid/i, 'SendGrid'],
  [/onetrust/i, 'OneTrust'],
];

/**
 * Mail + vendor fingerprint of a domain from public DNS.
 * @param {string} domain
 */
export async function domainDnsIntel(domain) {
  const [mx, txt, ns, a] = await Promise.all([
    dnsQuery(domain, 'MX'),
    dnsQuery(domain, 'TXT'),
    dnsQuery(domain, 'NS'),
    dnsQuery(domain, 'A'),
  ]);
  const mxHosts = mx.map((r) => r.split(' ').pop().replace(/\.$/, ''));
  const mailProvider = MAIL_PROVIDERS.find(([re]) => mxHosts.some((h) => re.test(h)))?.[1] || null;
  const vendors = [...new Set(TXT_VENDORS.filter(([re]) => txt.some((t) => re.test(t))).map(([, n]) => n))];
  const spf = txt.find((t) => t.toLowerCase().startsWith('v=spf1')) || null;
  return { resolves: a.length > 0 || mx.length > 0 || ns.length > 0, mxHosts, mailProvider, vendors, spf, ns };
}

// ── Company sources ────────────────────────────────────────────

const WD_PROPS = {
  P856: 'website', P159: 'hq', P571: 'inception', P1128: 'employees', P452: 'industry', P169: 'ceo',
  P112: 'founder', P17: 'country', P2002: 'twitter', P4264: 'linkedin', P2013: 'facebook',
  P2003: 'instagram', P2037: 'github', P2397: 'youtube', P1278: 'lei', P968: 'email', P1329: 'phone',
};

/**
 * Wikidata: structured company facts, official website and social handles.
 * @param {string} name
 */
export async function wikidataCompany(name) {
  const search = await fetchJson(
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&type=item&limit=6&format=json&origin=*`,
  );
  const candidates = (search?.search || []).filter((c) => !/defunct|former|discontinued|dissolved|fictional/i.test(c.description || ''));
  if (!candidates.length) return null;

  // Prefer candidates that look like organisations rather than people/places.
  const orgWords = /company|corporation|business|firm|bank|retailer|manufacturer|organi[sz]ation|startup|conglomerate|brand|agency|provider|developer|maker|group|enterprise|multinational/i;
  const pick =
    candidates.find((c) => orgWords.test(c.description || '') && namesMatch(c.label || '', name)) ||
    candidates.find((c) => orgWords.test(c.description || '')) ||
    candidates.find((c) => namesMatch(c.label || '', name));
  if (!pick) return null;

  const entity = (await fetchJson(`https://www.wikidata.org/wiki/Special:EntityData/${pick.id}.json`))?.entities?.[pick.id];
  if (!entity) return null;

  const raw = {};
  const qids = new Set();
  for (const [pid, key] of Object.entries(WD_PROPS)) {
    const values = (entity.claims?.[pid] || [])
      .map((c) => c.mainsnak?.datavalue?.value)
      .filter((v) => v !== undefined && v !== null);
    if (!values.length) continue;
    raw[key] = values;
    for (const v of values) if (v?.id) qids.add(v.id);
  }

  const labels = {};
  if (qids.size) {
    const res = await fetchJson(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${[...qids].slice(0, 50).join('|')}&props=labels&languages=en&format=json&origin=*`,
    );
    for (const [id, e] of Object.entries(res?.entities || {})) labels[id] = e.labels?.en?.value || id;
  }

  const items = (key) => (raw[key] || []).map((v) => (v?.id ? labels[v.id] : String(v))).filter(Boolean);
  const first = (key) => items(key)[0] || null;
  const inception = raw.inception?.[0]?.time?.match(/\d{4}/)?.[0] || null;
  const employees = raw.employees?.[0]?.amount ? Number(raw.employees[0].amount) : null;

  const socials = [];
  const addSocial = (network, key, urlFn) => {
    for (const v of items(key)) socials.push({ network, url: urlFn(v), source: 'Wikidata' });
  };
  addSocial('X / Twitter', 'twitter', (v) => `https://x.com/${v}`);
  addSocial('LinkedIn', 'linkedin', (v) => `https://www.linkedin.com/company/${v}`);
  addSocial('Facebook', 'facebook', (v) => `https://www.facebook.com/${v}`);
  addSocial('Instagram', 'instagram', (v) => `https://www.instagram.com/${v}`);
  addSocial('GitHub', 'github', (v) => `https://github.com/${v}`);
  addSocial('YouTube', 'youtube', (v) => `https://www.youtube.com/channel/${v}`);

  return {
    qid: pick.id,
    label: entity.labels?.en?.value || pick.label,
    description: entity.descriptions?.en?.value || pick.description || null,
    website: first('website'),
    hq: first('hq'),
    country: first('country'),
    industry: items('industry'),
    ceo: first('ceo'),
    founders: items('founder'),
    founded: inception,
    employees,
    lei: first('lei'),
    emails: items('email').map((e) => e.replace(/^mailto:/i, '')),
    phones: items('phone'),
    socials,
    url: `https://www.wikidata.org/wiki/${pick.id}`,
  };
}

/** @param {string} title */
export async function wikipediaSummary(title) {
  const res = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`);
  if (!res || res.type === 'disambiguation' || !res.extract) return null;
  return { extract: res.extract, url: res.content_urls?.desktop?.page || null };
}

/**
 * OpenStreetMap: business listings carry real phone / email / website / address tags.
 * @param {string} name
 */
export async function osmBusiness(name) {
  const res = await fetchJson(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=jsonv2&extratags=1&addressdetails=1&namedetails=1&limit=8`,
  );
  if (!Array.isArray(res)) return [];
  const results = [];
  for (const r of res) {
    if (!namesMatch(r.name || r.namedetails?.name || '', name)) continue;
    const t = r.extratags || {};
    const pick = (...keys) => keys.map((k) => t[k]).find(Boolean) || null;
    results.push({
      name: r.name || r.namedetails?.name,
      type: `${r.category}/${r.type}`,
      address: r.display_name,
      phone: pick('phone', 'contact:phone', 'contact:mobile'),
      email: pick('email', 'contact:email'),
      website: pick('website', 'contact:website', 'url'),
      facebook: pick('facebook', 'contact:facebook'),
      instagram: pick('contact:instagram', 'instagram'),
      hours: t.opening_hours || null,
      lat: r.lat,
      lon: r.lon,
      url: `https://www.openstreetmap.org/${r.osm_type}/${r.osm_id}`,
    });
  }
  return results.slice(0, 4);
}

/**
 * GLEIF: the global legal-entity register (legal name, registered address, status).
 * @param {string} name
 */
export async function gleifEntity(name) {
  const res = await fetchJson(
    `https://api.gleif.org/api/v1/lei-records?filter[fulltext]=${encodeURIComponent(name)}&page[size]=5`,
  );
  const rec = (res?.data || []).find((d) => namesMatch(d.attributes?.entity?.legalName?.name || '', name));
  if (!rec) return null;
  const e = rec.attributes.entity;
  const fmt = (a) => (a ? [...(a.addressLines || []), a.city, a.region, a.postalCode, a.country].filter(Boolean).join(', ') : null);
  return {
    lei: rec.id,
    legalName: e.legalName?.name,
    status: e.status,
    jurisdiction: e.jurisdiction,
    registeredAs: e.registeredAs || null,
    registeredAt: e.registeredAt?.id || null,
    legalAddress: fmt(e.legalAddress),
    hqAddress: fmt(e.headquartersAddress),
    url: `https://search.gleif.org/#/record/${rec.id}`,
  };
}

// ── Domain sources ─────────────────────────────────────────────

/**
 * RDAP (the modern WHOIS): registrar, dates, and any published contact vCards.
 * @param {string} domain
 */
export async function rdapDomain(domain) {
  const res = await fetchJson(`https://rdap.org/domain/${encodeURIComponent(domain)}`, { timeoutMs: 10000 });
  if (!res) return null;
  const ev = (action) => res.events?.find((e) => e.eventAction === action)?.eventDate?.slice(0, 10) || null;
  const contacts = [];
  const walk = (entities) => {
    for (const en of entities || []) {
      const v = en.vcardArray?.[1] || [];
      const get = (k) => v.find((x) => x[0] === k)?.[3];
      const email = get('email');
      const fn = get('fn');
      const tel = get('tel');
      const isRegistrarSide = en.roles?.some((r) => r === 'registrar' || r === 'abuse');
      if (!isRegistrarSide && (email || tel || fn)) contacts.push({ roles: en.roles, name: fn || null, email: email || null, phone: typeof tel === 'string' ? tel.replace(/^tel:/, '') : null });
      walk(en.entities);
    }
  };
  walk(res.entities);
  const registrar = res.entities?.find((e) => e.roles?.includes('registrar'))?.vcardArray?.[1]?.find((x) => x[0] === 'fn')?.[3] || null;
  return {
    registrar,
    registered: ev('registration'),
    expires: ev('expiration'),
    updated: ev('last changed'),
    nameservers: (res.nameservers || []).map((n) => n.ldhName?.toLowerCase()),
    contacts: contacts.filter((c) => c.email || c.phone),
  };
}

/**
 * security.txt (RFC 9116) is a file companies deliberately publish with contact details.
 * @param {string} domain
 */
export async function securityTxt(domain) {
  for (const host of [domain, `www.${domain}`]) {
    try {
      const res = await fetchWithTimeout(`https://${host}/.well-known/security.txt`, { timeoutMs: 5000 });
      if (!res.ok) continue;
      const text = (await res.text()).slice(0, 8000);
      if (!/^\s*Contact:/im.test(text)) continue;
      const grab = (key) => [...text.matchAll(new RegExp(`^\\s*${key}:\\s*(.+)$`, 'gim'))].map((m) => m[1].trim());
      return { url: `https://${host}/.well-known/security.txt`, contacts: grab('Contact'), policy: grab('Policy'), hiring: grab('Hiring') };
    } catch {
      /* try next host */
    }
  }
  return null;
}

/**
 * Check which standard "contact/careers" paths exist (status only — no page parsing).
 * @param {string} domain
 */
export async function probeCommonPages(domain) {
  const paths = ['careers', 'jobs', 'contact', 'contact-us', 'about', 'team', 'about-us', 'work-with-us', 'join-us'];
  const found = await Promise.all(
    paths.map(async (p) => {
      const url = `https://${domain}/${p}`;
      try {
        const res = await fetchWithTimeout(url, { method: 'HEAD', timeoutMs: 5000, redirect: 'follow' });
        return res.ok ? res.url || url : null;
      } catch {
        return null;
      }
    }),
  );
  return [...new Set(found.filter(Boolean))];
}

/**
 * Certificate-transparency subdomains (crt.sh) — useful for spotting careers./jobs./mail. hosts.
 * @param {string} domain
 */
export async function ctSubdomains(domain) {
  const data = await fetchJson(`https://crt.sh/?q=${encodeURIComponent(`%.${domain}`)}&output=json`, { timeoutMs: 12000 });
  if (!Array.isArray(data)) return [];
  const names = new Set();
  for (const entry of data) {
    for (const n of String(entry?.name_value || '').split('\n')) {
      const c = n.trim().toLowerCase().replace(/^\*\./, '');
      if (c && c.endsWith(domain)) names.add(c);
    }
  }
  return [...names].sort();
}

// ── GitHub ─────────────────────────────────────────────────────

/** @param {string} path API path or absolute URL */
export function github(path) {
  const headers = { Accept: 'application/vnd.github+json' };
  if (config.connectors.githubToken) headers.Authorization = `Bearer ${config.connectors.githubToken}`;
  return fetchJson(path.startsWith('http') ? path : `https://api.github.com${path}`, { headers });
}

/**
 * Find a company's GitHub org, its public profile, and the work-email
 * addresses its committers publish in public commit metadata — which reveals
 * the company's real email naming pattern.
 * @param {string} name
 * @param {string|null} domain
 */
export async function githubOrgIntel(name, domain) {
  const slug = slugify(name);
  const search = await github(`/search/users?q=${encodeURIComponent(`${name} type:org`)}&per_page=5`);
  let org = null;
  for (const item of search?.items || []) {
    const full = await github(`/orgs/${item.login}`);
    if (!full) continue;
    const blogHost = toDomain(full.blog || '');
    const blogMatch = domain && blogHost && (blogHost === domain || blogHost.endsWith(`.${domain}`));
    // With a known domain, only its own website link counts as proof; names alone are too ambiguous.
    const matches = domain ? blogMatch : slugify(full.login) === slug || slugify(full.name || '') === slug;
    if (matches) {
      org = full;
      break;
    }
  }
  if (!org) return null;

  const authors = new Map();
  const emailDomain = domain || toDomain(org.blog || '');
  if (emailDomain) {
    const repos = (await github(`/orgs/${org.login}/repos?sort=pushed&per_page=4`)) || [];
    const commitLists = await Promise.all(repos.map((r) => github(`/repos/${r.full_name}/commits?per_page=40`)));
    for (const commits of commitLists) {
      for (const c of commits || []) {
        const email = c.commit?.author?.email?.toLowerCase();
        if (!email || !email.endsWith(`@${emailDomain}`)) continue;
        authors.set(email, { email, name: c.commit.author.name || null });
      }
    }
  }
  return {
    login: org.login,
    name: org.name,
    description: org.description,
    blog: org.blog,
    email: org.email,
    twitter: org.twitter_username,
    location: org.location,
    publicRepos: org.public_repos,
    followers: org.followers,
    url: org.html_url,
    emailDomain,
    commitEmails: [...authors.values()],
  };
}

/**
 * Infer the naming pattern from known first/last + email pairs.
 * @param {Array<{ email: string, name: string|null }>} samples
 * @returns {string|null} e.g. "{first}.{last}"
 */
export function inferEmailPattern(samples) {
  const tally = {};
  for (const { email, name } of samples) {
    const parts = String(name || '').toLowerCase().replace(/[^a-z ]/g, '').split(/\s+/).filter(Boolean);
    if (parts.length < 2) continue;
    const [f, ...rest] = parts;
    const l = rest[rest.length - 1];
    const local = email.split('@')[0];
    const map = {
      '{first}.{last}': `${f}.${l}`, '{first}{last}': `${f}${l}`, '{f}{last}': `${f[0]}${l}`, '{f}.{last}': `${f[0]}.${l}`,
      '{first}': f, '{first}_{last}': `${f}_${l}`, '{first}{l}': `${f}${l[0]}`, '{last}': l, '{last}.{first}': `${l}.${f}`,
    };
    for (const [pattern, value] of Object.entries(map)) if (local === value) tally[pattern] = (tally[pattern] || 0) + 1;
  }
  return Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

/**
 * Build candidate addresses for a person at a domain.
 * @param {string} first
 * @param {string} last
 * @param {string} domain
 * @returns {Array<{ email: string, pattern: string }>}
 */
export function candidateEmails(first, last, domain) {
  const f = first.toLowerCase().replace(/[^a-z]/g, '');
  const l = last.toLowerCase().replace(/[^a-z]/g, '');
  if (!f || !l) return [];
  const map = {
    '{first}.{last}': `${f}.${l}`, '{first}{last}': `${f}${l}`, '{f}{last}': `${f[0]}${l}`, '{f}.{last}': `${f[0]}.${l}`,
    '{first}': f, '{first}_{last}': `${f}_${l}`, '{first}{l}': `${f}${l[0]}`, '{last}': l, '{last}.{first}': `${l}.${f}`, '{first}-{last}': `${f}-${l}`,
  };
  return Object.entries(map).map(([pattern, local]) => ({ email: `${local}@${domain}`, pattern }));
}

/** Apply a pattern such as "{first}.{last}" to a name. */
export function applyPattern(pattern, first, last, domain) {
  const c = candidateEmails(first, last, domain).find((x) => x.pattern === pattern);
  return c?.email || null;
}

/**
 * Hunter.io domain search (optional — requires HUNTER_API_KEY).
 * @param {string} domain
 */
export async function hunterDomain(domain) {
  const key = config.connectors.hunterApiKey;
  if (!key) return null;
  const res = await fetchJson(`https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=25&api_key=${key}`, { timeoutMs: 12000 });
  const d = res?.data;
  if (!d) return null;
  return {
    organization: d.organization,
    pattern: d.pattern,
    emails: (d.emails || []).map((e) => ({
      email: e.value,
      type: e.type,
      confidence: e.confidence,
      name: [e.first_name, e.last_name].filter(Boolean).join(' ') || null,
      position: e.position,
      department: e.department,
      linkedin: e.linkedin,
      phone: e.phone_number,
    })),
  };
}

// ── Person sources ─────────────────────────────────────────────

/** Gravatar public profile for an email (linked accounts, name, location). */
export async function gravatarProfile(email) {
  const res = await fetchJson(`https://en.gravatar.com/${md5(email.trim().toLowerCase())}.json`);
  const e = res?.entry?.[0];
  if (!e) return null;
  return {
    displayName: e.displayName || null,
    username: e.preferredUsername || null,
    about: e.aboutMe || null,
    location: e.currentLocation || null,
    urls: (e.urls || []).map((u) => u.value).filter(Boolean),
    accounts: (e.accounts || []).map((a) => ({ network: a.name || a.shortname, url: a.url, username: a.username })),
    profileUrl: e.profileUrl,
    avatar: e.thumbnailUrl,
  };
}

/** Does this address have any Gravatar registered? A cheap "this mailbox is a real, used address" signal. */
export async function gravatarExists(email) {
  try {
    const res = await fetchWithTimeout(`https://gravatar.com/avatar/${md5(email.trim().toLowerCase())}?d=404`, { method: 'HEAD', timeoutMs: 5000 });
    return res.status === 200;
  } catch {
    return false;
  }
}

/** EmailRep.io reputation + known profile hits (keyless, quota-limited). */
export async function emailRep(email) {
  const res = await fetchJson(`https://emailrep.io/${encodeURIComponent(email)}`, { headers: { Accept: 'application/json' } });
  if (!res || res.status === 'fail' || !res.details) return null;
  return {
    reputation: res.reputation,
    suspicious: res.suspicious,
    references: res.references,
    profiles: res.details.profiles || [],
    firstSeen: res.details.first_seen,
    lastSeen: res.details.last_seen,
    disposable: res.details.disposable,
    freeProvider: res.details.free_provider,
    deliverable: res.details.deliverable,
    credentialsLeaked: res.details.credentials_leaked,
    dataBreach: res.details.data_breach,
  };
}

/** Keybase: cryptographically-proven links between a handle and other accounts. */
export async function keybaseUser(username) {
  const res = await fetchJson(`https://keybase.io/_/api/1.0/user/lookup.json?usernames=${encodeURIComponent(username)}&fields=basics,profile,proofs_summary`);
  const u = res?.them?.[0];
  if (!u) return null;
  return {
    username: u.basics?.username,
    fullName: u.profile?.full_name || null,
    location: u.profile?.location || null,
    bio: u.profile?.bio || null,
    proofs: (u.proofs_summary?.all || []).map((p) => ({ network: p.proof_type, handle: p.nametag, url: p.service_url })),
    url: `https://keybase.io/${u.basics?.username}`,
  };
}

/** GitHub user profile by handle. */
export async function githubUser(username) {
  const u = await github(`/users/${encodeURIComponent(username)}`);
  if (!u || u.message) return null;
  return {
    login: u.login, name: u.name, company: u.company, blog: u.blog, location: u.location, email: u.email,
    bio: u.bio, twitter: u.twitter_username, followers: u.followers, repos: u.public_repos, created: u.created_at?.slice(0, 10), url: u.html_url,
  };
}

/** GitHub users whose public profile matches a full name (leads, not certainties). */
export async function githubSearchName(name, extra = '') {
  const res = await github(`/search/users?q=${encodeURIComponent(`"${name}" in:fullname ${extra}`.trim())}&per_page=5`);
  const out = [];
  for (const item of (res?.items || []).slice(0, 4)) {
    const u = await githubUser(item.login);
    if (u) out.push(u);
  }
  return out;
}

/** GitHub user with a given public email. */
export async function githubByEmail(email) {
  const res = await github(`/search/users?q=${encodeURIComponent(`${email} in:email`)}&per_page=1`);
  return res?.items?.[0]?.login || null;
}

const DIAL_CODES = {
  '1': 'US/Canada', '7': 'Russia/Kazakhstan', '20': 'Egypt', '27': 'South Africa', '30': 'Greece', '31': 'Netherlands', '32': 'Belgium',
  '33': 'France', '34': 'Spain', '39': 'Italy', '40': 'Romania', '41': 'Switzerland', '43': 'Austria', '44': 'United Kingdom',
  '45': 'Denmark', '46': 'Sweden', '47': 'Norway', '48': 'Poland', '49': 'Germany', '52': 'Mexico', '55': 'Brazil', '61': 'Australia',
  '62': 'Indonesia', '63': 'Philippines', '64': 'New Zealand', '65': 'Singapore', '81': 'Japan', '82': 'South Korea', '86': 'China',
  '90': 'Turkey', '91': 'India', '92': 'Pakistan', '234': 'Nigeria', '254': 'Kenya', '264': 'Namibia', '267': 'Botswana', '263': 'Zimbabwe',
  '258': 'Mozambique', '260': 'Zambia', '353': 'Ireland', '351': 'Portugal', '971': 'UAE', '966': 'Saudi Arabia', '972': 'Israel',
};

/** Normalise a phone number and guess its country from the dial prefix. */
export function analysePhone(raw) {
  const digits = String(raw).replace(/[^\d+]/g, '');
  if (digits.replace(/\D/g, '').length < 7) return null;
  const intl = digits.startsWith('+') ? digits.slice(1) : digits.startsWith('00') ? digits.slice(2) : null;
  let country = null;
  if (intl) for (const len of [3, 2, 1]) if (DIAL_CODES[intl.slice(0, len)]) { country = DIAL_CODES[intl.slice(0, len)]; break; }
  return { e164: intl ? `+${intl}` : null, national: digits, country, formatKnown: Boolean(intl) };
}
