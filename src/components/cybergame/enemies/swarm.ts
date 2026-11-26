// SWARM-NODE: a cluster of isometric data cubes on a broken hex lattice
// (some cells missing, loose orphan cubes drifting off), bonded to a core
// cube holding the single eye. Cells breathe, glitch-snap out of place and
// ease back; a bracket cage turns around them. On death it shakes apart
// (beginSplit) and each outer cube becomes a FRAGMENT: a tiny darting cube
// with whip tails and one eye.

import {
  CreateOpts,
  Ctx2D,
  DEATH_COLLAPSE,
  EnemyBase,
  EyeTrack,
  PAL,
  TAU,
  Vec,
  addDebrisPoly,
  burstGlyphs,
  clamp,
  coreColor,
  damp,
  drawChargeEye,
  drawDebris,
  drawEye,
  drawGlitched,
  drawGlow,
  drawTrail,
  edgeA,
  ensureDebris,
  grayA,
  hurtBase,
  killBase,
  makeBase,
  makeEye,
  orangeA,
  rand,
  randRange,
  silFill,
  steer,
  tickFx,
  turnToward,
  updateEye,
  updateGlitch,
  updateTrail,
  whiteA,
  robustUpdate,
  EnemyIntent,
  IntentMode,
} from './common';
import { Tendril, drawTendrilDebug, drawTendrils, initTendril, makeTendril, updateTendril, whipTendril } from './tendril';

export const SWARM_SIZE = 52;
export const FRAGMENT_SIZE = 22;
const SPLIT_TIME = 0.45;
const BURST_TIME = 0.4;

// ---------------------------------------------------------------------------
// Cube primitives (pointy-top hexagon seen as an isometric cube)

const HEX = new Float32Array(12);
const hexFill = (rot: number): void => {
  for (let k = 0; k < 6; k++) {
    const a = rot - Math.PI / 2 + (k * TAU) / 6;
    HEX[k * 2] = Math.cos(a);
    HEX[k * 2 + 1] = Math.sin(a);
  }
};
const cubeOutline = (ctx: Ctx2D, x: number, y: number, r: number, rot: number): void => {
  hexFill(rot);
  ctx.moveTo(x + HEX[0] * r, y + HEX[1] * r);
  for (let k = 1; k < 6; k++) ctx.lineTo(x + HEX[k * 2] * r, y + HEX[k * 2 + 1] * r);
  ctx.closePath();
};
/** top face rhombus: centre, v5, v0, v1 */
const cubeTop = (ctx: Ctx2D, x: number, y: number, r: number, rot: number): void => {
  hexFill(rot);
  ctx.moveTo(x, y);
  ctx.lineTo(x + HEX[10] * r, y + HEX[11] * r);
  ctx.lineTo(x + HEX[0] * r, y + HEX[1] * r);
  ctx.lineTo(x + HEX[2] * r, y + HEX[3] * r);
  ctx.closePath();
};
/** inner Y: centre to v1, v3, v5 */
const cubeY = (ctx: Ctx2D, x: number, y: number, r: number, rot: number): void => {
  hexFill(rot);
  for (let k = 1; k < 6; k += 2) {
    ctx.moveTo(x, y);
    ctx.lineTo(x + HEX[k * 2] * r, y + HEX[k * 2 + 1] * r);
  }
};
const hexPoly = (r: number): Float32Array => {
  const out = new Float32Array(12);
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI / 2 + (k * TAU) / 6;
    out[k * 2] = Math.cos(a) * r;
    out[k * 2 + 1] = Math.sin(a) * r;
  }
  return out;
};

// ---------------------------------------------------------------------------
// Fragment

const F_LAUNCH = 0;
const F_HOLD = 1;
const F_DART = 2;

export interface Fragment extends EnemyBase {
  kind: 'fragment';
  shape: Float32Array;
  tails: Tendril[];
  eye: EyeTrack;
  mode: number;
  modeT: number;
  dur: number;
  spin: number;
  flash: number;
  cubeRot: number;
}

