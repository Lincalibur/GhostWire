/**
 * WireframeGlobe — a hand-rolled, dependency-free 3D wireframe sphere
 * rendered on canvas: latitude/longitude wireframe, slow rotation, simple
 * perspective projection, and periodic "scan ping" ripples that land on
 * the surface as it turns.
 */

const LATS_DEG = [-60, -30, 0, 30, 60];
const LONS_DEG = [0, 45, 90, 135, 180, 225, 270, 315];
const SEGMENTS = 48;
const PING_DURATION_MS = 1400;

/** @param {number} deg */
function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * @param {number} latDeg
 * @param {number} r
 * @returns {{x:number,y:number,z:number}[]}
 */
function buildLatitudeLine(latDeg, r) {
  const lat = toRad(latDeg);
  const y = r * Math.sin(lat);
  const ringR = r * Math.cos(lat);
  const pts = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    const lon = (i / SEGMENTS) * Math.PI * 2;
    pts.push({ x: ringR * Math.cos(lon), y, z: ringR * Math.sin(lon) });
  }
  return pts;
}

/**
 * @param {number} lonDeg
 * @param {number} r
 * @returns {{x:number,y:number,z:number}[]}
 */
function buildMeridianLine(lonDeg, r) {
  const lon = toRad(lonDeg);
  const pts = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    const lat = -Math.PI / 2 + (i / SEGMENTS) * Math.PI;
    pts.push({
      x: r * Math.cos(lat) * Math.cos(lon),
      y: r * Math.sin(lat),
      z: r * Math.cos(lat) * Math.sin(lon),
    });
  }
  return pts;
}

/**
 * @param {number} latDeg
 * @param {number} lonDeg
 * @param {number} r
 * @returns {{x:number,y:number,z:number}}
 */
function spherePoint(latDeg, lonDeg, r) {
  const lat = toRad(latDeg);
  const lon = toRad(lonDeg);
  return {
    x: r * Math.cos(lat) * Math.cos(lon),
    y: r * Math.sin(lat),
    z: r * Math.cos(lat) * Math.sin(lon),
  };
}

export class WireframeGlobe {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.reduced =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = canvas.clientWidth || 200;
    this.size = size;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.radius = size * 0.36;
    this.perspective = this.radius * 4.2;
    this.lines = [
      ...LATS_DEG.map((l) => buildLatitudeLine(l, this.radius)),
      ...LONS_DEG.map((l) => buildMeridianLine(l, this.radius)),
    ];
    this.pings = [];
    this.spin = 0;
    this.tilt = toRad(18);
    this._running = true;
    this._last = performance.now();
    this._nextPingAt = this._last + 500;

    if (this.reduced) {
      this._draw(this._last);
    } else {
      this._raf = requestAnimationFrame((t) => this._loop(t));
    }
  }

  _spawnPing() {
    const latDeg = -70 + Math.random() * 140;
    const lonDeg = Math.random() * 360;
    this.pings.push({ point: spherePoint(latDeg, lonDeg, this.radius), start: performance.now() });
  }

  /**
   * Rotate a local sphere point by the current spin/tilt and project it to
   * screen space with a simple perspective divide.
   * @param {{x:number,y:number,z:number}} p
   * @returns {{sx:number,sy:number,z:number}}
   */
  _project(p) {
    const cosSpin = Math.cos(this.spin);
    const sinSpin = Math.sin(this.spin);
    const x1 = p.x * cosSpin + p.z * sinSpin;
    const z1 = -p.x * sinSpin + p.z * cosSpin;
    const y1 = p.y;

    const cosTilt = Math.cos(this.tilt);
    const sinTilt = Math.sin(this.tilt);
    const y2 = y1 * cosTilt - z1 * sinTilt;
    const z2 = y1 * sinTilt + z1 * cosTilt;

    const scale = this.perspective / (this.perspective + z2);
    const half = this.size / 2;
    return { sx: half + x1 * scale, sy: half + y2 * scale, z: z2 };
  }

  /** @param {number} now */
  _loop(now) {
    if (!this._running) return;
    const dt = (now - this._last) / 1000;
    this._last = now;
    this.spin += dt * 0.15;

    if (now >= this._nextPingAt) {
      this._spawnPing();
      this._nextPingAt = now + 900 + Math.random() * 1300;
    }

    this._draw(now);
    this._raf = requestAnimationFrame((t) => this._loop(t));
  }

  /** @param {number} now */
  _draw(now) {
    this.pings = this.pings.filter((p) => now - p.start <= PING_DURATION_MS);

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.size, this.size);

    for (const line of this.lines) {
      const pts = line.map((p) => this._project(p));
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const zMid = (a.z + b.z) / 2;
        const t = Math.max(0, Math.min(1, (zMid + this.radius) / (2 * this.radius)));
        const alpha = 0.1 + 0.65 * t;
        ctx.strokeStyle = `rgba(0, 240, 255, ${alpha.toFixed(3)})`;
        ctx.lineWidth = 0.6 + 0.8 * t;
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();
      }
    }

    for (const ping of this.pings) {
      const age = now - ping.start;
      const life = age / PING_DURATION_MS;
      const p = this._project(ping.point);
      const dotAlpha = Math.max(0, 1 - life * 1.3);
      const ringRadius = 3 + life * 16;
      const ringAlpha = Math.max(0, 0.8 * (1 - life));

      ctx.fillStyle = `rgba(252, 238, 10, ${dotAlpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, 2.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(252, 238, 10, ${ringAlpha.toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  stop() {
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
  }
}

/**
 * Find the intake page's globe canvas and start it, if present.
 * @returns {WireframeGlobe|null}
 */
export function initGlobe() {
  const canvas = document.getElementById('globe-canvas');
  if (!canvas) return null;
  return new WireframeGlobe(canvas);
}
