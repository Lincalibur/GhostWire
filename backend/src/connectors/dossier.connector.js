import {
  toDomain, slugify, wikidataCompany, wikipediaSummary, osmBusiness, gleifEntity, domainDnsIntel, rdapDomain,
  securityTxt, probeCommonPages, ctSubdomains, githubOrgIntel, inferEmailPattern, hunterDomain,
} from './intel/sources.js';
import { config } from '../config/index.js';

const ROLE_MAILBOXES = ['careers', 'jobs', 'recruitment', 'hr', 'talent', 'info', 'contact', 'hello', 'admin', 'office'];
const GUESS_TLDS = ['com', 'co.za', 'co.uk', 'io', 'org', 'net', 'com.au', 'ca'];

/** @param {string} v @param {Array} arr @param {(x: any) => string} key */
function addUnique(arr, item, key) {
  const k = key(item).toLowerCase();
  if (!arr.some((x) => key(x).toLowerCase() === k)) arr.push(item);
}

/**
 * Dossier — company intelligence. Takes a company name (or domain) and
 * returns the real, publicly published details: contact emails, phones,
 * addresses, socials, legal identity, mail/tech fingerprint and the likely
 * employee email pattern. Built entirely on public APIs — no page scraping.
 */
export const dossierConnector = {
  id: 'dossier',
  label: 'Dossier',
  title: 'Dossier // COMPANY INTELLIGENCE',
  inputLabel: 'COMPANY NAME OR DOMAIN',
  placeholder: 'e.g., Takealot, or takealot.com',

  /**
   * @param {string} query company name or domain
   * @returns {Promise<{ lines: string[], data: object }>}
   */
  async run(query) {
    const input = query.trim();
    const givenDomain = toDomain(input);
    const name = givenDomain ? givenDomain.split('.')[0] : input;
    const lines = [`  -> Building dossier for [${input}]...`];

    const contacts = { emails: [], phones: [], websites: [], socials: [], addresses: [] };
    const facts = {};
    const sources = [];

    // ── Phase 1: identity sources (parallel) ──────────────────
    // A bare domain gives only a generic label ("discovery" from discovery.co.za), so name-keyed
    // registries (GLEIF, Wikipedia) are skipped and OSM hits must carry the same website.
    const [wdRaw, osmAll, gleif, wiki] = await Promise.all([
      wikidataCompany(name),
      osmBusiness(givenDomain ? name : input),
      givenDomain ? null : gleifEntity(name),
      givenDomain ? null : wikipediaSummary(name),
    ]);
    const osm = givenDomain ? osmAll.filter((b) => toDomain(b.website || '') === givenDomain) : osmAll;

    // Reject a name-matched Wikidata entity whose website contradicts a domain the operator supplied.
    const wdSite = wdRaw?.website ? toDomain(wdRaw.website) : null;
    const wd = wdRaw && !(givenDomain && wdSite && wdSite !== givenDomain && !wdSite.endsWith(`.${givenDomain}`)) ? wdRaw : null;
    if (wd) {
      sources.push('Wikidata');
      facts.description = wd.description;
      facts.industry = wd.industry;
      facts.founded = wd.founded;
      facts.employees = wd.employees;
      facts.ceo = wd.ceo;
      facts.founders = wd.founders;
      facts.headquarters = wd.hq;
      facts.country = wd.country;
      if (wd.website) addUnique(contacts.websites, { value: wd.website, source: 'Wikidata' }, (x) => x.value);
      for (const e of wd.emails) addUnique(contacts.emails, { value: e, source: 'Wikidata', confidence: 'published' }, (x) => x.value);
      for (const p of wd.phones) addUnique(contacts.phones, { value: p, source: 'Wikidata' }, (x) => x.value);
      for (const s of wd.socials) addUnique(contacts.socials, s, (x) => x.url);
    }
    if (wiki) {
      sources.push('Wikipedia');
      facts.summary = wiki.extract;
    }
    if (gleif) {
      sources.push('GLEIF');
      facts.legal = gleif;
      for (const a of [gleif.hqAddress, gleif.legalAddress]) if (a) addUnique(contacts.addresses, { value: a, source: 'GLEIF' }, (x) => x.value);
    }
    for (const b of osm) {
      addUnique(sources, 'OpenStreetMap', (x) => x);
      if (b.address) addUnique(contacts.addresses, { value: b.address, source: 'OpenStreetMap' }, (x) => x.value);
      if (b.phone) addUnique(contacts.phones, { value: b.phone, source: 'OpenStreetMap' }, (x) => x.value);
      if (b.email) addUnique(contacts.emails, { value: b.email, source: 'OpenStreetMap', confidence: 'published' }, (x) => x.value);
      if (b.website) addUnique(contacts.websites, { value: b.website, source: 'OpenStreetMap' }, (x) => x.value);
      if (b.facebook) addUnique(contacts.socials, { network: 'Facebook', url: b.facebook, source: 'OpenStreetMap' }, (x) => x.url);
      if (b.instagram) addUnique(contacts.socials, { network: 'Instagram', url: b.instagram, source: 'OpenStreetMap' }, (x) => x.url);
    }

    // ── Phase 2: resolve the primary domain ───────────────────
    let domain = givenDomain;
    let domainSource = givenDomain ? 'provided' : null;
    if (!domain) {
      const fromSite = contacts.websites.map((w) => toDomain(w.value)).find(Boolean);
      if (fromSite) {
        domain = fromSite;
        domainSource = 'official website record';
      }
    }
    if (!domain) {
      const slug = slugify(name);
      for (const tld of GUESS_TLDS) {
        const candidate = `${slug}.${tld}`;
        const intel = await domainDnsIntel(candidate);
        if (intel.resolves) {
          domain = candidate;
          domainSource = 'GUESSED from company name — verify';
          break;
        }
      }
    }

    // ── Phase 3: domain-based sources (parallel) ──────────────
    let dns = null, rdap = null, sec = null, pages = [], subs = [], gh = null, hunter = null;
    if (domain) {
      [dns, rdap, sec, pages, subs, hunter] = await Promise.all([
        domainDnsIntel(domain), rdapDomain(domain), securityTxt(domain), probeCommonPages(domain),
        ctSubdomains(domain), hunterDomain(domain),
      ]);
      addUnique(contacts.websites, { value: `https://${domain}`, source: `domain (${domainSource})` }, (x) => toDomain(x.value) || x.value);
    }
    gh = await githubOrgIntel(name, domain);
    if (gh) {
      sources.push('GitHub');
      if (!domain && gh.emailDomain) domain = gh.emailDomain;
      if (gh.email) addUnique(contacts.emails, { value: gh.email, source: 'GitHub org profile', confidence: 'published' }, (x) => x.value);
      if (gh.blog) addUnique(contacts.websites, { value: gh.blog, source: 'GitHub org profile' }, (x) => x.value);
      if (gh.twitter) addUnique(contacts.socials, { network: 'X / Twitter', url: `https://x.com/${gh.twitter}`, source: 'GitHub org profile' }, (x) => x.url);
      addUnique(contacts.socials, { network: 'GitHub', url: gh.url, source: 'GitHub' }, (x) => x.url);
    }
    if (sec) {
      sources.push('security.txt');
      for (const c of sec.contacts) {
        if (/^mailto:/i.test(c)) addUnique(contacts.emails, { value: c.replace(/^mailto:/i, ''), source: 'security.txt', confidence: 'published (security contact)' }, (x) => x.value);
        else if (/^tel:/i.test(c)) addUnique(contacts.phones, { value: c.replace(/^tel:/i, ''), source: 'security.txt' }, (x) => x.value);
      }
    }
    if (rdap) {
      sources.push('RDAP');
      for (const c of rdap.contacts) {
        if (c.email && !/redact|privacy|withheld|proxy|whoisguard/i.test(c.email + (c.name || ''))) {
          addUnique(contacts.emails, { value: c.email, source: 'RDAP (domain registry)', confidence: 'registry contact' }, (x) => x.value);
        }
        if (c.phone && !/redact/i.test(c.phone)) addUnique(contacts.phones, { value: c.phone, source: 'RDAP (domain registry)' }, (x) => x.value);
      }
    }

    // Employee email pattern: Hunter first, else inferred from public commits.
    const pattern = hunter?.pattern || inferEmailPattern(gh?.commitEmails || []);
    if (hunter) {
      sources.push('Hunter.io');
      for (const e of hunter.emails) {
        addUnique(contacts.emails, { value: e.email, source: 'Hunter.io', confidence: `${e.confidence ?? '?'}% ${e.type || ''}`.trim(), name: e.name, position: e.position, department: e.department, linkedin: e.linkedin }, (x) => x.value);
        if (e.phone) addUnique(contacts.phones, { value: e.phone, source: 'Hunter.io' }, (x) => x.value);
      }
    }
    for (const c of gh?.commitEmails || []) {
      addUnique(contacts.emails, { value: c.email, source: 'public GitHub commits', confidence: 'observed employee address', name: c.name }, (x) => x.value);
    }

    // Generic role mailboxes — clearly labelled unverified candidates.
    const roleCandidates = domain && dns?.mxHosts?.length ? ROLE_MAILBOXES.map((r) => `${r}@${domain}`) : [];

    // ── Render ────────────────────────────────────────────────
    const push = (s) => lines.push(`  -> ${s}`);
    const head = (s) => lines.push(`  -> ── ${s} ──`);
    const legalName = gleif?.legalName || wd?.label || osm[0]?.name || name;

    head('IDENTITY');
    push(`Name        : ${legalName}`);
    if (facts.description) push(`About       : ${facts.description}`);
    if (facts.industry?.length) push(`Industry    : ${facts.industry.join(', ')}`);
    if (facts.founded) push(`Founded     : ${facts.founded}`);
    if (facts.employees) push(`Employees   : ~${facts.employees.toLocaleString()}`);
    if (facts.ceo) push(`CEO         : ${facts.ceo}`);
    if (facts.founders?.length) push(`Founder(s)  : ${facts.founders.join(', ')}`);
    if (facts.headquarters) push(`HQ          : ${facts.headquarters}${facts.country ? `, ${facts.country}` : ''}`);
    if (gleif) push(`Legal entity: ${gleif.legalName} [${gleif.status}] ${gleif.jurisdiction || ''} LEI ${gleif.lei}${gleif.registeredAs ? ` reg# ${gleif.registeredAs}` : ''}`);
    if (facts.summary) push(`Summary     : ${facts.summary.slice(0, 280)}${facts.summary.length > 280 ? '…' : ''}`);
    if (!wd && !gleif && !osm.length && !wiki) push('No public registry records matched this name (typical for small/local firms).');

    if (wd) push(`Matched Wikidata record: ${wd.label} (${wd.url}). Wrong company? Re-run with its domain, e.g. discovery.co.za.`);

    head('EMAILS');
    if (contacts.emails.length) {
      for (const e of contacts.emails) {
        const who = [e.name, e.position].filter(Boolean).join(', ');
        push(`${e.value}${who ? `  (${who})` : ''}  [${e.source}${e.confidence ? ` — ${e.confidence}` : ''}]`);
      }
    } else push('No published email addresses found in public sources.');
    if (pattern) push(`Employee email pattern: ${pattern}@${domain}`);
    if (roleCandidates.length) {
      push(`Role mailbox candidates (UNVERIFIED — domain accepts mail via ${dns.mailProvider || 'MX'}):`);
      push(`  ${roleCandidates.join(', ')}`);
    }

    head('PHONE / ADDRESS / WEB');
    for (const p of contacts.phones) push(`Phone   : ${p.value}  [${p.source}]`);
    if (!contacts.phones.length) push('Phone   : none published in public sources');
    for (const a of contacts.addresses) push(`Address : ${a.value}  [${a.source}]`);
    for (const w of contacts.websites) push(`Web     : ${w.value}  [${w.source}]`);
    if (pages.length) push(`Live contact/careers pages: ${pages.join('  ')}`);

    head('SOCIALS');
    if (contacts.socials.length) for (const s of contacts.socials) push(`${s.network.padEnd(12)}: ${s.url}  [${s.source}]`);
    else push('No socials linked in public sources.');

    if (domain) {
      head(`DOMAIN // ${domain}`);
      if (rdap) push(`Registrar: ${rdap.registrar || '?'} | registered ${rdap.registered || '?'} | expires ${rdap.expires || '?'}`);
      if (dns) {
        push(`Mail: ${dns.mailProvider || (dns.mxHosts.length ? dns.mxHosts.slice(0, 3).join(', ') : 'no MX records — cannot receive email')}`);
        if (dns.vendors.length) push(`Vendors seen in DNS: ${dns.vendors.join(', ')}`);
      }
      const interesting = subs.filter((s) => /^(careers|jobs|talent|apply|recruit|mail|webmail|support|help|hr|blog)\./.test(s));
      if (subs.length) push(`${subs.length} subdomain(s) in cert logs${interesting.length ? `; notable: ${interesting.slice(0, 8).join(', ')}` : ''}`);
    }

    if (gh) {
      head('GITHUB ORG');
      push(`${gh.name || gh.login} — ${gh.publicRepos} public repos, ${gh.followers} followers ${gh.location ? `| ${gh.location}` : ''}`);
      if (gh.commitEmails.length) push(`${gh.commitEmails.length} employee address(es) seen in public commits (listed under EMAILS)`);
    }

    head('MANUAL FOLLOW-UP (search links)');
    const q = encodeURIComponent(legalName);
    push(`LinkedIn company : https://www.linkedin.com/search/results/companies/?keywords=${q}`);
    push(`LinkedIn people  : https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${legalName} recruiter`)}`);
    if (domain) push(`Google emails    : https://www.google.com/search?q=${encodeURIComponent(`"@${domain}"`)}`);
    if (domain) push(`Google careers   : https://www.google.com/search?q=${encodeURIComponent(`site:${domain} careers OR jobs OR vacancies`)}`);

    lines.push(`  -> Dossier complete. ${contacts.emails.length} email(s), ${contacts.phones.length} phone(s), ${contacts.socials.length} social(s) from: ${sources.join(', ') || 'no registry sources'}.`);
    if (!config.connectors.hunterApiKey) lines.push('  -> Tip: set HUNTER_API_KEY (free tier) in .env for named HR/recruiter contacts.');

    return {
      lines,
      data: { query: input, name: legalName, domain, domainSource, facts, contacts, roleCandidates, emailPattern: pattern, dns, rdap, security: sec, pages, subdomains: subs.slice(0, 100), github: gh, sources },
    };
  },
};
