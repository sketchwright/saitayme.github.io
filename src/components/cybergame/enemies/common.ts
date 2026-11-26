// Shared primitives for the enemy module: palette, rng, easing, springs,
// glitch tears, corrupted glyph trails, the cached core-glow sprite, the
// spring-driven tracking eye, debris shatter and the optional hit / death /
// spawn-in FX state every enemy carries. Framework-free, Canvas 2D only.

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
const DRED_A = buildAlpha(138, 28, 18);

const rampIdx = (t: number, n: number): number => (t <= 0 ? 0 : t >= 1 ? n : Math.round(t * n));

/** Dim (#8a1c12) to hot (#ff5a2a) core colour. */
export const coreColor = (t: number): string => CORE_RAMP[rampIdx(t, RAMP_STEPS)];
export const orangeA = (a: number): string => ORANGE_A[rampIdx(a, ALPHA_STEPS)];
export const whiteA = (a: number): string => WHITE_A[rampIdx(a, ALPHA_STEPS)];
export const grayA = (a: number): string => GRAY_A[rampIdx(a, ALPHA_STEPS)];
export const hotA = (a: number): string => HOT_A[rampIdx(a, ALPHA_STEPS)];
export const voidA = (a: number): string => VOID_A[rampIdx(a, ALPHA_STEPS)];
export const dredA = (a: number): string => DRED_A[rampIdx(a, ALPHA_STEPS)];

// ---------------------------------------------------------------------------
// Math

export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const easeOutCubic = (t: number): number => 1 - (1 - t) * (1 - t) * (1 - t);
export const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));
export const smooth = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
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

/** Scalar damped spring (stable for stiff settings via substeps). */
export interface Spring {
  x: number;
  v: number;
}
export const makeSpring = (x: number): Spring => ({ x, v: 0 });
/** k = stiffness (1/s^2), z = damping ratio (<1 overshoots). */
export const stepSpring = (s: Spring, target: number, k: number, z: number, dt: number): void => {
  const c = 2 * Math.sqrt(k) * z;
  const n = Math.max(1, Math.ceil(dt * Math.sqrt(k) * 1.2));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    s.v += (k * (target - s.x) - c * s.v) * h;
    s.x += s.v * h;
  }
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
  /** Boss only: 0 Warden, 1 Echo, 2 Rogue Eye (default 2). */
  variant?: number;
}

/** Seconds of the materialise-in effect started by spawnEnemy(). */
export const SPAWN_TIME = 0.32;
/** Death: limbs collapse for this long, then the body shatters. */
export const DEATH_COLLAPSE = 0.3;
/** Death: total length; e.done turns true after this. */
export const DEATH_TIME = 1.05;

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
  /** Hit flash 1 -> 0 (set by hurtEnemy). */
  hurtT: number;
  /** Knockback velocity (decays; added on top of vx/vy). */
  kvx: number;
  kvy: number;
  /** -1 while alive, else seconds into the death animation (killEnemy). */
  deathT: number;
  /** Materialise progress 0..1 (spawnEnemy sets 0; 1 = fully present). */
  spawnT: number;
  /** Shatter pieces (death / boss plates); null when none. */
  debris: Debris | null;
  /** Input sanitising / smoothing state (see robustUpdate). */
  mo: Motion;
  // ---- optional fields the game's AI director may set (all may be missing)
  /** 'shieldBearer' | 'mender' | 'sniper' | 'suppressor' | anything else (ignored) */
  role?: string;
  /** shieldBearer dome radius (px) */
  shieldR?: number;
  /** mender: ally being repaired */
  mendTarget?: Vec | null;
  /** sniper: aim angle (radians) or aim point */
  aim?: number | Vec;
  /** elite affixes: Shielded, Splitting, Phasing, Vampiric, Hasted, Volatile */
  affixes?: string[];
}

export type IntentMode = 'orbit' | 'hold' | 'lunge' | 'evade' | 'surround';

/**
 * Director intent: a mode instead of a raw velocity. Every field optional
 * except mode; missing data falls back to sensible defaults.
 */
export interface EnemyIntent {
  mode: IntentMode;
  /** centre to orbit / surround / lunge at (default: the update target) */
  point?: Vec;
  /** direction the threat is coming from / moving along (evade) */
  threatDir?: Vec;
  /** orbit / surround radius (px) */
  radius?: number;
  /** surround: assigned angle around the point (radians) */
  angle?: number;
}

export const isEnemyIntent = (v: unknown): v is EnemyIntent =>
  !!v && typeof (v as EnemyIntent).mode === 'string';

export interface Motion {
  init: boolean;
  has: boolean;
  ix: number;
  iy: number;
  ivx: number;
  ivy: number;
  px: number;
  py: number;
  /** reused smoothed-intent vector handed to the step function */
  io: Vec;
  /** reused sanitised target */
  to: Vec;
  /** count of snap re-plants (debug / tests) */
  snaps: number;
  /** current director mode (null = raw velocity / own AI) + time in it */
  mode: IntentMode | null;
  modeT: number;
  orbitR: number;
  orbitDir: number;
  surAng: number;
  evX: number;
  evY: number;
  raw: Vec;
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
  trail: makeTrail(14),
  hurtT: 0,
  kvx: 0,
  kvy: 0,
  deathT: -1,
  spawnT: 1,
  debris: null,
  mo: {
    init: false,
    has: false,
    ix: 0,
    iy: 0,
    ivx: 0,
    ivy: 0,
    px: x,
    py: y,
    io: { x: 0, y: 0 },
    to: { x: 0, y: 0 },
    snaps: 0,
    mode: null,
    modeT: 0,
    orbitR: 0,
    orbitDir: 1,
    surAng: 0,
    evX: 0,
    evY: 0,
    raw: { x: 0, y: 0 },
  },
});

