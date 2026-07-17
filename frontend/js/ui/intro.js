import { AsciiEye } from '../visuals/asciiEye.js';
import { SKULL_ART } from '../visuals/skullArt.js';

/**
 * IntroStorm — a dense, bright field of ASCII circuit lines converging on a
 * central core, with fast travelling pulses and heavy binary rain. Purely
 * decorative; used only during the boot intro.
 */
class IntroStorm {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this._last = 0;
    this._onResize = () => {
      this._resize();
      this._build();
    };
    window.addEventListener('resize', this._onResize);
    this._resize();
    this._build();
    this._raf = requestAnimationFrame((t) => this._loop(t));
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _build() {
    this.cx = this.w / 2;
    this.cy = this.h * 0.44;
    const N = 24;
    this.nodes = [];
    for (let i = 0; i < N; i++) {
      this.nodes.push({ x: Math.random() * this.w, y: Math.random() * this.h });
    }
    this.wires = [];
    this.nodes.forEach((n, i) => this.wires.push(this._wire(this.cx, this.cy, n.x, n.y, i)));
    for (let k = 0; k < 18; k++) {
      const a = this.nodes[(Math.random() * N) | 0];
      const b = this.nodes[(Math.random() * N) | 0];
      this.wires.push(this._wire(a.x, a.y, b.x, b.y, k + 100));
    }

    this.ctx.font = 'bold 12px monospace';
    const cw = this.ctx.measureText('M').width;
    const ch = 14;
    this.rain = [];
    for (let y = 0; y < this.h; y += ch) {
      for (let x = 0; x < this.w; x += cw) {
        if (Math.random() < 0.17) {
          this.rain.push({ x, y, c: this._rainChar(), a: 0.05 + Math.random() * 0.28 });
        }
      }
    }
  }

  _wire(x1, y1, x2, y2, i) {
    const horiz = Math.abs(x2 - x1) > Math.abs(y2 - y1);
    const bend = 0.35 + (i % 4) * 0.12;
    let pts;
    if (horiz) {
      const mx = x1 + (x2 - x1) * bend;
      pts = [[x1, y1], [mx, y1], [mx, y2], [x2, y2]];
    } else {
      const my = y1 + (y2 - y1) * bend;
      pts = [[x1, y1], [x1, my], [x2, my], [x2, y2]];
    }
    return this._sample(pts, 10, i);
  }

  _sample(pts, spacing, i) {
    const segLens = [];
    let total = 0;
    for (let k = 0; k < pts.length - 1; k++) {
      const l = Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]);
      segLens.push(l);
      total += l;
    }
    const samples = [];
    let segIdx = 0;
    let segStart = 0;
    for (let dist = 0; dist <= total; dist += spacing) {
      while (segIdx < segLens.length - 1 && dist - segStart > segLens[segIdx]) {
        segStart += segLens[segIdx];
        segIdx++;
      }
      const segLen = segLens[segIdx] || 1;
      const tt = Math.min(1, (dist - segStart) / segLen);
      const p0 = pts[segIdx];
      const p1 = pts[segIdx + 1];
      const x = p0[0] + (p1[0] - p0[0]) * tt;
      const y = p0[1] + (p1[1] - p0[1]) * tt;
      const horiz = Math.abs(p1[0] - p0[0]) >= Math.abs(p1[1] - p0[1]);
      samples.push({ x, y, dist, char: this._wireChar(horiz) });
    }
    return {
      samples,
      total: Math.max(1, total),
      phase: (i % 10) / 10,
      speed: 0.0004 * (0.7 + Math.random() * 0.9),
    };
  }

  _wireChar(h) {
    const r = Math.random();
    if (r < 0.5) return h ? '-' : '|';
    if (r < 0.7) return '+';
    return Math.random() < 0.5 ? '0' : '1';
  }

  _rainChar() {
    if (Math.random() < 0.72) return Math.random() < 0.5 ? '0' : '1';
    const s = '#%*+=-:;./\\';
    return s[(Math.random() * s.length) | 0];
  }

  _loop(t) {
    this._raf = requestAnimationFrame((x) => this._loop(x));
    if (t - this._last < 33) return;
    this._last = t;
    this._draw(t);
  }

  _draw(t) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.font = 'bold 12px monospace';
    ctx.textBaseline = 'middle';

    ctx.textAlign = 'left';
    for (const c of this.rain) {
      if (Math.random() < 0.012) c.c = this._rainChar();
      ctx.globalAlpha = c.a;
      ctx.fillStyle = '#ff3030';
      ctx.fillText(c.c, c.x, c.y);
    }

    ctx.textAlign = 'center';
    for (const w of this.wires) {
      if (Math.random() < 0.03) {
        const s = w.samples[(Math.random() * w.samples.length) | 0];
        if (s) s.char = this._wireChar(Math.random() < 0.5);
      }
      const prog = [(t * w.speed + w.phase) % 1, (t * w.speed + w.phase + 0.5) % 1];
      for (const s of w.samples) {
        let inten = 0;
        for (const p of prog) {
          let d = Math.abs(s.dist / w.total - p);
          d = Math.min(d, 1 - d);
          inten = Math.max(inten, Math.max(0, 1 - d / 0.07));
        }
        const a = 0.24 + 0.76 * inten;
        const r = Math.round(150 + 105 * inten);
        const gb = Math.round(24 + 231 * inten);
        ctx.globalAlpha = a;
        ctx.fillStyle = `rgb(${r},${gb},${gb})`;
        ctx.shadowBlur = inten > 0.5 ? 6 * inten : 1;
        ctx.shadowColor = '#ff5050';
        ctx.fillText(s.char, s.x, s.y);
      }
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // Pulsing core rings behind the skull.
    const breathe = 0.5 + 0.5 * Math.sin(t * 0.004);
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ff3030';
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = `rgba(255,70,70,${(0.5 - k * 0.13) * (0.6 + 0.4 * breathe)})`;
      ctx.lineWidth = k === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, 120 + k * 26 + 6 * breathe, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  stop() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._onResize);
  }
}

