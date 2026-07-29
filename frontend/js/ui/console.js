import { api } from '../api.js';
import { writeFeed } from './feed.js';
import { AsciiLoader } from './loader.js';
import { setTarget, recordResult } from '../state/auditProfile.js';
import { visualsFor } from './toolVisuals.js';

/** Intake field id → connector id, in the order the fields are displayed. */
const FIELD_MODULE_MAP = [
  { fieldId: 'intake-email', moduleId: 'v0id' },
  { fieldId: 'intake-username', moduleId: 'grimnir' },
  { fieldId: 'intake-domain', moduleId: 'mspect' },
  { fieldId: 'intake-org', moduleId: 'wiretap' },
];

/** RECON_ARSENAL status cards, split 2/2 either side of the intake form. */
const CARD_COLUMNS = {
  'tool-gallery-left': ['mspect', 'v0id'],
  'tool-gallery-right': ['grimnir', 'wiretap'],
};

let modules = [];
let loader = null;

/**
 * Render the read-only RECON_ARSENAL status cards — no click handler, they
 * just reflect each module's sweep state as `runFullAudit()` progresses.
 * @returns {void}
 */
function renderStatusCards() {
  for (const [galleryId, moduleIds] of Object.entries(CARD_COLUMNS)) {
    const galleryEl = document.getElementById(galleryId);
    if (!galleryEl) continue;
    galleryEl.innerHTML = '';
    for (const moduleId of moduleIds) {
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
 * Run every connector whose intake field is non-empty, sequentially,
 * narrating progress to the console feed and folding each result into the
 * shared audit profile. A failure in one module does not abort the rest.
 * @returns {Promise<void>}
 */
async function runFullAudit() {
  const runBtn = document.getElementById('btn-run-audit');
  const statusEl = document.getElementById('audit-status');

  const jobs = FIELD_MODULE_MAP.map(({ fieldId, moduleId }) => ({
    moduleId,
    query: document.getElementById(fieldId).value.trim(),
  })).filter((j) => j.query);

  if (!jobs.length) {
    writeFeed('  [x] Enter at least one field before running the audit.');
    return;
  }

  runBtn.disabled = true;
  statusEl.textContent = 'RUNNING';
  writeFeed(`[!] FULL AUDIT INITIATED // ${jobs.length} module(s) queued`);
  setTarget(jobs.map((j) => j.query).join(' / '));

  let hadError = false;
  for (const job of jobs) {
    const meta = moduleMeta(job.moduleId);
    setFieldStatus(job.moduleId, 'SCANNING', 'scanning');
    loader?.start(`SCANNING ${job.query.toUpperCase()}`);
    writeFeed(`[!] EXEC: ${meta.label} scan on [${job.query}]...`);

    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await api.recon.query(job.moduleId, job.query);
      writeFeed(res.lines);
      recordResult(job.moduleId, job.query, res.data);
      setFieldStatus(job.moduleId, 'COMPLETE', 'ok');
    } catch (err) {
      hadError = true;
      writeFeed(`  [x] ${meta.label}: ${err.message}`);
      const label =
        err.code === 'RECON_RATE_LIMITED' ? 'THROTTLED' : err.code === 'TIMEOUT' ? 'TIMEOUT' : 'ERROR';
      setFieldStatus(job.moduleId, label, 'alert');
    }
  }

  loader?.stop(hadError ? '▒ SWEEP COMPLETE (WITH ERRORS)' : '▓ SWEEP COMPLETE');
  statusEl.textContent = hadError ? 'COMPLETE (ERRORS)' : 'COMPLETE';
  runBtn.disabled = false;
}

/**
 * Boot the console: load connector metadata, wire controls, and populate the feed.
 * @param {string} handle authenticated operator handle
 * @param {() => void} onLogout
 * @returns {Promise<void>}
 */
export async function initConsole(handle, onLogout) {
  document.getElementById('active-op-handle').textContent = handle.toUpperCase();

  const runBtn = document.getElementById('btn-run-audit');
  const logoutBtn = document.getElementById('btn-logout');
  const loaderEl = document.getElementById('scan-loader');
  loader = loaderEl ? new AsciiLoader(loaderEl) : null;

  renderStatusCards();

  try {
    const res = await api.recon.modules();
    modules = res.modules;
  } catch (err) {
    writeFeed(`  [x] Failed to load recon module metadata: ${err.message}`);
    modules = [];
  }

  runBtn.addEventListener('click', runFullAudit);
  FIELD_MODULE_MAP.forEach(({ fieldId }) => {
    document.getElementById(fieldId)?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') runFullAudit();
    });
  });
  logoutBtn.addEventListener('click', async () => {
    try {
      await api.auth.logout();
    } finally {
      onLogout();
    }
  });

  writeFeed([
    `OPERATOR [${handle.toUpperCase()}] SECURE SESSION ESTABLISHED`,
    'OTP VERIFICATION SUCCESSFUL // LEVEL_4 AUTHORIZED',
    'SYSTEM: Loading recon arsenal... [DONE]',
    'Ready for input parameters...',
  ]);
}
