import { useEffect, useRef } from 'react';
import './AsciiEye.css';

interface AsciiEyeOptions {
  color?: string;
  bgAlpha?: number;
  fontSize?: number;
  proximity?: number;
  fps?: number;
  rerollRate?: number;
  chars?: string;
  glow?: boolean;
  idle?: boolean;
}

/**
 * Lightweight canvas ASCII eye (ported from Feedback/ascii-eye.html).
 * Horizontal almond shape, even green gradient (no bright iris ring).
 */
class AsciiEyeEngine {
  container: HTMLElement;
  opts: Required<AsciiEyeOptions>;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  mouse = { x: -99999, y: -99999 };
  pupil = { x: 0, y: 0 };
  pupilTarget = { x: 0, y: 0 };
  idleT = Math.random() * 1000;
  width = 0;
  height = 0;
  charW = 0;
  charH = 0;
  cols = 0;
  rows = 0;
  cx = 0;
  cy = 0;
  a = 0;
  b = 0;
  R = 0;
  d = 0;
  irisR = 0;
  pupilR = 0;
  maxOffsetX = 0;
  maxOffsetY = 0;
  cells: { x: number; y: number; edge: number; inside: boolean; char: string }[] = [];
  private _lastTick = 0;
  private _visible = true;
  private _raf: number | null = null;
  private _io: IntersectionObserver | null = null;
  private _onMove: (e: { clientX: number; clientY: number }) => void;
  private _onResize: () => void;
  private _loop: (t: number) => void;
  private _onTouchMove: (e: TouchEvent) => void;

  constructor(container: HTMLElement, opts: AsciiEyeOptions = {}) {
    this.container = container;

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.opts = {
      color: '#39ff6a',
      bgAlpha: 0.1,
      fontSize: 14,
      proximity: 320,
      fps: reducedMotion ? 10 : 20,
      rerollRate: reducedMotion ? 0.004 : 0.015,
      chars: '01#%*+=-:;.ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      glow: true,
      idle: !reducedMotion,
      ...opts,
    };

    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('2d context unavailable');
    }
    this.ctx = ctx;
    container.appendChild(this.canvas);

    this._onMove = this._handleMove.bind(this);
    this._onResize = this._debounce(this._resize.bind(this), 150);
    this._loop = this._handleLoop.bind(this);
    this._onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        this._handleMove(e.touches[0]);
      }
    };

    window.addEventListener('mousemove', this._onMove, { passive: true });
    window.addEventListener('touchmove', this._onTouchMove, { passive: true });
    window.addEventListener('resize', this._onResize);

    if ('IntersectionObserver' in window) {
      this._io = new IntersectionObserver(
        (entries) => {
          this._visible = entries[0]?.isIntersecting ?? false;
        },
        { threshold: 0 },
      );
      this._io.observe(container);
    }

    this._resize();
    this._raf = requestAnimationFrame(this._loop);
  }

  destroy() {
    if (this._raf !== null) {
      cancelAnimationFrame(this._raf);
    }
    window.removeEventListener('mousemove', this._onMove);
    window.removeEventListener('touchmove', this._onTouchMove);
    window.removeEventListener('resize', this._onResize);
    this._io?.disconnect();
    this.canvas.remove();
  }

  private _debounce(fn: () => void, ms: number) {
    let t = 0;
    return () => {
      window.clearTimeout(t);
      t = window.setTimeout(fn, ms);
    };
  }

  private _resize() {
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

    // Horizontal almond: vesica with circle centers on the vertical axis
    // so the lens is wide (left–right) rather than tall.
    const halfW = Math.min(this.width * 0.48, this.height * 1.35);
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

  private _buildCells() {
    this.cells = [];
    const fadeBand = this.charH * 2.6;
    for (let r = 0; r < this.rows; r += 1) {
      for (let c = 0; c < this.cols; c += 1) {
        const x = c * this.charW - this.cx + this.charW / 2;
        const y = r * this.charH - this.cy + this.charH / 2;
        // Circles stacked vertically → wide horizontal vesica
        const distA = Math.hypot(x, y + this.d);
        const distB = Math.hypot(x, y - this.d);
        const inside = distA <= this.R && distB <= this.R;
        const edge = Math.min(this.R - distA, this.R - distB);
        if (!inside && edge < -fadeBand) {
          continue;
        }
        this.cells.push({ x, y, edge, inside, char: this._randChar() });
      }
    }
  }

  private _randChar() {
    const s = this.opts.chars;
    return s[(Math.random() * s.length) | 0] ?? '0';
  }

  private _handleMove(e: { clientX: number; clientY: number }) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = e.clientX - rect.left;
    this.mouse.y = e.clientY - rect.top;
  }

  private _handleLoop(t: number) {
    this._raf = requestAnimationFrame(this._loop);
    const interval = 1000 / this.opts.fps;
    if (t - this._lastTick < interval) {
      return;
    }
    this._lastTick = t;
    if (!this._visible) {
      return;
    }
    this._update();
    this._draw();
  }

  private _update() {
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
    for (let i = 0; i < n; i += 1) {
      const cell = this.cells[(Math.random() * this.cells.length) | 0];
      if (cell) {
        cell.char = this._randChar();
      }
    }
  }

  private _draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.font = `${this.opts.fontSize}px monospace`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    if (this.opts.glow) {
      ctx.shadowColor = this.opts.color;
      ctx.shadowBlur = 2;
    }

    for (const cell of this.cells) {
      const dx = cell.x - this.pupil.x;
      const dy = cell.y - this.pupil.y;
      const rr = Math.hypot(dx, dy);

      // Empty pupil void only — iris uses the same green gradient as the sclera
      if (rr < this.pupilR) {
        continue;
      }

      let alpha: number;
      if (cell.inside) {
        const edgeFade = Math.min(1, cell.edge / (this.charH * 1.8));
        alpha = 0.18 + edgeFade * 0.42;
      } else {
        const t = Math.max(0, 1 + cell.edge / (this.charH * 2.6));
        alpha = this.opts.bgAlpha * t;
      }

      if (alpha <= 0.015) {
        continue;
      }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.opts.color;
      ctx.fillText(cell.char, this.cx + cell.x, this.cy + cell.y);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }
}

interface AsciiEyeProps {
  className?: string;
}

export function AsciiEye({ className }: AsciiEyeProps) {
  const slotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) {
      return;
    }

    let engine: AsciiEyeEngine | null = null;
    try {
      engine = new AsciiEyeEngine(slot, {
        color: '#39ff6a',
        fontSize: 14,
        proximity: 360,
        fps: 20,
        rerollRate: 0.015,
        glow: true,
      });
    } catch {
      return;
    }

    return () => {
      engine?.destroy();
    };
  }, []);

  const rootClass = ['ascii-eye', className].filter(Boolean).join(' ');

  return (
    <div className={rootClass} aria-hidden="true">
      <div ref={slotRef} className="ascii-eye__slot" />
    </div>
  );
}
