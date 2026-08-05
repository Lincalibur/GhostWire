/**
 * Aggregates recon findings across modules into a single running "audit
 * profile" for the current operator, so a final report can be generated
 * without re-querying anything. Lives in sessionStorage only — nothing here
 * is persisted server-side or sent anywhere.
 */

const STORAGE_KEY = 'ghostwire_audit_profile';
const SENSITIVE_SUBDOMAIN_RE = /^(dev|staging|vpn|admin|internal|test|beta)\./i;

const COMMON_PORTS = new Set([80, 443]);

function emptyProfile() {
  return {
    target: '',
    mspect: null,
    v0id: null,
    grimnir: null,
    wiretap: null,
    shodan: null,
    metadata: [],
  };
}

function load() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : emptyProfile();
  } catch {
    return emptyProfile();
  }
}

let profile = load();

function persist() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    /* storage unavailable (private browsing, quota) — profile stays in-memory for this session */
  }
}

/**
 * Record the target indicator (email/username/domain) the operator is auditing.
 * @param {string} target
 */
export function setTarget(target) {
  profile.target = target;
  persist();
}

/**
 * Record a completed connector query into the profile under its module id.
 * @param {string} moduleId
 * @param {string} query
 * @param {object} data structured connector result payload
 */
export function recordResult(moduleId, query, data) {
  if (!Object.prototype.hasOwnProperty.call(profile, moduleId)) return;
  profile[moduleId] = { query, data, capturedAt: new Date().toISOString() };
  persist();
}

/**
 * Record a client-side metadata (EXIF) extraction.
 * @param {{ fileName: string, make: string|null, model: string|null, dateTimeOriginal: string|null, gps: { lat: number, lon: number } | null }} entry
 */
export function recordMetadata(entry) {
  profile.metadata.push({ ...entry, capturedAt: new Date().toISOString() });
  persist();
}

/** @returns {object} the raw aggregated profile */
export function getProfile() {
  return profile;
}

/** Clear the profile (e.g. when starting a fresh audit target). */
export function resetProfile() {
  profile = emptyProfile();
  persist();
}

/**
 * Weighted 0–100 exposure score from whatever findings have been gathered so far.
 * @returns {number}
 */
export function computeRiskScore() {
  let score = 0;

  const passwordCheck = profile.v0id?.data?.password;
  if (passwordCheck?.exposed) {
    score += Math.min(40, 20 + Math.log10(Math.max(passwordCheck.count, 1)) * 5);
  }

  const emailCheck = profile.v0id?.data?.email;
  if (emailCheck?.exposed) {
    score += Math.min(25, 15 + (emailCheck.breaches?.length || 1) * 3);
  }

  const openBuckets = profile.wiretap?.data?.results?.filter((r) => r.state === 'OPEN') || [];
  score += Math.min(25, openBuckets.length * 12);

  const aliasHits = profile.grimnir?.data?.results?.filter((r) => r.found) || [];
  score += Math.min(15, aliasHits.length * 4);

  const sensitiveSubdomains =
    profile.mspect?.data?.subdomains?.filter((s) => SENSITIVE_SUBDOMAIN_RE.test(s)) || [];
  score += Math.min(10, sensitiveSubdomains.length * 5);

  const gpsLeaks = profile.metadata.filter((m) => m.gps);
  score += Math.min(10, gpsLeaks.length * 10);

  const shodanVulns = profile.shodan?.data?.vulns || [];
  score += Math.min(20, shodanVulns.length * 6);

  const unusualPorts = (profile.shodan?.data?.ports || []).filter((p) => !COMMON_PORTS.has(p));
  score += Math.min(10, unusualPorts.length * 3);

  return Math.round(Math.min(100, score));
}

/**
 * @param {number} score
 * @returns {'CRITICAL'|'HIGH'|'MODERATE'|'LOW'}
 */
export function riskLabel(score) {
  if (score >= 70) return 'CRITICAL';
  if (score >= 40) return 'HIGH';
  if (score >= 15) return 'MODERATE';
  return 'LOW';
}

/**
 * Build the categorized findings + actionable remediation checklist for the
 * final audit report view.
 * @returns {{ score: number, label: string, target: string, findings: Array<{category: string, severity: string, detail: string}>, remediation: Array<{text: string, href: string|null}> }}
 */
