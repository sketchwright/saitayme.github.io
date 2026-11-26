// Procedural SFX via the Web Audio API. Nothing is created until unlock() is
// called from a user gesture; everything is torn down in dispose().
import type { SfxName } from './types';

type WindowWithWebkit = Window & { webkitAudioContext?: typeof AudioContext };

const THROTTLE: Partial<Record<SfxName, number>> = {
  shot: 0.04,
  hit: 0.035,
  death: 0.045,
  bigDeath: 0.12,
  damage: 0.12,
  combo: 0.1,
  shieldHit: 0.1,
  enemyShot: 0.06,
  pickup: 0.05,
  zap: 0.05,
  click: 0.04,
  latch: 0.3,
  alarm: 1,
};

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private last: Partial<Record<SfxName, number>> = {};
  private muted: boolean;
  private readonly volume = 0.2;

  constructor(muted: boolean) {
    this.muted = muted;
  }

  unlock(): void {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as WindowWithWebkit).webkitAudioContext;
        if (!AC) return;
        const ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -18;
        comp.ratio.value = 6;
        const master = ctx.createGain();
        master.gain.value = this.muted ? 0 : this.volume;
        master.connect(comp);
        comp.connect(ctx.destination);
        const len = Math.floor(ctx.sampleRate * 1.0);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        this.ctx = ctx;
        this.master = master;
        this.noiseBuf = buf;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.ctx.currentTime, 0.02);
    }
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  dispose(): void {
    const ctx = this.ctx;
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
    if (ctx) void ctx.close().catch(() => undefined);
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, gain: number, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }

  private noise(dur: number, gain: number, type: BiquadFilterType, f0: number, f1: number, q = 0.8, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noiseBuf) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.02);
    src.onended = () => {
      src.disconnect();
      f.disconnect();
      g.disconnect();
    };
  }

  play(name: SfxName): void {
    const ctx = this.ctx;
    if (!ctx || this.muted || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const th = THROTTLE[name];
    if (th !== undefined) {
      const l = this.last[name];
      if (l !== undefined && now - l < th) return;
    }
    this.last[name] = now;
    const j = 0.94 + Math.random() * 0.12;
    switch (name) {
      case 'shot':
        this.tone('square', 1300 * j, 420, 0.045, 0.018);
        this.noise(0.025, 0.014, 'highpass', 4200, 3000);
        break;
      case 'enemyShot':
        this.tone('sawtooth', 520 * j, 170, 0.12, 0.03);
        this.tone('sine', 260 * j, 90, 0.1, 0.03);
        break;
      case 'shieldHit':
        this.tone('triangle', 900, 300, 0.16, 0.05);
        this.noise(0.12, 0.05, 'bandpass', 3000, 900, 3);
        break;
      case 'pickup':
        this.tone('triangle', 660, 660, 0.06, 0.04);
        this.tone('triangle', 990, 990, 0.08, 0.04, 0.06);
        this.tone('sine', 1320, 1320, 0.12, 0.03, 0.12);
        break;
      case 'select':
        this.tone('triangle', 440, 440, 0.08, 0.05);
        this.tone('triangle', 660, 660, 0.08, 0.05, 0.08);
        this.tone('triangle', 880, 1320, 0.25, 0.05, 0.16);
        this.noise(0.3, 0.03, 'highpass', 6000, 2000, 0.8, 0.16);
        break;
      case 'click':
        this.tone('square', 1800, 1200, 0.03, 0.02);
        break;
      case 'sector':
        this.tone('sawtooth', 55, 110, 1.2, 0.07);
        this.tone('triangle', 220, 220, 0.3, 0.05, 0.2);
        this.tone('triangle', 277, 277, 0.3, 0.05, 0.5);
        this.tone('triangle', 330, 330, 0.6, 0.05, 0.8);
        this.noise(1.4, 0.06, 'bandpass', 300, 3000, 2);
        break;
      case 'laser':
        this.tone('sawtooth', 160, 120, 1.2, 0.07);
        this.tone('square', 80, 78, 1.2, 0.04);
        this.noise(1.1, 0.07, 'bandpass', 1800, 600, 4);
        break;
      case 'dash':
        this.noise(0.22, 0.09, 'bandpass', 800, 4000, 2);
        this.tone('sine', 300, 900, 0.15, 0.04);
        break;
      case 'latch':
        this.tone('sawtooth', 140, 60, 0.4, 0.07);
        this.tone('square', 70, 50, 0.4, 0.04);
        break;
      case 'synergy':
        for (let i = 0; i < 4; i++) this.tone('triangle', 440 * Math.pow(1.26, i), 440 * Math.pow(1.26, i), 0.14, 0.045, i * 0.07);
        this.tone('sine', 110, 110, 0.6, 0.06);
        break;
      case 'victory':
        [262, 330, 392, 523, 659].forEach((f, i) => this.tone('triangle', f, f, 0.5, 0.05, i * 0.16));
        this.tone('sine', 65, 65, 1.6, 0.08);
        break;
      case 'stingWarden':
        // heavy mechanical clang + descending square
        this.noise(0.5, 0.12, 'bandpass', 400, 120, 3);
        this.tone('square', 220, 110, 0.5, 0.06);
        this.tone('square', 165, 82, 0.6, 0.05, 0.25);
        this.tone('sine', 55, 40, 0.9, 0.1);
        break;
      case 'stingEcho':
        // detuned echoing triangles
        for (let i = 0; i < 4; i++) {
          this.tone('triangle', 660 - i * 90, 330 - i * 40, 0.35, 0.05 / (i + 1), i * 0.16);
          this.tone('triangle', 668 - i * 90, 334 - i * 40, 0.35, 0.04 / (i + 1), i * 0.16 + 0.02);
        }
        break;
      case 'stingRoot':
        // low drone swelling into a scream
        this.tone('sawtooth', 40, 80, 1.4, 0.09);
        this.tone('sawtooth', 41, 160, 1.4, 0.05, 0.3);
        this.noise(1.3, 0.08, 'bandpass', 200, 5000, 4);
        break;
      case 'alarm':
        this.tone('square', 880, 880, 0.09, 0.025);
        this.tone('square', 660, 660, 0.12, 0.025, 0.14);
        break;
      case 'zap':
        this.noise(0.08, 0.05, 'highpass', 5000, 2500, 1.5);
        this.tone('square', 2400 * j, 800, 0.05, 0.015);
        break;
      case 'hit':
        this.noise(0.045, 0.05, 'bandpass', 2600 * j, 1100, 2.5);
        break;
      case 'death':
        this.noise(0.2, 0.09, 'lowpass', 3200, 180);
        this.tone('sine', 150 * j, 42, 0.18, 0.12);
        this.tone('square', 720 * j, 90, 0.08, 0.02);
        break;
      case 'bigDeath':
        this.noise(0.6, 0.14, 'lowpass', 2600, 90);
        this.tone('sine', 95, 28, 0.55, 0.2);
        this.tone('sawtooth', 400, 40, 0.35, 0.03);
        break;
      case 'damage':
        this.tone('sawtooth', 110, 50, 0.3, 0.09);
        this.tone('square', 57, 48, 0.3, 0.05);
        this.noise(0.22, 0.08, 'lowpass', 1400, 250);
        break;
      case 'wave':
        this.tone('triangle', 220, 220, 0.12, 0.05);
        this.tone('triangle', 330, 330, 0.12, 0.05, 0.13);
        this.tone('triangle', 494, 494, 0.22, 0.05, 0.26);
        this.tone('sine', 55, 50, 0.5, 0.06);
        break;
      case 'boss':
        for (let i = 0; i < 3; i++) {
          this.tone('square', 190, 120, 0.22, 0.045, i * 0.32);
          this.tone('sine', 48, 40, 0.25, 0.08, i * 0.32);
        }
        break;
      case 'clear':
        this.tone('triangle', 520, 790, 0.22, 0.045);
        this.tone('triangle', 780, 1040, 0.25, 0.03, 0.1);
        break;
      case 'emp':
        this.tone('sine', 900, 55, 0.55, 0.14);
        this.noise(0.5, 0.1, 'lowpass', 5000, 100);
        break;
      case 'empReady':
        this.tone('triangle', 880, 880, 0.07, 0.03);
        this.tone('triangle', 1320, 1320, 0.1, 0.03, 0.08);
        break;
      case 'combo':
        this.tone('triangle', 660, 990, 0.09, 0.03);
        break;
      case 'gameover':
        this.tone('sawtooth', 320, 38, 1.5, 0.09);
        this.tone('sine', 70, 25, 1.6, 0.15);
        this.noise(1.3, 0.1, 'lowpass', 1800, 60);
        break;
    }
  }
}