/**
 * Walkers turn before they travel: velocity is scaled down while the body
 * still faces away from it, so they never skate sideways or backwards and
 * their planted feet are not dragged across the body by a fast spin.
 */
export const faceTravel = (e: EnemyBase): void => {
  const v = Math.hypot(e.vx, e.vy);
  if (v < 1e-3) return;
  const d = wrapAngle(Math.atan2(e.vy, e.vx) - e.heading);
  const k = clamp((Math.cos(d) + 0.35) / 1.35, 0.12, 1);
  e.vx *= k;
  e.vy *= k;
};

/** Velocity steering toward a desired velocity with snappy accel. */
export const steer = (e: EnemyBase, dvx: number, dvy: number, rate: number, dt: number): void => {
  const k = damp(rate, dt);
  e.vx += (dvx - e.vx) * k;
  e.vy += (dvy - e.vy) * k;
};

/**
 * Shared per-frame FX bookkeeping (hit flash, knockback, spawn-in, debris,
 * death clock). Returns true while the entity is dying.
 */
export const tickFx = (e: EnemyBase, dt: number): boolean => {
  if (e.hurtT > 0) e.hurtT = Math.max(0, e.hurtT - dt / 0.34);
  if (e.spawnT < 1) e.spawnT = Math.min(1, e.spawnT + dt / SPAWN_TIME);
  if (e.kvx !== 0 || e.kvy !== 0) {
    e.x += e.kvx * dt;
    e.y += e.kvy * dt;
    const k = Math.exp(-10 * dt);
    e.kvx *= k;
    e.kvy *= k;
    if (Math.abs(e.kvx) + Math.abs(e.kvy) < 0.5) e.kvx = e.kvy = 0;
  }
  if (e.debris) updateDebris(e.debris, dt);
  if (e.deathT >= 0) {
    e.deathT += dt;
    if (e.deathT >= DEATH_TIME) e.done = true;
    return true;
  }
  return false;
};

/** Generic hit: knockback along (dx,dy), flash, forced glitch tear. */
export const hurtBase = (e: EnemyBase, dx: number, dy: number, strength: number): void => {
  if (e.deathT >= 0) return;
  let d = Math.hypot(dx, dy);
  if (d < 1e-4) {
    const a = rand(e) * TAU;
    dx = Math.cos(a);
    dy = Math.sin(a);
    d = 1;
  }
  const k = e.size * 2.4 * strength;
  e.kvx += (dx / d) * k;
  e.kvy += (dy / d) * k;
  e.hurtT = 1;
  glitchForce(e, 0.6 + strength * 0.4);
};

/** Generic death start: flare the core, heavy tear, glyph burst. */
export const killBase = (e: EnemyBase): void => {
  if (e.deathT >= 0) return;
  e.alive = false;
  e.deathT = 0;
  e.hurtT = 1;
  e.charge = 1;
  glitchForce(e, 1.2);
};

export const spawnBase = (e: EnemyBase): void => {
  e.spawnT = 0;
  glitchForce(e, 0.8);
};

/** Silhouette fill: near-black, or the hit-flash ramp (white > hot > dim red). */
export const silFill = (e: EnemyBase): string =>
  e.hurtT > 0.82 ? PAL.white : e.hurtT > 0.5 ? PAL.coreHot : e.hurtT > 0.28 ? PAL.coreDim : PAL.plate;
/** Edge colour honouring the hit flash. */
export const edgeA = (e: EnemyBase, a: number): string => (e.hurtT > 0.5 ? whiteA(a) : orangeA(a));

// ---------------------------------------------------------------------------
// Glitch: rare, big, readable horizontal tears (2-3 frames) with an RGB-ish
// split using only orange / dark red / off-white.

export interface Glitch {
  next: number;
  sliceT: number;
  sliceY: number; // fraction of size, relative to centre
  sliceH: number; // fraction of size
  sliceDx: number; // px
  y2: number;
  h2: number; // 0 = single band
  dx2: number;
  flick: number;
}

export const makeGlitch = (): Glitch => ({ next: 1 + Math.random() * 3, sliceT: 0, sliceY: 0, sliceH: 0, sliceDx: 0, y2: 0, h2: 0, dx2: 0, flick: 0 });

const rollTear = (e: EnemyBase, amp: number, big: number): void => {
  const g = e.glitch;
  g.sliceT = 0.034 + rand(e) * 0.02; // 2-3 frames
  g.sliceY = randRange(e, -0.5, 0.15);
  g.sliceH = randRange(e, 0.1, 0.24) * big;
  const sgn = rand(e) < 0.5 ? -1 : 1;
  g.sliceDx = sgn * randRange(e, 0.1, 0.2 + amp) * e.size * big;
  if (rand(e) < 0.45) {
    g.y2 = g.sliceY + g.sliceH + randRange(e, 0.04, 0.16);
    g.h2 = randRange(e, 0.05, 0.14) * big;
    g.dx2 = -sgn * randRange(e, 0.06, 0.14) * e.size * big;
  } else g.h2 = 0;
  if (rand(e) < 0.3) g.flick = 0.05;
};

