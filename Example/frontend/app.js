/* =========================================================================
   AUDIO GENERATOR (Atmospheric 40Hz hum node)
   ========================================================================= */
let audioCtx = null;
let osc = null;
let filter = null;
let humActive = false;

window.toggleAudio = function() {
  const btn = document.getElementById('audio-prompt');
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    osc = audioCtx.createOscillator();
    filter = audioCtx.createBiquadFilter();
    const gainNode = audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(40, audioCtx.currentTime); // 40Hz deep hum

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(80, audioCtx.currentTime);

    gainNode.gain.setValueAtTime(0.04, audioCtx.currentTime); // keep it extremely quiet and subtle

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.start();
  }

  if (humActive) {
    audioCtx.suspend();
    btn.innerText = "AUDIO: OFF";
    humActive = false;
  } else {
    audioCtx.resume();
    btn.innerText = "AUDIO: ON";
    humActive = true;
  }
}

/* =========================================================================
   AsciiEye - Visual Node
   ========================================================================= */
class AsciiEye {
  constructor(container, opts = {}) {
    this.container = container;
    const reducedMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.opts = Object.assign({
      color: '#ff2b2b',
      pupilColor: '#ff9d9d',
      bgAlpha: 0.12,
      fontSize: 9,
      proximity: 220,
      fps: 20,
      rerollRate: 0.015,
      chars: '01#%*+=-:;.ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      glow: true,
      idle: !reducedMotion,
    }, opts);

    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.ctx = this.canvas.getContext('2d');
    container.appendChild(this.canvas);

    this.mouse = { x: -99999, y: -99999 };
    this.pupil = { x: 0, y: 0 };
    this.pupilTarget = { x: 0, y: 0 };
    this.idleT = Math.random() * 1000;
    this._lastTick = 0;
    this._visible = true;

    this._onMove = this._onMove.bind(this);
    this._onResize = this._debounce(this._resize.bind(this), 150);
    window.addEventListener('mousemove', this._onMove, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (e.touches[0]) this._onMove(e.touches[0]);
    }, { passive: true });
    window.addEventListener('resize', this._onResize);

    if ('IntersectionObserver' in window) {
      this._io = new IntersectionObserver((entries) => {
        this._visible = entries[0].isIntersecting;
      }, { threshold: 0 });
      this._io.observe(container);
    }