export function createFragment(x: number, y: number, seed: number, opts?: CreateOpts): Fragment {
  const size = opts?.size ?? FRAGMENT_SIZE;
  const b = makeBase(x, y, seed, size);
  const u = size / 22;
  const tails: Tendril[] = [];
  for (let i = 0; i < 2; i++) {
    const td = makeTendril(5 + i, randRange(b, 2.6, 3.6) * u, 1.1, randRange(b, 4, 6.5), rand(b) * TAU, 0.11);
    td.dampK = 0.91;
    initTendril(td, x, y, -Math.PI / 2);
    tails.push(td);
  }
  return {
    ...b,
    kind: 'fragment',
    shape: hexPoly(4.6 * u),
    tails,
    eye: makeEye(),
    mode: F_HOLD,
    modeT: 0,
    dur: 0.3,
    spin: 0,
    flash: 0,
    cubeRot: rand(b) * TAU,
  };
}

/** Darts straight at the target after a short freeze. */
export function fragmentDart(e: Fragment): void {
  if (e.deathT >= 0) return;
  e.mode = F_HOLD;
  e.modeT = 0;
  e.dur = 0.18;
  e.charge = 0.6;
}

export function hurtFragment(e: Fragment, dx: number, dy: number, strength = 1): void {
  if (e.deathT >= 0) return;
  hurtBase(e, dx, dy, strength * 1.4);
  e.spin += (rand(e) - 0.5) * 30;
  for (const td of e.tails) whipTendril(td, 2 * (e.size / 22), 0);
}

export function killFragment(e: Fragment): void {
  killBase(e);
}

const resetFragment = (e: Fragment): void => {
  for (const td of e.tails) initTendril(td, e.x, e.y, e.heading + Math.PI);
};

/** Robust public update (see robustUpdate). */
const modeFragment = (e: Fragment, mode: IntentMode): void => {
  if (mode === 'lunge') fragmentDart(e);
};

/** Robust public update (see robustUpdate). */
export function updateFragment(e: Fragment, dt: number, target: Vec, intent?: Vec | EnemyIntent | null): void {
  const u = e.size / 22;
  robustUpdate(e, dt, target, intent, 300 * u, 420 * u, 40, stepFragment, resetFragment, modeFragment);
}

function stepFragment(e: Fragment, dt: number, target: Vec, intent: Vec | null): void {
  e.t += dt;
  const u = e.size / 22;
  const dyingNow = tickFx(e, dt);
  if (dyingNow) {
    steer(e, 0, 0, 6, dt);
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.cubeRot += dt * 14;
    if (e.deathT >= DEATH_COLLAPSE * 0.5 && !e.debris) {
      const d = ensureDebris(e, 6, 0.6);
      addDebrisPoly(d, e.shape, e.x, e.y, e.cubeRot, 1, e.x, e.y, 90 * u, e.vx, e.vy, e);
      burstGlyphs(e, e.x, e.y, 5, 90 * u);
    }
    updateGlitch(e, dt, 3.5, 0.2);
    updateTrail(e, dt, 1e9);
    return;
  }
  e.modeT += dt;
  const dx = target.x - e.x;
  const dy = target.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  switch (e.mode) {
    case F_LAUNCH:
      steer(e, 0, 0, 3.5, dt);
      e.heading += e.spin * dt;
      e.spin *= Math.exp(-4 * dt);
      if (e.modeT > 0.45) {
        e.mode = F_HOLD;
        e.modeT = 0;
        e.dur = randRange(e, 0.1, 0.3);
      }
      break;
    case F_HOLD:
      steer(e, 0, 0, 20, dt);
      e.charge = Math.min(1, e.charge + dt * 2.5);
      if (rand(e) < dt * 12) e.heading = turnToward(e.heading, Math.atan2(dy, dx), 0.6);
      if (e.modeT > e.dur) {
        e.mode = F_DART;
        e.modeT = 0;
        e.dur = randRange(e, 0.18, 0.32);
        let a = Math.atan2(dy, dx);
        if (intent) a = Math.atan2(intent.y, intent.x);
        else if (dist < 30 * u) a += Math.PI * 0.5 * (rand(e) < 0.5 ? 1 : -1);
        else a += randRange(e, -0.7, 0.7);
        const sp = intent ? Math.hypot(intent.x, intent.y) * 1.6 : randRange(e, 180, 260) * u;
        e.vx = Math.cos(a) * sp;
        e.vy = Math.sin(a) * sp;
        e.heading = a;
        for (const td of e.tails) whipTendril(td, (rand(e) < 0.5 ? -1 : 1) * 1.6 * u, 0.03);
      }
      break;
    default:
      steer(e, 0, 0, 5, dt);
      e.charge += (0 - e.charge) * damp(6, dt);
      if (e.modeT > e.dur) {
        e.mode = F_HOLD;
        e.modeT = 0;
        e.dur = randRange(e, 0.08, 0.4);
      }
  }
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  e.flash = Math.max(0, e.flash - dt * 3);
  // cube tumbles in 60deg snaps while holding, spins while launched
  const goal = Math.round(e.cubeRot / (TAU / 6)) * (TAU / 6);
  e.cubeRot += e.mode === F_LAUNCH ? e.spin * dt : (goal - e.cubeRot) * damp(12, dt);
  if (e.mode === F_HOLD && rand(e) < dt * 2) e.cubeRot += TAU / 12;
  const c = Math.cos(e.heading);
  const s = Math.sin(e.heading);
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    const ax = e.x - c * 3.5 * u - s * side * 2 * u;
    const ay = e.y - s * 3.5 * u + c * side * 2 * u;
    updateTendril(e.tails[i], ax, ay, e.heading + Math.PI + side * 0.35, dt, e.t, 1, 1, 1);
  }
  updateEye(e.eye, e, e.x, e.y, target, dt, 0.3, e.charge);
  updateGlitch(e, dt, 0.6, 0.1);
  updateTrail(e, dt, 140 * u);
}