/** rate = glitch events per second (scaled down: rarer but bigger), amp = extra offset fraction. */
export const updateGlitch = (e: EnemyBase, dt: number, rate: number, amp: number): void => {
  const g = e.glitch;
  g.sliceT -= dt;
  g.flick -= dt;
  g.next -= dt * rate * 0.45;
  if (g.next <= 0) {
    g.next = 0.6 + rand(e) * 1.8;
    rollTear(e, amp, 1);
  }
};

/** Forces a tear right now (hits, deaths, phase changes). */
export const glitchForce = (e: EnemyBase, big: number): void => rollTear(e, 0.1, big);

export type DrawFn<E> = (ctx: Ctx2D, e: E, time: number) => void;

const bandPass = <E extends EnemyBase>(ctx: Ctx2D, e: E, time: number, fn: DrawFn<E>, x0: number, w: number, y0: number, y1: number, dx: number): void => {
  if (y1 <= y0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0 + dx, y0, w, y1 - y0);
  ctx.clip();
  ctx.translate(dx, 0);
  fn(ctx, e, time);
  ctx.restore();
};

function drawMaterialise<E extends EnemyBase>(ctx: Ctx2D, e: E, time: number, extent: number, fn: DrawFn<E>): void {
  const p = e.spawnT;
  const N = 6;
  const x0 = e.x - extent;
  const top = e.y - extent;
  const bh = (extent * 2) / N;
  const a0 = ctx.globalAlpha;
  for (let k = 0; k < N; k++) {
    const ord = (k * 4 + (e.seed & 3)) % N;
    const pk = clamp((p - ord * 0.085) / 0.45, 0, 1);
    if (pk <= 0) continue;
    const off = (1 - easeOutCubic(pk)) * extent * 0.9 * (k % 2 ? 1 : -1);
    const y0 = top + k * bh;
    ctx.globalAlpha = a0 * (pk < 1 ? 0.3 + 0.7 * pk : 1);
    bandPass(ctx, e, time, fn, x0, extent * 2, y0, y0 + bh + 0.5, off);
    if (pk < 1) {
      ctx.fillStyle = k % 3 === 0 ? whiteA(1 - pk) : k % 3 === 1 ? orangeA(1 - pk) : dredA(1 - pk);
      ctx.fillRect(e.x - extent * 0.6 + off * 0.5, y0, extent * 1.2, 1);
    }
  }
  ctx.globalAlpha = a0;
}

/**
 * Draws `fn` straight, materialising (spawn-in), or torn: everything outside
 * the tear bands normally, each band shifted sideways; the main band gets a
 * faint echo and a red multiply tint so the tear reads as an RGB split.
 * extent = half-size of the box that must contain everything fn draws.
 */
export function drawGlitched<E extends EnemyBase>(ctx: Ctx2D, e: E, time: number, extent: number, fn: DrawFn<E>): void {
  if (e.spawnT < 1) {
    drawMaterialise(ctx, e, time, extent, fn);
    return;
  }
  const g = e.glitch;
  const flicker = g.flick > 0 && ((time * 60) | 0) % 2 === 0;
  const prevA = ctx.globalAlpha;
  if (flicker) ctx.globalAlpha = prevA * 0.35;
  if (g.sliceT <= 0) {
    fn(ctx, e, time);
    ctx.globalAlpha = prevA;
    return;
  }
  const x0 = e.x - extent;
  const W = extent * 2;
  const top = e.y - extent;
  const bot = e.y + extent;
  const y0 = e.y + g.sliceY * e.size;
  const y1 = y0 + g.sliceH * e.size;
  const two = g.h2 > 0;
  const z0 = two ? e.y + g.y2 * e.size : bot;
  const z1 = two ? z0 + g.h2 * e.size : bot;
  // untouched regions
  ctx.save();
  ctx.beginPath();
  if (y0 > top) ctx.rect(x0, top, W, y0 - top);
  if (z0 > y1) ctx.rect(x0, y1, W, z0 - y1);
  if (bot > z1) ctx.rect(x0, z1, W, bot - z1);
  ctx.clip();
  fn(ctx, e, time);
  ctx.restore();
  // main band: echo + shifted copy + red multiply tint
  if (e.size > 90) {
    // echo copy only on big enemies (cost)
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * 0.35;
    bandPass(ctx, e, time, fn, x0, W, y0, y1, g.sliceDx * 1.7);
    ctx.globalAlpha = a;
  }
  bandPass(ctx, e, time, fn, x0, W, y0, y1, g.sliceDx);
  const op = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = PAL.coreHot;
  ctx.fillRect(e.x - e.size * 0.6 + g.sliceDx, y0, e.size * 1.2, y1 - y0);
  ctx.globalCompositeOperation = op;
  if (two) bandPass(ctx, e, time, fn, x0, W, z0, z1, g.dx2);
  // torn edges: off-white top, dark red + orange offset bottom
  const half = e.size * 0.55;
  ctx.fillStyle = whiteA(0.55);
  ctx.fillRect(e.x - half + g.sliceDx, y0, half * 1.3, 1);
  ctx.fillStyle = dredA(0.9);
  ctx.fillRect(e.x - half * 0.7 + g.sliceDx * 1.4, y1 - 1, half * 1.5, 2);
  ctx.fillStyle = orangeA(0.6);
  ctx.fillRect(e.x - half * 0.2 + g.sliceDx * 0.6, y1 + 1, half, 1);
  ctx.globalAlpha = prevA;
}