    this._resize();
    requestAnimationFrame(this._loop.bind(this));
  }

  _debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  _resize() {
    const rect = this.container.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.ctx.font = `${this.opts.fontSize}px monospace`;
    this.charW = this.ctx.measureText('M').width;
    this.charH = this.opts.fontSize * 1.15;
    this.cols = Math.ceil(this.width / this.charW);
    this.rows = Math.ceil(this.height / this.charH);

    this.cx = this.width / 2;
    this.cy = this.height / 2;

    const a = Math.min(this.width * 0.48, this.height * 2.4);
    const b = a * 0.28;
    this.a = a; this.b = b;

    this.irisR = b * 0.78;
    this.pupilR = b * 0.42;
    this.maxOffsetX = Math.max(0, (a - this.irisR) * 0.62);
    this.maxOffsetY = Math.max(0, (b - this.irisR) * 0.62);

    this._buildCells();
  }

  _buildCells() {
    this.cells = [];
    const fadeBand = this.charH * 3.2;
    const jitterAmt = this.charH * 1.1;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = c * this.charW - this.cx + this.charW / 2;
        const y = r * this.charH - this.cy + this.charH / 2;
        const rNorm = Math.hypot(x / this.a, y / this.b);
        const rawEdge = (1 - rNorm) * Math.min(this.a, this.b);
        const jitter = (Math.random() - 0.5) * jitterAmt;
        const edge = rawEdge + jitter;
        const inside = edge > 0;
        if (!inside && edge < -fadeBand) continue;
        this.cells.push({ x, y, edge, inside, char: this._randChar() });
      }
    }
  }

  _randChar() { const s = this.opts.chars; return s[(Math.random() * s.length) | 0]; }

  _onMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = e.clientX - rect.left;
    this.mouse.y = e.clientY - rect.top;
  }

  _loop(t) {
    requestAnimationFrame(this._loop.bind(this));
    const interval = 1000 / this.opts.fps;
    if (t - this._lastTick < interval) return;
    this._lastTick = t;
    if (!this._visible) return;
    this._update();
    this._draw();
  }

  _update() {
    const dx = this.mouse.x - this.cx;
    const dy = this.mouse.y - this.cy;
    const dist = Math.hypot(dx, dy);

    if (dist < this.opts.proximity && dist > 0.01) {
      const nx = dx / dist, ny = dy / dist;
      const pull = Math.min(1, dist / this.opts.proximity);
      this.pupilTarget.x = nx * this.maxOffsetX * pull;
      this.pupilTarget.y = ny * this.maxOffsetY * pull;
    } else if (this.opts.idle) {
      this.idleT += 0.016;
      this.pupilTarget.x = Math.sin(this.idleT) * this.maxOffsetX * 0.4;
      this.pupilTarget.y = Math.cos(this.idleT * 0.7) * this.maxOffsetY * 0.5;
    } else {
      this.pupilTarget.x = 0; this.pupilTarget.y = 0;
    }

    this.pupil.x += (this.pupilTarget.x - this.pupil.x) * 0.08;
    this.pupil.y += (this.pupilTarget.y - this.pupil.y) * 0.08;

    const nx2 = this.maxOffsetX > 0 ? this.pupil.x / this.maxOffsetX : 0;
    const ny2 = this.maxOffsetY > 0 ? this.pupil.y / this.maxOffsetY : 0;
    const m = Math.hypot(nx2, ny2);
    if (m > 1) { this.pupil.x /= m; this.pupil.y /= m; }

    const n = Math.max(1, Math.floor(this.cells.length * this.opts.rerollRate));
    for (let i = 0; i < n; i++) {
      this.cells[(Math.random() * this.cells.length) | 0].char = this._randChar();
    }
  }

  _draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.font = `${this.opts.fontSize}px monospace`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    if (this.opts.glow) { ctx.shadowColor = this.opts.color; ctx.shadowBlur = 3; }

    for (const cell of this.cells) {
      const dx = cell.x - this.pupil.x;
      const dy = cell.y - this.pupil.y;
      const rr = Math.hypot(dx, dy);

      let alpha, color;
      if (rr < this.pupilR) {
        continue;
      } else if (cell.inside) {
        const t = Math.min(1, cell.edge / (this.charH * 2.2));
        alpha = 0.16 + t * 0.5;
        color = this.opts.color;
      } else {
        const t = Math.max(0, 1 + cell.edge / (this.charH * 3.2));
        alpha = this.opts.bgAlpha * t;
        color = this.opts.color;
      }

      if (alpha <= 0.015) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillText(cell.char, this.cx + cell.x, this.cy + cell.y);
    }
    ctx.globalAlpha = 1;
  }
}

/* =========================================================================
   AsciiSkull - Visual Node
   ========================================================================= */
class AsciiSkull {
  constructor(container, opts = {}) {
    this.container = container;
    const reducedMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.opts = Object.assign({
      color: '#ff3b3b',
      fontSize: 10,
      fps: 20,
      rerollRate: 0.012,
      chars: '01',
      pulseSpeed: 0.0016,
      glow: true,
    }, opts);

    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    this.ctx = this.canvas.getContext('2d');
    container.appendChild(this.canvas);

    this._lastTick = 0;
    this._visible = true;
    this._onResize = this._debounce(this._resize.bind(this), 150);
    window.addEventListener('resize', this._onResize);

    if ('IntersectionObserver' in window) {
      this._io = new IntersectionObserver((entries) => {
        this._visible = entries[0].isIntersecting;
      }, { threshold: 0 });
      this._io.observe(container);
    }

    this._buildMask();
    this._resize();
    requestAnimationFrame(this._loop.bind(this));
  }

