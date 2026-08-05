import { api } from '../api.js';
import { writeFeed } from './feed.js';
import { AsciiLoader } from './loader.js';
import { setTarget, recordResult } from '../state/auditProfile.js';
import { visualsFor } from './toolVisuals.js';

/**
 * Intake field id → connector id for the 1:1 modules. v0id is handled
 * separately since it combines two fields (email + password) into one job.
 */
const FIELD_MODULE_MAP = [
  { fieldId: 'intake-username', moduleId: 'grimnir' },
  { fieldId: 'intake-domain', moduleId: 'mspect' },
  { fieldId: 'intake-org', moduleId: 'wiretap' },
  { fieldId: 'intake-shodan', moduleId: 'shodan' },
];

/** Every intake field id, for Enter-key wiring. */
const ALL_INTAKE_FIELD_IDS = [
  'intake-email',
  'intake-password',
  ...FIELD_MODULE_MAP.map((f) => f.fieldId),
];

/** RECON_ARSENAL status cards, one row, in display order. */
const CARD_ORDER = ['mspect', 'v0id', 'grimnir', 'wiretap', 'shodan'];

let modules = [];
let loader = null;

/**
 * Render the read-only RECON_ARSENAL status cards — no click handler, they
 * just reflect each module's sweep state as a scan progresses.
 * @returns {void}
 */
function renderStatusCards() {
  const galleryEl = document.getElementById('tool-gallery');
  if (!galleryEl) return;
  galleryEl.innerHTML = '';
  for (const moduleId of CARD_ORDER) {
    const v = visualsFor(moduleId);
    const card = document.createElement('div');
    card.className = 'tool-card';
    card.dataset.moduleId = moduleId;
    card.innerHTML = `
      <div class="card-bg" aria-hidden="true"></div>
      <div class="bg-text" aria-hidden="true">${v.bgText}</div>
      <img class="subject-img" src="${v.image}" alt="${v.alt}" draggable="false" />
      <div class="card-info">
        <span class="tool-id">[ ${v.toolId} ]</span>
        <h3 class="tool-title">${v.title}</h3>
        <p class="tool-desc">${v.desc}</p>
        <span class="tool-status" data-card-status>IDLE</span>
      </div>
    `;
    galleryEl.appendChild(card);
  }
}

/**
 * @param {string} moduleId
 * @returns {{ id: string, label: string }}
 */
function moduleMeta(moduleId) {
  return modules.find((m) => m.id === moduleId) || { id: moduleId, label: moduleId };
}

/**
 * @param {string} moduleId
 * @param {string} text
 * @param {string} [cls]
 * @returns {void}
 */
function setFieldStatus(moduleId, text, cls) {
  const el = document.getElementById(`intake-status-${moduleId}`);
  if (el) {
    el.textContent = text;
    el.className = 'intake-status' + (cls ? ` ${cls}` : '');
  }

  const card = document.querySelector(`.tool-card[data-module-id="${moduleId}"]`);
  if (card) {
    card.className = 'tool-card' + (cls ? ` ${cls}` : '');
    const statusEl = card.querySelector('[data-card-status]');
    if (statusEl) statusEl.textContent = text;
  }
}

/**
 * Build the job list from whichever intake fields are non-empty. v0id
 * combines email + password into one JSON query/job; every other module is
 * a plain 1:1 field → connector mapping.
 * @returns {Array<{ moduleId: string, query: string, label: string }>}
 */
function buildJobs() {
  const jobs = FIELD_MODULE_MAP.map(({ fieldId, moduleId }) => {
    const value = document.getElementById(fieldId).value.trim();
    return { moduleId, query: value, label: value };
  }).filter((j) => j.query);

  const email = document.getElementById('intake-email').value.trim();
  const password = document.getElementById('intake-password').value.trim();
  if (email || password) {
    const labelParts = [];
    if (email) labelParts.push(email);
    if (password) labelParts.push('(password)');
    jobs.unshift({
      moduleId: 'v0id',
      query: JSON.stringify({ email, password }),
      label: labelParts.join(' + '),
    });
  }

  return jobs;
}

/**
 * Run a single job: narrate progress to the console feed, fold the result
 * into the shared audit profile, and reflect status on the field/card.
 * @param {{ moduleId: string, query: string, label: string }} job
 * @returns {Promise<boolean>} true on success, false on failure
 */