// ---------------------------------------------------------------------------
// Corrupted glyph trail (ring buffer; glyphs drift when burst out)

export const GLYPH_STRING =
  '0123456789ABCDEF#%&$@<>/\\|=+*░▒▓┼┤├┬┴╳╱╲═║ｦｱｲｳｴｵｶｷｸｹｺｻｼｽﾀﾁﾂﾃﾄﾅﾆﾇﾈﾊﾋﾌﾍﾎ';
export const GLYPHS: string[] = Array.from(GLYPH_STRING);

export interface Trail {
  n: number;
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
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
  vx: new Float32Array(n),
  vy: new Float32Array(n),
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
  const vk = Math.exp(-4 * dt);
  for (let i = 0; i < tr.n; i++) {
    if (tr.life[i] > 0) {
      tr.life[i] -= dt * 2.2;
      if (tr.life[i] > 0) {
        live++;
        tr.x[i] += tr.vx[i] * dt;
        tr.y[i] += tr.vy[i] * dt;
        tr.vx[i] *= vk;
        tr.vy[i] *= vk;
        if (rand(e) < 0.08) tr.ch[i] = (rand(e) * GLYPHS.length) | 0;
      }
    }
  }
  const sp = Math.hypot(e.vx, e.vy);
  if (sp > minSpeed && e.deathT < 0) {
    tr.acc += dt * 11 * Math.min(2.5, sp / minSpeed);
    while (tr.acc >= 1) {
      tr.acc -= 1;
      const i = tr.head;
      tr.head = (tr.head + 1) % tr.n;
      const j = e.size * 0.22;
      tr.x[i] = e.x - (e.vx / sp) * e.size * 0.3 + (rand(e) - 0.5) * j;
      tr.y[i] = e.y - (e.vy / sp) * e.size * 0.3 + (rand(e) - 0.5) * j;
      tr.vx[i] = 0;
      tr.vy[i] = 0;
      tr.life[i] = 1;
      tr.ch[i] = (rand(e) * GLYPHS.length) | 0;
      live++;
    }
  } else tr.acc = 0;
  tr.live = live;
};

