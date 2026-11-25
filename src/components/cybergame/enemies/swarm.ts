// SWARM-NODE: a jittering lattice of 3-5 bound shards around a small core,
// caged by a rotating bracket ring. On death it shakes apart (beginSplit)
// and bursts into FRAGMENT creatures: tiny darting shards with whip tails.

import {
  CreateOpts,
  Ctx2D,
  EnemyBase,
  EyeTrack,
  PAL,
  TAU,
  Vec,
  coreColor,
  damp,
  drawEye,
  drawGlitched,
  drawGlow,
  drawTrail,
  grayA,
  makeBase,
  makeEye,
  orangeA,
  polyPath,
  rand,
  randRange,
  shardShape,
  steer,
  turnToward,
  updateEye,
  updateGlitch,
  updateTrail,
  whiteA,
} from './common';
import { Tendril, drawTendrilDebug, drawTendrils, initTendril, makeTendril, updateTendril } from './tendril';

export const SWARM_SIZE = 52;
export const FRAGMENT_SIZE = 22;
const SPLIT_TIME = 0.45;
const BURST_TIME = 0.4;

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
}

export function createFragment(x: number, y: number, seed: number, opts?: CreateOpts): Fragment {
  const size = opts?.size ?? FRAGMENT_SIZE;
  const b = makeBase(x, y, seed, size);
  const u = size / 22;
  const tails: Tendril[] = [];
  for (let i = 0; i < 2; i++) {
    const td = makeTendril(5 + i, randRange(b, 2.5, 3.6) * u, 1.3, randRange(b, 5, 8), rand(b) * TAU, 0.14);
    initTendril(td, x, y, -Math.PI / 2);
    tails.push(td);
  }
  return {
    ...b,
    kind: 'fragment',
    shape: shardShape(b, 4, 6.5 * u, 4 * u, 0.3, 0.7),
    tails,
    eye: makeEye(),
    mode: F_HOLD,
    modeT: 0,
    dur: 0.3,
    spin: 0,
    flash: 0,
  };
}

/** Darts straight at the target after a short freeze. */
export function fragmentDart(e: Fragment): void {
  e.mode = F_HOLD;
  e.modeT = 0;
  e.dur = 0.18;
  e.charge = 0.6;
}

export function updateFragment(e: Fragment, dt: number, target: Vec, intent?: Vec | null): void {
  e.t += dt;
  e.modeT += dt;
  const u = e.size / 22;
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
  const c = Math.cos(e.heading);
  const s = Math.sin(e.heading);
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    const ax = e.x - c * 4 * u - s * side * 2 * u;
    const ay = e.y - s * 4 * u + c * side * 2 * u;
    updateTendril(e.tails[i], ax, ay, e.heading + Math.PI + side * 0.35, dt, e.t, 1, 1, 1);
  }
  updateEye(e.eye, e, e.x, e.y, target, dt, 0.3);
  updateGlitch(e, dt, 0.6, 0.1);
  updateTrail(e, dt, 140 * u);
}

function drawFragBody(ctx: Ctx2D, e: Fragment, _time: number): void {
  const u = e.size / 22;
  const w = Math.max(0.7, 0.8 * Math.sqrt(u));
  drawTendrils(ctx, e.tails, 2, w * 1.2, w * 0.8, 1, 0);
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.heading);
  polyPath(ctx, e.shape, 1, 1);
  ctx.fillStyle = e.flash > 0.5 ? PAL.coreHot : PAL.body;
  ctx.fill();
  ctx.lineWidth = w;
  ctx.strokeStyle = orangeA(0.85);
  ctx.stroke();
  ctx.restore();
  drawGlow(ctx, e.x, e.y, (5 + e.charge * 6 + e.flash * 10) * u, 0.12 + e.charge * 0.5 + e.flash * 0.6);
  drawEye(ctx, e.x, e.y, 2.2 * u, e.eye, e.charge, 0.6);
}