async function runJob(job) {
  const meta = moduleMeta(job.moduleId);
  setFieldStatus(job.moduleId, 'SCANNING', 'scanning');
  writeFeed(`[!] EXEC: ${meta.label} scan on [${job.label}]...`);

  try {
    const res = await api.recon.query(job.moduleId, job.query);
    writeFeed(res.lines);
    recordResult(job.moduleId, job.label, res.data);
    setFieldStatus(job.moduleId, 'COMPLETE', 'ok');
    return true;
  } catch (err) {
    // The silent session bootstrap on page load can occasionally lose the
    // race (e.g. a dev-server restart) and leave the operator unauthenticated
    // with no visible sign of it. Try once to re-establish a session and
    // retry the job before surfacing an error.
    if (err.status === 401) {
      try {
        await api.auth.devLogin();
        const res = await api.recon.query(job.moduleId, job.query);
        writeFeed(res.lines);
        recordResult(job.moduleId, job.label, res.data);
        setFieldStatus(job.moduleId, 'COMPLETE', 'ok');
        return true;
      } catch {
        /* fall through to error reporting below */
      }
    }

    writeFeed(`  [x] ${meta.label}: ${err.message}`);
    const label =
      err.code === 'RECON_RATE_LIMITED' ? 'THROTTLED' : err.code === 'TIMEOUT' ? 'TIMEOUT' : 'ERROR';
    setFieldStatus(job.moduleId, label, 'alert');
    return false;
  }
}

/**
 * Run every queued job concurrently, narrating progress to the console feed
 * and folding each result into the shared audit profile. A failure in one
 * module does not abort the rest.
 * @param {Array<{ moduleId: string, query: string, label: string }>} jobs
 * @returns {Promise<void>}
 */
async function runScan(jobs) {
  const statusEl = document.getElementById('audit-status');

  statusEl.textContent = 'RUNNING';
  writeFeed(`[!] FULL SCAN INITIATED // ${jobs.length} module(s) queued`);
  setTarget(jobs.map((j) => j.label).join(' / '));
  loader?.start(`SCANNING ${jobs.length} TARGET(S)`);

  const results = await Promise.all(jobs.map(runJob));
  const hadError = results.some((ok) => !ok);

  loader?.stop(hadError ? '▒ SWEEP COMPLETE (WITH ERRORS)' : '▓ SWEEP COMPLETE');
  statusEl.textContent = hadError ? 'COMPLETE (ERRORS)' : 'COMPLETE';
}

/**
 * Wire the input page: validates the intake fields, and on a valid run,
 * switches to the output page (via `onRun`) before kicking off the scan.
 * @param {() => void} onRun called synchronously once a valid job set exists
 * @returns {void}
 */
export function initInputView(onRun) {
  const runBtn = document.getElementById('btn-run-scan');
  const errorEl = document.getElementById('intake-error');

  const trigger = () => {
    const jobs = buildJobs();
    if (!jobs.length) {
      if (errorEl) {
        errorEl.textContent = 'Enter at least one field before running the scan.';
        errorEl.style.display = 'block';
      }
      return;
    }
    if (errorEl) errorEl.style.display = 'none';
    onRun();
    runScan(jobs);
  };

  runBtn.addEventListener('click', trigger);
  ALL_INTAKE_FIELD_IDS.forEach((fieldId) => {
    document.getElementById(fieldId)?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') trigger();
    });
  });
}

/**
 * Fetch connector metadata (display labels used in feed lines). Call once
 * the operator is authenticated — not before, since this is a protected
 * endpoint.
 * @returns {Promise<void>}
 */
export async function loadModuleMetadata() {
  try {
    const res = await api.recon.modules();
    modules = res.modules;
  } catch (err) {
    writeFeed(`  [x] Failed to load recon module metadata: ${err.message}`);
    modules = [];
  }
}

/**
 * Wire the output page: status cards and the Terminate Session control.
 * @param {() => void} onTerminate called when the operator ends the session
 * @returns {void}
 */
export function initOutputView(onTerminate) {
  const logoutBtn = document.getElementById('btn-logout');
  const loaderEl = document.getElementById('scan-loader');
  loader = loaderEl ? new AsciiLoader(loaderEl) : null;

  renderStatusCards();

  logoutBtn.addEventListener('click', onTerminate);
}