/** Radial burst of glyphs (death / phase change). */
export const burstGlyphs = (e: EnemyBase, x: number, y: number, n: number, speed: number): void => {
  const tr = e.trail;
  for (let k = 0; k < n; k++) {
    const i = tr.head;
    tr.head = (tr.head + 1) % tr.n;
    const a = (k / n) * TAU + rand(e) * 0.6;
    const s = speed * (0.45 + rand(e) * 0.75);
    tr.x[i] = x;
    tr.y[i] = y;
    tr.vx[i] = Math.cos(a) * s;
    tr.vy[i] = Math.sin(a) * s;
    tr.life[i] = 1.35;
    tr.ch[i] = (rand(e) * GLYPHS.length) | 0;
  }
  tr.live = tr.n;
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
  ctx.font = monoFont(e.size * 0.2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const a0 = ctx.globalAlpha;
  for (let i = 0; i < tr.n; i++) {
    const l = tr.life[i];
    if (l <= 0) continue;
    ctx.fillStyle = l > 0.86 ? whiteA(0.8 * a0) : l > 0.4 ? orangeA(l * 0.85 * a0) : dredA(l * 2.2 * a0);
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
// Tracking eye: spring-damped pupil (lag + slight overshoot), discrete
// saccades with occasional rapid double-twitches, smooth pursuit between
// them, pupil dilation on charge, and a second lid that opens on charge.

export interface EyeTrack {
  ox: number;
  oy: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
  timer: number;
  sacc: number;
  blink: number; // openness 1 = open
  blinkP: number; // -1 idle, else 0..1 blink progress
  blinkT: number;
  /** pupil dilation 0..1 (follows charge) */
  dil: number;
  /** second (charge) eye openness 0..1 */
  open2: number;
}

export const makeEye = (): EyeTrack => ({
  ox: 0,
  oy: 0,
  vx: 0,
  vy: 0,
  tx: 0,
  ty: 0,
  timer: Math.random() * 0.5,
  sacc: 0,
  blink: 1,
  blinkP: -1,
  blinkT: 2 + Math.random() * 3,
  dil: 0.2,
  open2: 0,
});

export const updateEye = (eye: EyeTrack, r: Rng, ex: number, ey: number, target: Vec, dt: number, jitter: number, charge = 0): void => {
  const dx = target.x - ex;
  const dy = target.y - ey;
  const d = Math.hypot(dx, dy) || 1;
  const m = Math.min(1, d / 60) * 0.85;
  const ax = (dx / d) * m;
  const ay = (dy / d) * m;
  eye.timer -= dt;
  eye.sacc -= dt;
  if (eye.timer <= 0) {
    eye.sacc = 0.06;
    if (rand(r) < 0.16) {
      // rapid twitch: dart off-target, snap back almost immediately
      eye.tx = ax + (rand(r) - 0.5) * (0.9 + jitter);
      eye.ty = ay + (rand(r) - 0.5) * (0.9 + jitter);
      eye.timer = 0.05 + rand(r) * 0.05;
    } else {
      eye.tx = ax + (rand(r) - 0.5) * jitter;
      eye.ty = ay + (rand(r) - 0.5) * jitter;
      eye.timer = 0.3 + rand(r) * 1.1;
    }
  } else {
    // smooth pursuit between saccades
    const k = damp(1.6, dt);
    eye.tx += (ax - eye.tx) * k;
    eye.ty += (ay - eye.ty) * k;
  }
  const kk = eye.sacc > 0 ? 1700 : 210;
  const c = 2 * Math.sqrt(kk) * (eye.sacc > 0 ? 0.8 : 0.55);
  const n = Math.max(1, Math.ceil(dt * Math.sqrt(kk) * 1.2));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    eye.vx += (kk * (eye.tx - eye.ox) - c * eye.vx) * h;
    eye.vy += (kk * (eye.ty - eye.oy) - c * eye.vy) * h;
    eye.ox += eye.vx * h;
    eye.oy += eye.vy * h;
  }
  const lim = Math.hypot(eye.ox, eye.oy);
  if (lim > 1) {
    eye.ox /= lim;
    eye.oy /= lim;
  }
  eye.dil += (0.12 + charge * 0.88 - eye.dil) * damp(7, dt);
  eye.open2 += ((charge > 0.28 ? 1 : 0) - eye.open2) * damp(charge > 0.28 ? 9 : 6, dt);
  eye.blinkT -= dt;
  if (eye.blinkT <= 0 && eye.blinkP < 0) {
    eye.blinkT = 1.8 + rand(r) * 4;
    eye.blinkP = 0;
  }
  if (eye.blinkP >= 0) {
    eye.blinkP += dt / 0.17;
    if (eye.blinkP >= 1) {
      eye.blinkP = -1;
      eye.blink = 1;
    } else eye.blink = 1 - Math.sin(Math.PI * Math.pow(eye.blinkP, 0.6));
  }
};

/** Almond (pointed) socket path; axis angle = long axis. */
export const almondPath = (ctx: Ctx2D, x: number, y: number, rl: number, rh: number, ca: number, sa: number): void => {
  ctx.beginPath();
  ctx.moveTo(x - ca * rl, y - sa * rl);
  ctx.quadraticCurveTo(x + sa * rh * 2, y - ca * rh * 2, x + ca * rl, y + sa * rl);
  ctx.quadraticCurveTo(x - sa * rh * 2, y + ca * rh * 2, x - ca * rl, y - sa * rl);
  ctx.closePath();
};

/**
 * Almond socket + iris + slit/round pupil (dilates with eye.dil) + glint.
 * r = socket half-length in px. slit = 0 round pupil, 1 vertical slit.
 * rot = long-axis angle of the socket (0 = horizontal).
 */
export const drawEye = (ctx: Ctx2D, x: number, y: number, r: number, eye: EyeTrack, charge: number, slit: number, rot = 0): void => {
  const open = Math.max(0.06, eye.blink);
  const ca = Math.cos(rot);
  const sa = Math.sin(rot);
  const rh = r * 0.62 * open;
  almondPath(ctx, x, y, r, rh, ca, sa);
  ctx.fillStyle = PAL.void;
  ctx.fill();
  ctx.lineWidth = Math.max(0.8, r * 0.14);
  ctx.strokeStyle = coreColor(0.3 + charge * 0.7);
  ctx.stroke();
  if (open < 0.2) return;
  const px = x + eye.ox * r * 0.42;
  const py = y + eye.oy * r * 0.42;
  const ir = r * 0.6;
  const vis = Math.min(1, open * 1.15);
  ctx.fillStyle = coreColor(0.15 + charge * 0.85);
  ctx.beginPath();
  ctx.ellipse(px, py, ir, ir * vis, rot, 0, TAU);
  ctx.fill();
  if (r > 3.2) {
    ctx.strokeStyle = voidA(0.55);
    ctx.lineWidth = Math.max(0.6, r * 0.07);
    ctx.beginPath();
    ctx.ellipse(px, py, ir * 0.76, ir * 0.76 * vis, rot, 0, TAU);
    ctx.stroke();
  }
  const round = ir * (0.24 + eye.dil * 0.38);
  const pw = lerp(round, ir * (0.12 + eye.dil * 0.4), slit);
  const ph = lerp(round, ir * 0.95, slit) * vis;
  ctx.fillStyle = PAL.void;
  ctx.beginPath();
  ctx.ellipse(px + eye.ox * r * 0.06, py + eye.oy * r * 0.06, pw, ph, rot, 0, TAU);
  ctx.fill();
  const gs = Math.max(1, r * 0.17);
  ctx.fillStyle = whiteA(0.92);
  ctx.fillRect(px - ca * ir * 0.42 + sa * ir * 0.35 - gs * 0.5, py - sa * ir * 0.42 - ca * ir * 0.35 * vis - gs * 0.5, gs, gs);
};

/**
 * Secondary eye that only opens while charging (eye.open2). Closed it reads
 * as a seam; open it is a thin hot slit.
 */
export const drawChargeEye = (ctx: Ctx2D, x: number, y: number, r: number, eye: EyeTrack, charge: number, rot = 0): void => {
  const ca = Math.cos(rot);
  const sa = Math.sin(rot);
  const o = eye.open2;
  if (o < 0.08) {
    ctx.strokeStyle = orangeA(0.45);
    ctx.lineWidth = Math.max(0.7, r * 0.2);
    ctx.beginPath();
    ctx.moveTo(x - ca * r, y - sa * r);
    ctx.lineTo(x + ca * r, y + sa * r);
    ctx.stroke();
    return;
  }
  almondPath(ctx, x, y, r, r * 0.55 * o, ca, sa);
  ctx.fillStyle = coreColor(0.4 + charge * 0.6);
  ctx.fill();
  ctx.lineWidth = Math.max(0.7, r * 0.16);
  ctx.strokeStyle = orangeA(0.9);
  ctx.stroke();
  ctx.fillStyle = PAL.void;
  ctx.beginPath();
  ctx.ellipse(x + eye.ox * r * 0.35, y + eye.oy * r * 0.35, r * (0.1 + eye.dil * 0.14), r * 0.5 * o, rot, 0, TAU);
  ctx.fill();
};

// ---------------------------------------------------------------------------
// Polygons

/** Fills an outline from a flat [x0,y0,x1,y1,...] local polygon. */
export const polyPath = (ctx: Ctx2D, pts: Float32Array, sx: number, sy: number): void => {
  ctx.beginPath();
  ctx.moveTo(pts[0] * sx, pts[1] * sy);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i] * sx, pts[i + 1] * sy);
  ctx.closePath();
};

