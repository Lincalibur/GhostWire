import {
  toDomain, dnsQuery, gravatarProfile, gravatarExists, emailRep, keybaseUser, githubUser, githubSearchName,
  githubByEmail, candidateEmails, analysePhone,
} from './intel/sources.js';
import { grimnirConnector } from './grimnir.connector.js';

const EMAIL_RE = /^[^\s@]+@([^\s@]+\.[^\s@]+)$/;
const HANDLE_RE = /^[A-Za-z0-9_.-]{1,39}$/;

/**
 * Profiler — person-of-interest enrichment. The operator supplies whatever is
 * already known (name, email, username, phone, company/domain, location) and
 * every field is used to pivot to further public details: linked accounts,
 * profile data, candidate work emails and manual search links. API-based only;
 * matches are leads to verify, not proof of identity.
 */
export const profilerConnector = {
  id: 'profiler',
  label: 'Profiler',
  title: 'Profiler // PERSON ENRICHMENT',
  inputLabel: 'KNOWN DETAILS',
  placeholder: 'name / email / username / phone / company',

  /**
   * @param {string} query JSON: { name, email, username, phone, company, domain, location }
   * @returns {Promise<{ lines: string[], data: object }>}
   */
  async run(query) {
    let input;
    try {
      input = JSON.parse(query);
    } catch {
      return { lines: ['  [x] Profiler expects structured input.'], data: { error: 'INVALID_INPUT' } };
    }
    const clean = (v) => (typeof v === 'string' ? v.trim() : '');
    const name = clean(input.name);
    const email = clean(input.email).toLowerCase();
    const username = clean(input.username).replace(/^@/, '');
    const phone = clean(input.phone);
    const company = clean(input.company);
    const location = clean(input.location);
    const domain = toDomain(input.domain) || null;

    if (!name && !email && !username && !phone) {
      return { lines: ['  [x] Provide at least a name, email, username or phone.'], data: { error: 'EMPTY_INPUT' } };
    }
    const emailMatch = email ? EMAIL_RE.exec(email) : null;
    if (email && !emailMatch) return { lines: [`  [x] Invalid email: ${email}`], data: { error: 'INVALID_EMAIL' } };
    if (username && !HANDLE_RE.test(username)) return { lines: [`  [x] Invalid username: ${username}`], data: { error: 'INVALID_HANDLE' } };

    const lines = [`  -> Profiling subject: ${[name, email, username && `@${username}`, phone].filter(Boolean).join(' | ')}`];
    const push = (s) => lines.push(`  -> ${s}`);
    const head = (s) => lines.push(`  -> ── ${s} ──`);
    const accounts = []; // {network,url,handle,source}
    const known = { names: new Set(), locations: new Set(), emails: new Set(), companies: new Set(), sites: new Set() };
    if (name) known.names.add(name);
    if (email) known.emails.add(email);
    if (location) known.locations.add(location);
    if (company) known.companies.add(company);

    const addAccount = (a) => {
      if (a.url && !accounts.some((x) => x.url === a.url)) accounts.push(a);
    };

    // ── Fan out every pivot in parallel ───────────────────────
    const nameParts = name.split(/\s+/).filter(Boolean);
    const [first, last] = [nameParts[0], nameParts[nameParts.length - 1]];
    const emailDomain = emailMatch?.[1] || null;
    const workDomain = domain || null;

    const [gravatar, rep, mx, ghByEmail, ghUser, keybase, alias, nameLeads] = await Promise.all([
      email ? gravatarProfile(email) : null,
      email ? emailRep(email) : null,
      emailDomain ? dnsQuery(emailDomain, 'MX') : [],
      email ? githubByEmail(email) : null,
      username ? githubUser(username) : null,
      username ? keybaseUser(username) : null,
      username ? grimnirConnector.run(username) : null,
      nameParts.length >= 2 ? githubSearchName(name, location ? `location:"${location.split(',')[0]}"` : '') : [],
    ]);

    // ── EMAIL ─────────────────────────────────────────────────
    if (email) {
      head(`EMAIL // ${email}`);
      push(`Domain ${emailDomain}: ${mx.length ? 'accepts mail (MX present)' : 'NO MX records — address cannot receive mail'}`);
      if (gravatar) {
        push(`Gravatar profile: ${gravatar.displayName || gravatar.username || '(no name)'}${gravatar.location ? ` — ${gravatar.location}` : ''}`);
        if (gravatar.about) push(`  bio: ${gravatar.about.slice(0, 200)}`);
        if (gravatar.displayName) known.names.add(gravatar.displayName);
        if (gravatar.location) known.locations.add(gravatar.location);
        for (const u of gravatar.urls) known.sites.add(u);
        for (const a of gravatar.accounts) addAccount({ network: a.network, url: a.url, handle: a.username, source: 'Gravatar (self-linked)' });
        for (const u of gravatar.urls) push(`  linked site: ${u}`);
      } else push('No public Gravatar profile.');
      if (rep) {
        push(`EmailRep: reputation ${rep.reputation}${rep.suspicious ? ' (SUSPICIOUS)' : ''}; first seen ${rep.firstSeen || '?'}; deliverable ${rep.deliverable ?? '?'}; ${rep.credentialsLeaked ? 'credentials appear in breaches' : 'no leaked credentials flagged'}`);
        if (rep.profiles.length) push(`  accounts registered with this email: ${rep.profiles.join(', ')}`);
      }
      if (ghByEmail) push(`GitHub account with this public email: @${ghByEmail}`);
    }

    // ── USERNAME ──────────────────────────────────────────────
    const gh = ghUser || (ghByEmail ? await githubUser(ghByEmail) : null);
    if (username || gh) {
      head(`USERNAME // ${username || gh?.login}`);
      if (gh) {
        addAccount({ network: 'GitHub', url: gh.url, handle: gh.login, source: 'GitHub API' });
        push(`GitHub: ${gh.name || '(no name)'}${gh.company ? ` @ ${gh.company}` : ''}${gh.location ? ` — ${gh.location}` : ''} | ${gh.repos} repos, ${gh.followers} followers, joined ${gh.created}`);
        if (gh.bio) push(`  bio: ${gh.bio}`);
        if (gh.email) push(`  public email: ${gh.email}`);
        if (gh.blog) push(`  website: ${gh.blog}`);
        if (gh.twitter) push(`  X/Twitter: https://x.com/${gh.twitter}`);
        if (gh.name) known.names.add(gh.name);
        if (gh.location) known.locations.add(gh.location);
        if (gh.company) known.companies.add(gh.company.replace(/^@/, ''));
        if (gh.email) known.emails.add(gh.email);
        if (gh.blog) known.sites.add(gh.blog);
        if (gh.twitter) addAccount({ network: 'X / Twitter', url: `https://x.com/${gh.twitter}`, handle: gh.twitter, source: 'GitHub profile' });
      }
      if (keybase) {
        push(`Keybase: ${keybase.fullName || keybase.username}${keybase.location ? ` — ${keybase.location}` : ''} (cryptographically proven links)`);
        addAccount({ network: 'Keybase', url: keybase.url, handle: keybase.username, source: 'Keybase' });
        for (const p of keybase.proofs) {
          push(`  proven ${p.network}: ${p.handle}${p.url ? ` — ${p.url}` : ''}`);
          addAccount({ network: p.network, url: p.url, handle: p.handle, source: 'Keybase proof' });
        }
        if (keybase.fullName) known.names.add(keybase.fullName);
      }
      if (alias?.data?.results) {
        const hits = alias.data.results.filter((r) => r.found);
        push(`Platform sweep: ${hits.length}/${alias.data.results.length} directories matched (an existing account is NOT proof it is the same person):`);
        for (const h of hits) {
          push(`  ${h.platform} — ${h.url}`);
          addAccount({ network: h.platform, url: h.url, handle: username, source: 'username sweep (unverified)' });
        }
      }
    }

    // ── NAME ──────────────────────────────────────────────────
    if (nameParts.length >= 2) {
      head(`NAME // ${name}`);
      if (nameLeads.length) {
        push('GitHub profiles with this full name (leads — confirm by company/location):');
        for (const u of nameLeads) push(`  @${u.login} — ${[u.company, u.location].filter(Boolean).join(' | ') || 'no company/location'} — ${u.url}`);
      } else push('No GitHub profiles matched this exact name.');
    }

    // ── CANDIDATE WORK EMAILS ─────────────────────────────────
    const targetDomain = workDomain || (emailDomain && !/^(gmail|outlook|hotmail|yahoo|icloud|proton|live|msn)\./i.test(emailDomain) ? emailDomain : null);
    let candidates = [];
    if (first && last && targetDomain) {
      const list = candidateEmails(first, last, targetDomain);
      const checked = await Promise.all(list.map(async (c) => ({ ...c, gravatar: await gravatarExists(c.email) })));
      const dm = await dnsQuery(targetDomain, 'MX');
      candidates = checked;
      head(`CANDIDATE WORK EMAILS // ${targetDomain}`);
      push(dm.length ? `${targetDomain} accepts mail. Addresses below are GUESSES from common patterns:` : `${targetDomain} has no MX records — these cannot receive mail.`);
      for (const c of checked) push(`  ${c.email}  ${c.pattern}${c.gravatar ? '  <- has a Gravatar: address is in real use' : ''}`);
      push('Tip: run Dossier on the company — its "Employee email pattern" tells you which one is right.');
    } else if (first && last && company) {
      push('Add the company domain to generate candidate work emails.');
    }

    // ── PHONE ─────────────────────────────────────────────────
    let phoneInfo = null;
    if (phone) {
      phoneInfo = analysePhone(phone);
      head(`PHONE // ${phone}`);
      if (!phoneInfo) push('Too short to analyse.');
      else {
        push(phoneInfo.formatKnown ? `Normalised: ${phoneInfo.e164} — country: ${phoneInfo.country || 'unknown prefix'}` : 'No country prefix given — add +<country code> for country detection.');
        push(`Manual lookups: https://www.google.com/search?q=${encodeURIComponent(`"${phone}"`)}`);
      }
    }

    // ── SEARCH LINKS ──────────────────────────────────────────
    head('MANUAL FOLLOW-UP (search links)');
    const who = [name, company].filter(Boolean).join(' ');
    if (name) {
      push(`LinkedIn : https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(who)}`);
      push(`Google   : https://www.google.com/search?q=${encodeURIComponent(`"${name}"${company ? ` "${company}"` : ''}${location ? ` "${location.split(',')[0]}"` : ''}`)}`);
      push(`X        : https://x.com/search?q=${encodeURIComponent(name)}&f=user`);
      push(`Facebook : https://www.facebook.com/search/people/?q=${encodeURIComponent(name)}`);
      push(`Instagram: https://www.google.com/search?q=${encodeURIComponent(`site:instagram.com "${name}"`)}`);
    }
    if (email) push(`Email dork: https://www.google.com/search?q=${encodeURIComponent(`"${email}"`)}`);
    if (username) push(`Username dork: https://www.google.com/search?q=${encodeURIComponent(`"${username}"`)}`);

    // ── SUMMARY ───────────────────────────────────────────────
    head('WHAT WE NOW KNOW');
    const list = (label, set) => set.size && push(`${label}: ${[...set].join(' | ')}`);
    list('Names', known.names);
    list('Emails', known.emails);
    list('Locations', known.locations);
    list('Companies', known.companies);
    list('Websites', known.sites);
    push(`Linked accounts: ${accounts.length}`);
    lines.push('  -> Profile complete. Treat every match as a lead to verify before acting on it.');

    return {
      lines,
      data: {
        input: { name, email, username, phone, company, domain, location },
        known: Object.fromEntries(Object.entries(known).map(([k, v]) => [k, [...v]])),
        accounts, gravatar, emailReputation: rep, github: gh, keybase, nameLeads, candidateEmails: candidates, phone: phoneInfo,
      },
    };
  },
};
