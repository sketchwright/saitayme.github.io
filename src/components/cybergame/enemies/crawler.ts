// CRAWLER: fast asymmetric walker. Seven needle limbs (4 left / 3 right) of
// unequal length on true IK, single tracking eye, stop-start stalking,
// freeze + tremble + charge, then an ease-out lunge.

import {
  CreateOpts,
  Ctx2D,
  EnemyBase,
  EyeTrack,
  PAL,
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
} from './common';
import { Leg, Rig, drawRig, drawRigDebug, makeLeg, makeRig, plantRig, updateRig } from './ik';

export const CRAWLER_SIZE = 56;

const STALK = 0;
const FREEZE = 1;
const LUNGE = 2;
const RECOVER = 3;

export interface Crawler extends EnemyBase {
  kind: 'crawler';
  rig: Rig;
  mode: number;
  modeT: number;
  freezeDur: number;
  burstT: number;
  moving: boolean;
  cooldown: number;
  lx: number;
  ly: number;
  tremble: number;
  tailA: number;
  palpA: number;
  palpB: number;
  palpT: number;
  eye: EyeTrack;
  shape: Float32Array;
  tail: Float32Array;
  spines: Float32Array;
}

export function createCrawler(x: number, y: number, seed: number, opts?: CreateOpts): Crawler {
  const size = opts?.size ?? CRAWLER_SIZE;
  const b = makeBase(x, y, seed, size);
  const u = size / 56;
  const legs: Leg[] = [];
  // asymmetric layout: 4 left, 3 right
  const sides: Array<[number, number]> = [
    [-1, 4],
    [1, 3],
  ];
  for (const [side, count] of sides) {
    for (let k = 0; k < count; k++) {
      const f = count === 1 ? 0.5 : k / (count - 1);
      const hx = (7 - f * 14 + randRange(b, -1.5, 1.5)) * u;
      const hy = side * (4 + randRange(b, 0, 2)) * u;
      // fan from forward-reaching to back-trailing
      const fan = (0.95 - f * 2.0 + randRange(b, -0.15, 0.15)) * side;
      const reach = (27 + randRange(b, -4, 8) + (k === 0 ? 5 : 0)) * u;
      const ang = side * Math.PI * 0.5 - fan;
      const rx = hx + Math.cos(ang) * reach;
      const ry = hy + Math.sin(ang) * reach;
      const n = rand(b) < 0.5 ? 3 : 4;
      const total = reach * randRange(b, 1.28, 1.55);
      const segs: number[] = [];
      const w = n === 3 ? [0.36, 0.38, 0.26] : [0.3, 0.27, 0.24, 0.19];
      for (let i = 0; i < n; i++) segs.push(total * w[i] * randRange(b, 0.9, 1.1));
      legs.push(makeLeg({ hx, hy, rx, ry, side, group: (k + (side > 0 ? 1 : 0)) % 2, segs }));
    }
  }
  const rig = makeRig(legs, 8 * u, 0.17, 1.6);
  const e: Crawler = {
    ...b,
    kind: 'crawler',
    rig,
    mode: STALK,
    modeT: 0,
    freezeDur: 0.7,
    burstT: 0.3,
    moving: true,
    cooldown: 1 + rand(b) * 2,
    lx: 0,
    ly: 0,
    tremble: 0,
    tailA: Math.PI / 2,
    palpA: 0.3,
    palpB: -0.3,
    palpT: 0,
    eye: makeEye(),
    shape: shardShape(b, 9, 13 * u, 8 * u, 0.22, 0.35),
    tail: shardShape(b, 5, 7 * u, 4 * u, 0.3, 0.6),
    spines: new Float32Array(0),
  };
  // asymmetric spines: [x0,y0,x1,y1] local
  const sp: number[] = [];
  const ns = 3 + ((rand(e) * 2) | 0);
  for (let i = 0; i < ns; i++) {
    const a = randRange(e, 1.6, 4.7);
    const r0 = 8 * u;
    const l = randRange(e, 5, 15) * u;
    sp.push(Math.cos(a) * r0, Math.sin(a) * r0 * 0.7, Math.cos(a) * (r0 + l), Math.sin(a) * (r0 * 0.7 + l * 0.8));
  }
  e.spines = new Float32Array(sp);
  plantRig(rig, x, y, e.heading);
  e.tailA = e.heading;
  return e;
}

