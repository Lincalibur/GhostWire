/**
 * AsciiEye — a restless, character-based surveillance node whose pupil tracks
 * the cursor. The eye outline is a true "vesica" lens formed by the
 * intersection of two circles, giving a crisp almond shape (ported from the
 * detailed-red reference), rendered in a bold monospace for legibility.
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
        color: '#ff3535',
        pupilColor: '#ff6a6a',
        bgAlpha: 0.14,
        fontSize: 9,
        proximity: 260,
        fps: 20,
        rerollRate: 0.015,
        chars: '01#%*+=-:;.ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        glow: true,
        idle: !reducedMotion,
        // Fraction of the box the eye lens fills (smaller => more padding).
        fill: 0.9,
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
    this._raf = requestAnimationFrame(this._loop.bind(this));
  }

  /** Stop the animation and detach listeners (used for the transient intro eyes). */
  destroy() {
    this._destroyed = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    window.removeEventListener('mousemove', this._onMove);
    window.removeEventListener('resize', this._onResize);
    this._io?.disconnect();
    this.canvas.remove();
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

    this.ctx.font = `bold ${this.opts.fontSize}px monospace`;
    this.charW = this.ctx.measureText('M').width;
    this.charH = this.opts.fontSize * 1.15;
    this.cols = Math.ceil(this.width / this.charW);
    this.rows = Math.ceil(this.height / this.charH);

    this.cx = this.width / 2;
    this.cy = this.height / 2;

    // Vesica geometry: two circles of radius R whose overlap forms the lens.
    const halfW = Math.min(this.width * 0.48 * this.opts.fill, this.height * 1.35);
    const halfH = halfW * 0.42;
    this.a = halfW;
    this.b = halfH;
    this.R = (halfW * halfW + halfH * halfH) / (2 * halfH);
    this.d = this.R - halfH;

    this.irisR = halfH * 0.78;
    this.pupilR = halfH * 0.42;
    this.maxOffsetX = Math.max(0, (halfW - this.irisR) * 0.62);
    this.maxOffsetY = Math.max(0, (halfH - this.irisR) * 0.62);

    this._buildCells();
  }

  _buildCells() {
    this.cells = [];
    const fadeBand = this.charH * 2.6;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = c * this.charW - this.cx + this.charW / 2;
        const y = r * this.charH - this.cy + this.charH / 2;
        const distA = Math.hypot(x, y + this.d);
        const distB = Math.hypot(x, y - this.d);
        const inside = distA <= this.R && distB <= this.R;
        const edge = Math.min(this.R - distA, this.R - distB);
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
    if (this._destroyed) return;
    this._raf = requestAnimationFrame(this._loop.bind(this));
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
    ctx.font = `bold ${this.opts.fontSize}px monospace`;
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

      if (rr < this.pupilR) continue;

      let alpha;
      let color = this.opts.color;
      if (cell.inside) {
        const edgeFade = Math.min(1, cell.edge / (this.charH * 1.8));
        alpha = 0.28 + edgeFade * 0.55;
        // Brighter ring just outside the pupil (the iris).
        if (rr < this.irisR) color = this.opts.pupilColor;
      } else {
        const t = Math.max(0, 1 + cell.edge / (this.charH * 2.6));
        alpha = this.opts.bgAlpha * t;
      }

      if (alpha <= 0.015) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillText(cell.char, this.cx + cell.x, this.cy + cell.y);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }
}
