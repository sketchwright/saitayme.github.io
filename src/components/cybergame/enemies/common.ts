// Shared primitives for the enemy module: palette, rng, easing, glitch
// slices, corrupted glyph trails, the cached core-glow sprite and the
// tracking eye. Framework-free, Canvas 2D only.

export type Vec = { x: number; y: number };
export type Ctx2D = CanvasRenderingContext2D;

export const TAU = Math.PI * 2;

export const PAL = {
  void: '#0a0a0a',
  body: '#111111',
  bodyHi: '#1b1b1b',
  plate: '#161616',
  orange: '#f07e41',
  white: '#f4efe8',
  gray: '#6a6a6a',
  grayDim: '#2e2e2e',
  grayMid: '#454545',
  coreDim: '#8a1c12',
  coreHot: '#ff5a2a',
} as const;

// ---------------------------------------------------------------------------
// Precomputed colour ramps (no string building in hot paths)

const RAMP_STEPS = 32;
const ALPHA_STEPS = 40;

const buildRamp = (a: number[], b: number[]): string[] => {
  const out: string[] = [];
  for (let i = 0; i <= RAMP_STEPS; i++) {
    const t = i / RAMP_STEPS;
    const r = Math.round(a[0] + (b[0] - a[0]) * t);
    const g = Math.round(a[1] + (b[1] - a[1]) * t);
    const bl = Math.round(a[2] + (b[2] - a[2]) * t);
    out.push(`rgb(${r},${g},${bl})`);
  }
  return out;
};

const buildAlpha = (r: number, g: number, b: number): string[] => {
  const out: string[] = [];
  for (let i = 0; i <= ALPHA_STEPS; i++) out.push(`rgba(${r},${g},${b},${(i / ALPHA_STEPS).toFixed(3)})`);
  return out;
};

const CORE_RAMP = buildRamp([0x8a, 0x1c, 0x12], [0xff, 0x5a, 0x2a]);
const ORANGE_A = buildAlpha(240, 126, 65);
const WHITE_A = buildAlpha(244, 239, 232);
const GRAY_A = buildAlpha(120, 120, 120);
const HOT_A = buildAlpha(255, 90, 42);
const VOID_A = buildAlpha(10, 10, 10);

const rampIdx = (t: number, n: number): number => (t <= 0 ? 0 : t >= 1 ? n : Math.round(t * n));

/** Dim (#8a1c12) to hot (#ff5a2a) core colour. */
export const coreColor = (t: number): string => CORE_RAMP[rampIdx(t, RAMP_STEPS)];
export const orangeA = (a: number): string => ORANGE_A[rampIdx(a, ALPHA_STEPS)];
export const whiteA = (a: number): string => WHITE_A[rampIdx(a, ALPHA_STEPS)];
export const grayA = (a: number): string => GRAY_A[rampIdx(a, ALPHA_STEPS)];
export const hotA = (a: number): string => HOT_A[rampIdx(a, ALPHA_STEPS)];
export const voidA = (a: number): string => VOID_A[rampIdx(a, ALPHA_STEPS)];

// ---------------------------------------------------------------------------
// Math

export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const easeOutCubic = (t: number): number => 1 - (1 - t) * (1 - t) * (1 - t);
export const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));
/** Frame-rate independent exponential approach factor. */
export const damp = (rate: number, dt: number): number => 1 - Math.exp(-rate * dt);
export const wrapAngle = (a: number): number => {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
};
export const turnToward = (cur: number, target: number, maxStep: number): number => {
  const d = wrapAngle(target - cur);
  return cur + clamp(d, -maxStep, maxStep);
};

