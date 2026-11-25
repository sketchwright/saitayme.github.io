// SENTINEL: heavy turret chassis on five spindly 4-segment legs (IK, mostly
// planted; it shuffles to re-anchor). A lens-eye turret tracks the target in
// mechanical steps, then a visible charge-up (core + barrel + aim line +
// tremble) before firing (muzzle flash, recoil the legs absorb).

import {
  CreateOpts,
  Ctx2D,
  EnemyBase,
  EyeTrack,
  PAL,
  TAU,
  Vec,
  clamp,
  coreColor,
  damp,
  drawEye,
  drawGlitched,
  drawGlow,
  hotA,
  makeBase,
  makeEye,
  orangeA,
  polyPath,
  rand,
  randRange,
  steer,
  turnToward,
  updateEye,
  updateGlitch,
  whiteA,
  wrapAngle,
} from './common';
import { Leg, Rig, drawRig, drawRigDebug, makeLeg, makeRig, plantRig, updateRig } from './ik';

export const SENTINEL_SIZE = 70;

const TRACK = 0;
const CHARGE = 1;
const COOL = 2;
const CHARGE_TIME = 1.15;
const DASH: number[] = [3, 4];
const NODASH: number[] = [];

export interface Sentinel extends EnemyBase {
  kind: 'sentinel';
  rig: Rig;
  aim: number;
  aimGoal: number;
  aimStepT: number;
  mode: number;
  modeT: number;
  dur: number;
  recoil: number;
  flash: number;
  /** true for exactly one update when a shot is released */
  fired: boolean;
  ax: number;
  ay: number;
  anchorT: number;
  eye: EyeTrack;
  hull: Float32Array;
  tremble: number;
}

export function createSentinel(x: number, y: number, seed: number, opts?: CreateOpts): Sentinel {
  const size = opts?.size ?? SENTINEL_SIZE;
  const b = makeBase(x, y, seed, size);
  const u = size / 70;
  const legs: Leg[] = [];
  // 3 left, 2 right
  const specs: Array<[number, number, number]> = [
    // side, hip x, fan
    [-1, 9, 0.9],
    [-1, -1, 0.05],
    [-1, -10, -0.85],
    [1, 6, 0.6],
    [1, -8, -0.6],
  ];
  specs.forEach(([side, hx0, fan], k) => {
    const hx = hx0 * u;
    const hy = side * 9 * u;
    const reach = randRange(b, 27, 34) * u;
    const ang = side * (Math.PI * 0.5 - fan);
    const rx = hx + Math.cos(ang) * reach;
    const ry = hy + Math.sin(ang) * reach;
    const total = reach * randRange(b, 1.35, 1.55);
    const segs = [total * 0.3, total * 0.28, total * 0.24, total * 0.18];
    legs.push(makeLeg({ hx, hy, rx, ry, side, group: k % 2, segs }));
  });
  const rig = makeRig(legs, 9 * u, 0.22, 1.3);
  const hull = new Float32Array([
    15, -4, 10, -11, -3, -13, -12, -9, -16, 1, -11, 10, 2, 12, 12, 7,
  ].map((v) => v * u));
  const e: Sentinel = {
    ...b,
    kind: 'sentinel',
    rig,
    aim: Math.PI / 2,
    aimGoal: Math.PI / 2,
    aimStepT: 0,
    mode: TRACK,
    modeT: 0,
    dur: randRange(b, 1.4, 2.4),
    recoil: 0,
    flash: 0,
    fired: false,
    ax: x,
    ay: y,
    anchorT: randRange(b, 2, 4),
    eye: makeEye(),
    hull,
    tremble: 0,
  };
  plantRig(rig, x, y, e.heading);
  return e;
}

/** Skip straight to the charge-up tell. */
export function sentinelCharge(e: Sentinel): void {
  if (e.mode !== CHARGE) {
    e.mode = CHARGE;
    e.modeT = 0;
  }
}

export const sentinelMuzzle = (e: Sentinel, out: Vec): Vec => {
  const u = e.size / 70;
  const l = (27 - e.recoil * 5) * u;
  out.x = e.x + Math.cos(e.aim) * l;
  out.y = e.y + Math.sin(e.aim) * l;
  return out;
};