  _debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  _buildMask() {
    const W = 240, H = 210;
    const raw = document.createElement('canvas');
    raw.width = W; raw.height = H;
    const rctx = raw.getContext('2d');

    const leftPts = [
      [0.50, 0.03], [0.27, 0.045], [0.10, 0.19], [0.055, 0.36],
      [0.08, 0.52], [0.14, 0.68], [0.27, 0.83], [0.42, 0.92],
    ].map(p => [p[0] * W, p[1] * H]);

    const path = new Path2D();
    path.moveTo(leftPts[0][0], leftPts[0][1]);
    for (let i = 1; i < leftPts.length - 1; i++) {
      const xc = (leftPts[i][0] + leftPts[i + 1][0]) / 2;
      const yc = (leftPts[i][1] + leftPts[i + 1][1]) / 2;
      path.quadraticCurveTo(leftPts[i][0], leftPts[i][1], xc, yc);
    }
    path.lineTo(leftPts[leftPts.length - 1][0], leftPts[leftPts.length - 1][1]);
    path.lineTo(W * 0.5, H * 0.95);

    const rightPts = leftPts.slice().reverse().map(p => [W - p[0], p[1]]);
    path.lineTo(rightPts[0][0], rightPts[0][1]);
    for (let i = 1; i < rightPts.length - 1; i++) {
      const xc = (rightPts[i][0] + rightPts[i + 1][0]) / 2;
      const yc = (rightPts[i][1] + rightPts[i + 1][1]) / 2;
      path.quadraticCurveTo(rightPts[i][0], rightPts[i][1], xc, yc);
    }
    path.lineTo(rightPts[rightPts.length - 1][0], rightPts[rightPts.length - 1][1]);
    path.closePath();

    rctx.fillStyle = '#fff';
    rctx.fill(path);

    rctx.globalCompositeOperation = 'destination-out';
    rctx.fillStyle = '#fff';
    const ellipse = (cx, cy, rx, ry) => {
      rctx.beginPath();
      rctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      rctx.fill();
    };
    ellipse(W * 0.32, H * 0.38, W * 0.10, H * 0.13);
    ellipse(W * 0.68, H * 0.38, W * 0.10, H * 0.13);

    rctx.beginPath();
    rctx.moveTo(W * 0.5, H * 0.48);
    rctx.lineTo(W * 0.46, H * 0.58);
    rctx.lineTo(W * 0.54, H * 0.58);
    rctx.closePath();
    rctx.fill();

    for (let i = 0; i < 7; i++) {
      const x = W * (0.30 + i * 0.058);
      rctx.fillRect(x, H * 0.72, W * 0.02, H * 0.05);
    }
    rctx.globalCompositeOperation = 'source-over';

    const blurred = document.createElement('canvas');
    blurred.width = W; blurred.height = H;
    const bctx = blurred.getContext('2d');
    bctx.filter = 'blur(2px)';
    bctx.drawImage(raw, 0, 0);

    this.maskW = W; this.maskH = H;
    this.maskData = bctx.getImageData(0, 0, W, H).data;
  }

  _sampleMask(u, v) {
    const mx = Math.min(this.maskW - 1, Math.max(0, Math.floor(u * this.maskW)));
    const my = Math.min(this.maskH - 1, Math.max(0, Math.floor(v * this.maskH)));
    return this.maskData[(my * this.maskW + mx) * 4 + 3] / 255;
  }

  _resize() {
    const rect = this.container.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.ctx.font = `${this.opts.fontSize}px monospace`;
    this.charW = this.ctx.measureText('M').width;
    this.charH = this.opts.fontSize * 1.1;
    this.cols = Math.ceil(this.width / this.charW);
    this.rows = Math.ceil(this.height / this.charH);

    const maskAR = this.maskW / this.maskH;
    let boxW = this.width * 0.92, boxH = boxW / maskAR;
    if (boxH > this.height * 0.94) { boxH = this.height * 0.94; boxW = boxH * maskAR; }
    this.boxX = (this.width - boxW) / 2;
    this.boxY = (this.height - boxH) / 2;
    this.boxW = boxW; this.boxH = boxH;

    this._buildCells();
  }

