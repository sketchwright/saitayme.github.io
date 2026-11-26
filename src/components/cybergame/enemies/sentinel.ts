// SENTINEL: armored lens tower. A heavy chassis of four broken armor plates
// (gaps, a missing chunk, a loose floating fragment) around a breathing core
// ring, on four long asymmetric hydraulic legs (one snapped and dragged).
// The turret is a stacked lens tower drawn with parallax tiers so it reads
// as tall; the lens is the eye. It tracks in mechanical steps, then a
// visible charge-up (iris dilates, second eye opens, rails fill, aim line,
// tremble) before firing (muzzle flash, recoil the planted legs absorb).

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
  drawDebris,
  drawEye,
  drawGlitched,
  drawGlow,
  drawTrail,
  edgeA,
  ensureDebris,
  hotA,
  hurtBase,
  killBase,
  makeBase,
  makeEye,
  orangeA,
  polySub,
  rand,
  randRange,
  scaledPoly,
  silFill,
  steer,
  tickFx,
  turnToward,
  updateEye,
  updateGlitch,
  updateTrail,
  whiteA,
  wrapAngle,
  robustUpdate,
} from './common';
import { Leg, Rig, drawRig, drawRigDebug, makeLeg, makeRig, plantRig, replantRig, rigDetach, rigFlinch, updateRig } from './ik';

export const SENTINEL_SIZE = 70;
/** chassis / tower are drawn at this multiple of the size unit */
const BK = 1.5;

const TRACK = 0;
const CHARGE = 1;
const COOL = 2;
const CHARGE_TIME = 1.15;
const DASH: number[] = [3, 4];
const NODASH: number[] = [];

// armor plates at size 70 (+x forward)
const PLATES: number[][] = [
  [17, -3, 13, -12.5, 3.5, -15.5, 1.5, -9, 10, -4.5],
  [-1.5, -15.5, -12.5, -12.5, -18, -3, -10, -2.2, -2.8, -8.6],
  [-18, 2.2, -13.5, 11.5, -4, 15.5, -3.2, 8.6, -10, 3.2],
  [1.5, 15.5, 9, 13, 11, 8.5, 7.5, 6.5, 6, 3.5, 15.5, 3, 10.5, 4],
];
const FRAG = [2.5, 0, -1.8, -2.2, -1.2, 2];

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
  plates: Float32Array[];
  frag: Float32Array;
  hull: Float32Array;
  tremble: number;
  shake: number;
  shattered: boolean;
}

export function createSentinel(x: number, y: number, seed: number, opts?: CreateOpts): Sentinel {
  const size = opts?.size ?? SENTINEL_SIZE;
  const b = makeBase(x, y, seed, size);
  const u = size / 70;
  const legs: Leg[] = [];
  // side, hipX, hipY, rest angle off forward (deg), reach, group, drag
  const specs: Array<[number, number, number, number, number, number, boolean]> = [
    // three stilts at irregular points: a long one front-left, a long one
    // from the right flank, and a buckled stump dragging from the rear-left
    [-1, 16.7, -17.8, 58, 25, 0, false],
    [1, 2.2, 23.3, 92, 27, 1, false],
    [-1, -21, -12.2, 150, 17, 1, true],
  ];
  for (const [side, hx0, hy0, deg, reach0, group, drag] of specs) {
    const hx = hx0 * u;
    const hy = hy0 * u;
    const ang = (side * (deg + randRange(b, -6, 6)) * Math.PI) / 180;
    const reach = (reach0 + randRange(b, -3, 3)) * u;
    const rx = hx + Math.cos(ang) * reach;
    const ry = hy + Math.sin(ang) * reach;
    const total = reach * randRange(b, 1.5, 1.6);
    const segs = drag ? [total * 0.45, total * 0.35, total * 0.2] : [total * 0.42, total * 0.36, total * 0.22];
    legs.push(makeLeg({ hx, hy, rx, ry, side, group, segs, drag, broken: drag ? 1 : -1 }, b));
  }
  const rig = makeRig(legs, 9 * u, 0.15, 1.2);
  rig.sag = 0.3;
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
    plates: PLATES.map((p) => scaledPoly(b, p, u * BK, 1.4)),
    frag: scaledPoly(b, FRAG, u * BK, 0.6),
    hull: scaledPoly(b, [10, -4, 4, -10, -4, -10, -10, -4, -10, 4, -4, 10, 4, 10, 10, 4], u * BK, 0),
    tremble: 0,
    shake: 0,
    shattered: false,
  };
  plantRig(rig, x, y, e.heading);
  return e;
}