export function drawFragment(ctx: Ctx2D, e: Fragment, time: number): void {
  drawTrail(ctx, e);
  drawGlitched(ctx, e, time, e.size * 1.2, drawFragBody);
}

export function drawFragmentDebug(ctx: Ctx2D, e: Fragment): void {
  drawTendrilDebug(ctx, e.tails);
}

// ---------------------------------------------------------------------------
// Node

export interface SwarmNode extends EnemyBase {
  kind: 'swarm';
  nShard: number;
  // per shard: angle, radius, phase, eye
  sa: Float32Array;
  sr: Float32Array;
  sp: Float32Array;
  shapes: Float32Array[];
  eyes: EyeTrack[];
  ring: number;
  jx: number;
  jy: number;
  jitT: number;
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
  const shapes: Float32Array[] = [];
  const eyes: EyeTrack[] = [];
  for (let i = 0; i < n; i++) {
    sa[i] = (i / n) * TAU + randRange(b, -0.4, 0.4);
    sr[i] = randRange(b, 8, 12.5) * u;
    sp[i] = rand(b) * TAU;
    shapes.push(shardShape(b, 4, randRange(b, 4.5, 6.5) * u, randRange(b, 3, 4) * u, 0.3, 0.6));
    eyes.push(makeEye());
  }
  return {
    ...b,
    kind: 'swarm',
    nShard: n,
    sa,
    sr,
    sp,
    shapes,
    eyes,
    ring: 0,
    jx: 0,
    jy: 0,
    jitT: 0,
    splitT: -1,
    burstT: 0,
    spawned: null,
  };
}

/** Starts the death/split animation; fragments appear in `spawned` ~0.45 s later. */
export function beginSplit(e: SwarmNode): void {
  if (e.splitT < 0 && e.alive) e.splitT = 0;
}

const shardWorld = (e: SwarmNode, i: number, out: Vec): void => {
  const a = e.sa[i] + e.ring * (i % 2 ? -0.6 : 0.8);
  const r = e.sr[i] * (1 + 0.08 * Math.sin(e.t * 5 + e.sp[i]));
  out.x = e.x + Math.cos(a) * r;
  out.y = e.y + Math.sin(a) * r;
};

const tmp: Vec = { x: 0, y: 0 };

export function updateSwarmNode(e: SwarmNode, dt: number, target: Vec, intent?: Vec | null): void {
  e.t += dt;
  const u = e.size / 52;
  if (!e.alive) {
    e.burstT += dt;
    if (e.burstT > BURST_TIME) e.done = true;
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
    e.charge = 0.15 + 0.15 * Math.sin(e.t * 3);
    // twitch impulses
    e.jitT -= dt;
    if (e.jitT <= 0) {
      e.jitT = randRange(e, 0.15, 0.9);
      e.vx += (rand(e) - 0.5) * 90 * u;
      e.vy += (rand(e) - 0.5) * 90 * u;
    }
  }
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  e.ring += dt * (0.9 + e.charge * 4);
  const shake = e.splitT >= 0 ? (e.splitT / SPLIT_TIME) * 3 * u : 0.4 * u;
  e.jx = (Math.random() - 0.5) * shake;
  e.jy = (Math.random() - 0.5) * shake;
  for (let i = 0; i < e.nShard; i++) {
    shardWorld(e, i, tmp);
    updateEye(e.eyes[i], e, tmp.x, tmp.y, target, dt, 0.5);
  }
  updateGlitch(e, dt, e.splitT >= 0 ? 12 : 0.6, e.splitT >= 0 ? 0.25 : 0.06);
  updateTrail(e, dt, 120 * u);
}