export function buildReport() {
  const findings = [];

  const passwordCheck = profile.v0id?.data?.password;
  if (passwordCheck?.exposed) {
    findings.push({
      category: 'CREDENTIAL EXPOSURE',
      severity: 'critical',
      detail: `Password seen ${passwordCheck.count.toLocaleString()} time(s) in indexed breach corpora.`,
    });
  }

  const emailCheck = profile.v0id?.data?.email;
  if (emailCheck?.exposed) {
    findings.push({
      category: 'CREDENTIAL EXPOSURE',
      severity: 'critical',
      detail: `Email found in ${emailCheck.breaches.length} breach(es): ${emailCheck.breaches.join(', ')}.`,
    });
  }

  const openBuckets = profile.wiretap?.data?.results?.filter((r) => r.state === 'OPEN') || [];
  for (const b of openBuckets) {
    findings.push({
      category: 'CLOUD LEAKAGE',
      severity: 'critical',
      detail: `Public bucket listing exposed: ${b.bucket} (${b.url})`,
    });
  }

  const aliasHits = profile.grimnir?.data?.results?.filter((r) => r.found) || [];
  for (const a of aliasHits) {
    findings.push({
      category: 'ASSOCIATED ACCOUNTS',
      severity: 'info',
      detail: `Public profile found on ${a.platform}.`,
    });
  }

  const subdomains = profile.mspect?.data?.subdomains || [];
  for (const s of subdomains.filter((n) => SENSITIVE_SUBDOMAIN_RE.test(n))) {
    findings.push({
      category: 'INFRASTRUCTURE EXPOSURE',
      severity: 'moderate',
      detail: `Sensitive-looking subdomain publicly resolvable: ${s}`,
    });
  }

  for (const m of profile.metadata.filter((entry) => entry.gps)) {
    findings.push({
      category: 'METADATA LEAKAGE',
      severity: 'critical',
      detail: `GPS coordinates embedded in ${m.fileName} (${m.gps.lat.toFixed(4)}, ${m.gps.lon.toFixed(4)})`,
    });
  }

  const shodanVulns = profile.shodan?.data?.vulns || [];
  if (shodanVulns.length) {
    findings.push({
      category: 'INFRASTRUCTURE EXPOSURE',
      severity: 'critical',
      detail: `${shodanVulns.length} known vulnerability(ies) indexed for the host: ${shodanVulns.slice(0, 5).join(', ')}${shodanVulns.length > 5 ? ', ...' : ''}`,
    });
  }
  const unusualPorts = (profile.shodan?.data?.ports || []).filter((p) => !COMMON_PORTS.has(p));
  if (unusualPorts.length) {
    findings.push({
      category: 'INFRASTRUCTURE EXPOSURE',
      severity: 'moderate',
      detail: `Non-standard open port(s) exposed: ${unusualPorts.join(', ')}`,
    });
  }

  const remediation = [];
  if (passwordCheck?.exposed || emailCheck?.exposed) {
    remediation.push({
      text: 'Rotate the compromised credential immediately and use a password manager.',
      href: 'https://haveibeenpwned.com/Passwords',
    });
  }
  if (openBuckets.length) {
    remediation.push({
      text: 'Lock down or delist the exposed cloud storage bucket(s).',
      href: 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html',
    });
  }
  if (aliasHits.length) {
    remediation.push({
      text: 'Review privacy settings on discovered accounts and enable 2FA.',
      href: 'https://2fa.directory/',
    });
  }
  if (subdomains.some((s) => SENSITIVE_SUBDOMAIN_RE.test(s))) {
    remediation.push({
      text: 'Restrict internal/staging subdomains from public DNS resolution.',
      href: null,
    });
  }
  if (shodanVulns.length || unusualPorts.length) {
    remediation.push({
      text: 'Patch or close exposed services and review whether non-standard open ports need to be public.',
      href: null,
    });
  }
  if (profile.metadata.some((m) => m.gps)) {
    remediation.push({
      text: 'Strip EXIF/GPS metadata before sharing photos publicly (use the Metadata Extractor).',
      href: null,
    });
  }
  remediation.push({
    text: 'Set up ongoing breach-monitoring alerts for your primary identifiers.',
    href: 'https://haveibeenpwned.com/',
  });

  const score = computeRiskScore();
  return { score, label: riskLabel(score), target: profile.target, findings, remediation };
}
