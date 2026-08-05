import { api } from './api.js';
import { AmbientHum } from './visuals/audio.js';
import { initOutputView, initInputView, loadModuleMetadata } from './ui/console.js';
import { playIntro } from './ui/intro.js';
import { initMetadataTool } from './ui/metadataTool.js';
import { initReportPanel } from './ui/report.js';
import { clearFeed } from './ui/feed.js';
import { resetProfile } from './state/auditProfile.js';

const INTAKE_FIELD_IDS = ['intake-email', 'intake-password', 'intake-username', 'intake-domain', 'intake-org'];

/** Swap from the input page to the scan-output page. */
function showOutputView() {
  document.getElementById('input-view').classList.add('hidden');
  const outputView = document.getElementById('output-view');
  outputView.classList.remove('hidden');
  outputView.style.display = 'grid';
}

/** Return to the input page (fresh state) — used by "Terminate Session". */
async function showInputView() {
  try {
    await api.auth.logout();
  } catch {
    /* no active session to terminate — fine */
  }
  clearFeed();
  resetProfile();
  INTAKE_FIELD_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  const outputView = document.getElementById('output-view');
  outputView.classList.add('hidden');
  outputView.style.display = 'none';
  document.getElementById('input-view').classList.remove('hidden');
}

/** Wire the ambient audio toggle button. */
function initAudioToggle() {
  const hum = new AmbientHum();
  const btn = document.getElementById('audio-prompt');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const on = hum.toggle();
    btn.textContent = on ? 'AUDIO: ON' : 'AUDIO: OFF';
  });
}

/** Show a small corner badge indicating dev/static-demo mode. */
function showDevBadge(health) {
  const badge = document.createElement('div');
  badge.id = 'dev-badge';
  badge.textContent = health.staticDemo ? 'STATIC DEMO' : 'DEV MODE';
  document.body.appendChild(badge);
}

/**
 * Try to establish a session, retrying briefly on failure. Guards against a
 * transient hiccup (e.g. the dev server's `--watch` restart-on-boot) leaving
 * the operator silently unauthenticated for the whole page load.
 * @param {boolean} devMode
 * @returns {Promise<string|null>} the operator handle, or null if still unauthenticated
 */
async function establishSession(devMode) {
  const attempts = devMode ? 3 : 1;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await api.auth.session();
      return res?.operator?.handle || null;
    } catch {
      if (!devMode) return null;
      try {
        const res = await api.auth.devLogin();
        return res?.operator?.handle || null;
      } catch {
        if (i < attempts - 1) await new Promise((r) => setTimeout(r, 400));
      }
    }
  }
  return null;
}

/** Application entrypoint. */
async function main() {
  initAudioToggle();
  initMetadataTool();
  initReportPanel();
  initOutputView(showInputView);
  initInputView(showOutputView);

  await playIntro();

  let devMode = false;
  try {
    const health = await api.health();
    devMode = Boolean(health.devMode);
    if (devMode) showDevBadge(health);
  } catch {
    /* health unavailable — continue as prod-like */
  }

  // Best-effort, silent session bootstrap: resume an existing session, or
  // (dev mode only) auto-login, so recon calls are authorized once the
  // operator starts a scan. No UI is gated on this succeeding.
  const handle = await establishSession(devMode);
  if (handle) {
    const handleEl = document.getElementById('active-op-handle');
    if (handleEl) handleEl.textContent = handle.toUpperCase();
  }

  await loadModuleMetadata();
}

document.addEventListener('DOMContentLoaded', main);
