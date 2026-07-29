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
  let handle = null;
  try {
    const res = await api.auth.session();
    handle = res?.operator?.handle || null;
  } catch {
    if (devMode) {
      try {
        const res = await api.auth.devLogin();
        handle = res?.operator?.handle || null;
      } catch {
        /* stays unauthenticated — recon calls will surface as errors per job */
      }
    }
  }
  if (handle) {
    const handleEl = document.getElementById('active-op-handle');
    if (handleEl) handleEl.textContent = handle.toUpperCase();
  }

  await loadModuleMetadata();
}

document.addEventListener('DOMContentLoaded', main);