/** Per-entity mulberry32 stream. */
export interface Rng {
  rs: number;
}
export const rand = (r: Rng): number => {
  let t = (r.rs = (r.rs + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
export const randRange = (r: Rng, a: number, b: number): number => a + (b - a) * rand(r);

// ---------------------------------------------------------------------------
// Base entity

export interface CreateOpts {
  /** Nominal on-screen size in px (diameter-ish of the body + limbs). */
  size?: number;
}

export interface EnemyBase extends Rng {
  x: number;
  y: number;
  vx: number;
  vy: number;
  heading: number;
  size: number;
  seed: number;
  t: number;
  /** 0..1 attack charge; drives core brightness. */
  charge: number;
  /** Logical life (false once killed / split). */
  alive: boolean;
  /** Safe to remove (death animation finished). */
  done: boolean;
  glitch: Glitch;
  trail: Trail;
}

export const makeBase = (x: number, y: number, seed: number, size: number): EnemyBase => ({
  x,
  y,
  vx: 0,
  vy: 0,
  heading: Math.PI / 2,
  size,
  seed,
  rs: (seed * 2654435761) | 0,
  t: 0,
  charge: 0,
  alive: true,
  done: false,
  glitch: makeGlitch(),
  trail: makeTrail(10),
});

/** Velocity steering toward a desired velocity with snappy accel. */
export const steer = (e: EnemyBase, dvx: number, dvy: number, rate: number, dt: number): void => {
  const k = damp(rate, dt);
  e.vx += (dvx - e.vx) * k;
  e.vy += (dvy - e.vy) * k;
};

// ---------------------------------------------------------------------------
// Glitch: horizontal slice offsets + flicker frames

export interface Glitch {
  next: number;
  sliceT: number;
  sliceY: number; // fraction of size, relative to centre
  sliceH: number; // fraction of size
  sliceDx: number; // px
  flick: number;
}

export const makeGlitch = (): Glitch => ({ next: 0.5 + Math.random() * 2, sliceT: 0, sliceY: 0, sliceH: 0, sliceDx: 0, flick: 0 });

/** rate = glitch events per second, amp = slice offset as fraction of size. */
export const updateGlitch = (e: EnemyBase, dt: number, rate: number, amp: number): void => {
  const g = e.glitch;
  g.sliceT -= dt;
  g.flick -= dt;
  g.next -= dt * rate;
  if (g.next <= 0) {
    g.next = 0.4 + rand(e) * 1.6;
    g.sliceT = 0.04 + rand(e) * 0.09;
    g.sliceY = randRange(e, -0.45, 0.3);
    g.sliceH = randRange(e, 0.06, 0.22);
    g.sliceDx = (rand(e) < 0.5 ? -1 : 1) * randRange(e, 0.04, 0.14 + amp) * e.size;
    if (rand(e) < 0.35) g.flick = 0.05 + rand(e) * 0.06;
  }
};

export type DrawFn<E> = (ctx: Ctx2D, e: E, time: number) => void;

/**
 * Draws `fn` either straight, or (during a slice event) twice: once clipped
 * outside a horizontal band and once inside it, shifted sideways.
 * extent = half-size of the box that must contain everything fn draws.
 */
export function drawGlitched<E extends EnemyBase>(ctx: Ctx2D, e: E, time: number, extent: number, fn: DrawFn<E>): void {
  const g = e.glitch;
  const flicker = g.flick > 0 && ((time * 60) | 0) % 2 === 0;
  const prevA = ctx.globalAlpha;
  if (flicker) ctx.globalAlpha = prevA * 0.3;
  if (g.sliceT <= 0) {
    fn(ctx, e, time);
    ctx.globalAlpha = prevA;
    return;
  }
  const x0 = e.x - extent;
  const top = e.y - extent;
  const bot = e.y + extent;
  const y0 = e.y + g.sliceY * e.size;
  const y1 = y0 + g.sliceH * e.size;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, top, extent * 2, Math.max(0, y0 - top));
  ctx.rect(x0, y1, extent * 2, Math.max(0, bot - y1));
  ctx.clip();
  fn(ctx, e, time);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.rect(x0 + g.sliceDx, y0, extent * 2, y1 - y0);
  ctx.clip();
  ctx.translate(g.sliceDx, 0);
  fn(ctx, e, time);
  ctx.restore();
  // torn edge
  ctx.fillStyle = orangeA(0.35);
  ctx.fillRect(e.x - e.size * 0.5 + g.sliceDx, y0, e.size, 1);
  ctx.globalAlpha = prevA;
}

// ---------------------------------------------------------------------------
// Corrupted glyph trail (ring buffer)

export const GLYPH_STRING =
  '0123456789ABCDEF#%&$@<>/\\|=+*░▒▓┼┤├┬┴╳╱╲═║ｦｱｲｳｴｵｶｷｸｹｺｻｼｽﾀﾁﾂﾃﾄﾅﾆﾇﾈﾊﾋﾌﾍﾎ';
export const GLYPHS: string[] = Array.from(GLYPH_STRING);

export interface Trail {
  n: number;
  x: Float32Array;
  y: Float32Array;
  life: Float32Array;
  ch: Uint8Array;
  head: number;
  acc: number;
  live: number;
}

export const makeTrail = (n: number): Trail => ({
  n,
  x: new Float32Array(n),
  y: new Float32Array(n),
  life: new Float32Array(n),
  ch: new Uint8Array(n),
  head: 0,
  acc: 0,
  live: 0,
});

/** Emits glyphs behind the entity while its speed exceeds minSpeed. */
export const updateTrail = (e: EnemyBase, dt: number, minSpeed: number): void => {
  const tr = e.trail;
  let live = 0;
  for (let i = 0; i < tr.n; i++) {
    if (tr.life[i] > 0) {
      tr.life[i] -= dt * 2.4;
      if (tr.life[i] > 0) {
        live++;
        if (rand(e) < 0.12) tr.ch[i] = (rand(e) * GLYPHS.length) | 0;
      }
    }
  }
  const sp = Math.hypot(e.vx, e.vy);
  if (sp > minSpeed) {
    tr.acc += dt * 18 * Math.min(2.5, sp / minSpeed);
    while (tr.acc >= 1) {
      tr.acc -= 1;
      const i = tr.head;
      tr.head = (tr.head + 1) % tr.n;
      const j = e.size * 0.22;
      tr.x[i] = e.x - (e.vx / sp) * e.size * 0.25 + (rand(e) - 0.5) * j;
      tr.y[i] = e.y - (e.vy / sp) * e.size * 0.25 + (rand(e) - 0.5) * j;
      tr.life[i] = 1;
      tr.ch[i] = (rand(e) * GLYPHS.length) | 0;
      live++;
    }
  } else tr.acc = 0;
  tr.live = live;
};

const fontCache = new Map<number, string>();
export const monoFont = (px: number): string => {
  const k = Math.max(6, Math.round(px));
  let f = fontCache.get(k);
  if (!f) {
    f = `${k}px "JetBrains Mono", ui-monospace, Consolas, monospace`;
    fontCache.set(k, f);
  }
  return f;
};

export const drawTrail = (ctx: Ctx2D, e: EnemyBase): void => {
  const tr = e.trail;
  if (tr.live === 0) return;
  ctx.font = monoFont(e.size * 0.17);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const a0 = ctx.globalAlpha;
  for (let i = 0; i < tr.n; i++) {
    const l = tr.life[i];
    if (l <= 0) continue;
    ctx.fillStyle = l > 0.85 ? whiteA(0.7 * a0) : orangeA(l * l * 0.75 * a0);
    ctx.fillText(GLYPHS[tr.ch[i]], tr.x[i], tr.y[i]);
  }
};

// ---------------------------------------------------------------------------
// Cached additive core glow (the only glow per enemy)

let glowSprite: HTMLCanvasElement | null = null;
const getGlow = (): HTMLCanvasElement => {
  if (glowSprite) return glowSprite;
  const s = 64;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const g = c.getContext('2d');
  if (g) {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,110,60,0.95)');
    gr.addColorStop(0.25, 'rgba(255,90,42,0.45)');
    gr.addColorStop(0.6, 'rgba(160,36,20,0.12)');
    gr.addColorStop(1, 'rgba(138,28,18,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
  }
  glowSprite = c;
  return c;
};

export const drawGlow = (ctx: Ctx2D, x: number, y: number, r: number, a: number): void => {
  if (a <= 0.01 || r <= 0.5) return;
  const op = ctx.globalCompositeOperation;
  const pa = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = pa * Math.min(1, a);
  ctx.drawImage(getGlow(), x - r, y - r, r * 2, r * 2);
  ctx.globalCompositeOperation = op;
  ctx.globalAlpha = pa;
};

// ---------------------------------------------------------------------------
// Tracking eye with saccades (pupil offsets are normalised -1..1)

export interface EyeTrack {
  ox: number;
  oy: number;
  tx: number;
  ty: number;
  timer: number;
  blink: number; // 1 = open
  blinkT: number;
}

export const makeEye = (): EyeTrack => ({ ox: 0, oy: 0, tx: 0, ty: 0, timer: 0, blink: 1, blinkT: 2 + Math.random() * 3 });

export const updateEye = (eye: EyeTrack, r: Rng, ex: number, ey: number, target: Vec, dt: number, jitter: number): void => {
  eye.timer -= dt;
  if (eye.timer <= 0) {
    const dx = target.x - ex;
    const dy = target.y - ey;
    const d = Math.hypot(dx, dy) || 1;
    const m = Math.min(1, d / 60);
    eye.tx = (dx / d) * m * 0.9 + (rand(r) - 0.5) * jitter;
    eye.ty = (dy / d) * m * 0.9 + (rand(r) - 0.5) * jitter;
    eye.timer = 0.05 + rand(r) * 0.4;
  }
  const k = damp(38, dt);
  eye.ox += (eye.tx - eye.ox) * k;
  eye.oy += (eye.ty - eye.oy) * k;
  eye.blinkT -= dt;
  if (eye.blinkT <= 0) {
    eye.blinkT = 1.5 + rand(r) * 4;
    eye.blink = 0;
  }
  eye.blink = Math.min(1, eye.blink + dt * 9);
};

/**
 * Socket + iris ring + pupil + glint. r = socket radius in px.
 * slit = 0 round pupil, 1 vertical slit.
 */
export const drawEye = (ctx: Ctx2D, x: number, y: number, r: number, eye: EyeTrack, charge: number, slit: number): void => {
  const open = 0.15 + 0.85 * eye.blink;
  ctx.fillStyle = PAL.void;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * open, 0, 0, TAU);
  ctx.fill();
  ctx.lineWidth = Math.max(0.8, r * 0.14);
  ctx.strokeStyle = coreColor(0.25 + charge * 0.75);
  ctx.stroke();
  const px = x + eye.ox * r * 0.38;
  const py = y + eye.oy * r * 0.38 * open;
  const ir = r * 0.6;
  ctx.fillStyle = coreColor(charge * 0.85);
  ctx.beginPath();
  ctx.ellipse(px, py, ir, ir * open, 0, 0, TAU);
  ctx.fill();
  const pr = r * (0.34 - charge * 0.16);
  ctx.fillStyle = PAL.void;
  ctx.beginPath();
  ctx.ellipse(px + eye.ox * r * 0.08, py + eye.oy * r * 0.08, pr * (1 - slit * 0.7), pr * open * (1 + slit * 0.4), 0, 0, TAU);
  ctx.fill();
  const gs = Math.max(1, r * 0.16);
  ctx.fillStyle = whiteA(0.9);
  ctx.fillRect(px - ir * 0.45, py - ir * 0.5 * open, gs, gs);
};

/** Fills an outline from a flat [x0,y0,x1,y1,...] local polygon. */
export const polyPath = (ctx: Ctx2D, pts: Float32Array, sx: number, sy: number): void => {
  ctx.beginPath();
  ctx.moveTo(pts[0] * sx, pts[1] * sy);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i] * sx, pts[i + 1] * sy);
  ctx.closePath();
};

/** Irregular polygon: n points around an ellipse with radius noise. */
export const shardShape = (r: Rng, n: number, rx: number, ry: number, noise: number, noseBoost: number): Float32Array => {
  const out = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + (rand(r) - 0.5) * (TAU / n) * 0.5;
    let k = 1 + (rand(r) - 0.5) * 2 * noise;
    if (i === 0) k += noseBoost;
    out[i * 2] = Math.cos(a) * rx * k;
    out[i * 2 + 1] = Math.sin(a) * ry * k;
  }
  return out;
};