/** Skip straight to the charge-up tell. */
export function sentinelCharge(e: Sentinel): void {
  if (e.deathT >= 0) return;
  if (e.mode !== CHARGE) {
    e.mode = CHARGE;
    e.modeT = 0;
  }
}

export const sentinelMuzzle = (e: Sentinel, out: Vec): Vec => {
  const u = e.size / 70;
  const l = (27 - e.recoil * 5) * u * BK;
  out.x = e.x + Math.cos(e.aim) * l;
  out.y = e.y + Math.sin(e.aim) * l;
  return out;
};

/** Optional hit reaction: knockback, leg flinch, armor rattle, glitch. */
export function hurtSentinel(e: Sentinel, dx: number, dy: number, strength = 1): void {
  if (e.deathT >= 0) return;
  hurtBase(e, dx, dy, strength * 0.6);
  rigFlinch(e.rig, e);
  e.shake = 1;
}

/** Optional death: legs buckle and detach, armor and tower shatter. */
export function killSentinel(e: Sentinel): void {
  killBase(e);
  e.mode = COOL;
}

function dying(e: Sentinel, dt: number, target: Vec): void {
  const u = e.size / 70;
  const t = e.deathT;
  steer(e, 0, 0, 6, dt);
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  e.rig.collapse = Math.min(1, t / DEATH_COLLAPSE);
  const legs = e.rig.legs;
  for (let i = 0; i < legs.length; i++) if (t > 0.1 + i * 0.06) rigDetach(legs[i], e.x, e.y, 50 * u, e);
  e.tremble = 2 * u;
  e.aim += dt * 6 * (1 - e.rig.collapse * 0.5); // tower spins down
  if (!e.shattered && t >= DEATH_COLLAPSE) {
    e.shattered = true;
    const d = ensureDebris(e, 20, 0.8);
    for (const p of e.plates) addDebrisPoly(d, p, e.x, e.y, e.heading, 1, e.x, e.y, 110 * u, e.vx, e.vy, e);
    addDebrisPoly(d, e.hull, e.x, e.y, e.aim, 1, e.x, e.y, 60 * u, 0, 0, e);
    burstGlyphs(e, e.x, e.y, 12, 160 * u);
  }
  updateRig(e.rig, e.x, e.y, e.heading, e.vx, e.vy, dt, e);
  updateEye(e.eye, e, e.x, e.y, target, dt, 1.5, 1);
  updateGlitch(e, dt, 3.5, 0.2);
  updateTrail(e, dt, 1e9);
}

const resetSentinel = (e: Sentinel): void => {
  replantRig(e.rig, e.x, e.y, e.heading, e.vx, e.vy);
  e.ax = e.x;
  e.ay = e.y;
};

/** Robust public update (see robustUpdate). `fired` survives substeps. */
export function updateSentinel(e: Sentinel, dt: number, target: Vec, intent?: Vec | null): void {
  e.fired = false;
  const u = e.size / 70;
  robustUpdate(e, dt, target, intent, 60 * u, 200 * u, 6, stepSentinel, resetSentinel);
}

function stepSentinel(e: Sentinel, dt: number, target: Vec, intent: Vec | null): void {
  e.t += dt;
  if (tickFx(e, dt)) {
    dying(e, dt, target);
    return;
  }
  e.modeT += dt;
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
        e.shake = 0.7;
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
  // mechanical stepped aim with eased overshoot
  e.aimStepT -= dt;
  if (e.aimStepT <= 0 && aimRate > 0) {
    e.aimStepT = 0.08 + rand(e) * 0.08;
    const d = wrapAngle(want - e.aim);
    e.aimGoal = e.aim + clamp(d * 1.12, -aimRate * 0.12, aimRate * 0.12);
  }
  e.aim += wrapAngle(e.aimGoal - e.aim) * damp(26, dt);
  e.recoil = Math.max(0, e.recoil - dt * 3);
  e.flash = Math.max(0, e.flash - dt * 9);
  e.shake = Math.max(0, e.shake - dt * 4);

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
  e.heading = turnToward(e.heading, e.aim, 0.6 * dt);
  updateRig(e.rig, e.x, e.y, e.heading, e.vx, e.vy, dt, e);
  updateEye(e.eye, e, e.x, e.y, target, dt, 0.15, e.charge);
  updateGlitch(e, dt, 0.3 + e.charge * 2, 0.05);
}