/** Appends a closed sub-path (no beginPath) with an offset; for batching plates. */
export const polySub = (ctx: Ctx2D, pts: Float32Array, ox: number, oy: number): void => {
  ctx.moveTo(pts[0] + ox, pts[1] + oy);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i] + ox, pts[i + 1] + oy);
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

/** Scales a literal polygon by u with optional per-vertex jitter from rng. */
export const scaledPoly = (r: Rng, pts: number[], u: number, jit: number): Float32Array => {
  const out = new Float32Array(pts.length);
  for (let i = 0; i < pts.length; i++) out[i] = (pts[i] + (jit > 0 ? (rand(r) - 0.5) * jit : 0)) * u;
  return out;
};

// ---------------------------------------------------------------------------
// Debris: fan-triangulated polygon shards that fly apart, spin and fade.

export interface Debris {
  n: number;
  max: number;
  px: Float32Array;
  py: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  rot: Float32Array;
  vr: Float32Array;
  v: Float32Array; // 6 local coords per piece
  t: number;
  dur: number;
}

export const makeDebris = (max: number, dur: number): Debris => ({
  n: 0,
  max,
  px: new Float32Array(max),
  py: new Float32Array(max),
  vx: new Float32Array(max),
  vy: new Float32Array(max),
  rot: new Float32Array(max),
  vr: new Float32Array(max),
  v: new Float32Array(max * 6),
  t: 0,
  dur,
});

/** Ensures e.debris exists (reset if finished) and returns it. */
export const ensureDebris = (e: EnemyBase, max: number, dur: number): Debris => {
  let d = e.debris;
  if (!d || d.max < max) d = e.debris = makeDebris(max, dur);
  else if (d.t >= d.dur) {
    d.n = 0;
    d.t = 0;
  }
  d.dur = Math.max(d.dur - d.t, dur);
  return d;
};

/**
 * Splits a local polygon (transform tx,ty,ang,scale) into fan triangles that
 * fly away from (ox,oy). Pieces inherit (ivx,ivy).
 */
export function addDebrisPoly(
  d: Debris,
  poly: Float32Array,
  tx: number,
  ty: number,
  ang: number,
  scale: number,
  ox: number,
  oy: number,
  speed: number,
  ivx: number,
  ivy: number,
  r: Rng,
): void {
  const m = poly.length >> 1;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < m; i++) {
    cx += poly[i * 2];
    cy += poly[i * 2 + 1];
  }
  cx /= m;
  cy /= m;
  const c = Math.cos(ang) * scale;
  const s = Math.sin(ang) * scale;
  const step = m > 6 ? 2 : 1; // big polys -> fewer, chunkier shards
  for (let i = 0; i < m && d.n < d.max; i += step) {
    const j = (i + step) % m;
    const ax = poly[i * 2] - cx;
    const ay = poly[i * 2 + 1] - cy;
    const bx = poly[j * 2] - cx;
    const by = poly[j * 2 + 1] - cy;
    const gx = (ax + bx) / 3;
    const gy = (ay + by) / 3;
    const k = d.n++;
    const lx = cx + gx;
    const ly = cy + gy;
    const wx = tx + c * lx - s * ly;
    const wy = ty + s * lx + c * ly;
    d.px[k] = wx;
    d.py[k] = wy;
    let dx = wx - ox;
    let dy = wy - oy;
    const dl = Math.hypot(dx, dy) || 1;
    dx /= dl;
    dy /= dl;
    const sp = speed * (0.55 + rand(r) * 0.9);
    d.vx[k] = dx * sp + ivx + (rand(r) - 0.5) * speed * 0.3;
    d.vy[k] = dy * sp + ivy + (rand(r) - 0.5) * speed * 0.3;
    d.rot[k] = 0;
    d.vr[k] = (rand(r) - 0.5) * 16;
    // local verts relative to piece centroid, pre-rotated
    const o = k * 6;
    const p0x = -gx;
    const p0y = -gy;
    const p1x = ax - gx;
    const p1y = ay - gy;
    const p2x = bx - gx;
    const p2y = by - gy;
    d.v[o] = c * p0x - s * p0y;
    d.v[o + 1] = s * p0x + c * p0y;
    d.v[o + 2] = c * p1x - s * p1y;
    d.v[o + 3] = s * p1x + c * p1y;
    d.v[o + 4] = c * p2x - s * p2y;
    d.v[o + 5] = s * p2x + c * p2y;
  }
}