  _buildCells() {
    this.cells = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = c * this.charW + this.charW / 2;
        const y = r * this.charH + this.charH / 2;
        if (x < this.boxX || x > this.boxX + this.boxW || y < this.boxY || y > this.boxY + this.boxH) continue;
        const u = (x - this.boxX) / this.boxW;
        const v = (y - this.boxY) / this.boxH;
        const a = this._sampleMask(u, v);
        if (a < 0.03) continue;
        this.cells.push({ x, y, base: a, char: this._randChar() });
      }
    }
  }

  _randChar() { const s = this.opts.chars; return s[(Math.random() * s.length) | 0]; }

  _loop(t) {
    requestAnimationFrame(this._loop.bind(this));
    const interval = 1000 / this.opts.fps;
    if (t - this._lastTick < interval) return;
    this._lastTick = t;
    if (!this._visible) return;
    this._update(t);
    this._draw();
  }

  _update(t) {
    const n = Math.max(1, Math.floor(this.cells.length * this.opts.rerollRate));
    for (let i = 0; i < n; i++) this.cells[(Math.random() * this.cells.length) | 0].char = this._randChar();
    this.pulse = this.opts.pulseSpeed ? 0.78 + 0.22 * Math.sin(t * this.opts.pulseSpeed) : 1;
  }

  _draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.font = `${this.opts.fontSize}px monospace`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    if (this.opts.glow) { ctx.shadowColor = this.opts.color; ctx.shadowBlur = 2.5; }
    ctx.fillStyle = this.opts.color;

    for (const cell of this.cells) {
      const a = Math.min(1, cell.base * 1.15) * this.pulse;
      if (a <= 0.02) continue;
      ctx.globalAlpha = a;
      ctx.fillText(cell.char, cell.x, cell.y);
    }
    ctx.globalAlpha = 1;
  }
}

/* =========================================================================
   CircuitField - Animated ASCII Wires
   ========================================================================= */
class CircuitField {
  constructor(canvas, container, nodeEls, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.container = container;
    this.nodeEls = nodeEls;
    this.opts = Object.assign({
      color: '#ff2b2b',
      rainDensity: 0.10,
      charFontSize: 10,
      charSpacing: 10,
      pulseSpeed: 0.00007,
      searchLineCount: 5,
    }, opts);

    this._onResize = this._debounce(this.resize.bind(this), 150);
    window.addEventListener('resize', this._onResize);

    this.resize();
    requestAnimationFrame(this._loop.bind(this));
  }

  _debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  resize() {
    const rect = this.container.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this._computeNodes();
    this._buildWires();
    this._buildSearchLines();
    this._buildRain();
  }

  _computeNodes() {
    const cRect = this.container.getBoundingClientRect();
    this.center = null;
    this.satellites = [];
    for (const n of this.nodeEls) {
      const r = n.el.getBoundingClientRect();
      const cx = r.left + r.width / 2 - cRect.left;
      const cy = r.top + r.height / 2 - cRect.top;
      if (n.isCenter) this.center = { x: cx, y: cy };
      else this.satellites.push({ x: cx, y: cy });
    }
  }

  _route(cx, cy, tx, ty, i) {
    const horizFirst = Math.abs(tx - cx) > Math.abs(ty - cy);
    const bendFrac = 0.4 + (i % 3) * 0.12;
    if (horizFirst) {
      const mx = cx + (tx - cx) * bendFrac;
      return [[cx, cy], [mx, cy], [mx, ty], [tx, ty]];
    }
    const my = cy + (ty - cy) * bendFrac;
    return [[cx, cy], [cx, my], [tx, my], [tx, ty]];
  }