export function updateSentinel(e: Sentinel, dt: number, target: Vec, intent?: Vec | null): void {
  e.t += dt;
  e.modeT += dt;
  e.fired = false;
  const u = e.size / 70;
  const dx = target.x - e.x;
  const dy = target.y - e.y;
  const want = Math.atan2(dy, dx);
  let aimRate = 5;
  switch (e.mode) {
    case TRACK:
      e.charge += (0.08 - e.charge) * damp(3, dt);
      e.tremble = 0;
      if (e.modeT > e.dur) sentinelCharge(e);
      break;
    case CHARGE: {
      const p = Math.min(1, e.modeT / CHARGE_TIME);
      e.charge = p * p;
      aimRate = p > 0.7 ? 0 : 1.6;
      e.tremble = p > 0.6 ? (p - 0.6) * 3 * u : 0;
      if (p >= 1) {
        e.fired = true;
        e.flash = 1;
        e.recoil = 1;
        e.charge = 0.3;
        // shove the chassis back; planted feet absorb it
        e.vx -= Math.cos(e.aim) * 120 * u;
        e.vy -= Math.sin(e.aim) * 120 * u;
        e.mode = COOL;
        e.modeT = 0;
      }
      break;
    }
    default:
      e.charge += (0 - e.charge) * damp(4, dt);
      e.tremble = 0;
      if (e.modeT > 0.7) {
        e.mode = TRACK;
        e.modeT = 0;
        e.dur = randRange(e, 1.2, 2.4);
      }
  }
  // mechanical stepped aim with slight overshoot
  e.aimStepT -= dt;
  if (e.aimStepT <= 0 && aimRate > 0) {
    e.aimStepT = 0.07 + rand(e) * 0.06;
    const d = wrapAngle(want - e.aim);
    e.aimGoal = e.aim + clamp(d * 1.12, -aimRate * 0.12, aimRate * 0.12);
  }
  e.aim += wrapAngle(e.aimGoal - e.aim) * damp(30, dt);
  e.recoil = Math.max(0, e.recoil - dt * 3);
  e.flash = Math.max(0, e.flash - dt * 9);

  // re-anchor occasionally so it shuffles on its legs
  e.anchorT -= dt;
  if (e.anchorT <= 0) {
    e.anchorT = randRange(e, 2.5, 5);
    e.ax = e.x + randRange(e, -18, 18) * u;
    e.ay = e.y + randRange(e, -10, 10) * u;
  }
  let dvx: number;
  let dvy: number;
  if (intent) {
    dvx = intent.x;
    dvy = intent.y;
    e.ax = e.x;
    e.ay = e.y;
  } else {
    dvx = clamp((e.ax - e.x) * 1.5, -20 * u, 20 * u);
    dvy = clamp((e.ay - e.y) * 1.5, -20 * u, 20 * u);
  }
  steer(e, dvx, dvy, 4, dt);
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  // chassis slowly yaws toward aim (forces feet to re-place)
  e.heading = turnToward(e.heading, e.aim, 0.6 * dt);
  updateRig(e.rig, e.x, e.y, e.heading, e.vx, e.vy, dt, e);
  updateEye(e.eye, e, e.x, e.y, target, dt, 0.15);
  updateGlitch(e, dt, 0.3 + e.charge * 2, 0.05);
}