export const updateDebris = (d: Debris, dt: number): void => {
  d.t += dt;
  const k = Math.exp(-2.6 * dt);
  const kr = Math.exp(-1.2 * dt);
  for (let i = 0; i < d.n; i++) {
    d.px[i] += d.vx[i] * dt;
    d.py[i] += d.vy[i] * dt;
    d.vx[i] *= k;
    d.vy[i] *= k;
    d.rot[i] += d.vr[i] * dt;
    d.vr[i] *= kr;
  }
};

/** Batched: near-black shards with orange edges; flicker + shrink as they die. */
export const drawDebris = (ctx: Ctx2D, d: Debris | null, time: number): void => {
  if (!d || d.n === 0 || d.t >= d.dur) return;
  const p = d.t / d.dur;
  const sc = 1 - p * 0.45;
  ctx.beginPath();
  for (let i = 0; i < d.n; i++) {
    if (p > 0.6 && ((i * 7 + ((time * 30) | 0)) & 3) === 0) continue; // break-up flicker
    const c = Math.cos(d.rot[i]) * sc;
    const s = Math.sin(d.rot[i]) * sc;
    const o = i * 6;
    const x = d.px[i];
    const y = d.py[i];
    ctx.moveTo(x + c * d.v[o] - s * d.v[o + 1], y + s * d.v[o] + c * d.v[o + 1]);
    ctx.lineTo(x + c * d.v[o + 2] - s * d.v[o + 3], y + s * d.v[o + 2] + c * d.v[o + 3]);
    ctx.lineTo(x + c * d.v[o + 4] - s * d.v[o + 5], y + s * d.v[o + 4] + c * d.v[o + 5]);
    ctx.closePath();
  }
  ctx.fillStyle = p < 0.12 ? PAL.coreHot : PAL.void;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = p < 0.25 ? whiteA(0.9) : orangeA((1 - p) * 0.9);
  ctx.stroke();
};

// ---------------------------------------------------------------------------
// Robust update wrapper: every type's public updateX() goes through this.
// - dt: non-finite / <= 0 ignored, capped at MAX_DT, substepped at <= 1/30 s
// - intent: non-finite ignored, magnitude clamped, followed by a critically
//   damped spring (no steps / reversals reach the body in one frame)
// - velocity clamped per type; NaN state recovered
// - heading change capped per substep (never flips 180 deg at once)
// - teleports (between calls) and huge per-substep jumps re-plant the pose
//   (reset callback) instead of stretching legs / tendrils

export const MAX_DT = 0.1;
export const SUB_DT = 1 / 30;
const INTENT_W = 9; // spring angular frequency (1/s), critically damped

export type StepFn<E> = (e: E, dt: number, target: Vec, intent: Vec | null) => void;
export type ModeFn<E> = (e: E, mode: IntentMode) => void;

const EVADE_TIME = 0.38;

/** Mode entry: pick an orbit radius / direction, surround angle, evade side. */
const enterMode = (e: EnemyBase, it: EnemyIntent, c: Vec): void => {
  const m = e.mo;
  const dx = e.x - c.x;
  const dy = e.y - c.y;
  const d = Math.hypot(dx, dy) || 1;
  m.orbitR = it.radius && it.radius > 0 ? it.radius : clamp(d, e.size * 1.6, e.size * 4.5);
  m.orbitDir = (e.seed & 1) === 0 ? 1 : -1;
  m.surAng = it.angle !== undefined && Number.isFinite(it.angle) ? it.angle : Math.atan2(dy, dx) + ((e.seed * 2.39996) % 1) * 0.6;
  // evade: sidestep perpendicular to the threat, toward the side we already lean
  let tx = it.threatDir?.x ?? -dx / d;
  let ty = it.threatDir?.y ?? -dy / d;
  const tl = Math.hypot(tx, ty) || 1;
  tx /= tl;
  ty /= tl;
  let px = -ty;
  let py = tx;
  if (px * e.vx + py * e.vy < 0 || (Math.abs(e.vx) + Math.abs(e.vy) < 1 && (e.seed & 2) === 0)) {
    px = -px;
    py = -py;
  }
  m.evX = px;
  m.evY = py;
};

/** Desired velocity for a director mode (written into e.mo.raw). */
const resolveIntent = (e: EnemyBase, it: EnemyIntent, target: Vec, cruise: number): Vec => {
  const m = e.mo;
  const out = m.raw;
  const c = it.point && Number.isFinite(it.point.x) && Number.isFinite(it.point.y) ? it.point : target;
  const dx = e.x - c.x;
  const dy = e.y - c.y;
  const d = Math.hypot(dx, dy) || 1;
  const rx = dx / d;
  const ry = dy / d;
  switch (it.mode) {
    case 'orbit': {
      // circle-strafe: tangential cruise + radial correction toward the ring
      const r = it.radius && it.radius > 0 ? it.radius : m.orbitR;
      const radial = clamp((r - d) * 1.6, -cruise, cruise);
      out.x = -ry * m.orbitDir * cruise + rx * radial;
      out.y = rx * m.orbitDir * cruise + ry * radial;
      break;
    }
    case 'surround': {
      const r = it.radius && it.radius > 0 ? it.radius : m.orbitR;
      const a = it.angle !== undefined && Number.isFinite(it.angle) ? it.angle : m.surAng;
      const gx = c.x + Math.cos(a) * r - e.x;
      const gy = c.y + Math.sin(a) * r - e.y;
      const gd = Math.hypot(gx, gy) || 1;
      const sp = Math.min(cruise, gd * 2.2); // arrive and settle
      out.x = (gx / gd) * sp;
      out.y = (gy / gd) * sp;
      break;
    }
    case 'lunge': {
      // close in while the type's own wind-up / burst plays
      const sp = Math.min(cruise * 0.7, d * 2);
      out.x = -rx * sp;
      out.y = -ry * sp;
      break;
    }
    case 'evade': {
      const k = m.modeT < EVADE_TIME ? 1 - (m.modeT / EVADE_TIME) * (m.modeT / EVADE_TIME) : 0;
      out.x = m.evX * cruise * 2.1 * k;
      out.y = m.evY * cruise * 2.1 * k;
      break;
    }
    default:
      out.x = 0;
      out.y = 0;
  }
  return out;
};

