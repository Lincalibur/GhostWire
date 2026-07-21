/**
 * GhostWire intro gate — locked Data Nexus screen.
 *
 * Based on Example/ghostwire_intro.html, polished per Example/themeUpdate.md:
 * HUD brackets + top bar, full-viewport ASCII streams into the center figure,
 * ambient hex matrix, crosshair reticle, humanized typewriter, and a Continue
 * button that is the *only* way past the gate (no skip / no auto-dismiss).
 */

const ASCII_CHARS = '0123456789ABCDEF<>[]//::--++==$$';
const TYPE_TEXT =
  'WARNING: IGNORANCE IS A SHIELD. KNOWLEDGE IS A BURDEN.\n\nDO YOU STILL WISH TO PROCEED?';

/**
 * Full-viewport ASCII particles that spawn off-screen and stream toward the
 * central figure. Replaces the localized CSS-dot streams from the prototype.
 */
class AsciiStreamField {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this._running = true;
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);
    this._resize();
    const count = Math.min(90, Math.max(48, Math.floor((this.w * this.h) / 18000)));
    for (let i = 0; i < count; i++) {
      this.particles.push(this._spawn());
    }
    this._raf = requestAnimationFrame(() => this._loop());
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.tx = this.w / 2;
    this.ty = this.h * 0.38;
  }

  _spawn() {
    const edge = (Math.random() * 4) | 0;
    let x;
    let y;
    if (edge === 0) {
      x = Math.random() * this.w;
      y = -24;
    } else if (edge === 1) {
      x = this.w + 24;
      y = Math.random() * this.h;
    } else if (edge === 2) {
      x = Math.random() * this.w;
      y = this.h + 24;
    } else {
      x = -24;
      y = Math.random() * this.h;
    }
    return {
      x,
      y,
      speed: 1.4 + Math.random() * 2.6,
      char: ASCII_CHARS[(Math.random() * ASCII_CHARS.length) | 0],
      opacity: 0.22 + Math.random() * 0.7,
      size: 10 + ((Math.random() * 7) | 0),
    };
  }

  _loop() {
    if (!this._running) return;
    this._raf = requestAnimationFrame(() => this._loop());
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(10, 10, 10, 0.28)';
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const p of this.particles) {
      const dx = this.tx - p.x;
      const dy = this.ty - p.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < 22) {
        Object.assign(p, this._spawn());
        continue;
      }
      p.x += (dx / dist) * p.speed;
      p.y += (dy / dist) * p.speed;
      if (Math.random() < 0.05) {
        p.char = ASCII_CHARS[(Math.random() * ASCII_CHARS.length) | 0];
      }
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = '#d01212';
      ctx.font = `bold ${p.size}px "JetBrains Mono", monospace`;
      ctx.fillText(p.char, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  stop() {
    this._running = false;
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._onResize);
  }
}

/**
 * Humanized typewriter — variable delays, punctuation pauses, occasional hesitations.
 * @param {HTMLElement} el
 * @param {string} text
 * @param {boolean} reduced
 * @returns {Promise<void>}
 */
function typeWithHumanRhythm(el, text, reduced) {
  return new Promise((resolve) => {
    if (reduced) {
      el.textContent = text;
      resolve();
      return;
    }
    let index = 0;
    const step = () => {
      if (index >= text.length) {
        resolve();
        return;
      }
      const ch = text[index++];
      el.textContent += ch;
      let delay = 35 + ((Math.random() * 50) | 0);
      if (['.', ':', '?', '!'].includes(ch)) delay += 250 + ((Math.random() * 300) | 0);
      else if (ch === ' ' || ch === '\n') delay += 20 + ((Math.random() * 60) | 0);
      else if (Math.random() < 0.08) delay += 150 + ((Math.random() * 200) | 0);
      setTimeout(step, delay);
    };
    step();
  });
}

/**
 * Build faint scrolling hex/binary columns for ambient background texture.
 * @param {HTMLElement} host
 */
function buildHexMatrix(host) {
  const cols = Math.max(12, Math.floor(window.innerWidth / 72));
  const glyphs = '0123456789ABCDEF';
  host.innerHTML = '';
  for (let c = 0; c < cols; c++) {
    const col = document.createElement('div');
    col.className = 'hex-col';
    col.style.animationDuration = `${18 + (c % 7) * 3}s`;
    col.style.animationDelay = `${-((c * 1.7) % 12)}s`;
    let s = '';
    for (let i = 0; i < 48; i++) {
      s += glyphs[(Math.random() * glyphs.length) | 0];
      if (i % 2 === 1) s += Math.random() < 0.35 ? ' ' : '\n';
      else s += Math.random() < 0.5 ? '0' : '1';
      s += '\n';
    }
    col.textContent = s;
    host.appendChild(col);
  }
}

/**
 * Play the locked intro gate. Resolves only after the operator clicks Continue.
 * @param {() => void} [onComplete]
 * @returns {Promise<void>}
 */
export function playIntro(onComplete) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('intro-overlay');
    const canvas = document.getElementById('ascii-stream-canvas');
    const output = document.getElementById('cli-type-output');
    const proceedBtn = document.getElementById('proceedBtn');
    const hexHost = document.getElementById('hex-matrix');
    const nexusImg = document.getElementById('nexusImg');

    if (!overlay || !canvas || !output || !proceedBtn) {
      onComplete?.();
      resolve();
      return;
    }

    const reduced =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    document.body.classList.add('intro-locked');
    overlay.classList.remove('gate-dismissed', 'gate-removed', 'hidden');
    proceedBtn.classList.remove('visible');
    proceedBtn.disabled = true;
    output.textContent = '';

    if (hexHost) buildHexMatrix(hexHost);

    const stream = reduced ? null : new AsciiStreamField(canvas);
    if (reduced) {
      const ctx = canvas.getContext('2d');
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      proceedBtn.disabled = true;
      proceedBtn.style.pointerEvents = 'none';
      const label = proceedBtn.querySelector('.btn-glitch-text');
      if (label) label.textContent = '[ ACCESS GRANTED ]';
      proceedBtn.classList.add('granted');

      if (nexusImg) {
        nexusImg.style.transform = 'scale(1.08)';
        nexusImg.style.filter = 'drop-shadow(0 0 25px rgba(208, 18, 18, 0.9))';
      }

      setTimeout(() => {
        overlay.classList.add('gate-dismissed');
        document.body.classList.remove('intro-locked');
      }, 280);

      setTimeout(() => {
        stream?.stop();
        overlay.classList.add('gate-removed');
        overlay.remove();
        onComplete?.();
        resolve();
      }, 1100);
    };

    typeWithHumanRhythm(output, TYPE_TEXT, reduced).then(() => {
      proceedBtn.classList.add('visible');
      proceedBtn.disabled = false;
      proceedBtn.focus({ preventScroll: true });
    });

    proceedBtn.addEventListener('click', finish, { once: true });
  });
}