function drawBody(ctx: Ctx2D, e: Sentinel, time: number): void {
  const u = e.size / 70;
  const w = Math.max(0.8, 0.95 * Math.sqrt(u));
  const fill = silFill(e);
  drawRig(ctx, e.rig, w * 1.15, e.tremble * 0.5, 1, time, fill);
  if (e.shattered) return;
  const c = Math.cos(e.heading);
  const s = Math.sin(e.heading);
  const tj = e.tremble ? Math.sin(time * 91) * e.tremble : 0;
  const bx = e.x + c * e.rig.offX - s * e.rig.offY + tj;
  const by = e.y + s * e.rig.offX + c * e.rig.offY - tj * 0.5;
  const lw = Math.max(1, w);
  const U = u * BK;
  const ca = Math.cos(e.aim);
  const sa = Math.sin(e.aim);

  // aim line (charge tell)
  if (e.mode === CHARGE && e.charge > 0.05) {
    const flick = 0.6 + 0.4 * Math.sin(time * 60);
    ctx.strokeStyle = hotA(e.charge * 0.55 * flick);
    ctx.lineWidth = Math.max(0.6, 0.7 * u);
    ctx.setLineDash(e.charge > 0.5 ? NODASH : DASH);
    ctx.beginPath();
    const l0 = 28 * u;
    const l1 = l0 + 260 * u * Math.min(1, e.charge * 1.6);
    ctx.moveTo(bx + ca * l0, by + sa * l0);
    ctx.lineTo(bx + ca * l1, by + sa * l1);
    ctx.stroke();
    ctx.setLineDash(NODASH);
  }

  // chassis
  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(e.heading);
  // breathing core ring (visible through the plate gaps)
  const cg = 0.1 + 0.12 * Math.sin(time * 2.2 + e.seed) + e.charge * 0.85;
  ctx.strokeStyle = coreColor(cg);
  ctx.lineWidth = 1.8 * U;
  ctx.beginPath();
  ctx.arc(0, 0, 13 * U, 0, TAU);
  ctx.stroke();
  // plates batched, each rattles on shake / spreads with charge
  const spread = (e.charge * 1.2 + e.shake * 1.5) * U;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i + 0.5) * (TAU / 4) - TAU / 4;
    const j = e.shake > 0 ? Math.sin(time * 70 + i * 3) * e.shake * 1.2 * U : 0;
    polySub(ctx, e.plates[i], Math.cos(a) * spread + j, Math.sin(a) * spread - j);
  }
  polySub(ctx, e.frag, 15.5 * U + Math.sin(time * 1.9) * 0.8 * U, 11.5 * U + Math.cos(time * 1.3) * 0.6 * U);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.lineJoin = 'miter';
  ctx.strokeStyle = edgeA(e, 0.85);
  ctx.stroke();
  // vents + rivets
  ctx.strokeStyle = PAL.grayMid;
  ctx.lineWidth = Math.max(0.6, w * 0.8);
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    ctx.moveTo((-15 + i * 2) * U, -1 * U);
    ctx.lineTo((-15 + i * 2) * U, 2 * U);
  }
  ctx.moveTo(6 * U, -12 * U);
  ctx.lineTo(10 * U, -9 * U);
  ctx.stroke();
  // antenna needles with off-white tips (one sways)
  const sway = Math.sin(time * 1.6 + e.seed) * 0.25;
  const a1x = -14 * U + Math.cos(Math.PI + 0.5 + sway) * 13 * U;
  const a1y = -8 * U + Math.sin(Math.PI + 0.5 + sway) * 13 * U;
  ctx.strokeStyle = orangeA(0.7);
  ctx.beginPath();
  ctx.moveTo(-14 * U, -8 * U);
  ctx.lineTo(a1x, a1y);
  ctx.moveTo(-12 * U, 9 * U);
  ctx.lineTo(-22 * U, 14 * U);
  ctx.stroke();
  ctx.fillStyle = whiteA(0.9);
  const ts = Math.max(1, 1.2 * U);
  ctx.fillRect(a1x - ts / 2, a1y - ts / 2, ts, ts);
  ctx.fillRect(-22 * U - ts / 2, 14 * U - ts / 2, ts, ts);
  ctx.restore();

  // lens tower: three tiers, each shifted along the aim (parallax height)
  const rc = e.recoil * 5 * U;
  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(e.aim);
  ctx.lineJoin = 'miter';
  // tier 1: hull octagon
  ctx.beginPath();
  polySub(ctx, e.hull, -rc * 0.3, 0);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = edgeA(e, 0.7);
  ctx.stroke();
  // barrel rails (under the top tiers)
  ctx.lineCap = 'butt';
  ctx.strokeStyle = orangeA(0.7);
  ctx.lineWidth = w * 1.4 + 2;
  ctx.beginPath();
  ctx.moveTo(8 * U - rc, -2 * U);
  ctx.lineTo(27 * U - rc, -2 * U);
  ctx.moveTo(8 * U - rc, 2 * U);
  ctx.lineTo(27 * U - rc, 2 * U);
  ctx.stroke();
  ctx.strokeStyle = fill;
  ctx.lineWidth = w * 1.4;
  ctx.stroke();
  if (e.charge > 0.05) {
    ctx.fillStyle = coreColor(e.charge);
    const l = 19 * U * e.charge;
    ctx.fillRect(8 * U - rc, -2.6 * U, l, 1.2 * U);
    ctx.fillRect(8 * U - rc, 1.4 * U, l * 0.9, 1.2 * U);
  }
  ctx.strokeStyle = whiteA(0.85);
  ctx.lineWidth = Math.max(0.8, w * 0.8);
  ctx.beginPath();
  ctx.moveTo(25 * U - rc, -3.2 * U);
  ctx.lineTo(25 * U - rc, 3.2 * U);
  ctx.stroke();
  // tier 2: hexagon offset forward
  const t2 = 1.6 * U - rc * 0.5;
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + Math.PI / 6;
    const r = 7.6 * U;
    if (k === 0) ctx.moveTo(t2 + Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(t2 + Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = PAL.bodyHi;
  ctx.fill();
  ctx.strokeStyle = edgeA(e, 0.9);
  ctx.stroke();
  // tier 3: lens bezel ring with ticks (slowly rotating)
  const t3 = 3 * U - rc * 0.6;
  ctx.strokeStyle = PAL.grayMid;
  ctx.lineWidth = Math.max(0.8, 1.6 * U);
  ctx.beginPath();
  ctx.arc(t3, 0, 5.8 * U, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = orangeA(0.8);
  ctx.lineWidth = Math.max(0.6, 0.7 * U);
  ctx.beginPath();
  const rot = time * (0.6 + e.charge * 5);
  for (let k = 0; k < 8; k++) {
    const a = rot + (k / 8) * TAU;
    ctx.moveTo(t3 + Math.cos(a) * 5.2 * U, Math.sin(a) * 5.2 * U);
    ctx.lineTo(t3 + Math.cos(a) * 6.6 * U, Math.sin(a) * 6.6 * U);
  }
  ctx.stroke();
  ctx.restore();
  // lens = eye (focal point)
  const lx = bx + ca * (3 * U - rc * 0.6);
  const ly = by + sa * (3 * U - rc * 0.6);
  drawEye(ctx, lx, ly, 4.8 * U, e.eye, Math.max(0.65, e.charge), 0.25 + e.charge * 0.5, e.aim + Math.PI / 2);

  // single glow: muzzle while charging / firing, else the core
  const mx = bx + ca * (27 * U - rc);
  const my = by + sa * (27 * U - rc);
  if (e.flash > 0) drawGlow(ctx, mx, my, (10 + e.flash * 22) * U, e.flash);
  else if (e.mode === CHARGE) drawGlow(ctx, mx, my, (5 + e.charge * 10) * U, 0.2 + e.charge * 0.8);
  else drawGlow(ctx, bx, by, (14 + e.charge * 10) * U, 0.14 + 0.06 * Math.sin(time * 2.2 + e.seed));
  if (e.flash > 0) {
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
  if (e.deathT >= 0) drawTrail(ctx, e);
  drawGlitched(ctx, e, time, e.size * 1.25, drawBody);
  if (e.shattered) {
    drawDebris(ctx, e.debris, time);
    const p = (e.deathT - DEATH_COLLAPSE) / 0.5;
    if (p < 1) drawGlow(ctx, e.x, e.y, (18 + p * 30) * (e.size / 70), (1 - clamp(p, 0, 1)) * 0.95);
  }
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