function drawFragBody(ctx: Ctx2D, e: Fragment, _time: number): void {
  const u = e.size / 22;
  const w = Math.max(0.7, 0.8 * Math.sqrt(u));
  const dying = e.deathT >= 0;
  drawTendrils(ctx, e.tails, 2, w * 1.4, w * 0.8, dying ? 0.4 : 1, 0);
  if (e.debris) return;
  const r = 4.6 * u;
  const fill = e.flash > 0.5 ? PAL.coreHot : silFill(e);
  ctx.beginPath();
  cubeOutline(ctx, e.x, e.y, r, e.cubeRot);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = Math.max(1, w);
  ctx.strokeStyle = edgeA(e, 0.9);
  ctx.stroke();
  ctx.beginPath();
  cubeTop(ctx, e.x, e.y, r, e.cubeRot);
  ctx.fillStyle = PAL.bodyHi;
  ctx.fill();
  ctx.beginPath();
  cubeY(ctx, e.x, e.y, r, e.cubeRot);
  ctx.strokeStyle = PAL.grayMid;
  ctx.lineWidth = Math.max(0.6, w * 0.7);
  ctx.stroke();
  drawGlow(ctx, e.x, e.y, (5 + e.charge * 6 + e.flash * 10) * u, dying ? 0.9 : 0.12 + e.charge * 0.5 + e.flash * 0.6);
  drawEye(ctx, e.x, e.y, 2.4 * u, e.eye, e.charge, 0.7, e.heading + Math.PI / 2);
}

export function drawFragment(ctx: Ctx2D, e: Fragment, time: number): void {
  drawTrail(ctx, e);
  drawGlitched(ctx, e, time, e.size * 1.3, drawFragBody);
  if (e.debris) drawDebris(ctx, e.debris, time);
}

export function drawFragmentDebug(ctx: Ctx2D, e: Fragment): void {
  drawTendrilDebug(ctx, e.tails);
}

// ---------------------------------------------------------------------------
// Node

const N_ORPHAN = 2;

