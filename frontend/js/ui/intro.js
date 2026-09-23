/**
 * GhostWire intro gate — uplink boot sequence.
 *
 * Terminal boot log types out, cuts to a glitch flash, then the wordmark
 * decrypts into view with cyan/yellow RGB-split ghost layers. Jack In is the
 * *only* way past the gate; clicking it reuses the existing glitch-jitter →
 * CRT-collapse exit straight into the app underneath.
 */

const SCRAMBLE_CHARS = '!<>-_\\/[]{}—=+*^?#0123456789ABCDEF';
const WORDMARK = 'GHOSTWIRE';

const BOOT_LINES = [
  { text: 'INITIATING UPLINK...', cls: '' },
  { text: 'TRACE COUNTERMEASURES ACTIVE', cls: 'warn' },
  { text: 'ROUTING THROUGH PROXY_07', cls: 'dim' },
  { text: 'DECRYPTING RECON PACKET...', cls: '' },
  { text: 'ACCESS GRANTED', cls: 'ok' },
];

/**
 * Type a single boot line into `host`, character by character.
 * @param {HTMLElement} host
 * @param {{text: string, cls: string}} line
 * @returns {Promise<void>}
 */
function typeBootLine(host, line) {
  return new Promise((resolve) => {
    const row = document.createElement('div');
    if (line.cls) row.className = line.cls;
    host.appendChild(row);
    let i = 0;
    const step = () => {
      row.textContent = line.text.slice(0, i);
      i++;
      if (i > line.text.length) {
        resolve();
        return;
      }
      setTimeout(step, 16);
    };
    step();
  });
}

/**
 * Run the boot log line-by-line, resolving once every line has typed out.
 * @param {HTMLElement} host
 * @returns {Promise<void>}
 */
async function runBootLog(host) {
  host.innerHTML = '';
  for (const line of BOOT_LINES) {
    await typeBootLine(host, line);
    await new Promise((r) => setTimeout(r, 120));
  }
  await new Promise((r) => setTimeout(r, 300));
}

/**
 * Scramble-decode `el`'s text into `target`, revealing left-to-right.
 * @param {HTMLElement} el
 * @param {string} target
 * @param {number} [duration]
 * @returns {Promise<void>}
 */
function scrambleReveal(el, target, duration = 650) {
  return new Promise((resolve) => {
    const start = performance.now();
    const frame = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const revealCount = Math.floor(progress * target.length);
      let out = '';
      for (let i = 0; i < target.length; i++) {
        out += i < revealCount ? target[i] : SCRAMBLE_CHARS[(Math.random() * SCRAMBLE_CHARS.length) | 0];
      }
      el.textContent = out;
      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        el.textContent = target;
        resolve();
      }
    };
    requestAnimationFrame(frame);
  });
}

/**
 * Play the locked intro gate. Resolves only after the operator clicks Jack In.
 * @param {() => void} [onComplete]
 * @returns {Promise<void>}
 */
export function playIntro(onComplete) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('intro-overlay');
    const terminalEl = document.getElementById('intro-terminal');
    const wordmark = document.getElementById('intro-wordmark');
    const baseLayer = wordmark?.querySelector('.wm-base');
    const cyanLayer = wordmark?.querySelector('.wm-cyan');
    const yellowLayer = wordmark?.querySelector('.wm-yellow');
    const subline = document.getElementById('intro-subline');
    const corners = document.querySelectorAll('.intro-corner');
    const cta = document.getElementById('intro-cta');
    const proceedBtn = document.getElementById('proceedBtn');
    const flash = document.getElementById('intro-flash');

    if (!overlay || !terminalEl || !wordmark || !baseLayer || !proceedBtn) {
      onComplete?.();
      resolve();
      return;
    }

    const reduced =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    document.body.classList.add('intro-locked');
    overlay.classList.remove('gate-dismissed', 'gate-removed');
    proceedBtn.disabled = true;
    terminalEl.innerHTML = '';
    terminalEl.classList.remove('visible');
    baseLayer.textContent = '';
    if (cyanLayer) cyanLayer.textContent = '';
    if (yellowLayer) yellowLayer.textContent = '';
    wordmark.classList.remove('revealed', 'settled', 'flicker');
    subline?.classList.remove('visible');
    cta?.classList.remove('visible');
    corners.forEach((c) => c.classList.remove('visible'));

    let flickerTimer = null;
    const startAmbientFlicker = () => {
      flickerTimer = setInterval(() => {
        if (Math.random() > 0.94) {
          wordmark.classList.add('flicker');
          setTimeout(() => wordmark.classList.remove('flicker'), 60);
        }
      }, 400);
    };

    const revealSequence = async () => {
      terminalEl.classList.add('visible');
      await runBootLog(terminalEl);

      // Glitch cut: brief flash, terminal log drops away.
      flash?.classList.add('burst');
      setTimeout(() => flash?.classList.remove('burst'), 90);
      terminalEl.classList.remove('visible');

      wordmark.classList.add('revealed');
      await scrambleReveal(baseLayer, WORDMARK);
      if (cyanLayer) cyanLayer.textContent = WORDMARK;
      if (yellowLayer) yellowLayer.textContent = WORDMARK;
      wordmark.classList.add('settled');

      subline?.classList.add('visible');
      corners.forEach((c, i) => setTimeout(() => c.classList.add('visible'), i * 80));

      proceedBtn.disabled = false;
      cta?.classList.add('visible');
      proceedBtn.focus({ preventScroll: true });
      startAmbientFlicker();
    };

    if (reduced) {
      baseLayer.textContent = WORDMARK;
      if (cyanLayer) cyanLayer.textContent = WORDMARK;
      if (yellowLayer) yellowLayer.textContent = WORDMARK;
      wordmark.classList.add('revealed', 'settled');
      subline?.classList.add('visible');
      corners.forEach((c) => c.classList.add('visible'));
      proceedBtn.disabled = false;
      cta?.classList.add('visible');
    } else {
      revealSequence();
    }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      proceedBtn.disabled = true;
      proceedBtn.style.pointerEvents = 'none';
      proceedBtn.textContent = 'ACCESS GRANTED';
      if (flickerTimer) clearInterval(flickerTimer);

      const tearDown = () => {
        overlay.classList.add('gate-removed');
        overlay.remove();
        document.body.classList.remove('intro-locked');
        onComplete?.();
        resolve();
      };

      // Reduced motion: quick fade, no glitch theatrics.
      if (reduced) {
        overlay.classList.add('gate-dismissed');
        setTimeout(tearDown, 450);
        return;
      }

      // Hard glitch-cut: brief RGB-split/static jitter, then a CRT
      // power-off collapse straight to the app underneath.
      overlay.classList.add('glitching');
      setTimeout(() => overlay.classList.add('crt-off'), 350);
      setTimeout(tearDown, 750);
    };

    proceedBtn.addEventListener('click', finish, { once: true });
  });
}
