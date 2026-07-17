/**
 * AsciiEye — a restless, character-based surveillance node whose pupil tracks
 * the cursor. Renders into its own <canvas> inside the supplied container.
 */
export class AsciiEye {
  /**
   * @param {HTMLElement} container
   * @param {object} [opts]
   */
  constructor(container, opts = {}) {
    this.container = container;
    const reducedMotion =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.opts = Object.assign(
      {
        color: '#ff2b2b',
        bgAlpha: 0.12,
        fontSize: 9,
        proximity: 220,
        fps: 20,
        rerollRate: 0.015,
        chars: '01#%*+=-:;.ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        glow: true,
        idle: !reducedMotion,
      },
      opts,
    );

    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'display:block;width:100%;height:100%';
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
    window.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches[0]) this._onMove(e.touches[0]);
      },
      { passive: true },
    );
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
    this.a = a;
    this.b = b;

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

  _randChar() {
    const s = this.opts.chars;
    return s[(Math.random() * s.length) | 0];
  }

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
      const nx = dx / dist;
      const ny = dy / dist;
      const pull = Math.min(1, dist / this.opts.proximity);
      this.pupilTarget.x = nx * this.maxOffsetX * pull;
      this.pupilTarget.y = ny * this.maxOffsetY * pull;
    } else if (this.opts.idle) {
      this.idleT += 0.016;
      this.pupilTarget.x = Math.sin(this.idleT) * this.maxOffsetX * 0.4;
      this.pupilTarget.y = Math.cos(this.idleT * 0.7) * this.maxOffsetY * 0.5;
    } else {
      this.pupilTarget.x = 0;
      this.pupilTarget.y = 0;
    }

    this.pupil.x += (this.pupilTarget.x - this.pupil.x) * 0.08;
    this.pupil.y += (this.pupilTarget.y - this.pupil.y) * 0.08;

    const nx2 = this.maxOffsetX > 0 ? this.pupil.x / this.maxOffsetX : 0;
    const ny2 = this.maxOffsetY > 0 ? this.pupil.y / this.maxOffsetY : 0;
    const m = Math.hypot(nx2, ny2);
    if (m > 1) {
      this.pupil.x /= m;
      this.pupil.y /= m;
    }

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
    if (this.opts.glow) {
      ctx.shadowColor = this.opts.color;
      ctx.shadowBlur = 3;
    }

    for (const cell of this.cells) {
      const dx = cell.x - this.pupil.x;
      const dy = cell.y - this.pupil.y;
      const rr = Math.hypot(dx, dy);

      let alpha;
      if (rr < this.pupilR) {
        continue;
      } else if (cell.inside) {
        const t = Math.min(1, cell.edge / (this.charH * 2.2));
        alpha = 0.16 + t * 0.5;
      } else {
        const t = Math.max(0, 1 + cell.edge / (this.charH * 3.2));
        alpha = this.opts.bgAlpha * t;
      }

      if (alpha <= 0.015) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.opts.color;
      ctx.fillText(cell.char, this.cx + cell.x, this.cy + cell.y);
    }
    ctx.globalAlpha = 1;
  }
}