export interface SwarmNode extends EnemyBase {
  kind: 'swarm';
  nShard: number;
  // per outer cube: lattice angle, radius, phase, size, rot, glitch offset
  sa: Float32Array;
  sr: Float32Array;
  sp: Float32Array;
  cs: Float32Array;
  crot: Float32Array;
  off: Float32Array; // x,y per cube
  /** kept for API compatibility (cube outlines in local space) */
  shapes: Float32Array[];
  eyes: EyeTrack[];
  eye: EyeTrack;
  ring: number;
  jx: number;
  jy: number;
  jitT: number;
  snapT: number;
  orph: Float32Array; // per orphan: angle, radius, phase
  /** -1 = intact, else seconds into the split animation */
  splitT: number;
  /** seconds since burst (dead), drives the shock ring */
  burstT: number;
  /** set on the frame the node bursts; caller takes them and sets to null */
  spawned: Fragment[] | null;
}

export function createSwarmNode(x: number, y: number, seed: number, opts?: CreateOpts): SwarmNode {
  const size = opts?.size ?? SWARM_SIZE;
  const b = makeBase(x, y, seed, size);
  const u = size / 52;
  const n = 3 + ((rand(b) * 3) | 0);
  const sa = new Float32Array(n);
  const sr = new Float32Array(n);
  const sp = new Float32Array(n);
  const cs = new Float32Array(n);
  const crot = new Float32Array(n);
  const shapes: Float32Array[] = [];
  const eyes: EyeTrack[] = [];
  // choose n of the 6 hex neighbour slots (missing cells = broken lattice)
  const slots = [0, 1, 2, 3, 4, 5];
  for (let i = 5; i > 0; i--) {
    const j = (rand(b) * (i + 1)) | 0;
    const t = slots[i];
    slots[i] = slots[j];
    slots[j] = t;
  }
  for (let i = 0; i < n; i++) {
    sa[i] = (slots[i] * TAU) / 6 + randRange(b, -0.08, 0.08);
    sr[i] = randRange(b, 11.5, 13.5) * u;
    sp[i] = rand(b) * TAU;
    cs[i] = randRange(b, 4.8, 6) * u;
    crot[i] = rand(b) < 0.3 ? TAU / 12 : 0;
    shapes.push(hexPoly(cs[i]));
    eyes.push(makeEye());
  }
  const orph = new Float32Array(N_ORPHAN * 3);
  for (let i = 0; i < N_ORPHAN; i++) {
    orph[i * 3] = rand(b) * TAU;
    orph[i * 3 + 1] = randRange(b, 20, 26) * u;
    orph[i * 3 + 2] = rand(b) * TAU;
  }
  return {
    ...b,
    kind: 'swarm',
    nShard: n,
    sa,
    sr,
    sp,
    cs,
    crot,
    off: new Float32Array(n * 2),
    shapes,
    eyes,
    eye: makeEye(),
    ring: 0,
    jx: 0,
    jy: 0,
    jitT: 0,
    snapT: 0.6,
    orph,
    splitT: -1,
    burstT: 0,
    spawned: null,
  };
}

/** Starts the death/split animation; fragments appear in `spawned` ~0.45 s later. */
export function beginSplit(e: SwarmNode): void {
  if (e.splitT < 0 && e.alive && e.deathT < 0) e.splitT = 0;
}

/** Optional hit reaction: knockback, cells jolt out of the lattice, glitch. */
export function hurtSwarmNode(e: SwarmNode, dx: number, dy: number, strength = 1): void {
  if (!e.alive || e.deathT >= 0) return;
  hurtBase(e, dx, dy, strength);
  const u = e.size / 52;
  for (let i = 0; i < e.nShard; i++) {
    e.off[i * 2] += (rand(e) - 0.5) * 8 * u;
    e.off[i * 2 + 1] += (rand(e) - 0.5) * 8 * u;
  }
}

/** Optional death. split=true (default) bursts into fragments via beginSplit; false shatters with no spawn. */
export function killSwarmNode(e: SwarmNode, split = true): void {
  if (split) beginSplit(e);
  else if (e.splitT < 0) killBase(e);
}

