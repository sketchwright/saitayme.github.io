// Canvas 2D renderer for Cyber Defender. Static layers (sector background
// tiles, scanlines, vignette, side panels) are pre-rendered on resize; glows
// are cached radial sprites drawn additively (no shadowBlur anywhere).
import { drawEnemy } from './enemies';
import type { Game } from './engine';
import {
  C_GRAY,
  C_RED,
  C_WHITE,
  EB_HARD,
  EB_HOMING,
  EB_NEEDLE,
  EB_ORB,
  FIELD_W,
  P_EMBER,
  P_FRAG,
  P_GLITCH,
  P_HEX,
  P_RING,
  P_SPARK,
  PALETTE,
  PK_OVERCLOCK,
  PK_RAPID,
  PK_SHIELD,
  TAU,
  TELL_TIME,
  U_BOSS,
  U_DYING,
  U_LATCH,
} from './types';
import { SYNERGIES, UPGRADE_BY_ID } from './content/upgrades';
import { SECTORS } from './content/sectors';

const ORANGE = '#f07e41';
const CORE = '#ff5a2a';
const WHITE = '#f4efe8';
const DIM = '#6c6c74';
const FONT_H = 'Orbitron, sans-serif';
const FONT_UI = '"JetBrains Mono", ui-monospace, monospace';
const TILE = 256;

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };

const makeCanvas = (w: number, h: number): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
};

const glowSprite = (r: number, g: number, b: number, hot: string): HTMLCanvasElement => {
  const s = 64;
  const c = makeCanvas(s, s);
  const x = c.getContext('2d');
  if (!x) return c;
  const grd = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, hot);
  grd.addColorStop(0.18, `rgba(${r},${g},${b},0.85)`);
  grd.addColorStop(0.45, `rgba(${r},${g},${b},0.25)`);
  grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = grd;
  x.fillRect(0, 0, s, s);
  return c;
};

const hexPath = (c: CanvasRenderingContext2D, x: number, y: number, r: number, rot = Math.PI / 6) => {
  for (let i = 0; i < 6; i++) {
    const a = rot + (i / 6) * TAU;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) c.moveTo(px, py);
    else c.lineTo(px, py);
  }
  c.closePath();
};

/** Small seeded rng for deterministic background art. */
const lcg = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

interface Stream {
  x: number;
  y: number;
  speed: number;
  len: number;
  alpha: number;
  bits: number;
}

// player ship outline (logical units, nose up)
const SHIP = [0, -21, 6, -8, 8, -2, 18, 8, 17, 11, 8, 9, 5, 15, -5, 15, -8, 9, -17, 11, -18, 8, -8, -2, -6, -8];

