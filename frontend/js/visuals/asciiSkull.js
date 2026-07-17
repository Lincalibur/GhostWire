/**
 * AsciiSkull — the central daemon node. A binary-text skull that "breathes"
 * via a slow brightness oscillation, built from a rasterised mask.
 */
export class AsciiSkull {
  /**
   * @param {HTMLElement} container
   * @param {object} [opts]
   */
  constructor(container, opts = {}) {
    this.container = container;
    this.opts = Object.assign(
      {
        color: '#ff3b3b',
        fontSize: 10,
        fps: 20,
        rerollRate: 0.012,
        chars: '01',
        pulseSpeed: 0.0016,
        glow: true,
      },
      opts,
    );

    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'display:block;width:100%;height:100%';
    this.ctx = this.canvas.getContext('2d');
    container.appendChild(this.canvas);

    this._lastTick = 0;
    this._visible = true;
    this._onResize = this._debounce(this._resize.bind(this), 150);
    window.addEventListener('resize', this._onResize);

    if ('IntersectionObserver' in window) {
      this._io = new IntersectionObserver(
        (entries) => {
          this._visible = entries[0].isIntersecting;
        },
        { threshold: 0 },
      );
      this._io.observe(container);
    }

    this._buildMask();
    this._resize();
    requestAnimationFrame(this._loop.bind(this));
  }

  _debounce(fn, ms) {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  }

  _buildMask() {
    const W = 240;
    const H = 210;
    const raw = document.createElement('canvas');
    raw.width = W;
    raw.height = H;
    const rctx = raw.getContext('2d');

    const leftPts = [
      [0.5, 0.03],
      [0.27, 0.045],
      [0.1, 0.19],
      [0.055, 0.36],
      [0.08, 0.52],
      [0.14, 0.68],
      [0.27, 0.83],
      [0.42, 0.92],
    ].map((p) => [p[0] * W, p[1] * H]);

    const path = new Path2D();
    path.moveTo(leftPts[0][0], leftPts[0][1]);
    for (let i = 1; i < leftPts.length - 1; i++) {
      const xc = (leftPts[i][0] + leftPts[i + 1][0]) / 2;
      const yc = (leftPts[i][1] + leftPts[i + 1][1]) / 2;
      path.quadraticCurveTo(leftPts[i][0], leftPts[i][1], xc, yc);
    }
    path.lineTo(leftPts[leftPts.length - 1][0], leftPts[leftPts.length - 1][1]);
    path.lineTo(W * 0.5, H * 0.95);

    const rightPts = leftPts
      .slice()
      .reverse()
      .map((p) => [W - p[0], p[1]]);
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
    ellipse(W * 0.32, H * 0.38, W * 0.1, H * 0.13);
    ellipse(W * 0.68, H * 0.38, W * 0.1, H * 0.13);

    rctx.beginPath();
    rctx.moveTo(W * 0.5, H * 0.48);
    rctx.lineTo(W * 0.46, H * 0.58);
    rctx.lineTo(W * 0.54, H * 0.58);
    rctx.closePath();
    rctx.fill();

    for (let i = 0; i < 7; i++) {
      const x = W * (0.3 + i * 0.058);
      rctx.fillRect(x, H * 0.72, W * 0.02, H * 0.05);
    }
    rctx.globalCompositeOperation = 'source-over';

    const blurred = document.createElement('canvas');
    blurred.width = W;
    blurred.height = H;
    const bctx = blurred.getContext('2d');
    bctx.filter = 'blur(2px)';
    bctx.drawImage(raw, 0, 0);

    this.maskW = W;
    this.maskH = H;
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
    let boxW = this.width * 0.92;
    let boxH = boxW / maskAR;
    if (boxH > this.height * 0.94) {
      boxH = this.height * 0.94;
      boxW = boxH * maskAR;
    }
    this.boxX = (this.width - boxW) / 2;
    this.boxY = (this.height - boxH) / 2;
    this.boxW = boxW;
    this.boxH = boxH;

    this._buildCells();
  }

  _buildCells() {
    this.cells = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = c * this.charW + this.charW / 2;
        const y = r * this.charH + this.charH / 2;
        if (x < this.boxX || x > this.boxX + this.boxW || y < this.boxY || y > this.boxY + this.boxH)
          continue;
        const u = (x - this.boxX) / this.boxW;
        const v = (y - this.boxY) / this.boxH;
        const a = this._sampleMask(u, v);
        if (a < 0.03) continue;
        this.cells.push({ x, y, base: a, char: this._randChar() });
      }
    }
  }

  _randChar() {
    const s = this.opts.chars;
    return s[(Math.random() * s.length) | 0];
  }

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
    for (let i = 0; i < n; i++)
      this.cells[(Math.random() * this.cells.length) | 0].char = this._randChar();
    this.pulse = this.opts.pulseSpeed ? 0.78 + 0.22 * Math.sin(t * this.opts.pulseSpeed) : 1;
  }

  _draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.font = `${this.opts.fontSize}px monospace`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    if (this.opts.glow) {
      ctx.shadowColor = this.opts.color;
      ctx.shadowBlur = 2.5;
    }
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
