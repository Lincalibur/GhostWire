import { api } from '../api.js';
import { writeFeed } from './feed.js';

let modules = [];
let activeModule = null;

/**
 * Render the recon module tabs from backend metadata.
 * @param {HTMLElement} tabsEl
 * @returns {void}
 */
function renderTabs(tabsEl) {
  tabsEl.innerHTML = '';
  modules.forEach((mod, i) => {
    const tab = document.createElement('div');
    tab.className = 'module-tab' + (i === 0 ? ' active' : '');
    tab.dataset.moduleId = mod.id;
    tab.textContent = mod.label;
    tab.addEventListener('click', () => selectModule(mod.id, tab, tabsEl));
    tabsEl.appendChild(tab);
  });
}

/**
 * Activate a module: highlight its tab and update the query panel.
 * @param {string} id
 * @param {HTMLElement} tabEl
 * @param {HTMLElement} tabsEl
 * @returns {void}
 */
function selectModule(id, tabEl, tabsEl) {
  activeModule = modules.find((m) => m.id === id);
  if (!activeModule) return;

  tabsEl.querySelectorAll('.module-tab').forEach((t) => t.classList.remove('active'));
  tabEl.classList.add('active');

  document.getElementById('module-title').textContent = activeModule.title;
  document.getElementById('module-input-label').textContent = activeModule.inputLabel;
  const input = document.getElementById('recon-query');
  input.placeholder = activeModule.placeholder;
  input.value = '';
  document.getElementById('module-status').textContent = 'READY';
}

/**
 * Execute the active module against the current query input.
 * @returns {Promise<void>}
 */
async function runQuery() {
  if (!activeModule) return;
  const input = document.getElementById('recon-query');
  const query = input.value.trim();
  const statusEl = document.getElementById('module-status');
  if (!query) return;

  statusEl.textContent = 'SCANNING';
  writeFeed(`[!] EXEC: ${activeModule.label} scan on [${query}]...`);

  try {
    const res = await api.recon.query(activeModule.id, query);
    writeFeed(res.lines);
    statusEl.textContent = 'COMPLETE';
  } catch (err) {
    writeFeed(`  [x] ${err.message}`);
    statusEl.textContent = err.code === 'RECON_RATE_LIMITED' ? 'THROTTLED' : 'ERROR';
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

  const tabsEl = document.getElementById('module-tabs');
  const runBtn = document.getElementById('btn-run-query');
  const queryInput = document.getElementById('recon-query');
  const logoutBtn = document.getElementById('btn-logout');

  try {
    const res = await api.recon.modules();
    modules = res.modules;
    renderTabs(tabsEl);
    activeModule = modules[0] || null;
    if (activeModule) {
      const first = tabsEl.querySelector('.module-tab');
      if (first) selectModule(activeModule.id, first, tabsEl);
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
    'SYSTEM: Loading active plugins... [DONE]',
    'Ready for input parameters...',
  ]);
}