export class Renderer {
  private readonly ctx: Ctx;
  private readonly canvas: HTMLCanvasElement;
  private W = 800;
  private H = 600;
  private dpr = 1;
  private tiles: (HTMLCanvasElement | null)[] = [null, null, null];
  private side: HTMLCanvasElement = makeCanvas(1, 1);
  private fx: HTMLCanvasElement = makeCanvas(1, 1);
  private hurt: HTMLCanvasElement = makeCanvas(1, 1);
  private readonly glowO = glowSprite(240, 126, 65, 'rgba(255,236,224,1)');
  private readonly glowR = glowSprite(255, 90, 42, 'rgba(255,210,190,1)');
  private readonly glowW = glowSprite(244, 239, 232, 'rgba(255,255,255,1)');
  private streams: Stream[] = [];
  private icons = new Map<string, Path2D>();
  private lastT = 0;
  private scroll = 0;
  private dispHp = 100;
  private scoreVal = -1;
  private scoreStr = '0';
  private bestVal = -1;
  private bestStr = '0';
  private glitchT = 1;
  private pulseT = 0;
  private k = 1;
  private ox = 0;
  private oy = 0;
  private builtFor = '';

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx as Ctx;
    this.canvas = ctx.canvas;
  }

  resize(W: number, H: number, dpr: number): void {
    this.W = W;
    this.H = H;
    this.dpr = dpr;
    this.builtFor = '';
  }

  private ensureLayers(g: Game): void {
    const key = `${this.W}x${this.H}@${this.dpr.toFixed(2)}/${g.scale.toFixed(3)}`;
    if (key === this.builtFor) return;
    this.builtFor = key;
    this.tiles = [null, null, null];
    const { W, H, dpr } = this;
    const w = Math.round(W * dpr);
    const h = Math.round(H * dpr);

    // side panels outside the playfield
    this.side = makeCanvas(w, h);
    const s = this.side.getContext('2d');
    if (s) {
      s.setTransform(dpr, 0, 0, dpr, 0, 0);
      const fx0 = g.fx0;
      const fw = FIELD_W * g.scale;
      if (fx0 > 2) {
        s.fillStyle = '#060607';
        s.fillRect(0, 0, fx0, H);
        s.fillRect(fx0 + fw, 0, W - fx0 - fw, H);
        s.strokeStyle = 'rgba(255,255,255,0.025)';
        s.lineWidth = 1;
        s.beginPath();
        for (let x = fx0 - 24; x > 0; x -= 24) {
          s.moveTo(Math.round(x) + 0.5, 0);
          s.lineTo(Math.round(x) + 0.5, H);
        }
        for (let x = fx0 + fw + 24; x < W; x += 24) {
          s.moveTo(Math.round(x) + 0.5, 0);
          s.lineTo(Math.round(x) + 0.5, H);
        }
        s.stroke();
        s.fillStyle = 'rgba(240,126,65,0.3)';
        s.fillRect(Math.round(fx0) - 1, 0, 1, H);
        s.fillRect(Math.round(fx0 + fw), 0, 1, H);
        s.fillStyle = 'rgba(240,126,65,0.6)';
        for (let y = 40; y < H; y += 120) {
          s.fillRect(Math.round(fx0) - 4, y, 4, 1);
          s.fillRect(Math.round(fx0 + fw) + 1, y, 4, 1);
        }
      }
    }

    this.fx = makeCanvas(w, h);
    const f = this.fx.getContext('2d');
    if (f) {
      f.setTransform(dpr, 0, 0, dpr, 0, 0);
      f.fillStyle = 'rgba(0,0,0,0.18)';
      for (let y = 0; y < H; y += 3) f.fillRect(0, y, W, 1);
      const diag = Math.hypot(W, H) / 2;
      const vg = f.createRadialGradient(W / 2, H / 2, diag * 0.4, W / 2, H / 2, diag);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.75)');
      f.fillStyle = vg;
      f.fillRect(0, 0, W, H);
    }

    this.hurt = makeCanvas(w, h);
    const hu = this.hurt.getContext('2d');
    if (hu) {
      hu.setTransform(dpr, 0, 0, dpr, 0, 0);
      const diag = Math.hypot(W, H) / 2;
      const rg = hu.createRadialGradient(W / 2, H / 2, diag * 0.3, W / 2, H / 2, diag);
      rg.addColorStop(0, 'rgba(255,90,42,0)');
      rg.addColorStop(1, 'rgba(200,40,20,0.6)');
      hu.fillStyle = rg;
      hu.fillRect(0, 0, W, H);
    }

    const n = Math.max(6, Math.round((FIELD_W * g.scale) / 40));
    this.streams = [];
    for (let i = 0; i < n; i++) this.streams.push(this.newStream(g, Math.random() * H));
  }

  /** Seamless (vertically) sector background tile in device px. */
  private tile(g: Game, theme: number): HTMLCanvasElement {
    const cached = this.tiles[theme];
    if (cached) return cached;
    const k = g.scale * this.dpr;
    const c = makeCanvas(FIELD_W * k, TILE * k);
    const x = c.getContext('2d');
    this.tiles[theme] = c;
    if (!x) return c;
    x.setTransform(k, 0, 0, k, 0, 0);
    const FW = FIELD_W;
    const rnd = lcg(0x51 + theme * 977);
    const bg = theme === 2 ? '#050404' : theme === 1 ? '#060607' : '#070606';
    x.fillStyle = bg;
    x.fillRect(0, 0, FW, TILE);
    const cell = 32;
    const minor = theme === 1 ? 'rgba(170,170,180,0.035)' : theme === 2 ? 'rgba(255,90,42,0.03)' : 'rgba(240,126,65,0.035)';
    const major = theme === 1 ? 'rgba(170,170,180,0.07)' : theme === 2 ? 'rgba(255,90,42,0.065)' : 'rgba(240,126,65,0.075)';
    x.lineWidth = 1;
    for (let pass = 0; pass < 2; pass++) {
      x.beginPath();
      for (let i = 0; i <= FW / cell; i++) {
        if ((i % 4 === 0) !== (pass === 1)) continue;
        x.moveTo(i * cell + 0.5, 0);
        x.lineTo(i * cell + 0.5, TILE);
      }
      for (let j = 0; j < TILE / cell; j++) {
        if ((j % 4 === 0) !== (pass === 1)) continue;
        x.moveTo(0, j * cell + 0.5);
        x.lineTo(FW, j * cell + 0.5);
      }
      x.strokeStyle = pass ? major : minor;
      x.stroke();
    }
    const trace = theme === 1 ? 'rgba(170,170,180,0.09)' : theme === 2 ? 'rgba(255,90,42,0.11)' : 'rgba(240,126,65,0.1)';
    const pad = theme === 1 ? 'rgba(200,200,210,0.16)' : theme === 2 ? 'rgba(255,90,42,0.22)' : 'rgba(240,126,65,0.2)';
    // circuit traces; drawn at y and y +- TILE so they wrap seamlessly
    const traces: number[][] = [];
    for (let i = 0; i < 16; i++) {
      const pts: number[] = [];
      let px = Math.floor(rnd() * (FW / cell)) * cell;
      let py = Math.floor(rnd() * (TILE / cell)) * cell;
      pts.push(px, py);
      const steps = 2 + Math.floor(rnd() * 4);
      for (let s = 0; s < steps; s++) {
        if (rnd() < 0.5) px += (rnd() < 0.5 ? -1 : 1) * cell * (1 + Math.floor(rnd() * 3));
        else py += cell * (1 + Math.floor(rnd() * 2));
        if (rnd() < 0.3) {
          px += cell;
          py += cell;
        }
        pts.push(px, py);
      }
      traces.push(pts);
    }
    for (const off of [-TILE, 0, TILE]) {
      x.strokeStyle = trace;
      x.lineWidth = 1.2;
      for (const pts of traces) {
        x.beginPath();
        x.moveTo(pts[0], pts[1] + off);
        for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1] + off);
        x.stroke();
        x.fillStyle = pad;
        x.fillRect(pts[pts.length - 2] - 2, pts[pts.length - 1] + off - 2, 4, 4);
      }
    }
    if (theme === 0) {
      // firewall brick bands
      x.strokeStyle = 'rgba(240,126,65,0.06)';
      x.beginPath();
      for (let yb = 64; yb < TILE; yb += 128) {
        for (let xb = 0; xb < FW; xb += 48) {
          x.rect(xb + ((yb / 128) % 2) * 24 + 0.5, yb + 0.5, 44, 10);
        }
      }
      x.stroke();
    } else if (theme === 1) {
      // memory pages with addresses
      x.font = `8px ${FONT_UI}`;
      for (let i = 0; i < 9; i++) {
        const bx = Math.floor(rnd() * (FW / cell)) * cell;
        const by = Math.floor(rnd() * (TILE / cell)) * cell;
        const bw = cell * (1 + Math.floor(rnd() * 3));
        const bh = cell * (1 + Math.floor(rnd() * 2));
        x.fillStyle = 'rgba(170,170,180,0.035)';
        x.fillRect(bx, by, bw, bh);
        x.fillStyle = 'rgba(200,200,210,0.14)';
        x.fillText(`0x${Math.floor(rnd() * 0xffff).toString(16).toUpperCase().padStart(4, '0')}`, bx + 3, by + 10);
      }
    } else {
      // core: concentric arcs toward the kernel above
      x.strokeStyle = 'rgba(255,90,42,0.05)';
      x.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        x.beginPath();
        x.arc(FW / 2, -TILE * 0.5, 120 + i * 70, 0.25 * Math.PI, 0.75 * Math.PI);
        x.stroke();
      }
    }
    return c;
  }

  private newStream(g: Game, y: number): Stream {
    const cell = 32;
    return {
      x: g.fx0 + (Math.floor(Math.random() * (FIELD_W / cell)) * cell + cell / 2) * g.scale,
      y,
      speed: 30 + Math.random() * 80,
      len: 6 + ((Math.random() * 12) | 0),
      alpha: 0.05 + Math.random() * 0.1,
      bits: (Math.random() * 0x3ffff) | 0,
    };
  }

  private drawStreams(g: Game, dt: number): void {
    const c = this.ctx;
    c.fillStyle = g.theme === 1 ? '#9a9aa2' : g.theme === 2 ? CORE : ORANGE;
    for (let i = 0; i < this.streams.length; i++) {
      const s = this.streams[i];
      s.y += s.speed * dt;
      if (s.y - s.len * 8 > this.H) this.streams[i] = this.newStream(g, -Math.random() * 120);
      for (let j = 0; j < s.len; j++) {
        c.globalAlpha = s.alpha * (1 - j / s.len);
        const on = (s.bits >> j) & 1;
        c.fillRect(s.x, s.y - j * 8, on ? 2 : 1, on ? 5 : 2);
      }
    }
    c.globalAlpha = 1;
  }

  private glow(img: HTMLCanvasElement, x: number, y: number, size: number, alpha: number): void {
    if (alpha <= 0.01 || size <= 0) return;
    const c = this.ctx;
    c.globalAlpha = alpha > 1 ? 1 : alpha;
    c.drawImage(img, x - size / 2, y - size / 2, size, size);
  }

  private world(): void {
    this.ctx.setTransform(this.k, 0, 0, this.k, this.ox, this.oy);
  }

  private icon(id: string): Path2D | null {
    let p = this.icons.get(id);
    if (!p) {
      const def = UPGRADE_BY_ID[id];
      if (!def) return null;
      try {
        p = new Path2D(def.icon);
      } catch {
        return null;
      }
      this.icons.set(id, p);
    }
    return p;
  }

  // ================================================================ frame
  draw(g: Game): void {
    this.ensureLayers(g);
    const c = this.ctx;
    const d = this.dpr;
    let dt = g.time - this.lastT;
    if (dt < 0 || dt > 0.1) dt = 0.016;
    this.lastT = g.time;
    if (g.phase === 'paused') dt = 0;
    const playing = g.phase === 'playing';

    // ---- background
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.fillStyle = '#050506';
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const tile = this.tile(g, g.theme);
    this.scroll = (this.scroll + dt * (playing ? 26 : 10) * g.scale * d) % tile.height;
    const tx = Math.round(g.fx0 * d);
    for (let y = this.scroll - tile.height; y < this.canvas.height; y += tile.height) c.drawImage(tile, tx, Math.floor(y));
    c.setTransform(d, 0, 0, d, 0, 0);
    this.drawStreams(g, dt);
    if (g.theme === 2) this.drawCorePulses(g, dt);

    const sm = g.shake;
    const sx = sm > 0 ? (Math.random() * 2 - 1) * sm : 0;
    const sy = sm > 0 ? (Math.random() * 2 - 1) * sm : 0;
    this.k = d * g.scale;
    this.ox = d * (g.fx0 + sx);
    this.oy = d * sy;

    // ---- world (normal blend)
    this.world();
    c.lineCap = 'butt';
    c.lineJoin = 'miter';
    this.drawPickups(g);
    this.drawLaser(g, false);
    for (const u of g.units) {
      if (u.dead || u.delay > 0) continue;
      const e = u.e;
      if (e.y < -140 || e.y > g.FH + 140) continue;
      c.globalAlpha = 1;
      drawEnemy(c, e, g.time);
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    this.world();
    this.drawUnitMarks(g);
    if (g.phase !== 'menu' && g.phase !== 'summary' && g.dying < 0) this.drawShip(g);

    // dark fragments
    c.fillStyle = PALETTE[C_GRAY];
    for (const p of g.particles) {
      if (!p.active || p.kind !== P_FRAG || p.color !== C_GRAY) continue;
      const a = p.life / p.max;
      c.globalAlpha = Math.min(1, a * 1.6);
      const s = p.size * (0.4 + 0.6 * a);
      c.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    c.globalAlpha = 1;

    // ---- additive
    c.globalCompositeOperation = 'lighter';
    this.drawUnitGlow(g);
    if (g.phase !== 'menu' && g.phase !== 'summary' && g.dying < 0) this.drawShipGlow(g);
    this.drawEBullets(g);
    this.drawBullets(g);
    this.drawParticles(g);
    this.drawArcs(g);
    this.drawPulse(g);
    this.drawLaser(g, true);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;

    // ---- screen space
    if (g.theme === 1 && (playing || g.phase === 'menu')) this.datamosh(g, dt);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.side, 0, 0);
    c.setTransform(d, 0, 0, d, 0, 0);
    this.drawBossScreen(g);
    this.drawTexts(g);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.fx, 0, 0);
    const lowPulse = playing && g.dying < 0 && g.hp < g.stats.maxHp * 0.25 ? 0.24 + 0.16 * Math.sin(g.time * 7) : 0;
    const drainPulse = g.latchedCount > 0 ? 0.25 + 0.15 * Math.sin(g.time * 9) : 0;
    const hurtA = Math.max(g.damageFlash * 0.85, lowPulse, drainPulse);
    if (hurtA > 0.01) {
      c.globalAlpha = hurtA;
      c.drawImage(this.hurt, 0, 0);
      c.globalAlpha = 1;
    }
    c.setTransform(d, 0, 0, d, 0, 0);
    if (g.damageFlash > 0.45 && !g.reducedMotion) {
      c.fillStyle = 'rgba(255,90,42,0.08)';
      for (let i = 0; i < 4; i++) c.fillRect(0, Math.random() * g.H, g.W, 2 + Math.random() * 12);
    }
    if (playing || g.phase === 'paused') this.drawHud(g);
  }

  // ================================================================ fx
  private drawCorePulses(g: Game, dt: number): void {
    const c = this.ctx;
    this.pulseT += dt;
    const cx = g.fx0 + (FIELD_W / 2) * g.scale;
    const beat = (this.pulseT % 2.6) / 2.6;
    c.globalCompositeOperation = 'lighter';
    this.glow(this.glowR, cx, -40 * g.scale, 520 * g.scale * (0.9 + 0.1 * Math.sin(this.pulseT * 2.4)), 0.16);
    c.globalAlpha = (1 - beat) * 0.22;
    c.strokeStyle = CORE;
    c.lineWidth = 2;
    c.beginPath();
    c.arc(cx, -60 * g.scale, (80 + beat * 900) * g.scale, 0.1 * Math.PI, 0.9 * Math.PI);
    c.stroke();
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }

  private datamosh(g: Game, dt: number): void {
    if (g.reducedMotion) return;
    this.glitchT -= dt;
    if (this.glitchT > 0) {
      if (this.glitchT > 0.18) return;
    } else this.glitchT = 0.9 + Math.random() * 2.4;
    const c = this.ctx;
    const ch = this.canvas.height;
    const x0 = Math.round(g.fx0 * this.dpr);
    const fw = Math.round(FIELD_W * g.scale * this.dpr);
    c.setTransform(1, 0, 0, 1, 0, 0);
    const n = 2 + ((Math.random() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const h = Math.round((6 + Math.random() * 40) * this.dpr);
      const y = Math.round(Math.random() * (ch - h));
      const off = Math.round((Math.random() - 0.5) * 40 * this.dpr);
      c.drawImage(this.canvas, x0, y, fw, h, x0 + off, y + Math.round((Math.random() - 0.5) * 6), fw, h);
    }
    // smeared blocks
    c.globalAlpha = 0.12;
    c.fillStyle = Math.random() < 0.5 ? ORANGE : '#8a8a92';
    for (let i = 0; i < 3; i++) {
      const bw = (20 + Math.random() * 90) * this.dpr;
      c.fillRect(x0 + Math.random() * (fw - bw), Math.random() * ch, bw, (2 + Math.random() * 8) * this.dpr);
    }
    c.globalAlpha = 1;
  }

  // ================================================================ world pieces
  private drawUnitMarks(g: Game): void {
    const c = this.ctx;
    for (const u of g.units) {
      if (u.dead || u.delay > 0 || u.state === U_BOSS || u.state === U_DYING) continue;
      const e = u.e;
      if (u.tellT > 0) {
        // shot tell: thin aim line toward the locked direction
        const f = 1 - u.tellT / TELL_TIME;
        c.strokeStyle = `rgba(255,90,42,${(0.25 + f * 0.6).toFixed(2)})`;
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(e.x, e.y);
        c.lineTo(e.x + Math.cos(u.tellA) * (80 + f * 320), e.y + Math.sin(u.tellA) * (80 + f * 320));
        c.stroke();
      }
      if (u.elite) {
        // elite bracket tag
        const r = u.r + 7;
        c.strokeStyle = 'rgba(240,126,65,0.75)';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(e.x - r, e.y - r + 5);
        c.lineTo(e.x - r, e.y - r);
        c.lineTo(e.x - r + 5, e.y - r);
        c.moveTo(e.x + r - 5, e.y - r);
        c.lineTo(e.x + r, e.y - r);
        c.lineTo(e.x + r, e.y - r + 5);
        c.stroke();
      }
      if (u.hp < u.maxHp && u.maxHp >= 6 && u.state !== U_LATCH) {
        const w = 22;
        c.fillStyle = 'rgba(240,126,65,0.15)';
        c.fillRect(e.x - w / 2, e.y + u.r + 6, w, 2);
        c.fillStyle = ORANGE;
        c.fillRect(e.x - w / 2, e.y + u.r + 6, w * Math.max(0, u.hp / u.maxHp), 2);
      }
      if (u.state === U_LATCH) {
        const pulse = 0.5 + 0.5 * Math.sin(g.time * 10);
        c.strokeStyle = `rgba(255,90,42,${(0.4 + pulse * 0.5).toFixed(2)})`;
        c.lineWidth = 1.2;
        c.beginPath();
        c.arc(e.x, e.y, u.r + 6 + pulse * 3, 0, TAU);
        c.stroke();
      }
    }
  }

  private drawUnitGlow(g: Game): void {
    for (const u of g.units) {
      if (u.dead || u.delay > 0) continue;
      if (u.tellT > 0) {
        const f = 1 - u.tellT / TELL_TIME;
        this.glow(this.glowR, u.e.x, u.e.y, u.e.size * (0.6 + f * 0.8), 0.35 + f * 0.6);
      }
      if (u.flash <= 0) continue;
      const e = u.e;
      const s = u.state === U_BOSS ? u.r * 2 : e.size * 0.9;
      this.glow(this.glowW, e.x, e.y, s, (u.flash / 0.08) * (u.state === U_BOSS ? 0.25 : 0.5));
    }
    this.drawBossLayers(g);
  }

  /** Additive boss gameplay layers: tells, shields, walls, shockwaves, tethers. */
  private drawBossLayers(g: Game): void {
    const bc = g.bc;
    const b = g.boss;
    if (!bc || !b || b.dead) return;
    const c = this.ctx;
    const e = b.e;
    // tell: core flare, plus an aim line for aimed attacks
    if (bc.tell !== 'none' && bc.dying < 0) {
      const pulse = 0.5 + 0.5 * Math.sin(g.time * 18);
      this.glow(this.glowR, e.x, e.y, b.r * (1.6 + pulse * 0.8), 0.45 + pulse * 0.35);
      if (bc.tell === 'charge' || bc.tell === 'beam' || bc.tell === 'burst') {
        c.globalAlpha = 0.35 + pulse * 0.4;
        c.strokeStyle = CORE;
        c.lineWidth = 1;
        c.beginPath();
        const tx = bc.tell === 'charge' && bc.variant === 0 && bc.phase >= 2 ? bc.laneX : g.px;
        c.moveTo(e.x, e.y);
        c.lineTo(tx, g.FH);
        c.stroke();
      }
    }
    // laser-grid walls with one moving gap
    for (const w of bc.walls) {
      if (!w.active) continue;
      const g0 = w.gapX - w.gapW / 2;
      const g1 = w.gapX + w.gapW / 2;
      c.globalAlpha = 0.85;
      c.fillStyle = CORE;
      c.fillRect(0, w.y - 2, g0, 4);
      c.fillRect(g1, w.y - 2, g.FW - g1, 4);
      c.globalAlpha = 0.25;
      c.fillRect(0, w.y - 7, g0, 14);
      c.fillRect(g1, w.y - 7, g.FW - g1, 14);
      c.globalAlpha = 0.9;
      c.fillStyle = WHITE;
      c.fillRect(g0 - 2, w.y - 9, 2, 18);
      c.fillRect(g1, w.y - 9, 2, 18);
    }
    if (bc.tell === 'laserGrid') {
      c.globalAlpha = 0.3 + 0.3 * Math.sin(g.time * 30);
      c.strokeStyle = CORE;
      c.setLineDash([8, 8]);
      c.beginPath();
      c.moveTo(0, e.y + b.r);
      c.lineTo(g.FW, e.y + b.r);
      c.stroke();
      c.setLineDash([]);
    }
    // ground-pound shockwaves
    for (const sh of bc.shocks) {
      if (!sh.active) continue;
      const f = 1 - sh.r / sh.max;
      c.globalAlpha = 0.25 * f;
      c.strokeStyle = ORANGE;
      c.lineWidth = 18;
      c.beginPath();
      c.arc(sh.x, sh.y, sh.r, 0, TAU);
      c.stroke();
      c.globalAlpha = 0.9 * f;
      c.strokeStyle = WHITE;
      c.lineWidth = 2;
      c.stroke();
    }
    // ECHO leech tether + its break radius
    if (bc.tether.on) {
      const t = bc.tether;
      c.globalAlpha = 0.25;
      c.strokeStyle = CORE;
      c.lineWidth = 1;
      c.setLineDash([4, 6]);
      c.beginPath();
      c.arc(t.ax, t.ay, 170, 0, TAU);
      c.stroke();
      c.setLineDash([]);
      this.glow(this.glowR, g.px, g.py, 50, 0.5);
    }
    if (bc.inv > 0) {
      c.globalAlpha = 0.5 + 0.3 * Math.sin(g.time * 30);
      c.strokeStyle = WHITE;
      c.lineWidth = 1.5;
      c.beginPath();
      hexPath(c, e.x, e.y, b.r * 1.25, g.time);
      c.stroke();
    }
    c.globalAlpha = 1;
  }

  /** Screen-space boss effects: corrupted edges, static bands, intro card. */
  private drawBossScreen(g: Game): void {
    const bc = g.bc;
    if (!bc) return;
    const c = this.ctx;
    const k = g.scale;
    const x0 = g.fx0;
    if (bc.inset > 0) {
      const w = bc.inset * k;
      c.fillStyle = 'rgba(40,6,4,0.72)';
      c.fillRect(x0, 0, w, g.H);
      c.fillRect(x0 + FIELD_W * k - w, 0, w, g.H);
      c.fillStyle = CORE;
      for (let i = 0; i < 14; i++) {
        const y = Math.random() * g.H;
        c.globalAlpha = 0.15 + Math.random() * 0.25;
        c.fillRect(x0 + Math.random() * w, y, 2 + Math.random() * 18, 1.5);
        c.fillRect(x0 + FIELD_W * k - Math.random() * w, y, 2 + Math.random() * 18, 1.5);
      }
      c.globalAlpha = 0.9;
      c.fillRect(x0 + w - 1, 0, 2, g.H);
      c.fillRect(x0 + FIELD_W * k - w - 1, 0, 2, g.H);
      c.globalAlpha = 1;
    }
    if (bc.tether.on && !g.reducedMotion) {
      // vision corruption: static bands only
      for (let i = 0; i < 5; i++) {
        const y = Math.random() * g.H;
        const h = 3 + Math.random() * 14;
        c.globalAlpha = 0.06 + Math.random() * 0.1;
        c.fillStyle = Math.random() < 0.5 ? '#8a8a92' : ORANGE;
        c.fillRect(x0, y, FIELD_W * k, h);
      }
      c.globalAlpha = 1;
    }
    if (bc.intro > 0) {
      const t = 3 - bc.intro;
      const a = Math.min(1, bc.intro * 2, t * 4);
      c.globalAlpha = 0.55 * a;
      c.fillStyle = '#000';
      c.fillRect(0, 0, g.W, g.H);
      // warning bars
      const barH = 22;
      c.globalAlpha = 0.9 * a;
      for (const y of [g.H * 0.3, g.H * 0.62]) {
        c.save();
        c.beginPath();
        c.rect(0, y, g.W, barH);
        c.clip();
        c.fillStyle = '#1a0c06';
        c.fillRect(0, y, g.W, barH);
        c.fillStyle = CORE;
        const off = (g.time * 60) % 28;
        for (let x = -40 + off; x < g.W + 40; x += 28) {
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x + 14, y);
          c.lineTo(x + 14 - barH, y + barH);
          c.lineTo(x - barH, y + barH);
          c.closePath();
          c.fill();
        }
        c.restore();
      }
      const slam = Math.max(1, 2.2 - t * 6);
      const cx = g.W / 2;
      const cy = g.H * 0.46;
      c.save();
      c.translate(cx + (t < 0.35 ? (Math.random() - 0.5) * 10 : 0), cy);
      c.scale(slam, slam);
      c.globalAlpha = a;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.font = `700 ${g.W < 640 ? 26 : 44}px ${FONT_H}`;
      c.letterSpacing = '6px';
      c.fillStyle = CORE;
      c.fillText(bc.def.name, 3, 2);
      c.fillStyle = WHITE;
      c.fillText(bc.def.name, 0, 0);
      c.restore();
      c.globalAlpha = a;
      c.letterSpacing = '4px';
      c.font = `500 ${g.W < 640 ? 9 : 12}px ${FONT_UI}`;
      c.textAlign = 'center';
      c.fillStyle = ORANGE;
      c.fillText(`WARNING // ${bc.def.title} // SECTOR BREACH`, cx, cy + (g.W < 640 ? 30 : 44));
      c.letterSpacing = '0px';
      c.textBaseline = 'alphabetic';
      c.globalAlpha = 1;
    }
  }

  private drawShip(g: Game): void {
    const c = this.ctx;
    const x = g.px;
    const y = g.py;
    if (g.inv > 0 && g.dashT <= 0 && Math.sin(g.time * 50) > 0.2) c.globalAlpha = 0.35;
    // engine trail
    const n = g.trailX.length;
    c.lineCap = 'round';
    for (let i = 1; i < n; i++) {
      const a = (g.trailHead - i + 1 + n) % n;
      const b = (g.trailHead - i + n) % n;
      const f = 1 - i / n;
      c.strokeStyle = `rgba(240,126,65,${(f * 0.35).toFixed(3)})`;
      c.lineWidth = 3 * f + 0.5;
      c.beginPath();
      c.moveTo(g.trailX[a], g.trailY[a]);
      c.lineTo(g.trailX[b], g.trailY[b]);
      c.stroke();
    }
    c.lineCap = 'butt';
    // drones
    for (let i = 0; i < g.stats.drones; i++) {
      const [dx, dy] = g.dronePos(i);
      c.beginPath();
      c.moveTo(dx, dy - 6);
      c.lineTo(dx + 4, dy);
      c.lineTo(dx, dy + 5);
      c.lineTo(dx - 4, dy);
      c.closePath();
      c.fillStyle = '#121212';
      c.fill();
      c.strokeStyle = ORANGE;
      c.lineWidth = 1;
      c.stroke();
    }
    // hull
    const sq = 1 - Math.abs(g.bank) * 0.22;
    const tilt = g.bank * 2.5;
    c.save();
    c.translate(x, y);
    c.scale(sq, 1);
    c.beginPath();
    c.moveTo(SHIP[0], SHIP[1]);
    for (let i = 2; i < SHIP.length; i += 2) c.lineTo(SHIP[i] + (SHIP[i] > 0 ? -tilt : tilt) * 0.3, SHIP[i + 1]);
    c.closePath();
    c.fillStyle = '#121212';
    c.fill();
    c.lineWidth = 1.3;
    c.strokeStyle = WHITE;
    c.stroke();
    // spine + wing accents
    c.strokeStyle = ORANGE;
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(0, -15);
    c.lineTo(0, 9);
    c.moveTo(8 - tilt * 0.3, 1);
    c.lineTo(15 - tilt * 0.3, 8);
    c.moveTo(-8 + tilt * 0.3, 1);
    c.lineTo(-15 + tilt * 0.3, 8);
    c.stroke();
    // canopy
    c.beginPath();
    c.moveTo(0 + tilt, -10);
    c.lineTo(3 + tilt, -4);
    c.lineTo(0 + tilt, -1);
    c.lineTo(-3 + tilt, -4);
    c.closePath();
    c.fillStyle = ORANGE;
    c.fill();
    // engines
    c.fillStyle = '#2a2a2a';
    c.fillRect(-5, 14, 3, 3);
    c.fillRect(2, 14, 3, 3);
    c.restore();
    c.globalAlpha = 1;
    // shields
    if (g.stats.shieldMax > 0 && g.shield > 0.5) {
      const f = g.shield / g.stats.shieldMax;
      c.strokeStyle = `rgba(244,239,232,${(0.12 + f * 0.25).toFixed(3)})`;
      c.lineWidth = 1;
      c.beginPath();
      hexPath(c, x, y, 26, g.time * 0.5);
      c.stroke();
    }
  }

  private drawShipGlow(g: Game): void {
    const c = this.ctx;
    const x = g.px;
    const y = g.py;
    const fl = 0.75 + Math.random() * 0.35;
    const len = 7 + (g.pvy < -50 ? 6 : 0) + Math.random() * 4;
    c.globalAlpha = 0.9;
    c.fillStyle = ORANGE;
    for (const ex of [-3.5, 3.5]) {
      c.beginPath();
      c.moveTo(x + ex - 2, y + 16);
      c.lineTo(x + ex + 2, y + 16);
      c.lineTo(x + ex, y + 16 + len * fl);
      c.closePath();
      c.fill();
      this.glow(this.glowO, x + ex, y + 18, 14 * fl, 0.6);
    }
    if (g.muzzle > 0) {
      this.glow(this.glowO, x, y - 22, 30, g.muzzle * 14);
      this.glow(this.glowW, x, y - 22, 10, g.muzzle * 16);
    }
    for (let i = 0; i < g.stats.drones; i++) {
      const [dx, dy] = g.dronePos(i);
      this.glow(this.glowO, dx, dy, 14, 0.5);
    }
    if (g.buffShield > 0) {
      const blink = g.buffShield < 1.5 && Math.sin(g.time * 20) > 0;
      if (!blink) {
        c.globalAlpha = 0.55;
        c.strokeStyle = WHITE;
        c.lineWidth = 1.5;
        c.beginPath();
        c.arc(x, y, 30, 0, TAU);
        c.stroke();
        this.glow(this.glowW, x, y, 70, 0.12);
      }
    }
    if (g.buffOver > 0 || g.stats.permOverclock) this.glow(this.glowR, x, y, 54, 0.22 + 0.08 * Math.sin(g.time * 12));
    if (g.dashT > 0) this.glow(this.glowW, x, y, 60, 0.4);
    c.globalAlpha = 1;
  }

  private drawPickups(g: Game): void {
    const c = this.ctx;
    c.font = `700 9px ${FONT_UI}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (const p of g.pickups) {
      if (!p.active) continue;
      if (p.life < 3 && Math.sin(p.t * 20) > 0.3) continue;
      c.beginPath();
      hexPath(c, p.x, p.y, 10, p.t * 1.5);
      c.fillStyle = '#120c08';
      c.fill();
      c.strokeStyle = p.kind === PK_SHIELD ? WHITE : ORANGE;
      c.lineWidth = 1.4;
      c.stroke();
      c.fillStyle = WHITE;
      c.fillText(p.kind === PK_RAPID ? 'R' : p.kind === PK_SHIELD ? 'S' : p.kind === PK_OVERCLOCK ? 'O' : '+', p.x, p.y + 0.5);
    }
    c.textBaseline = 'alphabetic';
    c.globalCompositeOperation = 'lighter';
    for (const p of g.pickups) if (p.active) this.glow(p.kind === PK_SHIELD ? this.glowW : this.glowO, p.x, p.y, 40, 0.35);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
  }

  private drawLaser(g: Game, additive: boolean): void {
    const bc = g.bc;
    const b = g.boss;
    if (!bc || !b || bc.beam === 0) return;
    const c = this.ctx;
    const x = bc.beamX;
    const y0 = b.e.y + b.r * 0.4;
    const y1 = g.FH + 20;
    if (bc.beam === 1) {
      if (additive) return;
      const f = 0.5 + 0.5 * Math.sin(g.time * 40);
      c.strokeStyle = `rgba(255,90,42,${(0.35 + f * 0.35).toFixed(2)})`;
      c.lineWidth = 1;
      c.setLineDash([6, 6]);
      c.beginPath();
      c.moveTo(x - 20, y0);
      c.lineTo(x - 20, y1);
      c.moveTo(x + 20, y0);
      c.lineTo(x + 20, y1);
      c.stroke();
      c.setLineDash([]);
      return;
    }
    if (!additive) return;
    const w = 30 + Math.sin(g.time * 50) * 3;
    c.globalAlpha = 0.35;
    c.fillStyle = CORE;
    c.fillRect(x - w / 2, y0, w, y1 - y0);
    c.globalAlpha = 0.8;
    c.fillStyle = ORANGE;
    c.fillRect(x - w * 0.22, y0, w * 0.44, y1 - y0);
    c.globalAlpha = 0.9;
    c.fillStyle = WHITE;
    c.fillRect(x - 2, y0, 4, y1 - y0);
    this.glow(this.glowR, x, y0, 110, 0.8);
    this.glow(this.glowO, x, y1 - 20, 90, 0.5);
    c.globalAlpha = 1;
  }

  private drawEBullets(g: Game): void {
    const c = this.ctx;
    for (const b of g.ebullets) {
      if (!b.active) continue;
      if (b.kind === EB_ORB) {
        this.glow(this.glowR, b.x, b.y, 28, 0.85);
        c.globalAlpha = 0.95;
        c.fillStyle = WHITE;
        c.fillRect(b.x - 1.5, b.y - 1.5, 3, 3);
      } else if (b.kind === EB_HARD) {
        // unshootable pattern bullet: darker core, hard white rim
        this.glow(this.glowR, b.x, b.y, 20, 0.6);
        c.globalAlpha = 0.95;
        c.strokeStyle = WHITE;
        c.lineWidth = 1.2;
        c.beginPath();
        c.arc(b.x, b.y, 4.5, 0, TAU);
        c.stroke();
      } else if (b.kind === EB_HOMING) {
        this.glow(this.glowR, b.x, b.y, 30, 0.6);
        c.globalAlpha = 0.95;
        c.strokeStyle = WHITE;
        c.lineWidth = 1.5;
        c.beginPath();
        hexPath(c, b.x, b.y, 6, b.t * 4);
        c.stroke();
      } else if (b.kind === EB_NEEDLE) {
        const sp = Math.hypot(b.vx, b.vy) || 1;
        c.globalAlpha = 0.9;
        c.strokeStyle = CORE;
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(b.x, b.y);
        c.lineTo(b.x - (b.vx / sp) * 12, b.y - (b.vy / sp) * 12);
        c.stroke();
        this.glow(this.glowR, b.x, b.y, 14, 0.6);
      } else {
        this.glow(this.glowR, b.x, b.y, 18, 0.75);
        c.globalAlpha = 0.9;
        c.fillStyle = ORANGE;
        c.fillRect(b.x - 2, b.y - 2, 4, 4);
      }
    }
    c.globalAlpha = 1;
  }

  private drawBullets(g: Game): void {
    const c = this.ctx;
    for (let pass = 0; pass < 2; pass++) {
      const crit = pass === 1;
      let any = false;
      let size = 1;
      c.beginPath();
      for (const b of g.bullets) {
        if (!b.active || b.crit !== crit) continue;
        any = true;
        size = Math.max(size, b.size);
        const sp = Math.hypot(b.vx, b.vy) || 1;
        const l = 14 + b.size * 4;
        c.moveTo(b.x - (b.vx / sp) * l, b.y - (b.vy / sp) * l);
        c.lineTo(b.x, b.y);
      }
      if (!any) continue;
      c.lineCap = 'round';
      c.globalAlpha = 0.25;
      c.strokeStyle = crit ? WHITE : ORANGE;
      c.lineWidth = 5 * size;
      c.stroke();
      c.globalAlpha = 0.9;
      c.strokeStyle = ORANGE;
      c.lineWidth = 2 * size;
      c.stroke();
      c.globalAlpha = 0.95;
      c.strokeStyle = WHITE;
      c.lineWidth = crit ? 1.6 * size : 0.8 * size;
      c.stroke();
      c.lineCap = 'butt';
    }
    for (const b of g.bullets) if (b.active) this.glow(b.crit ? this.glowW : this.glowO, b.x, b.y, 14 * b.size, 0.45);
    c.globalAlpha = 1;
  }

  private drawParticles(g: Game): void {
    const c = this.ctx;
    for (const p of g.particles) {
      if (!p.active) continue;
      const a = p.life / p.max;
      switch (p.kind) {
        case P_SPARK:
          c.globalAlpha = a;
          c.strokeStyle = PALETTE[p.color];
          c.lineWidth = 1.2;
          c.beginPath();
          c.moveTo(p.x, p.y);
          c.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
          c.stroke();
          break;
        case P_FRAG: {
          if (p.color === C_GRAY) break;
          c.globalAlpha = Math.min(1, a * 1.5);
          c.fillStyle = PALETTE[p.color];
          const s = p.size * (0.4 + 0.6 * a);
          c.fillRect(p.x - s / 2, p.y - s / 2, s, s);
          break;
        }
        case P_EMBER:
          this.glow(p.color === C_RED ? this.glowR : p.color === C_WHITE ? this.glowW : this.glowO, p.x, p.y, p.size * (0.5 + 0.5 * a), a * 0.9);
          break;
        case P_RING:
          c.globalAlpha = a * 0.8;
          c.strokeStyle = PALETTE[p.color];
          c.lineWidth = 0.5 + 2 * a;
          c.beginPath();
          c.arc(p.x, p.y, p.size + (1 - a) * p.vx, 0, TAU);
          c.stroke();
          break;
        case P_HEX:
          c.globalAlpha = a * 0.9;
          c.strokeStyle = PALETTE[p.color];
          c.lineWidth = 0.5 + 1.5 * a;
          c.beginPath();
          hexPath(c, p.x, p.y, p.size + (1 - a) * p.vx);
          c.stroke();
          break;
        case P_GLITCH:
          c.globalAlpha = a * (Math.random() < 0.5 ? 0.9 : 0.25);
          c.fillStyle = PALETTE[p.color];
          c.fillRect(p.x - p.size / 2, p.y, p.size, 1.6);
          break;
      }
    }
    c.globalAlpha = 1;
  }

  private drawArcs(g: Game): void {
    const c = this.ctx;
    for (const a of g.arcs) {
      if (!a.active) continue;
      const f = a.life / 0.16;
      const dx = a.x2 - a.x1;
      const dy = a.y2 - a.y1;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      c.beginPath();
      c.moveTo(a.x1, a.y1);
      const seg = 6;
      for (let i = 1; i < seg; i++) {
        const t = i / seg;
        const j = (Math.random() - 0.5) * 16;
        c.lineTo(a.x1 + dx * t + nx * j, a.y1 + dy * t + ny * j);
      }
      c.lineTo(a.x2, a.y2);
      c.globalAlpha = 0.4 * f;
      c.strokeStyle = ORANGE;
      c.lineWidth = 4;
      c.stroke();
      c.globalAlpha = f;
      c.strokeStyle = WHITE;
      c.lineWidth = 1.2;
      c.stroke();
      this.glow(this.glowW, a.x2, a.y2, 22, f * 0.6);
    }
    c.globalAlpha = 1;
  }

  private drawPulse(g: Game): void {
    if (g.pulseR < 0) return;
    const c = this.ctx;
    const maxR = Math.max(g.FW, g.FH) * 1.2;
    const a = Math.max(0, 1 - g.pulseR / maxR);
    c.beginPath();
    c.arc(g.pulseX, g.pulseY, g.pulseR, 0, TAU);
    c.strokeStyle = ORANGE;
    c.globalAlpha = 0.18 * a;
    c.lineWidth = 16;
    c.stroke();
    c.globalAlpha = 0.85 * a;
    c.lineWidth = 2.5;
    c.stroke();
    c.strokeStyle = WHITE;
    c.globalAlpha = 0.6 * a;
    c.lineWidth = 1;
    c.stroke();
    c.globalAlpha = 1;
  }

  // ================================================================ screen space
  private drawTexts(g: Game): void {
    const c = this.ctx;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (const t of g.texts) {
      if (!t.active) continue;
      const a = Math.min(1, (t.life / t.max) * 2);
      const x = g.fx0 + t.x * g.scale;
      const y = t.y * g.scale;
      c.globalAlpha = a;
      if (t.big) {
        c.font = `700 12px ${FONT_H}`;
        c.letterSpacing = '3px';
      } else {
        c.font = `500 10px ${FONT_UI}`;
        c.letterSpacing = '0px';
      }
      c.fillStyle = PALETTE[t.color];
      c.fillText(t.text, x, y);
    }
    c.letterSpacing = '0px';
    c.globalAlpha = 1;
    c.textBaseline = 'alphabetic';
  }

  private label(text: string, x: number, y: number, align: CanvasTextAlign, color = '#8a8a92', size = 10): void {
    const c = this.ctx;
    c.font = `500 ${size}px ${FONT_UI}`;
    c.letterSpacing = '2px';
    c.textAlign = align;
    c.fillStyle = color;
    c.fillText(text, x, y);
    c.letterSpacing = '0px';
  }

  private bracket(x: number, y: number, w: number, h: number): void {
    const c = this.ctx;
    const s = 6;
    c.strokeStyle = 'rgba(240,126,65,0.45)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x, y + s);
    c.lineTo(x, y);
    c.lineTo(x + s, y);
    c.moveTo(x + w - s, y);
    c.lineTo(x + w, y);
    c.lineTo(x + w, y + s);
    c.moveTo(x + w, y + h - s);
    c.lineTo(x + w, y + h);
    c.lineTo(x + w - s, y + h);
    c.moveTo(x + s, y + h);
    c.lineTo(x, y + h);
    c.lineTo(x, y + h - s);
    c.stroke();
  }

  private drawAnnounce(g: Game): void {
    if (g.announceT <= 0 || !g.announce) return;
    const c = this.ctx;
    const small = g.W < 640;
    const cx = g.W / 2;
    const a = Math.min(1, g.announceT * 2);
    const y = g.H * 0.28;
    c.font = `700 ${small ? 20 : 34}px ${FONT_H}`;
    c.letterSpacing = small ? '3px' : '7px';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const jit = !g.reducedMotion && Math.random() < 0.12 ? (Math.random() * 2 - 1) * 6 : 0;
    c.globalAlpha = a * 0.5;
    c.fillStyle = CORE;
    c.fillText(g.announce, cx - 2 + jit, y);
    c.fillStyle = ORANGE;
    c.fillText(g.announce, cx + 2 - jit, y + 1);
    c.globalAlpha = a;
    c.fillStyle = g.announceDanger ? CORE : WHITE;
    c.fillText(g.announce, cx, y);
    c.letterSpacing = '3px';
    c.font = `500 ${small ? 9 : 11}px ${FONT_UI}`;
    c.fillStyle = g.announceDanger ? CORE : ORANGE;
    c.fillText(g.announceSub, cx, y + (small ? 24 : 34));
    const lw = small ? 60 : 120;
    c.globalAlpha = a * 0.6;
    c.fillRect(cx - lw / 2, y + (small ? 38 : 52), lw, 1);
    c.letterSpacing = '0px';
    c.textBaseline = 'alphabetic';
    c.globalAlpha = 1;
  }

  private drawHud(g: Game): void {
    const c = this.ctx;
    const W = g.W;
    const H = g.H;
    const small = W < 640;
    const pad = small ? 10 : 16;
    const fl = g.fx0;
    const fr = g.fx0 + FIELD_W * g.scale;
    const wide = fl > 200;
    // HUD anchors: inside the side panels when wide, else over the field
    const L = wide ? fl - 190 : pad;
    const R = wide ? fr + 190 : W - pad;
    c.textBaseline = 'alphabetic';

    if (g.score !== this.scoreVal) {
      this.scoreVal = g.score;
      this.scoreStr = g.score.toLocaleString('en-US');
    }
    if (g.best !== this.bestVal) {
      this.bestVal = g.best;
      this.bestStr = g.best.toLocaleString('en-US');
    }

    // score
    this.label('SCORE', L + 8, pad + 14, 'left');
    c.font = `700 ${small ? 18 : 24}px ${FONT_H}`;
    c.textAlign = 'left';
    c.fillStyle = WHITE;
    c.fillText(this.scoreStr, L + 8, pad + (small ? 36 : 42));
    this.label(`BEST ${this.bestStr}`, L + 8, pad + (small ? 52 : 60), 'left', DIM, 9);
    this.bracket(L, pad, small ? 124 : 170, small ? 60 : 70);

    // sector / wave
    const r = g.run;
    const cx = wide ? (fl + fr) / 2 : W / 2;
    // On phones the corner blocks take the top row, so the centre header moves below them
    const narrow = !wide && W < 560;
    const top = narrow ? pad + 70 : pad;
    if (r) {
      const sec = SECTORS[r.sector];
      const nW = sec.waves.length;
      const cur = g.isBoss ? nW : Math.min(nW - 1, r.waveInSector);
      this.label(
        narrow
          ? `S${r.sector + 1}/${SECTORS.length} · ${sec.name} · ${g.isBoss ? 'BOSS' : `W${cur + 1}/${nW}${g.waveElite ? ' ELITE' : ''}`}`
          : `SECTOR ${r.sector + 1}/${SECTORS.length} · ${sec.name} · ${g.isBoss ? 'BOSS' : `WAVE ${cur + 1}/${nW}${g.waveElite ? ' ELITE' : ''}`}`,
        cx,
        top + 12,
        'center',
        g.isBoss ? CORE : WHITE,
        small ? 8 : 9,
      );
      // pips: waves then the boss
      const pw = small ? 16 : 22;
      const gap = 4;
      const total = (nW + 1) * pw + nW * gap + 8;
      let x = cx - total / 2;
      for (let i = 0; i <= nW; i++) {
        const boss = i === nW;
        const done = i < cur;
        const now = i === cur;
        if (boss) x += 8;
        c.fillStyle = done ? ORANGE : now ? (Math.sin(g.time * 6) > -0.3 ? WHITE : ORANGE) : 'rgba(240,126,65,0.18)';
        c.fillRect(x, top + 19, pw, boss ? 5 : 3);
        x += pw + gap;
      }
    }
    const b = g.boss;
    const bc = g.bc;
    if (b && bc && !b.dead) {
      const w = Math.min(420, (wide ? fr - fl : W) - 60);
      const y = top + (small ? 40 : 44);
      const hint =
        bc.variant === 0 && bc.phase < 2 && bc.shields.some((x) => x > 0)
          ? 'SHOOT OFF THE SHIELD SEGMENTS'
          : bc.variant === 1 && bc.phase >= 1
            ? 'DECOYS EXPLODE // FIND THE REAL ONE'
            : bc.tether.on
              ? 'TETHERED // MOVE AWAY TO BREAK IT'
              : bc.inset > 0
                ? 'AVOID THE CORRUPTED EDGES'
                : bc.def.title;
      this.label(`${bc.def.name} // P${bc.phase + 1} // ${hint}`, cx, y, 'center', CORE, 9);
      c.fillStyle = 'rgba(255,90,42,0.15)';
      c.fillRect(cx - w / 2, y + 6, w, 5);
      c.fillStyle = bc.inv > 0 ? WHITE : CORE;
      c.fillRect(cx - w / 2, y + 6, w * Math.max(0, b.hp / b.maxHp), 5);
      c.fillStyle = '#050506';
      for (let i = 1; i < 20; i++) c.fillRect(cx - w / 2 + (w * i) / 20, y + 6, 1, 5);
      // phase ticks
      c.fillStyle = WHITE;
      for (const p of [0.66, 0.33]) c.fillRect(cx - w / 2 + w * p - 1, y + 3, 2, 11);
    } else if (g.waveActive) {
      let alive = 0;
      for (const u of g.units) if (!u.dead) alive++;
      const bw = small ? 90 : 140;
      const frac = g.waveTotal > 0 ? Math.min(1, alive / g.waveTotal) : 0;
      const y = top + (small ? 40 : 44);
      c.fillStyle = 'rgba(240,126,65,0.15)';
      c.fillRect(cx - bw / 2, y, bw, 2);
      c.fillStyle = ORANGE;
      c.fillRect(cx - bw / 2, y, bw * frac, 2);
      this.label(`${alive} HOSTILE`, cx, y + 14, 'center', DIM, 9);
    }

    // multiplier
    const hot = g.mult >= 4;
    this.label('MULTIPLIER', R - 8, pad + 14, 'right');
    c.font = `700 ${small ? 18 : 24}px ${FONT_H}`;
    c.textAlign = 'right';
    c.fillStyle = g.combo > 0 ? (hot ? WHITE : ORANGE) : '#3a3a40';
    c.fillText(`x${g.mult}`, R - 8, pad + (small ? 36 : 42));
    const tw = small ? 70 : 110;
    c.fillStyle = 'rgba(240,126,65,0.15)';
    c.fillRect(R - 8 - tw, pad + (small ? 44 : 50), tw, 2);
    if (g.combo > 0) {
      c.fillStyle = hot ? WHITE : ORANGE;
      c.fillRect(R - 8 - tw, pad + (small ? 44 : 50), tw * Math.max(0, g.comboT / g.stats.comboTime), 2);
    }
    this.label(`CHAIN ${g.combo}`, R - 8, pad + (small ? 56 : 64), 'right', DIM, 9);
    this.bracket(R - (small ? 104 : 140), pad, small ? 104 : 140, small ? 60 : 70);

    // integrity + shield
    const st = g.stats;
    this.dispHp += (g.hp - this.dispHp) * 0.15;
    const low = g.hp < st.maxHp * 0.3;
    const col = low ? CORE : ORANGE;
    const barW = small ? 130 : 200;
    const segs = 20;
    const gap = 2;
    const sw = (barW - gap * (segs - 1)) / segs;
    const by = H - pad - 20;
    const lit = Math.ceil((this.dispHp / st.maxHp) * segs);
    const flick = low && Math.sin(g.time * 20) > 0.5;
    const critical = g.hp > 0 && g.hp < st.maxHp * 0.25;
    if (critical && !g.reducedMotion && Math.random() < 0.06) c.globalAlpha = 0.45; // HUD flicker
    this.label(critical ? (Math.sin(g.time * 9) > 0 ? 'INTEGRITY CRITICAL' : '') : 'INTEGRITY', L + 8, by - 12, 'left', critical ? CORE : '#8a8a92');
    c.globalAlpha = 1;
    c.font = `700 12px ${FONT_H}`;
    c.textAlign = 'right';
    c.fillStyle = low ? CORE : WHITE;
    c.fillText(`${Math.max(0, Math.ceil(g.hp))}/${st.maxHp}`, L + 8 + barW, by - 11);
    for (let i = 0; i < segs; i++) {
      c.fillStyle = i < lit ? (flick ? '#5a1e1a' : col) : 'rgba(240,126,65,0.12)';
      c.fillRect(L + 8 + i * (sw + gap), by, sw, 7);
    }
    if (st.shieldMax > 0) {
      c.fillStyle = 'rgba(244,239,232,0.12)';
      c.fillRect(L + 8, by + 10, barW, 2);
      c.fillStyle = WHITE;
      c.fillRect(L + 8, by + 10, barW * (g.shield / st.shieldMax), 2);
    }
    this.bracket(L, by - 28, barW + 16, 48);

    // timed buffs
    let yb = by - 40;
    const buffs: [number, number, string][] = [
      [g.buffRapid, g.buffMax[0], 'RAPID FIRE'],
      [g.buffShield, g.buffMax[1], 'AEGIS'],
      [g.buffOver, g.buffMax[2], 'OVERCLOCK'],
    ];
    for (const [v, m, name] of buffs) {
      if (v <= 0) continue;
      this.label(`${name} ${v.toFixed(1)}s`, L + 8, yb, 'left', WHITE, 9);
      c.fillStyle = 'rgba(240,126,65,0.15)';
      c.fillRect(L + 8, yb + 4, barW * 0.7, 2);
      c.fillStyle = ORANGE;
      c.fillRect(L + 8, yb + 4, barW * 0.7 * Math.min(1, v / m), 2);
      yb -= 22;
    }
    if (g.stats.permOverclock) this.label('OVERCLOCK // PERMANENT', L + 8, yb, 'left', CORE, 9);

    // ability buttons (also touch targets)
    if (st.pulse) this.abilityBtn(g.btnPulse.x, g.btnPulse.y, g.btnPulse.r, 'PULSE', 1 - g.pulseCdT / st.pulseCd, small ? '' : 'E / RMB', g.time);
    if (st.dash) this.abilityBtn(g.btnDash.x, g.btnDash.y, g.btnDash.r, 'DASH', 1 - g.dashCdT / st.dashCd, small ? '' : 'SHIFT', g.time);

    // wide-screen side panels: terminal log + build
    if (wide) {
      c.font = `500 10px ${FONT_UI}`;
      c.textAlign = 'left';
      let ly = H * 0.42;
      this.label('// SYSLOG', L + 8, ly - 18, 'left', ORANGE, 9);
      for (let i = 0; i < g.log.length; i++) {
        const age = g.time - g.log[i].t;
        c.fillStyle = age < 1 ? WHITE : '#6a6a72';
        c.globalAlpha = i === g.log.length - 1 ? 1 : 0.55 + (i / g.log.length) * 0.4;
        c.font = `400 10px ${FONT_UI}`;
        c.fillText(`> ${g.log[i].text}`.slice(0, 28), L + 8, ly);
        ly += 15;
      }
      c.globalAlpha = 1;
      if (r && r.build.length) {
        let y = H * 0.3;
        this.label('// BUILD', R - 8, y - 16, 'right', ORANGE, 9);
        for (const bu of r.build) {
          const def = UPGRADE_BY_ID[bu.id];
          if (!def) continue;
          const col = def.rarity === 'corrupted' ? CORE : def.rarity === 'rare' ? ORANGE : '#b4b4bc';
          const p = this.icon(bu.id);
          if (p) {
            c.save();
            c.translate(R - 186, y - 10);
            c.scale(0.55, 0.55);
            c.strokeStyle = col;
            c.lineWidth = 2;
            c.stroke(p);
            c.restore();
          }
          c.font = `500 9px ${FONT_UI}`;
          c.textAlign = 'left';
          c.fillStyle = col;
          const hackedNow = g.hacked === bu.id;
          if (hackedNow) c.fillStyle = Math.sin(g.time * 10) > 0 ? CORE : '#5a5a60';
          c.fillText(hackedNow ? `${def.name} // HACKED` .slice(0, 26) : `${def.name}${bu.stacks > 1 ? ` x${bu.stacks}` : ''}`.slice(0, 26), R - 170, y);
          if (hackedNow) c.fillRect(R - 170, y - 3, 150, 1);
          y += 15;
          if (y > H * 0.78) break;
        }
        const syn = SYNERGIES.filter((x) => g.syn.has(x.id));
        if (syn.length) {
          y += 6;
          this.label('// SYNERGY', R - 8, y, 'right', ORANGE, 9);
          y += 14;
          for (const sd of syn) {
            c.font = `500 9px ${FONT_UI}`;
            c.textAlign = 'left';
            c.fillStyle = WHITE;
            c.fillText(sd.name, R - 186, y);
            y += 14;
          }
        }
      }
    }

    if (g.phase === 'playing') this.drawAnnounce(g);
  }

  private abilityBtn(x: number, y: number, r: number, name: string, frac: number, hint: string, t: number): void {
    const c = this.ctx;
    const ready = frac >= 1;
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.fillStyle = 'rgba(11,7,5,0.85)';
    c.fill();
    c.lineWidth = 3;
    c.strokeStyle = 'rgba(240,126,65,0.18)';
    c.stroke();
    c.beginPath();
    c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * clampN(frac));
    c.strokeStyle = ready ? (Math.sin(t * 8) > 0 ? WHITE : ORANGE) : ORANGE;
    c.stroke();
    if (ready) {
      c.globalCompositeOperation = 'lighter';
      this.glow(this.glowO, x, y, r * 3, 0.25 + 0.1 * Math.sin(t * 8));
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
    }
    c.font = `700 9px ${FONT_H}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = ready ? WHITE : DIM;
    c.fillText(name, x, y + 1);
    c.textBaseline = 'alphabetic';
    if (hint) this.label(hint, x - r - 10, y + 4, 'right', ready ? ORANGE : DIM, 9);
  }
}

const clampN = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
