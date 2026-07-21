/**
 * AmbientHum — a subtle 40Hz "surveillance van" low-frequency drone,
 * toggled on user interaction (browsers require a gesture to start audio).
 */
export class AmbientHum {
  constructor() {
    this.ctx = null;
    this.active = false;
  }

  /** Lazily construct the Web Audio graph on first activation. */
  _init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(40, this.ctx.currentTime);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(80, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.04, this.ctx.currentTime);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
  }

  /**
   * Toggle the hum on/off.
   * @returns {boolean} the new active state
   */
  toggle() {
    if (!this.ctx) this._init();
    if (this.active) {
      this.ctx.suspend();
      this.active = false;
    } else {
      this.ctx.resume();
      this.active = true;
    }
    return this.active;
  }
}
