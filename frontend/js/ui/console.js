import { api } from '../api.js';
import { writeFeed } from './feed.js';
import { AsciiLoader } from './loader.js';
import { refreshMesh } from '../visuals/mesh.js';
import { visualsFor } from './toolVisuals.js';

let modules = [];
let activeModule = null;
let loader = null;

/**
 * Render brutalist text-behind-subject tool cards for each recon module.
 * @param {HTMLElement} galleryEl
 * @returns {void}
 */
function renderCards(galleryEl) {
  galleryEl.innerHTML = '';
  modules.forEach((mod, i) => {
    const v = visualsFor(mod.id);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'tool-card' + (i === 0 ? ' active' : '');
    card.dataset.moduleId = mod.id;
    card.setAttribute('aria-label', `Launch ${v.title}`);
    card.innerHTML = `
      <div class="card-bg" aria-hidden="true"></div>
      <div class="bg-text" aria-hidden="true">${v.bgText}</div>
      <img class="subject-img" src="${v.image}" alt="${v.alt}" draggable="false" />
      <div class="card-info">
        <span class="tool-id">[ ${v.toolId} ]</span>
        <h3 class="tool-title">${v.title}</h3>
        <p class="tool-desc">${v.desc}</p>
        <span class="tool-btn">LAUNCH MODULE &rarr;</span>
      </div>
    `;
    card.addEventListener('click', () => selectModule(mod.id, card, galleryEl));
    galleryEl.appendChild(card);
  });
}

/**
 * Activate a module: highlight its card and update the query panel.
 * @param {string} id
 * @param {HTMLElement} cardEl
 * @param {HTMLElement} galleryEl
 * @returns {void}
 */
function selectModule(id, cardEl, galleryEl) {
  activeModule = modules.find((m) => m.id === id);
  if (!activeModule) return;

  galleryEl.querySelectorAll('.tool-card').forEach((c) => c.classList.remove('active'));
  cardEl.classList.add('active');

  const v = visualsFor(activeModule.id);
  document.getElementById('module-title').textContent = activeModule.title;
  document.getElementById('module-input-label').textContent = activeModule.inputLabel;
  const input = document.getElementById('recon-query');
  input.placeholder = activeModule.placeholder;
  input.value = '';
  document.getElementById('module-status').textContent = 'READY';
  writeFeed(`[>] MODULE ARMED: ${v.toolId} // ${activeModule.label}`);
}

/**
 * Execute the active module against the current query input.
 * @returns {Promise<void>}
 */
async function runQuery() {
  if (!activeModule) return;
  const input = document.getElementById('recon-query');
  const runBtn = document.getElementById('btn-run-query');
  const query = input.value.trim();
  const statusEl = document.getElementById('module-status');
  if (!query) return;

  statusEl.textContent = 'SCANNING';
  runBtn.disabled = true;
  loader?.start(`SCANNING ${query.toUpperCase()}`);
  writeFeed(`[!] EXEC: ${activeModule.label} scan on [${query}]...`);

  try {
    const res = await api.recon.query(activeModule.id, query);
    writeFeed(res.lines);
    statusEl.textContent = 'COMPLETE';
    loader?.stop('▓ SCAN COMPLETE');
  } catch (err) {
    writeFeed(`  [x] ${err.message}`);
    statusEl.textContent = err.code === 'RECON_RATE_LIMITED' ? 'THROTTLED' : 'ERROR';
    loader?.stop('▒ SCAN ABORTED');
  } finally {
    runBtn.disabled = false;
  }
}

/**
 * Boot the console: load modules, wire controls, and populate the feed.
 * @param {string} handle authenticated operator handle
 * @param {() => void} onLogout
 * @returns {Promise<void>}
 */
export async function initConsole(handle, onLogout) {
  document.getElementById('active-op-handle').textContent = handle.toUpperCase();

  const galleryEl = document.getElementById('tool-gallery');
  const runBtn = document.getElementById('btn-run-query');
  const queryInput = document.getElementById('recon-query');
  const logoutBtn = document.getElementById('btn-logout');
  const loaderEl = document.getElementById('scan-loader');
  loader = loaderEl ? new AsciiLoader(loaderEl) : null;

  // Panels are now visible — re-wire the circuit mesh to connect to them.
  refreshMesh();

  try {
    const res = await api.recon.modules();
    modules = res.modules;
    renderCards(galleryEl);
    activeModule = modules[0] || null;
    if (activeModule) {
      const first = galleryEl.querySelector('.tool-card');
      if (first) {
        // Silent initial select — avoid duplicate boot feed noise.
        galleryEl.querySelectorAll('.tool-card').forEach((c) => c.classList.remove('active'));
        first.classList.add('active');
        document.getElementById('module-title').textContent = activeModule.title;
        document.getElementById('module-input-label').textContent = activeModule.inputLabel;
        queryInput.placeholder = activeModule.placeholder;
        document.getElementById('module-status').textContent = 'READY';
      }
    }
  } catch (err) {
    writeFeed(`  [x] Failed to load recon modules: ${err.message}`);
  }

  runBtn.addEventListener('click', runQuery);
  queryInput.addEventListener('keydown', (e) => e.key === 'Enter' && runQuery());
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