const shardWorld = (e: SwarmNode, i: number, out: Vec): void => {
  const a = e.sa[i] + e.ring * 0.35;
  const r = e.sr[i] * (1 + 0.06 * Math.sin(e.t * 3.2 + e.sp[i]) + (e.splitT >= 0 ? e.splitT * 0.5 : 0));
  out.x = e.x + Math.cos(a) * r + e.off[i * 2];
  out.y = e.y + Math.sin(a) * r + e.off[i * 2 + 1];
};

const tmp: Vec = { x: 0, y: 0 };

const resetSwarm = (_e: SwarmNode): void => {};

/** Robust public update (see robustUpdate). */
export function updateSwarmNode(e: SwarmNode, dt: number, target: Vec, intent?: Vec | EnemyIntent | null): void {
  const u = e.size / 52;
  robustUpdate(e, dt, target, intent, 110 * u, 220 * u, 20, stepSwarmNode, resetSwarm);
}

function stepSwarmNode(e: SwarmNode, dt: number, target: Vec, intent: Vec | null): void {
  e.t += dt;
  const u = e.size / 52;
  if (!e.alive && e.deathT < 0) {
    e.burstT += dt;
    updateTrail(e, dt, 1e9);
    if (e.burstT > BURST_TIME) e.done = true;
    return;
  }
  if (tickFx(e, dt)) {
    steer(e, 0, 0, 6, dt);
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    if (e.deathT >= DEATH_COLLAPSE * 0.6 && !e.debris) {
      const d = ensureDebris(e, 24, 0.7);
      for (let i = 0; i < e.nShard; i++) {
        shardWorld(e, i, tmp);
        addDebrisPoly(d, e.shapes[i], tmp.x, tmp.y, 0, 1, e.x, e.y, 110 * u, e.vx, e.vy, e);
      }
      addDebrisPoly(d, hexPoly(6.5 * u), e.x, e.y, 0, 1, e.x, e.y + 1, 50 * u, 0, 0, e);
      burstGlyphs(e, e.x, e.y, 12, 150 * u);
    }
    updateGlitch(e, dt, 3.5, 0.2);
    updateTrail(e, dt, 1e9);
    return;
  }
  const dx = target.x - e.x;
  const dy = target.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  if (e.splitT >= 0) {
    e.splitT += dt;
    steer(e, 0, 0, 12, dt);
    e.charge = Math.min(1, e.splitT / SPLIT_TIME);
    if (e.splitT >= SPLIT_TIME) {
      e.alive = false;
      e.burstT = 0;
      const out: Fragment[] = [];
      for (let i = 0; i < e.nShard; i++) {
        shardWorld(e, i, tmp);
        const f = createFragment(tmp.x, tmp.y, (e.seed * 31 + i * 7919) | 0, { size: FRAGMENT_SIZE * u });
        const a = Math.atan2(tmp.y - e.y, tmp.x - e.x) + randRange(e, -0.3, 0.3);
        const sp = randRange(e, 160, 260) * u;
        f.vx = Math.cos(a) * sp + e.vx;
        f.vy = Math.sin(a) * sp + e.vy;
        f.heading = a;
        f.spin = randRange(e, -18, 18);
        f.mode = F_LAUNCH;
        f.flash = 1;
        for (const td of f.tails) initTendril(td, tmp.x, tmp.y, a + Math.PI);
        out.push(f);
      }
      burstGlyphs(e, e.x, e.y, 10, 140 * u);
      e.spawned = out;
      return;
    }
  } else {
    let dvx: number;
    let dvy: number;
    if (intent) {
      dvx = intent.x;
      dvy = intent.y;
    } else {
      const stand = 90 * u;
      const k = dist > stand ? 1 : -0.5;
      dvx = (dx / dist) * 34 * u * k + Math.cos(e.t * 0.7 + e.seed) * 20 * u;
      dvy = (dy / dist) * 34 * u * k + Math.sin(e.t * 0.9 + e.seed) * 20 * u;
    }
    steer(e, dvx, dvy, 2.5, dt);
    e.charge = 0.15 + 0.12 * Math.sin(e.t * 2.4);
    e.jitT -= dt;
    if (e.jitT <= 0) {
      e.jitT = randRange(e, 0.3, 1.2);
      e.vx += (rand(e) - 0.5) * 70 * u;
      e.vy += (rand(e) - 0.5) * 70 * u;
    }
    // a cell glitch-snaps out of the lattice (and eases back)
    e.snapT -= dt;
    if (e.snapT <= 0) {
      e.snapT = randRange(e, 0.35, 1.4);
      const i = (rand(e) * e.nShard) | 0;
      e.off[i * 2] = (rand(e) - 0.5) * 9 * u;
      e.off[i * 2 + 1] = (rand(e) - 0.5) * 9 * u;
      if (rand(e) < 0.4) e.crot[i] += TAU / 6;
    }
  }
  const ok = damp(e.splitT >= 0 ? 1 : 6, dt);
  for (let i = 0; i < e.off.length; i++) e.off[i] -= e.off[i] * ok;
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  e.ring += dt * (0.5 + e.charge * 3);
  // deterministic shiver (no per-frame random jitter)
  const shake = e.splitT >= 0 ? (e.splitT / SPLIT_TIME) * 3 * u : 0.25 * u;
  e.jx = Math.sin(e.t * 71) * shake;
  e.jy = Math.cos(e.t * 59) * shake;
  for (let i = 0; i < e.nShard; i++) {
    shardWorld(e, i, tmp);
    updateEye(e.eyes[i], e, tmp.x, tmp.y, target, dt, 0.5, e.charge);
  }
  updateEye(e.eye, e, e.x, e.y, target, dt, 0.3, e.splitT >= 0 ? 1 : e.charge);
  updateGlitch(e, dt, e.splitT >= 0 ? 12 : 0.6, e.splitT >= 0 ? 0.25 : 0.06);
  updateTrail(e, dt, 120 * u);
}

