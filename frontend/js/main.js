import { api } from './api.js';
import { initMesh, refreshMesh } from './visuals/mesh.js';
import { AmbientHum } from './visuals/audio.js';
import { initPortal } from './ui/portal.js';
import { initConsole } from './ui/console.js';
import { playIntro } from './ui/intro.js';

/** Swap from the login portal to the authenticated console view. */
function enterConsole(handle) {
  document.getElementById('login-view').classList.add('hidden');
  const consoleView = document.getElementById('console-view');
  consoleView.classList.remove('hidden');
  consoleView.style.display = 'grid';
  initConsole(handle, exitConsole);
}

/** Return to the login portal after logout/session loss. */
function exitConsole() {
  const consoleView = document.getElementById('console-view');
  consoleView.classList.add('hidden');
  consoleView.style.display = 'none';
  document.getElementById('login-view').classList.remove('hidden');
  document.getElementById('login-form-step').classList.remove('hidden');
  document.getElementById('otp-form-step').classList.add('hidden');
  document.getElementById('operator-id').value = '';
  document.getElementById('operator-pass').value = '';
  document.getElementById('otp-token').value = '';
  refreshMesh();
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

/**
 * Enable dev-mode affordances: a corner badge, prefilled credentials, and a
 * one-click "DEV LOGIN" button that bypasses the OTP.
 * @param {{ devOperator?: string, devPassword?: string }} health
 */
function enableDevAffordances(health) {
  document.body.classList.add('dev-mode');

  const badge = document.createElement('div');
  badge.id = 'dev-badge';
  badge.textContent = 'DEV MODE';
  document.body.appendChild(badge);

  const idInput = document.getElementById('operator-id');
  const passInput = document.getElementById('operator-pass');
  if (idInput && health.devOperator) idInput.value = health.devOperator;
  if (passInput && health.devPassword) passInput.value = health.devPassword;

  const loginStep = document.getElementById('login-form-step');
  if (loginStep && !document.getElementById('btn-dev-login')) {
    const btn = document.createElement('button');
    btn.id = 'btn-dev-login';
    btn.type = 'button';
    btn.className = 'terminal-btn dev';
    btn.textContent = 'DEV LOGIN (skip OTP)';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const res = await api.auth.devLogin();
        enterConsole(res.operator.handle);
      } catch {
        btn.disabled = false;
      }
    });
    loginStep.appendChild(btn);
  }
}

/** Application entrypoint. */
async function main() {
  // Mesh + portal boot behind the gate; auth waits until Continue.
  initMesh();
  initAudioToggle();
  initPortal(enterConsole);

  await playIntro();

  let devMode = false;
  try {
    const health = await api.health();
    devMode = Boolean(health.devMode);
    if (devMode) enableDevAffordances(health);
  } catch {
    /* health unavailable — continue as prod-like */
  }

  // Resume an existing session if the cookie is still valid.
  try {
    const res = await api.auth.session();
    if (res?.operator?.handle) {
      enterConsole(res.operator.handle);
      return;
    }
  } catch {
    /* no active session */
  }

  // Dev mode: drop straight into the console for fast feature testing.
  if (devMode) {
    try {
      const res = await api.auth.devLogin();
      enterConsole(res.operator.handle);
    } catch {
      /* fall back to the (prefilled) portal */
    }
  }
}

document.addEventListener('DOMContentLoaded', main);
