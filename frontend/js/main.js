import { api } from './api.js';
import { initMesh } from './visuals/mesh.js';
import { AmbientHum } from './visuals/audio.js';
import { initPortal } from './ui/portal.js';
import { initConsole } from './ui/console.js';

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

/** Application entrypoint. */
async function main() {
  initMesh();
  initAudioToggle();
  initPortal(enterConsole);

  // Resume an existing session if the cookie is still valid.
  try {
    const res = await api.auth.session();
    if (res?.operator?.handle) enterConsole(res.operator.handle);
  } catch {
    /* no active session — remain on the portal */
  }
}

document.addEventListener('DOMContentLoaded', main);