function drawNodeBody(ctx: Ctx2D, e: SwarmNode, time: number): void {
  const u = e.size / 52;
  const w = Math.max(0.75, 0.9 * Math.sqrt(u));
  const lw = Math.max(1, w);
  const sx = e.x + e.jx;
  const sy = e.y + e.jy;
  const splitting = e.splitT >= 0;
  const flick = splitting && ((time * 40) | 0) % 2 === 0;
  const fill = silFill(e);
  const dying = e.deathT >= 0;
  if (e.debris) return;
  // bonds
  ctx.lineWidth = Math.max(0.6, w * 0.7);
  ctx.strokeStyle = flick ? whiteA(0.6) : grayA(0.55);
  ctx.beginPath();
  for (let i = 0; i < e.nShard; i++) {
    shardWorld(e, i, tmp);
    ctx.moveTo(sx, sy);
    ctx.lineTo(tmp.x + e.jx, tmp.y + e.jy);
  }
  ctx.stroke();
  // bracket cage: three broken arcs + ticks
  const rr = 22 * u * (1 + (splitting ? e.splitT * 0.6 : 0));
  ctx.strokeStyle = orangeA(0.35);
  ctx.lineWidth = w;
  ctx.beginPath();
  for (let k = 0; k < 3; k++) {
    const a0 = -e.ring * 0.5 + (k * TAU) / 3;
    ctx.moveTo(sx + Math.cos(a0) * rr, sy + Math.sin(a0) * rr);
    ctx.arc(sx, sy, rr, a0, a0 + 0.8);
    ctx.moveTo(sx + Math.cos(a0) * rr, sy + Math.sin(a0) * rr);
    ctx.lineTo(sx + Math.cos(a0) * (rr - 3 * u), sy + Math.sin(a0) * (rr - 3 * u));
  }
  ctx.stroke();
  // cubes: outlines (batched), top faces, inner Ys
  const coreR = 7 * u * (1 + 0.04 * Math.sin(time * 2.4 + e.seed));
  ctx.beginPath();
  cubeOutline(ctx, sx, sy, coreR, 0);
  for (let i = 0; i < e.nShard; i++) {
    shardWorld(e, i, tmp);
    cubeOutline(ctx, tmp.x + e.jx, tmp.y + e.jy, e.cs[i], e.crot[i]);
  }
  for (let i = 0; i < N_ORPHAN; i++) {
    const a = e.orph[i * 3] + e.t * 0.25;
    const r = e.orph[i * 3 + 1] + Math.sin(e.t * 1.3 + e.orph[i * 3 + 2]) * 3 * u;
    cubeOutline(ctx, sx + Math.cos(a) * r, sy + Math.sin(a) * r, 2.4 * u, e.t * 0.8 + i);
  }
  ctx.fillStyle = flick ? PAL.coreDim : fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.lineJoin = 'miter';
  ctx.strokeStyle = edgeA(e, 0.85);
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < e.nShard; i++) {
    shardWorld(e, i, tmp);
    cubeTop(ctx, tmp.x + e.jx, tmp.y + e.jy, e.cs[i], e.crot[i]);
  }
  ctx.fillStyle = PAL.bodyHi;
  ctx.fill();
  ctx.beginPath();
  for (let i = 0; i < e.nShard; i++) {
    shardWorld(e, i, tmp);
    cubeY(ctx, tmp.x + e.jx, tmp.y + e.jy, e.cs[i], e.crot[i]);
  }
  ctx.strokeStyle = PAL.grayMid;
  ctx.lineWidth = Math.max(0.6, w * 0.7);
  ctx.stroke();
  // data pips on the outer cubes (charge eyes)
  for (let i = 0; i < e.nShard; i++) {
    shardWorld(e, i, tmp);
    drawChargeEye(ctx, tmp.x + e.jx, tmp.y + e.jy + e.cs[i] * 0.35, e.cs[i] * 0.32, e.eyes[i], e.splitT >= 0 ? 1 : e.charge, 0);
  }
  // core cube holds the eye
  const cg = 0.3 + e.charge * 0.7;
  ctx.strokeStyle = coreColor(cg);
  ctx.lineWidth = Math.max(1, 1.4 * u);
  ctx.beginPath();
  cubeOutline(ctx, sx, sy, coreR * 0.82, 0);
  ctx.stroke();
  drawGlow(ctx, sx, sy, (11 + e.charge * 16) * u, dying ? 0.9 : 0.2 + e.charge * 0.7);
  drawEye(ctx, sx, sy, 4 * u, e.eye, e.splitT >= 0 ? 1 : e.charge, 0.6, 0);
}

