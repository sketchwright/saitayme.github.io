// Canvas 2D renderer for Cyber Defender. Static layers (grid, scanlines,
// vignette) are pre-rendered on resize; glows use cached radial sprites with
// additive blending instead of shadowBlur.
import type { Game } from './engine';
import {
  C_GRAY,
  C_RED,
  C_WHITE,
  Enemy,
  P_EMBER,
  P_FRAG,
  P_GLITCH,
  P_HEX,
  P_RING,
  P_SPARK,
  PALETTE,
  TAU,
} from './types';

const ORANGE = '#f07e41';
const RED = '#e5383b';
const BODY = '#0b0b0e';
const BODY_FLASH = '#2c0f0b';
const RIM = 'rgba(240,126,65,0.6)';
const LEG_THIN = 'rgba(240,126,65,0.55)';
const FONT_H = 'Orbitron, sans-serif';
const FONT_UI = '"JetBrains Mono", ui-monospace, monospace';

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };

const makeCanvas = (w: number, h: number): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
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

const el = (c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) => {
  c.moveTo(x + rx, y);
  c.ellipse(x, y, rx, ry, 0, 0, TAU);
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

interface Stream {
  x: number;
  y: number;
  speed: number;
  len: number;
  alpha: number;
  bits: number;
}

export class Renderer {
  private readonly ctx: Ctx;
  private W = 800;
  private H = 600;
  private dpr = 1;
  private bg: HTMLCanvasElement = makeCanvas(1, 1);
  private fx: HTMLCanvasElement = makeCanvas(1, 1);
  private hurt: HTMLCanvasElement = makeCanvas(1, 1);
  private readonly glowO = glowSprite(240, 126, 65, 'rgba(255,236,224,1)');
  private readonly glowR = glowSprite(229, 56, 59, 'rgba(255,210,205,1)');
  private readonly glowW = glowSprite(255, 255, 255, 'rgba(255,255,255,1)');
  private streams: Stream[] = [];
  private lastT = 0;
  private dispInt = 100;
  private scoreVal = -1;
  private scoreStr = '0';
  private bestVal = -1;
  private bestStr = '0';
  private k = 1;
  private ox = 0;
  private oy = 0;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx as Ctx;
  }

  resize(W: number, H: number, dpr: number): void {
    this.W = W;
    this.H = H;
    this.dpr = dpr;
    this.buildLayers();
    this.initStreams();
  }

  // ------------------------------------------------------------ static layers
  private buildLayers(): void {
    const { W, H, dpr } = this;
    const w = Math.round(W * dpr);
    const h = Math.round(H * dpr);
    const cx = W / 2;
    const cy = H / 2;

    this.bg = makeCanvas(w, h);
    const b = this.bg.getContext('2d');
    if (b) {
      b.setTransform(dpr, 0, 0, dpr, 0, 0);
      b.fillStyle = '#050506';
      b.fillRect(0, 0, W, H);
      const lg = b.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.6);
      lg.addColorStop(0, 'rgba(240,126,65,0.075)');
      lg.addColorStop(0.35, 'rgba(240,126,65,0.02)');
      lg.addColorStop(1, 'rgba(0,0,0,0)');
      b.fillStyle = lg;
      b.fillRect(0, 0, W, H);

      const cell = 32;
      const x0 = cx % cell;
      const y0 = cy % cell;
      b.lineWidth = 1;
      for (let pass = 0; pass < 2; pass++) {
        b.beginPath();
        for (let x = x0; x < W; x += cell) {
          const major = Math.round((x - cx) / cell) % 4 === 0;
          if (major !== (pass === 1)) continue;
          b.moveTo(Math.round(x) + 0.5, 0);
          b.lineTo(Math.round(x) + 0.5, H);
        }
        for (let y = y0; y < H; y += cell) {
          const major = Math.round((y - cy) / cell) % 4 === 0;
          if (major !== (pass === 1)) continue;
          b.moveTo(0, Math.round(y) + 0.5);
          b.lineTo(W, Math.round(y) + 0.5);
        }
        b.strokeStyle = pass === 1 ? 'rgba(240,126,65,0.075)' : 'rgba(240,126,65,0.032)';
        b.stroke();
      }
      // grid intersections on major lines
      b.fillStyle = 'rgba(240,126,65,0.16)';
      const mx0 = cx % (cell * 4);
      const my0 = cy % (cell * 4);
      for (let x = mx0; x < W; x += cell * 4) for (let y = my0; y < H; y += cell * 4) b.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);

      // circuit traces radiating from the core
      b.strokeStyle = 'rgba(240,126,65,0.085)';
      b.lineWidth = 1.2;
      b.fillStyle = 'rgba(240,126,65,0.18)';
      const n = 22;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + Math.random() * 0.2;
        let x = cx + Math.cos(a) * 90;
        let y = cy + Math.sin(a) * 90;
        x = Math.round((x - x0) / cell) * cell + x0;
        y = Math.round((y - y0) / cell) * cell + y0;
        b.beginPath();
        b.moveTo(x, y);
        const steps = 3 + ((Math.random() * 6) | 0);
        for (let s = 0; s < steps; s++) {
          const horiz = Math.random() < 0.5;
          const dirx = Math.sign(x - cx) || 1;
          const diry = Math.sign(y - cy) || 1;
          const len = cell * (1 + ((Math.random() * 3) | 0));
          if (horiz) x += dirx * len;
          else y += diry * len;
          if (Math.random() < 0.3) {
            x += dirx * cell;
            y += diry * cell;
          }
          b.lineTo(x, y);
        }
        b.stroke();
        b.fillRect(x - 2, y - 2, 4, 4);
      }

      // faint system labels (vertically centred on the edges, clear of the HUD)
      if (W >= 640) {
        b.font = `10px ${FONT_UI}`;
        b.fillStyle = 'rgba(160,160,170,0.16)';
        b.textAlign = 'left';
        b.fillText('NODE 0x3F7A // KERNEL SPACE', 20, cy - 6);
        b.fillText('SEC.LAYER 07 // FIREWALL ACTIVE', 20, cy + 8);
        b.textAlign = 'right';
        b.fillText('SYS.UPTIME 99.982%', W - 20, cy - 6);
        b.fillText('PROC.SCAN // HEURISTIC', W - 20, cy + 8);
      }
    }

    this.fx = makeCanvas(w, h);
    const f = this.fx.getContext('2d');
    if (f) {
      f.setTransform(dpr, 0, 0, dpr, 0, 0);
      f.fillStyle = 'rgba(0,0,0,0.2)';
      for (let y = 0; y < H; y += 3) f.fillRect(0, y, W, 1);
      const diag = Math.hypot(W, H) / 2;
      const vg = f.createRadialGradient(cx, cy, diag * 0.35, cx, cy, diag);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.82)');
      f.fillStyle = vg;
      f.fillRect(0, 0, W, H);
    }

    this.hurt = makeCanvas(w, h);
    const hu = this.hurt.getContext('2d');
    if (hu) {
      hu.setTransform(dpr, 0, 0, dpr, 0, 0);
      const diag = Math.hypot(W, H) / 2;
      const rg = hu.createRadialGradient(cx, cy, diag * 0.3, cx, cy, diag);
      rg.addColorStop(0, 'rgba(229,56,59,0)');
      rg.addColorStop(1, 'rgba(229,56,59,0.6)');
      hu.fillStyle = rg;
      hu.fillRect(0, 0, W, H);
    }
  }

  private initStreams(): void {
    const n = Math.max(8, Math.round(this.W / 36));
    this.streams = [];
    for (let i = 0; i < n; i++) {
      this.streams.push(this.newStream(Math.random() * this.H));
    }
  }

  private newStream(y: number): Stream {
    const cell = 32;
    const x0 = (this.W / 2) % cell;
    return {
      x: Math.round(x0 + Math.floor(Math.random() * (this.W / cell)) * cell + cell / 2),
      y,
      speed: 25 + Math.random() * 70,
      len: 6 + ((Math.random() * 12) | 0),
      alpha: 0.05 + Math.random() * 0.12,
      bits: (Math.random() * 0x3ffff) | 0,
    };
  }

  private drawStreams(dt: number): void {
    const c = this.ctx;
    c.fillStyle = ORANGE;
    for (let i = 0; i < this.streams.length; i++) {
      const s = this.streams[i];
      s.y += s.speed * dt;
      if (s.y - s.len * 8 > this.H) this.streams[i] = this.newStream(-Math.random() * 120);
      for (let j = 0; j < s.len; j++) {
        c.globalAlpha = s.alpha * (1 - j / s.len);
        const on = (s.bits >> j) & 1;
        c.fillRect(s.x, s.y - j * 8, on ? 2 : 1, on ? 5 : 2);
      }
    }
    c.globalAlpha = 1;
  }

  // ------------------------------------------------------------ helpers
  private world(): void {
    this.ctx.setTransform(this.k, 0, 0, this.k, this.ox, this.oy);
  }

  private local(x: number, y: number, ch: number, sh: number, jx = 0, jy = 0): void {
    const k = this.k;
    this.ctx.setTransform(k * ch, k * sh, -k * sh, k * ch, this.ox + k * x + jx, this.oy + k * y + jy);
  }

  private glow(img: HTMLCanvasElement, x: number, y: number, size: number, alpha: number): void {
    if (alpha <= 0.01 || size <= 0) return;
    const c = this.ctx;
    c.globalAlpha = alpha > 1 ? 1 : alpha;
    c.drawImage(img, x - size / 2, y - size / 2, size, size);
  }

  // ------------------------------------------------------------ frame
  draw(g: Game): void {
    const c = this.ctx;
    const d = this.dpr;
    let dt = g.time - this.lastT;
    if (dt < 0 || dt > 0.1) dt = 0.016;
    this.lastT = g.time;
    if (g.phase === 'paused') dt = 0;

    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.drawImage(this.bg, 0, 0);
    c.setTransform(d, 0, 0, d, 0, 0);
    this.drawStreams(dt);

    const sm = g.shake;
    const sx = sm > 0 ? (Math.random() * 2 - 1) * sm : 0;
    const sy = sm > 0 ? (Math.random() * 2 - 1) * sm : 0;
    this.k = d * g.scale;
    this.ox = d * (g.W / 2 + sx);
    this.oy = d * (g.H / 2 + sy);

    c.lineCap = 'butt';
    c.lineJoin = 'miter';
    this.world();
    this.drawPerimeter(g);
    this.drawAimLine(g);
    this.drawCore(g);

    for (const e of g.enemies) if (e.active) this.drawEnemy(e, g.time);

    // dark fragments (normal blend)
    this.world();
    c.fillStyle = PALETTE[C_GRAY];
    for (const p of g.particles) {
      if (!p.active || p.kind !== P_FRAG || p.color !== C_GRAY) continue;
      const a = p.life / p.max;
      c.globalAlpha = Math.min(1, a * 1.6);
      const s = p.size * (0.4 + 0.6 * a);
      c.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    c.globalAlpha = 1;

    // ---- additive pass
    c.globalCompositeOperation = 'lighter';
    for (const e of g.enemies) if (e.active) this.drawEnemyGlow(e, g.time);
    this.world();
    this.drawCoreGlow(g);
    this.drawShots(g);
    this.drawBullets(g);
    this.drawParticles(g);
    this.drawEmp(g);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;

    // ---- screen space
    c.setTransform(d, 0, 0, d, 0, 0);
    this.drawTexts(g);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.fx, 0, 0);
    const lowPulse = g.phase === 'playing' && g.dying < 0 && g.integrity < 25 ? 0.18 + 0.1 * Math.sin(g.time * 6) : 0;
    const hurtA = Math.max(g.damageFlash * 0.85, lowPulse);
    if (hurtA > 0.01) {
      c.globalAlpha = hurtA;
      c.drawImage(this.hurt, 0, 0);
      c.globalAlpha = 1;
    }
    c.setTransform(d, 0, 0, d, 0, 0);
    if (g.damageFlash > 0.45) {
      c.fillStyle = 'rgba(229,56,59,0.1)';
      for (let i = 0; i < 4; i++) c.fillRect(0, Math.random() * g.H, g.W, 2 + Math.random() * 12);
    }
    if (g.phase !== 'menu') this.drawHud(g);
    this.drawReticle(g);
  }

  // ------------------------------------------------------------ world pieces
  private drawPerimeter(g: Game): void {
    const c = this.ctx;
    const t = g.time;
    c.lineWidth = 1;
    c.strokeStyle = 'rgba(240,126,65,0.17)';
    c.beginPath();
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * TAU + t * 0.04;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const r2 = i % 6 === 0 ? 134 : 127;
      c.moveTo(ca * 122, sa * 122);
      c.lineTo(ca * r2, sa * r2);
    }
    c.stroke();
    c.strokeStyle = 'rgba(240,126,65,0.1)';
    c.lineWidth = 1.5;
    c.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = -t * 0.12 + (i / 4) * TAU;
      c.moveTo(Math.cos(a) * 190, Math.sin(a) * 190);
      c.arc(0, 0, 190, a, a + 0.55);
    }
    c.stroke();
    const pr = (t * 0.45) % 1;
    c.strokeStyle = `rgba(240,126,65,${(0.12 * (1 - pr)).toFixed(3)})`;
    c.lineWidth = 1;
    c.beginPath();
    c.arc(0, 0, g.coreR + 20 + pr * 300, 0, TAU);
    c.stroke();
  }

  private drawAimLine(g: Game): void {
    if (g.phase !== 'playing' || g.dying >= 0 || !g.pointerInside || !g.pointerMouse) return;
    const c = this.ctx;
    const a = g.turret;
    const len = Math.min(Math.hypot(g.aimX, g.aimY), 2000);
    c.strokeStyle = 'rgba(240,126,65,0.08)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(Math.cos(a) * (g.coreR + 24), Math.sin(a) * (g.coreR + 24));
    c.lineTo(Math.cos(a) * len, Math.sin(a) * len);
    c.stroke();
  }

  private drawCore(g: Game): void {
    if (g.dying >= 0) return;
    const c = this.ctx;
    const t = g.time;
    const R = g.coreR;
    const low = g.integrity < 35;
    const flick = low && Math.sin(t * 23) > 0.55;
    const col = low ? RED : ORANGE;

    c.beginPath();
    hexPath(c, 0, 0, R + 10);
    c.fillStyle = '#0b0705';
    c.fill();
    c.lineWidth = 1.6;
    c.strokeStyle = flick ? '#4a1a14' : col;
    c.stroke();
    c.beginPath();
    hexPath(c, 0, 0, R + 3);
    c.lineWidth = 1;
    c.strokeStyle = 'rgba(240,126,65,0.35)';
    c.stroke();

    for (let i = 0; i < 4; i++) {
      const y = -R * 0.55 + i * R * 0.3;
      c.fillStyle = '#1b130e';
      c.fillRect(-R * 0.6, y, R * 1.2, R * 0.2);
      c.fillStyle = Math.sin(t * 6 + i * 1.7) > 0 ? col : '#3a2216';
      c.fillRect(R * 0.36, y + R * 0.06, R * 0.08, R * 0.08);
      c.fillStyle = Math.sin(t * 9 + i * 2.3) > 0.3 ? col : '#3a2216';
      c.fillRect(R * 0.22, y + R * 0.06, R * 0.08, R * 0.08);
    }

    const segs = 10;
    const lit = Math.ceil((g.integrity / 100) * segs);
    const rot = t * 0.5;
    c.lineWidth = 3;
    for (let i = 0; i < segs; i++) {
      const a0 = rot + (i / segs) * TAU + 0.07;
      c.beginPath();
      c.arc(0, 0, R + 19, a0, a0 + TAU / segs - 0.14);
      c.strokeStyle = i < lit ? (flick ? '#4a1a14' : col) : '#24150e';
      c.stroke();
    }

    const ca = Math.cos(g.turret);
    const sa = Math.sin(g.turret);
    this.local(0, 0, ca, sa);
    const rc = g.recoil;
    c.fillStyle = '#120d0a';
    c.fillRect(R * 0.1 - rc, -4.5, R + 12, 9);
    c.lineWidth = 1;
    c.strokeStyle = col;
    c.strokeRect(R * 0.1 - rc, -4.5, R + 12, 9);
    c.fillStyle = col;
    c.fillRect(R * 0.45 - rc, -1, R * 0.7, 2);
    if (g.mult >= 6) {
      c.fillRect(R * 0.45 - rc, -4, R * 0.6, 1);
      c.fillRect(R * 0.45 - rc, 3, R * 0.6, 1);
    }
    c.beginPath();
    c.arc(0, 0, R * 0.42, 0, TAU);
    c.fillStyle = '#0e0907';
    c.fill();
    c.strokeStyle = col;
    c.stroke();
    this.world();
  }

  private drawCoreGlow(g: Game): void {
    if (g.dying >= 0) return;
    const t = g.time;
    const R = g.coreR;
    const low = g.integrity < 35;
    const img = low ? this.glowR : this.glowO;
    this.glow(img, 0, 0, R * 5.5 * (0.92 + 0.08 * Math.sin(t * 3)) + g.corePulse * R * 4, 0.45 + g.corePulse * 0.4);
    this.glow(this.glowW, 0, 0, R * 1.1, 0.55);
    const tip = R + 22 - g.recoil;
    const tx = Math.cos(g.turret) * tip;
    const ty = Math.sin(g.turret) * tip;
    this.glow(this.glowO, tx, ty, 14, 0.5);
    if (g.muzzle > 0) {
      this.glow(this.glowO, tx, ty, 46, g.muzzle * 16);
      this.glow(this.glowW, tx, ty, 16, g.muzzle * 18);
    }
  }

  // ------------------------------------------------------------ enemies
  private silhouette(e: Enemy): void {
    const c = this.ctx;
    const r = e.r;
    c.beginPath();
    switch (e.kind) {
      case 'crawler':
      case 'mite':
        el(c, -0.85 * r, 0, 0.95 * r, 0.66 * r);
        el(c, 0.15 * r, 0, 0.55 * r, 0.47 * r);
        el(c, 0.78 * r, 0, 0.32 * r, 0.28 * r);
        break;
      case 'brooder':
        el(c, -0.55 * r, 0, 1.05 * r, 0.92 * r);
        el(c, 0.55 * r, 0, 0.45 * r, 0.4 * r);
        el(c, 1.0 * r, 0, 0.26 * r, 0.23 * r);
        break;
      case 'brute':
        c.moveTo(1.15 * r, 0);
        c.lineTo(0.6 * r, -0.75 * r);
        c.lineTo(-0.7 * r, -0.85 * r);
        c.lineTo(-1.25 * r, -0.35 * r);
        c.lineTo(-1.25 * r, 0.35 * r);
        c.lineTo(-0.7 * r, 0.85 * r);
        c.lineTo(0.6 * r, 0.75 * r);
        c.closePath();
        break;
      case 'boss':
        el(c, -0.75 * r, 0, 1.05 * r, 0.85 * r);
        el(c, 0.35 * r, 0, 0.55 * r, 0.5 * r);
        el(c, 0.95 * r, 0, 0.32 * r, 0.3 * r);
        break;
    }
  }

  private mandibles(r: number, reach: number, w: number, rim: string): void {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(1.0 * r, -0.3 * r);
    c.quadraticCurveTo((1 + reach) * r, -0.48 * r, (0.95 + reach) * r, -0.05 * r);
    c.moveTo(1.0 * r, 0.3 * r);
    c.quadraticCurveTo((1 + reach) * r, 0.48 * r, (0.95 + reach) * r, 0.05 * r);
    c.lineWidth = w + 1.2;
    c.strokeStyle = rim;
    c.stroke();
    c.lineWidth = w;
    c.strokeStyle = BODY;
    c.stroke();
  }

  private barcode(bits: number, x: number, y: number, step: number, w: number, h: number, n: number): void {
    const c = this.ctx;
    for (let b = 0; b < n; b++) if ((bits >> b) & 1) c.fillRect(x + b * step, y, w, h);
  }

  private drawEnemy(e: Enemy, t: number): void {
    const c = this.ctx;
    const r = e.r;
    const ch = Math.cos(e.heading);
    const sh = Math.sin(e.heading);
    const flash = e.flash > 0;
    const rim = flash ? 'rgba(255,255,255,0.95)' : RIM;

    // --- legs, two-bone IK in world space
    this.world();
    const lw = e.kind === 'boss' ? 3.4 : e.kind === 'brute' ? 2.6 : e.kind === 'brooder' ? 1.7 : e.kind === 'mite' ? 0.9 : 1.25;
    const heavy = e.kind === 'boss' || e.kind === 'brute';
    c.beginPath();
    for (let i = 0; i < e.legCount; i++) {
      const L = e.legs[i];
      const hx = e.x + ch * L.lx - sh * L.ly;
      const hy = e.y + sh * L.lx + ch * L.ly;
      const dx = L.fx - hx;
      const dy = L.fy - hy;
      let dist = Math.hypot(dx, dy);
      const maxD = L.l1 + L.l2 - 0.01;
      const minD = Math.abs(L.l1 - L.l2) + 0.01;
      if (dist > maxD) dist = maxD;
      if (dist < minD) dist = minD;
      let cosA = (L.l1 * L.l1 + dist * dist - L.l2 * L.l2) / (2 * L.l1 * dist);
      cosA = cosA < -1 ? -1 : cosA > 1 ? 1 : cosA;
      const a = Math.acos(cosA);
      const base = Math.atan2(dy, dx);
      const k1x = hx + Math.cos(base + a) * L.l1;
      const k1y = hy + Math.sin(base + a) * L.l1;
      const k2x = hx + Math.cos(base - a) * L.l1;
      const k2y = hy + Math.sin(base - a) * L.l1;
      const d1 = (k1x - e.x) ** 2 + (k1y - e.y) ** 2;
      const d2 = (k2x - e.x) ** 2 + (k2y - e.y) ** 2;
      const kx = d1 > d2 ? k1x : k2x;
      const ky = d1 > d2 ? k1y : k2y;
      c.moveTo(hx, hy);
      c.lineTo(kx, ky);
      c.lineTo(L.fx, L.fy);
      // claw tip
      const tx = L.fx - kx;
      const ty = L.fy - ky;
      const tl = Math.hypot(tx, ty) || 1;
      c.lineTo(L.fx + (tx / tl) * lw * 1.6, L.fy + (ty / tl) * lw * 1.6);
    }
    if (lw >= 1.5) {
      // thick legs: dark limb with a neon rim
      c.lineWidth = lw + 1.5;
      c.strokeStyle = rim;
      c.stroke();
      c.lineWidth = lw;
      c.strokeStyle = BODY;
      c.stroke();
    } else {
      // thin legs: a single dim stroke is visually identical and half the cost
      c.lineWidth = lw;
      c.strokeStyle = flash ? rim : LEG_THIN;
      c.stroke();
    }

    // --- body in local space (+x forward)
    let jx = 0;
    let jy = 0;
    if (e.glitch > 0) {
      jx = (Math.random() * 2 - 1) * 2.5 * this.dpr;
      jy = (Math.random() * 2 - 1) * 1.5 * this.dpr;
    }
    this.local(e.x, e.y, ch, sh, jx, jy);
    this.silhouette(e);
    c.fillStyle = flash ? BODY_FLASH : BODY;
    c.fill();
    c.lineWidth = heavy ? 1.4 : 1.1;
    c.strokeStyle = rim;
    c.stroke();

    switch (e.kind) {
      case 'crawler':
      case 'mite': {
        // level of detail: skip fine markings when the bug is tiny on screen
        const detailed = (r * this.k) / this.dpr >= 7;
        if (detailed) {
          c.strokeStyle = 'rgba(229,56,59,0.6)';
          c.lineWidth = 0.8;
          c.beginPath();
          for (let j = 0; j < 3; j++) {
            const x = -0.85 * r + (j - 1) * 0.38 * r;
            c.moveTo(x, -0.55 * r);
            c.lineTo(x + 0.12 * r, 0);
            c.lineTo(x, 0.55 * r);
          }
          c.stroke();
        }
        c.beginPath();
        c.moveTo(1.0 * r, -0.14 * r);
        c.lineTo(1.42 * r, -0.03 * r);
        c.moveTo(1.0 * r, 0.14 * r);
        c.lineTo(1.42 * r, 0.03 * r);
        c.strokeStyle = rim;
        c.lineWidth = 1;
        c.stroke();
        c.fillStyle = RED;
        const es = Math.max(1, 0.11 * r);
        c.fillRect(0.82 * r, -0.17 * r, es, es);
        c.fillRect(0.82 * r, 0.07 * r, es, es);
        c.fillRect(0.68 * r, -0.22 * r, es * 0.8, es * 0.8);
        c.fillRect(0.68 * r, 0.14 * r, es * 0.8, es * 0.8);
        if (e.kind === 'crawler' && detailed) {
          c.fillStyle = 'rgba(240,126,65,0.6)';
          this.barcode(e.bits, -1.5 * r, -0.07 * r, 0.2 * r, 0.11 * r, 0.14 * r, 6);
        }
        break;
      }
      case 'brooder': {
        const ax = -0.55 * r;
        c.beginPath();
        hexPath(c, ax, 0, 0.5 * r, t * 0.8 + e.seed * 6);
        c.strokeStyle = 'rgba(229,56,59,0.7)';
        c.lineWidth = 1;
        c.stroke();
        c.beginPath();
        const rot = t * 0.8 + e.seed * 6 + Math.PI / 6;
        for (let i = 0; i < 3; i++) {
          const a = rot + (i / 3) * TAU;
          const px = ax + Math.cos(a) * 0.5 * r;
          const py = Math.sin(a) * 0.5 * r;
          c.moveTo(px + 0.2 * r, py);
          c.arc(px, py, 0.2 * r, 0, TAU);
        }
        c.fillStyle = '#1d0e08';
        c.fill();
        c.strokeStyle = 'rgba(240,126,65,0.85)';
        c.stroke();
        c.fillStyle = 'rgba(240,126,65,0.55)';
        this.barcode(e.bits, -1.45 * r, -0.9 * r, 0.22 * r, 0.12 * r, 0.1 * r, 7);
        this.barcode(e.bits >> 3, -1.45 * r, 0.8 * r, 0.22 * r, 0.12 * r, 0.1 * r, 7);
        c.beginPath();
        c.moveTo(1.18 * r, -0.1 * r);
        c.lineTo(1.45 * r, -0.02 * r);
        c.moveTo(1.18 * r, 0.1 * r);
        c.lineTo(1.45 * r, 0.02 * r);
        c.strokeStyle = rim;
        c.stroke();
        c.fillStyle = RED;
        c.fillRect(1.05 * r, -0.12 * r, 0.09 * r, 0.09 * r);
        c.fillRect(1.05 * r, 0.03 * r, 0.09 * r, 0.09 * r);
        break;
      }
      case 'brute': {
        c.beginPath();
        c.moveTo(0.6 * r, -0.75 * r);
        c.lineTo(0.15 * r, -0.2 * r);
        c.lineTo(0.15 * r, 0.2 * r);
        c.lineTo(0.6 * r, 0.75 * r);
        c.moveTo(-0.7 * r, -0.85 * r);
        c.lineTo(-0.35 * r, -0.25 * r);
        c.lineTo(-0.35 * r, 0.25 * r);
        c.lineTo(-0.7 * r, 0.85 * r);
        c.lineWidth = 1.6;
        c.strokeStyle = '#2c2c33';
        c.stroke();
        c.lineWidth = 0.7;
        c.strokeStyle = 'rgba(229,56,59,0.4)';
        c.stroke();
        c.fillStyle = '#000';
        c.fillRect(-1.0 * r, -0.07 * r, 1.5 * r, 0.14 * r);
        if (e.hp < e.maxHp * 0.5) {
          c.beginPath();
          c.moveTo(-0.2 * r, -0.6 * r);
          c.lineTo(-0.05 * r, -0.35 * r);
          c.lineTo(-0.25 * r, -0.2 * r);
          c.moveTo(0.3 * r, 0.55 * r);
          c.lineTo(0.42 * r, 0.3 * r);
          c.strokeStyle = 'rgba(229,56,59,0.9)';
          c.lineWidth = 0.9;
          c.stroke();
        }
        this.mandibles(r, 0.6, 1.5, rim);
        c.fillStyle = RED;
        for (let i = 0; i < 3; i++) {
          c.fillRect(0.82 * r - i * 0.1 * r, -0.14 * r - i * 0.1 * r, 0.08 * r, 0.08 * r);
          c.fillRect(0.82 * r - i * 0.1 * r, 0.06 * r + i * 0.1 * r, 0.08 * r, 0.08 * r);
        }
        break;
      }
      case 'boss': {
        const ax = -0.75 * r;
        c.strokeStyle = 'rgba(229,56,59,0.55)';
        c.lineWidth = 1.2;
        c.beginPath();
        for (let j = 0; j < 4; j++) {
          const x = ax + (j - 1.5) * 0.4 * r;
          c.moveTo(x, -0.72 * r);
          c.lineTo(x + 0.15 * r, 0);
          c.lineTo(x, 0.72 * r);
        }
        c.stroke();
        c.beginPath();
        const rot = t * 1.1;
        for (let i = 0; i < 6; i++) {
          const a = rot + (i / 6) * TAU;
          c.moveTo(ax + Math.cos(a) * 0.55 * r, Math.sin(a) * 0.55 * r);
          c.arc(ax, 0, 0.55 * r, a, a + 0.7);
        }
        c.strokeStyle = 'rgba(240,126,65,0.8)';
        c.lineWidth = 1.6;
        c.stroke();
        c.fillStyle = 'rgba(240,126,65,0.5)';
        this.barcode(e.bits, ax - 0.8 * r, -0.95 * r, 0.16 * r, 0.09 * r, 0.06 * r, 10);
        this.barcode(e.bits >> 2, ax - 0.8 * r, 0.9 * r, 0.16 * r, 0.09 * r, 0.06 * r, 10);
        c.beginPath();
        hexPath(c, 0.35 * r, 0, 0.25 * r);
        c.strokeStyle = 'rgba(229,56,59,0.6)';
        c.lineWidth = 1;
        c.stroke();
        this.mandibles(r, 0.55, 3, rim);
        c.fillStyle = RED;
        for (let i = 0; i < 4; i++) {
          c.fillRect(1.0 * r - i * 0.07 * r, -0.12 * r - i * 0.06 * r, 0.06 * r, 0.06 * r);
          c.fillRect(1.0 * r - i * 0.07 * r, 0.06 * r + i * 0.06 * r, 0.06 * r, 0.06 * r);
        }
        break;
      }
    }
  }

  private lp(e: Enemy, ch: number, sh: number, lx: number, ly: number, out: { x: number; y: number }): void {
    out.x = e.x + ch * lx - sh * ly;
    out.y = e.y + sh * lx + ch * ly;
  }

  private readonly tmp = { x: 0, y: 0 };

  private drawEnemyGlow(e: Enemy, t: number): void {
    const c = this.ctx;
    const r = e.r;
    const ch = Math.cos(e.heading);
    const sh = Math.sin(e.heading);
    const p = this.tmp;
    const pulse = 0.85 + 0.15 * Math.sin(t * 9 + e.seed * 20);

    // glitch ghosts: chromatic offset silhouettes
    if (e.glitch > 0) {
      const gx = (2 + Math.random() * 3) * this.dpr;
      this.local(e.x, e.y, ch, sh, gx, 0);
      this.silhouette(e);
      c.globalAlpha = 0.6;
      c.lineWidth = 1;
      c.strokeStyle = RED;
      c.stroke();
      this.local(e.x, e.y, ch, sh, -gx, gx * 0.3);
      this.silhouette(e);
      c.globalAlpha = 0.35;
      c.strokeStyle = ORANGE;
      c.stroke();
    }

    if (e.kind === 'brute') {
      this.local(e.x, e.y, ch, sh);
      c.globalAlpha = 0.9 * pulse;
      c.fillStyle = ORANGE;
      c.fillRect(-0.95 * r, -0.035 * r, 1.4 * r, 0.07 * r);
    }

    this.world();
    switch (e.kind) {
      case 'crawler':
      case 'mite':
        this.lp(e, ch, sh, -0.85 * r, 0, p);
        this.glow(this.glowR, p.x, p.y, r * 2.8 * pulse, 0.85);
        this.lp(e, ch, sh, 0.8 * r, 0, p);
        this.glow(this.glowR, p.x, p.y, r * 1.0, 0.5);
        break;
      case 'brooder': {
        const ax = -0.55 * r;
        this.lp(e, ch, sh, ax, 0, p);
        this.glow(this.glowR, p.x, p.y, r * 2.4 * pulse, 0.5);
        const rot = t * 0.8 + e.seed * 6 + Math.PI / 6;
        for (let i = 0; i < 3; i++) {
          const a = rot + (i / 3) * TAU;
          this.lp(e, ch, sh, ax + Math.cos(a) * 0.5 * r, Math.sin(a) * 0.5 * r, p);
          this.glow(this.glowO, p.x, p.y, r * (0.8 + 0.25 * Math.sin(t * 5 + i * 2)), 0.75);
        }
        break;
      }
      case 'brute':
        this.lp(e, ch, sh, -0.55 * r, 0, p);
        this.glow(this.glowO, p.x, p.y, r * 1.5 * pulse, 0.55);
        this.lp(e, ch, sh, 0.2 * r, 0, p);
        this.glow(this.glowO, p.x, p.y, r * 1.1 * pulse, 0.5);
        this.lp(e, ch, sh, 0.85 * r, 0, p);
        this.glow(this.glowR, p.x, p.y, r * 0.8, 0.6);
        break;
      case 'boss': {
        const hpF = e.hp / e.maxHp;
        const bp = 0.8 + 0.2 * Math.sin(t * (4 + (1 - hpF) * 8));
        this.lp(e, ch, sh, -0.75 * r, 0, p);
        this.glow(this.glowR, p.x, p.y, r * 3.0 * bp, 0.75);
        this.glow(this.glowW, p.x, p.y, r * 0.5 * bp, 0.5);
        this.lp(e, ch, sh, 0.35 * r, 0, p);
        this.glow(this.glowO, p.x, p.y, r * 1.2, 0.45);
        this.lp(e, ch, sh, 1.0 * r, 0, p);
        this.glow(this.glowR, p.x, p.y, r * 0.8, 0.7);
        break;
      }
    }
    if (e.flash > 0) this.glow(this.glowW, e.x, e.y, r * 2.6, (e.flash / 0.07) * 0.45);

    if ((e.kind === 'brute' || e.kind === 'brooder') && e.hp < e.maxHp) {
      c.globalAlpha = 0.55;
      c.strokeStyle = RED;
      c.lineWidth = 1;
      c.beginPath();
      c.arc(e.x, e.y, r * 1.9, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0, e.hp / e.maxHp));
      c.stroke();
    }
    c.globalAlpha = 1;
  }

  private drawShots(g: Game): void {
    const c = this.ctx;
    for (const s of g.shots) {
      if (!s.active) continue;
      c.globalAlpha = 0.5;
      c.strokeStyle = RED;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(s.x, s.y);
      c.lineTo(s.x - s.vx * 0.08, s.y - s.vy * 0.08);
      c.stroke();
      this.glow(this.glowR, s.x, s.y, 28, 0.9);
      c.globalAlpha = 0.9;
      c.fillStyle = '#fff';
      c.fillRect(s.x - 1.5, s.y - 1.5, 3, 3);
    }
    c.globalAlpha = 1;
  }

  private drawBullets(g: Game): void {
    const c = this.ctx;
    let any = false;
    c.beginPath();
    for (const b of g.bullets) {
      if (!b.active) continue;
      any = true;
      c.moveTo(b.x - b.vx * 0.03, b.y - b.vy * 0.03);
      c.lineTo(b.x, b.y);
    }
    if (!any) return;
    c.lineCap = 'round';
    c.globalAlpha = 0.25;
    c.strokeStyle = ORANGE;
    c.lineWidth = 6;
    c.stroke();
    c.globalAlpha = 0.9;
    c.lineWidth = 2.2;
    c.stroke();
    c.globalAlpha = 0.95;
    c.strokeStyle = '#fff';
    c.lineWidth = 0.9;
    c.stroke();
    c.lineCap = 'butt';
    for (const b of g.bullets) if (b.active) this.glow(this.glowO, b.x, b.y, 18, 0.55);
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

  private drawEmp(g: Game): void {
    if (g.empR < 0) return;
    const c = this.ctx;
    const maxR = Math.max(g.hx, g.hy) * 1.3;
    const a = Math.max(0, 1 - g.empR / maxR);
    c.beginPath();
    c.arc(0, 0, g.empR, 0, TAU);
    c.strokeStyle = ORANGE;
    c.globalAlpha = 0.18 * a;
    c.lineWidth = 14;
    c.stroke();
    c.globalAlpha = 0.85 * a;
    c.lineWidth = 2.5;
    c.stroke();
    c.strokeStyle = '#fff';
    c.globalAlpha = 0.6 * a;
    c.lineWidth = 1;
    c.stroke();
    c.globalAlpha = 1;
  }

  // ------------------------------------------------------------ screen space
  private drawTexts(g: Game): void {
    const c = this.ctx;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (const t of g.texts) {
      if (!t.active) continue;
      const a = Math.min(1, (t.life / t.max) * 2);
      const x = g.W / 2 + t.x * g.scale;
      const y = g.H / 2 + t.y * g.scale;
      c.globalAlpha = a;
      if (t.big) {
        c.font = `700 14px ${FONT_H}`;
        c.letterSpacing = '3px';
      } else {
        c.font = `500 11px ${FONT_UI}`;
        c.letterSpacing = '0px';
      }
      c.fillStyle = PALETTE[t.color];
      c.fillText(t.text, x, y);
    }
    c.letterSpacing = '0px';
    c.globalAlpha = 1;
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

  private drawHud(g: Game): void {
    const c = this.ctx;
    const W = g.W;
    const H = g.H;
    const small = W < 640;
    const pad = small ? 12 : 20;
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
    this.label('SCORE', pad + 8, pad + 14, 'left');
    c.font = `700 ${small ? 20 : 26}px ${FONT_H}`;
    c.textAlign = 'left';
    c.fillStyle = '#fff';
    c.fillText(this.scoreStr, pad + 8, pad + (small ? 38 : 44));
    this.label(`BEST ${this.bestStr}`, pad + 8, pad + (small ? 54 : 62), 'left', '#6c6c74', 9);
    this.bracket(pad, pad, small ? 130 : 170, small ? 62 : 72);

    // wave + hostiles
    const cx = W / 2;
    this.label('WAVE', cx, pad + 14, 'center');
    c.font = `700 ${small ? 18 : 22}px ${FONT_H}`;
    c.textAlign = 'center';
    c.fillStyle = ORANGE;
    c.fillText(String(Math.max(1, g.wave)).padStart(2, '0'), cx, pad + (small ? 36 : 40));
    const remain = g.queue.length + g.activeEnemies;
    const bw = small ? 100 : 150;
    const frac = g.waveTotal > 0 ? Math.min(1, remain / g.waveTotal) : 0;
    c.fillStyle = 'rgba(240,126,65,0.15)';
    c.fillRect(cx - bw / 2, pad + 48, bw, 2);
    c.fillStyle = ORANGE;
    c.fillRect(cx - bw / 2, pad + 48, bw * frac, 2);
    this.label(`${remain} HOSTILE`, cx, pad + 64, 'center', '#6c6c74', 9);

    // boss bar
    if (g.boss && g.boss.active) {
      const b = g.boss;
      const w = Math.min(440, W - pad * 2 - 40);
      const y = pad + 82;
      this.label('KERNEL LEECH // ROOT ACCESS', cx, y, 'center', RED, 9);
      c.fillStyle = 'rgba(229,56,59,0.15)';
      c.fillRect(cx - w / 2, y + 7, w, 5);
      c.fillStyle = RED;
      c.fillRect(cx - w / 2, y + 7, w * Math.max(0, b.hp / b.maxHp), 5);
      c.fillStyle = '#050506';
      for (let i = 1; i < 20; i++) c.fillRect(cx - w / 2 + (w * i) / 20, y + 7, 1, 5);
    }

    // combo
    const rx = W - pad - 8;
    const hot = g.mult >= 4;
    this.label('MULTIPLIER', rx, pad + 14, 'right');
    c.font = `700 ${small ? 20 : 26}px ${FONT_H}`;
    c.textAlign = 'right';
    c.fillStyle = g.combo > 0 ? (hot ? '#fff' : ORANGE) : '#3a3a40';
    c.fillText(`x${g.mult}`, rx, pad + (small ? 38 : 44));
    const tw = small ? 80 : 110;
    c.fillStyle = 'rgba(240,126,65,0.15)';
    c.fillRect(rx - tw, pad + (small ? 46 : 52), tw, 2);
    if (g.combo > 0) {
      c.fillStyle = hot ? '#fff' : ORANGE;
      c.fillRect(rx - tw, pad + (small ? 46 : 52), tw * Math.max(0, g.comboT / 2.4), 2);
    }
    this.label(`CHAIN ${g.combo}`, rx, pad + (small ? 58 : 66), 'right', '#6c6c74', 9);
    this.bracket(W - pad - (small ? 110 : 140), pad, small ? 110 : 140, small ? 62 : 72);

    // integrity
    this.dispInt += (g.integrity - this.dispInt) * 0.15;
    const low = g.integrity < 35;
    const col = low ? RED : ORANGE;
    const barW = small ? 140 : 230;
    const segs = 20;
    const gap = 2;
    const sw = (barW - gap * (segs - 1)) / segs;
    const by = H - pad - 14;
    const lit = Math.ceil(this.dispInt / (100 / segs));
    const flick = g.integrity < 25 && Math.sin(g.time * 20) > 0.5;
    this.label('CORE INTEGRITY', pad + 8, by - 12, 'left');
    c.font = `700 13px ${FONT_H}`;
    c.textAlign = 'right';
    c.fillStyle = low ? RED : '#fff';
    c.fillText(`${Math.round(g.integrity)}%`, pad + 8 + barW, by - 11);
    for (let i = 0; i < segs; i++) {
      c.fillStyle = i < lit ? (flick ? '#5a1e1a' : col) : 'rgba(240,126,65,0.12)';
      c.fillRect(pad + 8 + i * (sw + gap), by, sw, 8);
    }
    this.bracket(pad, by - 30, barW + 16, 46);

    // EMP button
    const b = g.empBtn;
    const ready = g.emp >= 1;
    c.beginPath();
    c.arc(b.x, b.y, b.r, 0, TAU);
    c.fillStyle = 'rgba(11,7,5,0.85)';
    c.fill();
    c.lineWidth = 3;
    c.strokeStyle = 'rgba(240,126,65,0.18)';
    c.stroke();
    c.beginPath();
    c.arc(b.x, b.y, b.r, -Math.PI / 2, -Math.PI / 2 + TAU * g.emp);
    c.strokeStyle = ready ? (Math.sin(g.time * 8) > 0 ? '#fff' : ORANGE) : ORANGE;
    c.stroke();
    if (ready) {
      c.globalCompositeOperation = 'lighter';
      this.glow(this.glowO, b.x, b.y, b.r * 3.2, 0.35 + 0.15 * Math.sin(g.time * 8));
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
    }
    c.font = `700 11px ${FONT_H}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = ready ? '#fff' : '#6c6c74';
    c.fillText('EMP', b.x, b.y + 1);
    c.textBaseline = 'alphabetic';
    if (!small) this.label(ready ? 'SPACE / RMB' : `${Math.floor(g.emp * 100)}%`, b.x - b.r - 12, b.y + 4, 'right', ready ? ORANGE : '#6c6c74', 9);

    // announcement
    if (g.announceT > 0 && g.announce && g.phase !== 'over') {
      const a = Math.min(1, g.announceT * 2);
      const y = H * 0.3;
      c.globalAlpha = a;
      c.font = `700 ${small ? 24 : 40}px ${FONT_H}`;
      c.letterSpacing = small ? '4px' : '8px';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      const jit = Math.random() < 0.12 ? (Math.random() * 2 - 1) * 6 : 0;
      c.globalAlpha = a * 0.55;
      c.fillStyle = RED;
      c.fillText(g.announce, cx - 2 + jit, y);
      c.fillStyle = ORANGE;
      c.fillText(g.announce, cx + 2 - jit, y + 1);
      c.globalAlpha = a;
      c.fillStyle = g.announceDanger ? RED : '#fff';
      c.fillText(g.announce, cx, y);
      c.letterSpacing = '3px';
      c.font = `500 ${small ? 9 : 11}px ${FONT_UI}`;
      c.fillStyle = g.announceDanger ? RED : ORANGE;
      c.fillText(g.announceSub, cx, y + (small ? 26 : 38));
      const lw = small ? 60 : 120;
      c.fillStyle = g.announceDanger ? RED : ORANGE;
      c.globalAlpha = a * 0.6;
      c.fillRect(cx - lw / 2, y + (small ? 40 : 56), lw, 1);
      c.letterSpacing = '0px';
      c.textBaseline = 'alphabetic';
      c.globalAlpha = 1;
    }
  }

  private drawReticle(g: Game): void {
    if (g.phase !== 'playing' || g.dying >= 0 || !g.pointerInside || !g.pointerMouse) return;
    const c = this.ctx;
    const x = g.pointerX;
    const y = g.pointerY;
    const spin = g.firing ? g.time * 6 : g.time * 1.2;
    const gap = g.firing ? 5 : 7;
    c.strokeStyle = ORANGE;
    c.lineWidth = 1.5;
    c.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = spin + (i / 4) * TAU;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      c.moveTo(x + ca * gap, y + sa * gap);
      c.lineTo(x + ca * (gap + 6), y + sa * (gap + 6));
    }
    c.stroke();
    c.lineWidth = 1;
    c.strokeStyle = 'rgba(240,126,65,0.4)';
    c.beginPath();
    c.arc(x, y, 15, -spin, -spin + 1.2);
    c.moveTo(x + Math.cos(-spin + Math.PI) * 15, y + Math.sin(-spin + Math.PI) * 15);
    c.arc(x, y, 15, -spin + Math.PI, -spin + Math.PI + 1.2);
    c.stroke();
    c.fillStyle = '#fff';
    c.fillRect(x - 1, y - 1, 2, 2);
  }
}
