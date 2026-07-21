/**
 * CircuitField — the animated ASCII wiring, matrix rain, and restless
 * "search" tendrils that connect the skull to the surveillance eyes.
 */
export class CircuitField {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {HTMLElement} container
   * @param {Array<{ el: HTMLElement, isCenter: boolean }>} nodeEls
   * @param {object} [opts]
   */
  constructor(canvas, container, nodeEls, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.container = container;
    this.nodeEls = nodeEls;
    this.opts = Object.assign(
      {
        color: '#ff2b2b',
        rainDensity: 0.1,
        charFontSize: 11,
        charSpacing: 10,
        pulseSpeed: 0.00007,
        searchLineCount: 5,
        // CSS selector for UI panels that wires should also route toward.
        blockSelector: null,
      },
      opts,
    );

    this._onResize = this._debounce(this.resize.bind(this), 150);
    window.addEventListener('resize', this._onResize);

    this.resize();
    requestAnimationFrame(this._loop.bind(this));
  }

  _debounce(fn, ms) {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  }

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

  /**
   * Recompute node positions and wires without a full canvas resize.
   * Call when UI panels appear/disappear so block wiring updates.
   * @returns {void}
   */
  refresh() {
    this._computeNodes();
    this._buildWires();
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
    this._computeBlockTargets(cRect);
  }

  /**
   * Compute anchor points on visible UI panels (the closest point on each
   * panel's border to the mesh center), so wires visibly terminate at the
   * blocks. Hidden panels (0-size) are skipped.
   * @param {DOMRect} cRect container bounding rect
   */
  _computeBlockTargets(cRect) {
    this.blockTargets = [];
    if (!this.opts.blockSelector || !this.center) return;
    const els = document.querySelectorAll(this.opts.blockSelector);
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue; // hidden / collapsed
      const left = r.left - cRect.left;
      const top = r.top - cRect.top;
      const right = left + r.width;
      const bottom = top + r.height;
      // Closest point on the panel rectangle to the mesh center.
      const px = Math.max(left, Math.min(this.center.x, right));
      const py = Math.max(top, Math.min(this.center.y, bottom));
      this.blockTargets.push({ x: px, y: py, isBlock: true });
    }
  }

  _route(cx, cy, tx, ty, i) {
    const horizFirst = Math.abs(tx - cx) > Math.abs(ty - cy);
    const bendFrac = 0.4 + (i % 3) * 0.12;
    if (horizFirst) {
      const mx = cx + (tx - cx) * bendFrac;
      return [
        [cx, cy],
        [mx, cy],
        [mx, ty],
        [tx, ty],
      ];
    }
    const my = cy + (ty - cy) * bendFrac;
    return [
      [cx, cy],
      [cx, my],
      [tx, my],
      [tx, ty],
    ];
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
    if (!this.center) {
      this.wires = [];
      return;
    }
    const targets = this.satellites.concat(this.blockTargets || []);
    const n = Math.max(1, targets.length);
    this.wires = targets.map((s, i) => {
      const pts = this._route(this.center.x, this.center.y, s.x, s.y, i);
      const { samples, total } = this._sample(pts, this.opts.charSpacing);
      return {
        samples,
        total,
        phase: i / n,
        speed: this.opts.pulseSpeed * (0.8 + Math.random() * 0.5),
        isBlock: Boolean(s.isBlock),
      };
    });
  }

  _spawnSearchLine(t) {
    const segs = 2 + ((Math.random() * 2) | 0);
    let cx = this.center.x;
    let cy = this.center.y;
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
      samples,
      total,
      bornAt: t || performance.now(),
      lifespan: 4000 + Math.random() * 5000,
      speed: this.opts.pulseSpeed * 4 * (0.7 + Math.random() * 0.8),
      phase: Math.random() * 2,
    };
  }

  _buildSearchLines() {
    if (!this.center) {
      this.searchLines = [];
      return;
    }
    this.searchLines = Array.from({ length: this.opts.searchLineCount }, () =>
      this._spawnSearchLine(performance.now()),
    );
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
    const cw = this.ctx.measureText('M').width;
    const ch = this.opts.charFontSize * 1.15;
    const cols = Math.ceil(this.width / cw);
    const rows = Math.ceil(this.height / ch);
    this.rainCells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() < this.opts.rainDensity) {
          this.rainCells.push({
            x: c * cw,
            y: r * ch,
            ch: this._randRainChar(),
            a: 0.04 + Math.random() * 0.13,
          });
        }
      }
    }
  }

  _triWave(x) {
    const p = ((x % 2) + 2) % 2;
    return p < 1 ? p : 2 - p;
  }

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
    const windowFrac = isSearch ? 0.18 : 0.09;
    // Structural wires to blocks/eyes sit brighter at rest for legibility;
    // roaming search tendrils stay dimmer.
    const baseA = isSearch ? 0.14 : 0.34;

    for (const s of w.samples) {
      let intensity = 0;
      for (const p of progressList) {
        let d = Math.abs(s.dist / w.total - p);
        d = Math.min(d, 1 - d);
        intensity = Math.max(intensity, Math.max(0, 1 - d / windowFrac));
      }
      const alpha = baseA + (1 - baseA) * intensity;
      const r = Math.round(120 + (255 - 120) * intensity);
      const g = Math.round(22 + (70 - 22) * intensity);
      const b = Math.round(22 + (70 - 22) * intensity);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.shadowBlur = intensity > 0.4 ? 5 * intensity : 1.5;
      ctx.shadowColor = '#ff4040';
      ctx.fillText(s.char, s.x, s.y);
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  _draw(t) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.font = `bold ${this.opts.charFontSize}px monospace`;
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
    const ringBase = Math.max(80, Math.min(this.width, this.height) * 0.085);
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#ff3030';
    for (let k = 0; k < 3; k++) {
      const rr = ringBase + k * 16 + 4 * breathe;
      ctx.strokeStyle = `rgba(255,60,60,${(0.4 - k * 0.1) * (0.6 + 0.4 * breathe)})`;
      ctx.lineWidth = k === 0 ? 1.5 : 1;
      ctx.beginPath();
      ctx.arc(this.center.x, this.center.y, rr, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }
}