const BOOT_LINES = [
  '> GHOSTWIRE NODE BOOT SEQUENCE ......... INIT',
  '> MOUNTING SURVEILLANCE MESH ........... OK',
  '> CALIBRATING OPTICAL NODES [6] ........ OK',
  '> ROUTING CIRCUIT PATHWAYS ............. OK',
  '> DECRYPTING GATEKEEPER ROUTES ......... OK',
  '> DAEMON HANDSHAKE ..................... OK',
  '> STATUS: NODE ONLINE',
];

/**
 * Play the boot intro, then reveal the app.
 * Resolves (and calls onComplete) once the overlay has faded out or the user
 * skips via click / keypress.
 * @param {() => void} [onComplete]
 * @returns {void}
 */
export function playIntro(onComplete) {
  const overlay = document.getElementById('intro-overlay');
  const canvas = document.getElementById('intro-canvas');
  const skullEl = document.getElementById('intro-skull');
  const bootEl = document.getElementById('intro-boot');

  if (!overlay || !canvas || !skullEl || !bootEl) {
    onComplete?.();
    return;
  }

  const reduced =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Build the three stacked skull layers for the RGB-split glitch effect.
  for (const cls of ['base', 'g1', 'g2']) {
    const pre = document.createElement('pre');
    pre.className = `skull-layer ${cls}`;
    pre.textContent = SKULL_ART;
    skullEl.appendChild(pre);
  }

  const storm = new IntroStorm(canvas);

  // Scatter a few live eyes so the surveillance nodes get their moment.
  const eyes = [];
  for (const [l, tp] of [[16, 24], [84, 22], [22, 76], [80, 74]]) {
    const d = document.createElement('div');
    d.className = 'intro-eye';
    d.style.left = `${l}%`;
    d.style.top = `${tp}%`;
    overlay.appendChild(d);
    eyes.push(new AsciiEye(d, { fontSize: 11, proximity: 340 }));
  }

  // Type out the boot log.
  let li = 0;
  const typer = setInterval(() => {
    if (li >= BOOT_LINES.length) return;
    const div = document.createElement('div');
    div.textContent = BOOT_LINES[li++];
    bootEl.appendChild(div);
  }, 260);

  // Periodic glitch bursts.
  const glitchTimer = setInterval(() => {
    overlay.style.setProperty('--gx', `${(Math.random() - 0.5) * 12}px`);
    overlay.classList.add('glitch');
    setTimeout(() => overlay.classList.remove('glitch'), 130);
  }, 850);

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearInterval(typer);
    clearInterval(glitchTimer);
    clearTimeout(timer);
    overlay.removeEventListener('click', finish);
    window.removeEventListener('keydown', finish);
    overlay.classList.add('hidden');
    setTimeout(() => {
      storm.stop();
      eyes.forEach((e) => e.destroy && e.destroy());
      overlay.remove();
      onComplete?.();
    }, 750);
  };

  const timer = setTimeout(finish, reduced ? 700 : 3600);
  overlay.addEventListener('click', finish);
  window.addEventListener('keydown', finish);
}