/** Force the freeze -> tremble -> lunge sequence now. */
export function crawlerLunge(e: Crawler): void {
  if (e.mode === FREEZE || e.mode === LUNGE) return;
  e.mode = FREEZE;
  e.modeT = 0;
  e.freezeDur = 0.55 + rand(e) * 0.35;
}

export function updateCrawler(e: Crawler, dt: number, target: Vec, intent?: Vec | null): void {
  e.t += dt;
  e.modeT += dt;
  const u = e.size / 56;
  const dx = target.x - e.x;
  const dy = target.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  const walk = 62 * u;
  let turnRate = 7;

  switch (e.mode) {
    case STALK: {
      e.burstT -= dt;
      if (e.burstT <= 0) {
        e.moving = !e.moving;
        e.burstT = e.moving ? randRange(e, 0.25, 0.7) : randRange(e, 0.08, 0.35);
      }
      let dvx: number;
      let dvy: number;
      if (intent) {
        dvx = intent.x;
        dvy = intent.y;
      } else {
        // approach, then circle at standoff
        const stand = 55 * u;
        const tx = -dy / dist;
        const ty = dx / dist;
        const radial = dist > stand ? 1 : dist < stand * 0.7 ? -0.6 : 0;
        dvx = (dx / dist) * radial * walk + tx * walk * 0.6;
        dvy = (dy / dist) * radial * walk + ty * walk * 0.6;
      }
      const k = e.moving ? 1 : 0.04;
      steer(e, dvx * k, dvy * k, e.moving ? 12 : 22, dt);
      e.tremble = e.moving ? 0 : 0.35 * u;
      e.charge += (0 - e.charge) * damp(3, dt);
      e.cooldown -= dt;
      if (!intent && e.cooldown <= 0 && dist < 240 * u && dist > 35 * u && rand(e) < dt * 0.9) crawlerLunge(e);
      break;
    }
    case FREEZE: {
      steer(e, 0, 0, 30, dt);
      const p = Math.min(1, e.modeT / e.freezeDur);
      e.charge = p;
      e.tremble = (0.4 + p * 1.4) * u;
      // jerky re-aim in discrete snaps
      if (rand(e) < dt * 9) e.heading = turnToward(e.heading, Math.atan2(dy, dx), 0.5);
      turnRate = 0;
      if (p >= 1) {
        e.mode = LUNGE;
        e.modeT = 0;
        e.lx = dx / dist;
        e.ly = dy / dist;
        e.heading = Math.atan2(dy, dx);
      }
      break;
    }
    case LUNGE: {
      const p = Math.min(1, e.modeT / 0.38);
      const sp = 430 * u * (1 - p) * (1 - p);
      e.vx = e.lx * sp;
      e.vy = e.ly * sp;
      e.charge = 1 - p * 0.6;
      e.tremble = 0;
      turnRate = 0;
      if (p >= 1) {
        e.mode = RECOVER;
        e.modeT = 0;
      }
      break;
    }
    default: {
      steer(e, 0, 0, 8, dt);
      e.charge += (0 - e.charge) * damp(5, dt);
      e.tremble = 0.25 * u;
      if (e.modeT > 0.35) {
        e.mode = STALK;
        e.cooldown = randRange(e, 1.4, 3.2);
      }
    }
  }

  e.x += e.vx * dt;
  e.y += e.vy * dt;
  const sp = Math.hypot(e.vx, e.vy);
  if (turnRate > 0 && sp > 8 * u) e.heading = turnToward(e.heading, Math.atan2(e.vy, e.vx), turnRate * dt);
  e.tailA = turnToward(e.tailA, e.heading, 4 * dt);

  e.palpT -= dt;
  if (e.palpT <= 0) {
    e.palpT = randRange(e, 0.05, 0.4);
    e.palpA = randRange(e, 0.1, 0.7);
    e.palpB = -randRange(e, 0.1, 0.7);
  }

  updateRig(e.rig, e.x, e.y, e.heading, e.vx, e.vy, dt, e);
  const c = Math.cos(e.heading);
  const s = Math.sin(e.heading);
  updateEye(e.eye, e, e.x + c * 7 * u, e.y + s * 7 * u, target, dt, 0.35);
  updateGlitch(e, dt, 0.35 + e.charge * 2.2 + (e.mode === LUNGE ? 3 : 0), e.charge * 0.1);
  updateTrail(e, dt, 170 * u);
}

