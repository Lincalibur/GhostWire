import { AsciiEye } from './asciiEye.js';
import { CircuitField } from './circuitField.js';
import { SKULL_ART } from './skullArt.js';

const ACCENT = '#ff3535';

/** Live circuit field instance, so callers can trigger re-wiring. */
let circuit = null;

/**
 * Initialise the full surveillance mesh: eyes, central skull, and the animated
 * circuit/rain field that wires the core to the eyes and to the UI panels.
 * @param {object} [opts]
 * @param {number} [opts.eyeFontSize]
 * @returns {void}
 */
export function initMesh({ eyeFontSize = 9 } = {}) {
  const network = document.getElementById('network');
  const bgCanvas = document.getElementById('bg-canvas');
  if (!network || !bgCanvas) return;

  const nodeDivs = network.querySelectorAll('.node');
  const satelliteEls = network.querySelectorAll('.node.small');

  satelliteEls.forEach((el) => new AsciiEye(el, { color: ACCENT, proximity: 240, fontSize: eyeFontSize }));

  // Faint ASCII skull daemon at the core (the center node stays as the
  // invisible wiring anchor for the circuit field).
  const bgSkull = document.getElementById('bg-skull');
  if (bgSkull && !bgSkull.textContent.trim()) bgSkull.textContent = SKULL_ART;

  const nodeRefs = Array.from(nodeDivs).map((el) => ({
    el,
    isCenter: el.classList.contains('center'),
  }));

  requestAnimationFrame(() => {
    circuit = new CircuitField(bgCanvas, network, nodeRefs, {
      color: ACCENT,
      blockSelector: '.panel-window',
    });
  });
}

/**
 * Recompute the circuit wiring — call after UI panels appear/disappear so the
 * pulsing lines connect to the currently visible blocks.
 * @returns {void}
 */
export function refreshMesh() {
  if (!circuit) return;
  // Allow layout to settle before sampling panel geometry.
  requestAnimationFrame(() => circuit.refresh());
}