  _sample(pts, spacing) {
    const segLens = [];
    let total = 0;
    for (let k = 0; k < pts.length - 1; k++) {
      const l = Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]);
      segLens.push(l);
      total += l;
    }
    const samples = [];
    let segIdx = 0, segStart = 0;
    for (let dist = 0; dist <= total; dist += spacing) {
      while (segIdx < segLens.length - 1 && dist - segStart > segLens[segIdx]) {
        segStart += segLens[segIdx];
        segIdx++;
      }
      const segLen = segLens[segIdx] || 1;
      const tt = Math.min(1, (dist - segStart) / segLen);
      const p0 = pts[segIdx], p1 = pts[segIdx + 1];
      const x = p0[0] + (p1[0] - p0[0]) * tt;
      const y = p0[1] + (p1[1] - p0[1]) * tt;
      const horiz = Math.abs(p1[0] - p0[0]) >= Math.abs(p1[1] - p0[1]);
      samples.push({ x, y, dist, horiz, char: this._wireChar(horiz) });
    }
    return { samples, total: Math.max(1, total) };
  }

  _wireChar(horiz) {
    const r = Math.random();
    if (r < 0.5) return horiz ? '-' : '|';
    if (r < 0.68) return horiz ? '=' : ':';
    if (r < 0.8) return '+';
    return Math.random() < 0.5 ? '0' : '1';
  }

  _randRainChar() {
    const r = Math.random();
    if (r < 0.78) return Math.random() < 0.5 ? '0' : '1';
    const extra = '#%*+=-:;./\\';
    return extra[(Math.random() * extra.length) | 0];
  }

  _buildWires() {
    if (!this.center) { this.wires = []; return; }
    const n = Math.max(1, this.satellites.length);
    this.wires = this.satellites.map((s, i) => {
      const pts = this._route(this.center.x, this.center.y, s.x, s.y, i);
      const { samples, total } = this._sample(pts, this.opts.charSpacing);
      return { samples, total, phase: i / n, speed: this.opts.pulseSpeed * (0.8 + Math.random() * 0.5) };
    });
  }

  _spawnSearchLine(t) {
    const segs = 2 + ((Math.random() * 2) | 0);
    let cx = this.center.x, cy = this.center.y;
    const pts = [[cx, cy]];
    let ang = Math.random() * Math.PI * 2;
    for (let s = 0; s < segs; s++) {
      const len = 36 + Math.random() * 84;
      ang += (Math.random() - 0.5) * 1.4;
      if (Math.abs(Math.cos(ang)) > Math.abs(Math.sin(ang))) cx += Math.sign(Math.cos(ang)) * len;
      else cy += Math.sign(Math.sin(ang)) * len;
      cx = Math.max(6, Math.min(this.width - 6, cx));
      cy = Math.max(6, Math.min(this.height - 6, cy));
      pts.push([cx, cy]);
    }
    const { samples, total } = this._sample(pts, this.opts.charSpacing);
    return {
      samples, total,
      bornAt: t || performance.now(),
      lifespan: 4000 + Math.random() * 5000,
      speed: this.opts.pulseSpeed * 4 * (0.7 + Math.random() * 0.8),
      phase: Math.random() * 2,
    };
  }

  _buildSearchLines() {
    if (!this.center) { this.searchLines = []; return; }
    this.searchLines = Array.from({ length: this.opts.searchLineCount }, () => this._spawnSearchLine(performance.now()));
  }

  _maybeRespawnSearchLines(t) {
    for (let i = 0; i < this.searchLines.length; i++) {
      if (t - this.searchLines[i].bornAt > this.searchLines[i].lifespan) {
        this.searchLines[i] = this._spawnSearchLine(t);
      }
    }
  }

  _buildRain() {
    this.ctx.font = `${this.opts.charFontSize}px monospace`;
    const cw = this.ctx.measureText('M').width, ch = this.opts.charFontSize * 1.15;
    const cols = Math.ceil(this.width / cw), rows = Math.ceil(this.height / ch);
    this.rainCells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() < this.opts.rainDensity) {
          this.rainCells.push({ x: c * cw, y: r * ch, ch: this._randRainChar(), a: 0.02 + Math.random() * 0.10 });
        }
      }
    }
  }

  _triWave(x) { const p = ((x % 2) + 2) % 2; return p < 1 ? p : 2 - p; }

  _loop(t) {
    requestAnimationFrame(this._loop.bind(this));
    if (!this._acc) this._acc = 0;
    const dt = t - (this._lastT || t);
    this._lastT = t;
    this._acc += dt;
    if (this._acc < 40) return;
    this._acc = 0;
    this._draw(t);
  }

  _drawTrace(w, t, isSearch) {
    const ctx = this.ctx;
    if (Math.random() < 0.02) {
      const s = w.samples[(Math.random() * w.samples.length) | 0];
      if (s) s.char = this._wireChar(s.horiz);
    }
    const progressList = isSearch
      ? [this._triWave(t * w.speed + w.phase)]
      : [(t * w.speed + w.phase) % 1, (t * w.speed + w.phase + 0.5) % 1];
    const windowFrac = isSearch ? 0.18 : 0.08;
    const baseA = isSearch ? 0.08 : 0.16;

    for (const s of w.samples) {
      let intensity = 0;
      for (const p of progressList) {
        let d = Math.abs(s.dist / w.total - p);
        d = Math.min(d, 1 - d);
        intensity = Math.max(intensity, Math.max(0, 1 - d / windowFrac));
      }
      const alpha = baseA + (1 - baseA) * intensity;
      const r = Math.round(30 + (255 - 30) * intensity);
      const g = Math.round(5 + (60 - 5) * intensity);
      const b = Math.round(5 + (60 - 5) * intensity);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.shadowBlur = intensity > 0.5 ? 4 * intensity : 0;
      ctx.shadowColor = '#ff4040';
      ctx.fillText(s.char, s.x, s.y);
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  _draw(t) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.font = `${this.opts.charFontSize}px monospace`;
    ctx.textBaseline = 'middle';

    ctx.textAlign = 'left';
    for (const cell of this.rainCells) {
      if (Math.random() < 0.003) cell.ch = this._randRainChar();
      ctx.globalAlpha = cell.a;
      ctx.fillStyle = this.opts.color;
      ctx.fillText(cell.ch, cell.x, cell.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';

    if (!this.center) return;

    for (const w of this.wires) this._drawTrace(w, t, false);

    this._maybeRespawnSearchLines(t);
    for (const sl of this.searchLines) this._drawTrace(sl, t, true);

    const breathe = 0.5 + 0.5 * Math.sin(t * 0.0016);
    const ringBase = Math.max(60, Math.min(this.width, this.height) * 0.065);
    ctx.strokeStyle = `rgba(255,50,50,${0.18 * breathe})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(this.center.x, this.center.y, ringBase + 4 * breathe, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/* =========================================================================
   INITIALIZATION
   ========================================================================= */
const nodeDivs = document.querySelectorAll('#network .node');
const centerEl = document.querySelector('#network .node.center');
const satelliteEls = document.querySelectorAll('#network .node.small');

satelliteEls.forEach(el => {
  new AsciiEye(el, { color: '#ff2b2b', proximity: 200, fontSize: 8 });
});

new AsciiSkull(centerEl, { color: '#ff2b2b' });

const nodeRefs = Array.from(nodeDivs).map(el => ({ el, isCenter: el.classList.contains('center') }));
new CircuitField(document.getElementById('bg-canvas'), document.getElementById('network'), nodeRefs, {
  color: '#ff2b2b',
});

/* =========================================================================
   PORTAL & WORKSPACE LOGIC (Mock Authentication & UI Interactions)
   ========================================================================= */
let activeModule = 'mspect';
let operatorHandle = '';

const moduleDetails = {
  mspect: {
    title: "µspect // TARGET FOOTPRINTING",
    label: "TARGET DOMAIN OR ADDRESS",
    placeholder: "e.g., target-node.local"
  },
  wiretap: {
    title: "WireTap // SIGNAL LEAKAGE SNIFFER",
    label: "CLOUD ENDPOINT OR TARGET HOST",
    placeholder: "e.g., s3://leaky-bucket-assets"
  },
  grimnir: {
    title: "Grimnir // ALIAS TRACKER",
    label: "OPERATOR HANDLE / USERNAME",
    placeholder: "e.g., net_phantom"
  },
  v0id: {
    title: "v0id // BREACH ARCHIVE INDEXER",
    label: "EMAIL ADDRESS TO INDEX",
    placeholder: "e.g., target@domain.com"
  }
};

window.submitOperator = function() {
  const input = document.getElementById('operator-id');
  if (!input.value.trim()) return;
  operatorHandle = input.value.trim().toUpperCase();
  
  // Step to OTP verification
  document.getElementById('login-form-step').classList.add('hidden');
  document.getElementById('otp-form-step').classList.remove('hidden');
  document.getElementById('otp-token').focus();
}

window.submitOtp = function() {
  const otpVal = document.getElementById('otp-token').value.trim();
  if (otpVal === '000000' || otpVal === '000-000') {
    // Authenticated successfully
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('console-view').style.display = 'grid';
    document.getElementById('active-op-handle').innerText = operatorHandle;
    
    writeLogFeed([
      `OPERATOR [${operatorHandle}] CREATED SECURE SESSION AT NODE: ${window.location.hostname}`,
      `OTP VERIFICATION SUCCESSFUL // LEVEL 4 AUTHORIZED`,
      `SYSTEM: Loading active plugins... [DONE]`
    ]);
  } else {
    alert("ACCESS DENIED: INVALID OTP TOKEN");
  }
}