function drawNodeBody(ctx: Ctx2D, e: SwarmNode, time: number): void {
  const u = e.size / 52;
  const w = Math.max(0.75, 0.9 * Math.sqrt(u));
  const sx = e.x + e.jx;
  const sy = e.y + e.jy;
  const splitting = e.splitT >= 0;
  const flick = splitting && ((time * 40) | 0) % 2 === 0;
  // lattice
  ctx.lineWidth = Math.max(0.6, w * 0.7);
  ctx.strokeStyle = flick ? whiteA(0.6) : orangeA(0.4);
  ctx.beginPath();
  for (let i = 0; i < e.nShard; i++) {
    shardWorld(e, i, tmp);
    const ax = tmp.x + e.jx;
    const ay = tmp.y + e.jy;
    ctx.moveTo(sx, sy);
    ctx.lineTo(ax, ay);
    shardWorld(e, (i + 1) % e.nShard, tmp);
    ctx.lineTo(tmp.x + e.jx, tmp.y + e.jy);
  }
  ctx.stroke();
  // bracket cage: three broken arcs + ticks
  const rr = 18 * u * (1 + (splitting ? e.splitT * 0.6 : 0));
  ctx.strokeStyle = grayA(0.9);
  ctx.lineWidth = w;
  ctx.beginPath();
  for (let k = 0; k < 3; k++) {
    const a0 = -e.ring * 0.5 + (k * TAU) / 3;
    ctx.moveTo(sx + Math.cos(a0) * rr, sy + Math.sin(a0) * rr);
    ctx.arc(sx, sy, rr, a0, a0 + 1.1);
    ctx.moveTo(sx + Math.cos(a0) * rr, sy + Math.sin(a0) * rr);
    ctx.lineTo(sx + Math.cos(a0) * (rr - 3 * u), sy + Math.sin(a0) * (rr - 3 * u));
  }
  ctx.stroke();
  // core
  const cr = (3 + e.charge * 2.5) * u;
  ctx.fillStyle = coreColor(e.charge);
  ctx.beginPath();
  ctx.moveTo(sx, sy - cr * 1.3);
  ctx.lineTo(sx + cr, sy);
  ctx.lineTo(sx, sy + cr * 1.3);
  ctx.lineTo(sx - cr, sy);
  ctx.closePath();
  ctx.fill();
  drawGlow(ctx, sx, sy, (10 + e.charge * 16) * u, 0.2 + e.charge * 0.7);
  // shards
  for (let i = 0; i < e.nShard; i++) {
    shardWorld(e, i, tmp);
    const ax = tmp.x + e.jx;
    const ay = tmp.y + e.jy;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(Math.atan2(ay - sy, ax - sx));
    polyPath(ctx, e.shapes[i], 1, 1);
    ctx.fillStyle = PAL.body;
    ctx.fill();
    ctx.strokeStyle = orangeA(0.85);
    ctx.lineWidth = w;
    ctx.stroke();
    ctx.restore();
    drawEye(ctx, ax, ay, 1.8 * u, e.eyes[i], e.charge, 0.5);
  }
}

function drawBurst(ctx: Ctx2D, e: SwarmNode): void {
  const u = e.size / 52;
  const p = e.burstT / BURST_TIME;
  const r = (14 + p * 40) * u;
  ctx.lineWidth = Math.max(0.7, u);
  ctx.strokeStyle = orangeA((1 - p) * 0.9);
  ctx.beginPath();
  for (let k = 0; k < 7; k++) {
    const a = k * 0.9 + e.seed;
    ctx.moveTo(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r);
    ctx.arc(e.x, e.y, r, a, a + 0.5);
  }
  ctx.stroke();
  drawGlow(ctx, e.x, e.y, (20 + p * 20) * u, (1 - p) * 0.9);
}

export function drawSwarmNode(ctx: Ctx2D, e: SwarmNode, time: number): void {
  if (!e.alive) {
    if (!e.done) drawBurst(ctx, e);
    return;
  }
  drawTrail(ctx, e);
  drawGlitched(ctx, e, time, e.size * 1.0, drawNodeBody);
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