function drawBody(ctx: Ctx2D, e: Sentinel, time: number): void {
  const u = e.size / 70;
  const w = Math.max(0.8, 0.95 * Math.sqrt(u));
  drawRig(ctx, e.rig, w, e.tremble * 0.5, 1);
  const c = Math.cos(e.heading);
  const s = Math.sin(e.heading);
  const tj = e.tremble ? (Math.random() - 0.5) * e.tremble : 0;
  const bx = e.x + c * e.rig.offX - s * e.rig.offY + tj;
  const by = e.y + s * e.rig.offX + c * e.rig.offY + tj;

  // aim line (charge tell)
  if (e.mode === CHARGE && e.charge > 0.05) {
    const flick = 0.6 + 0.4 * Math.sin(time * 60);
    ctx.strokeStyle = hotA(e.charge * 0.55 * flick);
    ctx.lineWidth = Math.max(0.6, 0.7 * u);
    ctx.setLineDash(e.charge > 0.5 ? NODASH : DASH);
    ctx.beginPath();
    const l0 = 28 * u;
    const l1 = l0 + 260 * u * Math.min(1, e.charge * 1.6);
    ctx.moveTo(bx + Math.cos(e.aim) * l0, by + Math.sin(e.aim) * l0);
    ctx.lineTo(bx + Math.cos(e.aim) * l1, by + Math.sin(e.aim) * l1);
    ctx.stroke();
    ctx.setLineDash(NODASH);
  }

  // hull
  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(e.heading);
  polyPath(ctx, e.hull, 1, 1);
  ctx.fillStyle = PAL.body;
  ctx.fill();
  ctx.lineWidth = w * 1.3;
  ctx.strokeStyle = orangeA(0.8);
  ctx.stroke();
  // plating + vents
  ctx.lineWidth = w * 0.8;
  ctx.strokeStyle = PAL.grayMid;
  ctx.beginPath();
  ctx.moveTo(-14 * u, -2 * u);
  ctx.lineTo(-6 * u, -10 * u);
  ctx.moveTo(-12 * u, 6 * u);
  ctx.lineTo(4 * u, 10 * u);
  for (let i = 0; i < 4; i++) {
    ctx.moveTo((-13 + i * 2) * u, 0);
    ctx.lineTo((-13 + i * 2) * u, 4 * u);
  }
  ctx.stroke();
  // core ring
  ctx.strokeStyle = coreColor(e.charge);
  ctx.lineWidth = 2.2 * u;
  ctx.beginPath();
  ctx.arc(0, 0, 9.5 * u, 0, TAU);
  ctx.stroke();
  ctx.restore();
  drawGlow(ctx, bx, by, (12 + e.charge * 18) * u, 0.15 + e.charge * 0.7);

  // turret
  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(e.aim);
  const rc = e.recoil * 5 * u;
  ctx.fillStyle = PAL.bodyHi;
  ctx.strokeStyle = orangeA(0.9);
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(9 * u - rc * 0.3, -5 * u);
  ctx.lineTo(9 * u - rc * 0.3, 5 * u);
  ctx.lineTo(-3 * u, 7.5 * u);
  ctx.lineTo(-8 * u, 0);
  ctx.lineTo(-3 * u, -7.5 * u);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // barrel: twin rails
  ctx.strokeStyle = PAL.grayMid;
  ctx.lineWidth = w * 1.4;
  ctx.beginPath();
  ctx.moveTo(8 * u - rc, -1.8 * u);
  ctx.lineTo(27 * u - rc, -1.8 * u);
  ctx.moveTo(8 * u - rc, 1.8 * u);
  ctx.lineTo(27 * u - rc, 1.8 * u);
  ctx.stroke();
  ctx.strokeStyle = orangeA(0.9);
  ctx.lineWidth = w * 0.8;
  ctx.beginPath();
  ctx.moveTo(24 * u - rc, -3 * u);
  ctx.lineTo(24 * u - rc, 3 * u);
  ctx.stroke();
  // charge creeping along the rails
  if (e.charge > 0.05) {
    ctx.fillStyle = coreColor(e.charge);
    const l = 19 * u * e.charge;
    ctx.fillRect(8 * u - rc, -0.7 * u, l, 1.4 * u);
  }
  ctx.restore();
  const mx = bx + Math.cos(e.aim) * (27 * u - rc);
  const my = by + Math.sin(e.aim) * (27 * u - rc);
  drawEye(ctx, bx, by, 4.2 * u, e.eye, e.charge, 0.2);
  if (e.mode === CHARGE) drawGlow(ctx, mx, my, (4 + e.charge * 8) * u, e.charge * 0.8);
  if (e.flash > 0) {
    drawGlow(ctx, mx, my, (10 + e.flash * 22) * u, e.flash);
    ctx.strokeStyle = whiteA(e.flash);
    ctx.lineWidth = Math.max(0.8, u);
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const a = e.aim + (k - 1.5) * 0.45;
      const l = (6 + e.flash * 14) * u * (k === 1 || k === 2 ? 1.5 : 0.8);
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + Math.cos(a) * l, my + Math.sin(a) * l);
    }
    ctx.stroke();
  }
}

export function drawSentinel(ctx: Ctx2D, e: Sentinel, time: number): void {
  drawGlitched(ctx, e, time, e.size * 1.2, drawBody);
}

export function drawSentinelDebug(ctx: Ctx2D, e: Sentinel): void {
  drawRigDebug(ctx, e.rig);
  ctx.strokeStyle = 'rgba(150,150,150,0.6)';
  ctx.beginPath();
  ctx.arc(e.ax, e.ay, 4, 0, TAU);
  ctx.moveTo(e.x, e.y);
  ctx.lineTo(e.x + Math.cos(e.aimGoal) * 60, e.y + Math.sin(e.aimGoal) * 60);
  ctx.stroke();
}