window.switchModule = function(modId, tabEl) {
  activeModule = modId;
  document.querySelectorAll('.module-tab').forEach(tab => tab.classList.remove('active'));
  tabEl.classList.add('active');

  const config = moduleDetails[modId];
  document.getElementById('module-title').innerText = config.title;
  document.getElementById('module-input-label').innerText = config.label;
  document.getElementById('recon-query').placeholder = config.placeholder;
  document.getElementById('recon-query').value = '';
  document.getElementById('module-status').innerText = "READY";
}

window.handleQueryKey = function(e) {
  if (e.key === 'Enter') runReconQuery();
}

window.runReconQuery = function() {
  const qInput = document.getElementById('recon-query');
  const query = qInput.value.trim();
  if (!query) return;

  document.getElementById('module-status').innerText = "SCANNING";
  writeLogFeed([`\n[!] EXEC: Initializing target scan on [${query}] using module [${activeModule.toUpperCase()}]...`]);
  
  let lines = [];
  if (activeModule === 'mspect') {
    lines = [
      `  -> Resolving infrastructure record maps...`,
      `  -> Target IP resolve: 198.51.100.12`,
      `  -> Active Ports found: 80 (HTTP), 443 (HTTPS), 22 (SSH)`,
      `  -> Topography structure: PASSIVE SCAN COMPLETE. Saved trace log.`
    ];
  } else if (activeModule === 'wiretap') {
    lines = [
      `  -> Crawling public configurations...`,
      `  -> Scanning standard cloud bucket namespace patterns...`,
      `  -> SUCCESS: Found inactive public index on storage bucket: https://${query}.s3.amazonaws.com`,
      `  -> Metadata log: index.html (2.1KB), backup-config.json (124KB) -- WARNING: CONFIG UNSECURED`
    ];
  } else if (activeModule === 'grimnir') {
    lines = [
      `  -> Parsing developer boards and public directories...`,
      `  -> Found active handle [${query}] on Github (ID: 991823), Reddit, Keybase.`,
      `  -> Mapping digital signature keys... MATCHED.`
    ];
  } else if (activeModule === 'v0id') {
    lines = [
      `  -> Cross-referencing safe range query hashes...`,
      `  -> MATCH: Query matches known index breach record in database (2024 Node-Leak).`,
      `  -> Vulnerable points: Password hash leaked (SHA-1), recovery answer compromised.`,
      `  -> STATUS: Critical warning logged.`
    ];
  }

  let delay = 300;
  lines.forEach((line, idx) => {
    setTimeout(() => {
      writeLogFeed([line]);
      if (idx === lines.length - 1) {
        document.getElementById('module-status').innerText = "COMPLETE";
      }
    }, (idx + 1) * delay);
  });
}

function writeLogFeed(lines) {
  const feed = document.getElementById('log-feed');
  lines.forEach(line => {
    const div = document.createElement('div');
    div.className = 'feed-line';
    if (line.startsWith('  ->') || line.startsWith('  [')) {
      div.className = 'feed-line accent';
    } else if (line.startsWith('SYSTEM:') || line.startsWith('Ready')) {
      div.className = 'feed-line system';
    }
    div.innerText = line;
    feed.appendChild(div);
  });
  feed.scrollTop = feed.scrollHeight;
}

// Support submitting operator form via Enter key
document.getElementById('operator-id').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitOperator();
});
document.getElementById('otp-token').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitOtp();
});
