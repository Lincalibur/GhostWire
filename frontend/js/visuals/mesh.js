import { AsciiEye } from './asciiEye.js';
import { AsciiSkull } from './asciiSkull.js';
import { CircuitField } from './circuitField.js';

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
  const centerEl = network.querySelector('.node.center');
  const satelliteEls = network.querySelectorAll('.node.small');

  satelliteEls.forEach((el) => new AsciiEye(el, { color: ACCENT, proximity: 240, fontSize: eyeFontSize }));

  if (centerEl) new AsciiSkull(centerEl, { color: ACCENT });

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