export function robustUpdate<E extends EnemyBase>(
  e: E,
  dt: number,
  target: Vec,
  intent: Vec | EnemyIntent | null | undefined,
  maxIntent: number,
  maxSpeed: number,
  maxTurn: number,
  step: StepFn<E>,
  reset: (e: E) => void,
  onMode?: ModeFn<E>,
): void {
  if (!(dt > 0)) return;
  if (dt > MAX_DT) dt = MAX_DT;
  const m = e.mo;
  const snapDist = Math.max(16, e.size * 0.45); // ~1.5x a walker stride
  // corrupted state
  if (!Number.isFinite(e.x) || !Number.isFinite(e.y)) {
    e.x = Number.isFinite(m.px) ? m.px : 0;
    e.y = Number.isFinite(m.py) ? m.py : 0;
    e.vx = e.vy = e.kvx = e.kvy = 0;
    m.init = false;
  }
  if (!Number.isFinite(e.vx) || !Number.isFinite(e.vy)) e.vx = e.vy = 0;
  if (!Number.isFinite(e.heading)) e.heading = 0;
  // teleported since last update (or first update after create / bad state)
  if (!m.init || Math.hypot(e.x - m.px, e.y - m.py) > snapDist) {
    if (m.init) {
      m.snaps++;
      glitchForce(e, 0.7);
    }
    reset(e);
  }
  const to = m.to;
  if (Number.isFinite(target.x) && Number.isFinite(target.y)) {
    to.x = target.x;
    to.y = target.y;
  } else {
    to.x = e.x;
    to.y = e.y;
  }
  // director modes: track entry (pick radius / side / angle, fire hooks)
  const dIntent = isEnemyIntent(intent) ? intent : null;
  const mode = dIntent ? dIntent.mode : null;
  if (mode !== m.mode) {
    m.mode = mode;
    m.modeT = 0;
    if (dIntent) {
      enterMode(e, dIntent, dIntent.point ?? to);
      if (onMode && e.deathT < 0) onMode(e, dIntent.mode);
    }
  }
  const cruise = maxIntent * 0.62;
  const n = Math.max(1, Math.ceil(dt / SUB_DT - 1e-6));
  const h = dt / n;
  for (let s = 0; s < n; s++) {
    let it: Vec | null = null;
    let src: Vec | null = null;
    let cap = maxIntent;
    if (dIntent) {
      src = resolveIntent(e, dIntent, to, cruise);
      if (dIntent.mode === 'evade') cap = maxIntent * 2.2;
      m.modeT += h;
    } else if (intent && Number.isFinite((intent as Vec).x) && Number.isFinite((intent as Vec).y)) src = intent as Vec;
    if (src) {
      let ix = src.x;
      let iy = src.y;
      const l = Math.hypot(ix, iy);
      if (l > cap) {
        ix *= cap / l;
        iy *= cap / l;
      }
      if (!m.has) {
        m.has = true;
        m.ix = clamp(e.vx, -maxIntent, maxIntent);
        m.iy = clamp(e.vy, -maxIntent, maxIntent);
        m.ivx = m.ivy = 0;
      }
      const w = dIntent && dIntent.mode === 'evade' ? INTENT_W * 2 : INTENT_W;
      m.ivx += (w * w * (ix - m.ix) - 2 * w * m.ivx) * h;
      m.ivy += (w * w * (iy - m.iy) - 2 * w * m.ivy) * h;
      m.ix += m.ivx * h;
      m.iy += m.ivy * h;
      m.io.x = m.ix;
      m.io.y = m.iy;
      it = m.io;
    } else m.has = false;
    const ox = e.x;
    const oy = e.y;
    const oh = e.heading;
    step(e, h, to, it);
    if (!Number.isFinite(e.x) || !Number.isFinite(e.y) || !Number.isFinite(e.vx) || !Number.isFinite(e.vy)) {
      e.x = ox;
      e.y = oy;
      e.vx = e.vy = 0;
      reset(e);
    }
    const sp = Math.hypot(e.vx, e.vy);
    if (sp > maxSpeed) {
      e.vx *= maxSpeed / sp;
      e.vy *= maxSpeed / sp;
    }
    if (!Number.isFinite(e.heading)) e.heading = oh;
    const dh = wrapAngle(e.heading - oh);
    const mt = maxTurn * h;
    if (dh > mt) e.heading = oh + mt;
    else if (dh < -mt) e.heading = oh - mt;
    if (Math.hypot(e.x - ox, e.y - oy) > snapDist) {
      m.snaps++;
      reset(e);
    }
  }
  m.px = e.x;
  m.py = e.y;
  m.init = true;
}
