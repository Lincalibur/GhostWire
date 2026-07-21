/**
 * AsciiLoader — an in-theme scanning animation: a spinning glyph, a
 * ping-ponging block "signal sweep" bar, and a flickering hex trace.
 * Rendered as text into a target element.
 */
export class AsciiLoader {
  /**
   * @param {HTMLElement} el target element to render frames into
   */
  constructor(el) {
    this.el = el;
    this.timer = null;
    this.frame = 0;
    this.width = 22;
    this.spin = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    this.running = false;
  }

  /**
   * Begin the animation.
   * @param {string} [label]
   * @returns {void}
   */
  start(label = 'SCANNING TARGET') {
    this.label = label;
    this.frame = 0;
    this.running = true;
    this.el.classList.add('active');
    this._tick();
    this.timer = setInterval(() => this._tick(), 80);
  }

  _tick() {
    this.frame += 1;
    const w = this.width;
    const period = 2 * (w - 1);
    const p = this.frame % period;
    const pos = p < w ? p : period - p;

    let bar = '';
    for (let i = 0; i < w; i++) {
      const d = Math.abs(i - pos);
      bar += d === 0 ? '█' : d === 1 ? '▓' : d === 2 ? '▒' : '░';
    }

    const spinner = this.spin[this.frame % this.spin.length];
    const hex = Math.floor(Math.random() * 0xffff)
      .toString(16)
      .toUpperCase()
      .padStart(4, '0');

    this.el.textContent = `${spinner} ${this.label} [${bar}] 0x${hex}::ACQUIRING`;
  }

  /**
   * Stop the animation and optionally set a final line.
   * @param {string} [finalText] if omitted, the element is cleared/hidden
   * @returns {void}
   */
  stop(finalText) {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (finalText !== undefined) {
      this.el.textContent = finalText;
    } else {
      this.el.textContent = '';
      this.el.classList.remove('active');
    }
  }
}
