import { AsciiEye } from './asciiEye.js';
import { AsciiSkull } from './asciiSkull.js';
import { CircuitField } from './circuitField.js';

const ACCENT = '#ff2b2b';

/**
 * Initialise the full surveillance mesh: eyes, central skull, and the
 * animated circuit/rain field wiring them together.
 * @param {object} [opts]
 * @param {number} [opts.eyeFontSize]
 * @returns {void}
 */
export function initMesh({ eyeFontSize = 8 } = {}) {
  const network = document.getElementById('network');
  const bgCanvas = document.getElementById('bg-canvas');
  if (!network || !bgCanvas) return;

  const nodeDivs = network.querySelectorAll('.node');
  const centerEl = network.querySelector('.node.center');
  const satelliteEls = network.querySelectorAll('.node.small');

  satelliteEls.forEach((el) => new AsciiEye(el, { color: ACCENT, proximity: 200, fontSize: eyeFontSize }));

  if (centerEl) new AsciiSkull(centerEl, { color: ACCENT });

  const nodeRefs = Array.from(nodeDivs).map((el) => ({
    el,
    isCenter: el.classList.contains('center'),
  }));

  // Recompute node positions once layout settles.
  requestAnimationFrame(() => {
    new CircuitField(bgCanvas, network, nodeRefs, { color: ACCENT });
  });
}