function drawBurst(ctx: Ctx2D, e: SwarmNode): void {
  const u = e.size / 52;
  const p = e.burstT / BURST_TIME;
  const r = (14 + p * 40) * u;
  ctx.lineWidth = Math.max(0.7, u);
  ctx.strokeStyle = orangeA((1 - p) * 0.9);
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (k * TAU) / 6 + e.seed;
    ctx.moveTo(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r);
    ctx.lineTo(e.x + Math.cos(a + TAU / 6) * r, e.y + Math.sin(a + TAU / 6) * r);
  }
  ctx.stroke();
  drawGlow(ctx, e.x, e.y, (20 + p * 20) * u, (1 - p) * 0.9);
}

export function drawSwarmNode(ctx: Ctx2D, e: SwarmNode, time: number): void {
  if (!e.alive && e.deathT < 0) {
    drawTrail(ctx, e);
    if (!e.done) drawBurst(ctx, e);
    return;
  }
  drawTrail(ctx, e);
  drawGlitched(ctx, e, time, e.size * 1.0, drawNodeBody);
  if (e.debris) {
    drawDebris(ctx, e.debris, time);
    const p = clamp(e.deathT / 0.6, 0, 1);
    drawGlow(ctx, e.x, e.y, (16 + p * 26) * (e.size / 52), (1 - p) * 0.9);
  }
}

export function drawSwarmNodeDebug(ctx: Ctx2D, e: SwarmNode): void {
  ctx.strokeStyle = 'rgba(150,150,150,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < e.nShard; i++) {
    shardWorld(e, i, tmp);
    ctx.moveTo(tmp.x + 3, tmp.y);
    ctx.arc(tmp.x, tmp.y, 3, 0, TAU);
  }
  ctx.stroke();
}