function drawBody(ctx: Ctx2D, e: Crawler, _time: number): void {
  const u = e.size / 56;
  const w = Math.max(0.75, 0.9 * Math.sqrt(u));
  drawRig(ctx, e.rig, w, e.tremble, 1);

  const c = Math.cos(e.heading);
  const s = Math.sin(e.heading);
  const ox = c * e.rig.offX - s * e.rig.offY + (e.tremble ? (Math.random() - 0.5) * e.tremble : 0);
  const oy = s * e.rig.offX + c * e.rig.offY + (e.tremble ? (Math.random() - 0.5) * e.tremble : 0);
  const bx = e.x + ox;
  const by = e.y + oy;

  // tail shard trails with lag, connected by a spine
  const ta = e.tailA;
  const tx = bx - Math.cos(ta) * 17 * u;
  const ty = by - Math.sin(ta) * 17 * u;
  ctx.strokeStyle = grayA(0.8);
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(bx - c * 8 * u, by - s * 8 * u);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(ta + 0.4);
  polyPath(ctx, e.tail, 1, 1);
  ctx.fillStyle = PAL.body;
  ctx.fill();
  ctx.strokeStyle = orangeA(0.5);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(e.heading);
  const sq = 1 - e.rig.bob * 0.05;
  ctx.scale(1 + e.charge * 0.04, sq);
  // spines
  ctx.strokeStyle = orangeA(0.45);
  ctx.lineWidth = Math.max(0.6, w * 0.7);
  ctx.beginPath();
  const sp = e.spines;
  for (let i = 0; i < sp.length; i += 4) {
    ctx.moveTo(sp[i], sp[i + 1]);
    ctx.lineTo(sp[i + 2], sp[i + 3]);
  }
  // palps (twitching mandible needles)
  ctx.moveTo(11 * u, -3 * u);
  ctx.lineTo(11 * u + Math.cos(-e.palpA) * 9 * u, -3 * u + Math.sin(-e.palpA) * 9 * u);
  ctx.moveTo(11 * u, 3 * u);
  ctx.lineTo(11 * u + Math.cos(-e.palpB) * 7 * u, 3 * u + Math.sin(-e.palpB) * 7 * u);
  ctx.stroke();
  // carapace
  polyPath(ctx, e.shape, 1, 1);
  ctx.fillStyle = PAL.body;
  ctx.fill();
  ctx.lineWidth = w;
  ctx.strokeStyle = orangeA(0.75 + e.charge * 0.25);
  ctx.stroke();
  // plating seams
  ctx.strokeStyle = PAL.grayDim;
  ctx.beginPath();
  ctx.moveTo(-11 * u, -1 * u);
  ctx.lineTo(2 * u, -4 * u);
  ctx.lineTo(9 * u, -1 * u);
  ctx.moveTo(-8 * u, 4 * u);
  ctx.lineTo(1 * u, 2 * u);
  ctx.stroke();
  // core slit
  ctx.fillStyle = coreColor(e.charge);
  ctx.fillRect(-8 * u, -1.2 * u, 7 * u, 2.4 * u);
  ctx.restore();

  const cx = bx - c * 4.5 * u;
  const cy = by - s * 4.5 * u;
  drawGlow(ctx, cx, cy, (9 + e.charge * 14) * u, 0.18 + e.charge * 0.75);
  drawEye(ctx, bx + c * 7 * u, by + s * 7 * u, 3.6 * u, e.eye, e.charge, e.charge * 0.8);
}

export function drawCrawler(ctx: Ctx2D, e: Crawler, time: number): void {
  drawTrail(ctx, e);
  drawGlitched(ctx, e, time, e.size * 1.1, drawBody);
}

export function drawCrawlerDebug(ctx: Ctx2D, e: Crawler): void {
  drawRigDebug(ctx, e.rig);
}
