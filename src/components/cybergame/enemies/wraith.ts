// WRAITH: torn veil / shroud. A hooded shroud with a ragged hem, torn veil
// ribbons (verlet strips with holes) and two hairline whip tendrils, a void
// face hollow holding one large slit eye (focal), a small blinking eye and
// two lids that only open while charging. Phases out (alpha + heavy tears),
// relocates fast while near-invisible, then phases back in with a flare
// and a coordinated whip of every strip.

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
  robustUpdate,
  EnemyIntent,
  IntentMode,
} from './common';
import { Tendril, drawRibbons, drawTendrilDebug, drawTendrils, initTendril, makeTendril, updateTendril, whipTendril } from './tendril';

export const WRAITH_SIZE = 60;

const SHOWN = 0;
const FADING = 1;
const GHOST = 2;
const RETURNING = 3;

const N_RIB = 4;
const N_HAIR = 2;
const FRINGE = 9;

export interface Wraith extends EnemyBase {
  kind: 'wraith';
  /** ribbons first (N_RIB), then hairline whips */
  tendrils: Tendril[];
  hairs: Tendril[];
  anchors: Float32Array; // local x,y per tendril
  eye: EyeTrack;
  eye2: EyeTrack;
  hood: Float32Array; // local outline; FRINGE pairs from index 10 flutter
  vis: number;
  mode: number;
  modeT: number;
  dur: number;
  goalX: number;
  goalY: number;
  driftPh: number;
  whipT: number;
  tilt: number;
  shattered: boolean;
}

export function createWraith(x: number, y: number, seed: number, opts?: CreateOpts): Wraith {
  const size = opts?.size ?? WRAITH_SIZE;
  const b = makeBase(x, y, seed, size);
  const u = size / 60;
  // hood: off-centre crown spike, torn notch on the right shoulder, ragged hem
  const pts: number[] = [
    randRange(b, -3, 1) * u, -26 * u,
    5 * u, -16 * u,
    9 * u, -14 * u, // notch
    8 * u, -10 * u,
    randRange(b, 14, 17) * u, -2 * u,
  ];
  for (let i = 0; i < FRINGE; i++) {
    const f = i / (FRINGE - 1);
    pts.push((13 - f * 27) * u, (9 + (i % 2) * randRange(b, 4, 10)) * u);
  }
  pts.push(-15 * u, 0, -12 * u, -11 * u, -6 * u, -18 * u);
  const tendrils: Tendril[] = [];
  const anchors = new Float32Array((N_RIB + N_HAIR) * 2);
  for (let i = 0; i < N_RIB + N_HAIR; i++) {
    const rib = i < N_RIB;
    const n = rib ? 8 + ((rand(b) * 4) | 0) : 12 + ((rand(b) * 4) | 0);
    const seg = (rib ? randRange(b, 3.6, 5) : randRange(b, 3, 4)) * u;
    const td = makeTendril(n, seg, randRange(b, 0.7, 1.2), randRange(b, 1.6, 2.8), i * 0.9 + rand(b), rib ? randRange(b, 0.035, 0.06) : randRange(b, 0.05, 0.08));
    td.dampK = 0.925;
    if (rib) {
      const tear = new Float32Array(n);
      const hole = 2 + ((rand(b) * (n - 4)) | 0);
      for (let k = 0; k < n; k++) tear[k] = k === hole ? 0.15 : k === hole + 1 ? 0.55 : 0.8 + rand(b) * 0.4;
      td.tear = tear;
    }
    const ax = rib ? (10 - (i / (N_RIB - 1)) * 21 + randRange(b, -1.5, 1.5)) * u : (i === N_RIB ? 5 : -7) * u;
    const ay = (rib ? 9 : 7) * u;
    anchors[i * 2] = ax;
    anchors[i * 2 + 1] = ay;
    initTendril(td, x + ax, y + ay, Math.PI / 2);
    tendrils.push(td);
  }
  return {
    ...b,
    kind: 'wraith',
    tendrils,
    hairs: tendrils.slice(N_RIB),
    anchors,
    eye: makeEye(),
    eye2: makeEye(),
    hood: new Float32Array(pts),
    vis: 1,
    mode: SHOWN,
    modeT: 0,
    dur: randRange(b, 2, 4),
    goalX: x,
    goalY: y,
    driftPh: rand(b) * TAU,
    whipT: randRange(b, 1, 3),
    tilt: 0,
    shattered: false,
  };
}

/** Phase out now and strike from a new position. */
export function wraithStrike(e: Wraith): void {
  if (e.mode !== SHOWN || e.deathT >= 0) return;
  e.mode = FADING;
  e.modeT = 0;
}

/** Optional hit reaction: knockback, strips whip, glitch-out. */
export function hurtWraith(e: Wraith, dx: number, dy: number, strength = 1): void {
  if (e.deathT >= 0) return;
  hurtBase(e, dx, dy, strength * 1.2);
  for (let i = 0; i < e.tendrils.length; i++) whipTendril(e.tendrils[i], (rand(e) < 0.5 ? -1 : 1) * 3 * (e.size / 60), i * 0.02);
  e.tilt = (dx > 0 ? 1 : -1) * 0.35;
}

/** Optional death: strips go limp and fall away, the shroud tears apart. */
export function killWraith(e: Wraith): void {
  killBase(e);
  e.vis = 1;
}

function stepTendrils(e: Wraith, dt: number, ampMul: number, freqMul: number, stiffMul: number): void {
  const sp = Math.hypot(e.vx, e.vy);
  const u = e.size / 60;
  const m = Math.min(1, sp / (30 * u));
  // trail opposite the motion; hang "down-back" when still
  const back = Math.atan2(-Math.sin(e.heading) * m + 0.9, -Math.cos(e.heading) * m);
  const c = Math.cos(e.tilt);
  const s = Math.sin(e.tilt);
  for (let i = 0; i < e.tendrils.length; i++) {
    const lx = e.anchors[i * 2];
    const ly = e.anchors[i * 2 + 1];
    const spread = i < N_RIB ? (i - (N_RIB - 1) / 2) * 0.14 : (i === N_RIB ? 0.35 : -0.4);
    updateTendril(e.tendrils[i], e.x + c * lx - s * ly, e.y + s * lx + c * ly, back + spread + e.tilt, dt, e.t, ampMul, freqMul, stiffMul);
  }
}

function dying(e: Wraith, dt: number, target: Vec): void {
  const u = e.size / 60;
  const t = e.deathT;
  steer(e, 0, 30 * u, 3, dt); // sinks
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  e.tilt += (0.6 - e.tilt) * damp(3, dt);
  stepTendrils(e, dt, 0.3, 0.5, Math.max(0.05, 1 - t * 3));
  if (!e.shattered && t >= DEATH_COLLAPSE) {
    e.shattered = true;
    const d = ensureDebris(e, 16, 0.8);
    addDebrisPoly(d, e.hood, e.x, e.y, e.tilt, 1, e.x, e.y - 4 * u, 120 * u, e.vx, e.vy, e);
    burstGlyphs(e, e.x, e.y - 4 * u, 12, 150 * u);
  }
  updateEye(e.eye, e, e.x, e.y, target, dt, 1.5, 1);
  updateGlitch(e, dt, 3.5, 0.2);
  updateTrail(e, dt, 1e9);
}

const resetWraith = (e: Wraith): void => {
  const c = Math.cos(e.tilt);
  const s = Math.sin(e.tilt);
  for (let i = 0; i < e.tendrils.length; i++) {
    const lx = e.anchors[i * 2];
    const ly = e.anchors[i * 2 + 1];
    initTendril(e.tendrils[i], e.x + c * lx - s * ly, e.y + s * lx + c * ly, Math.PI / 2 + e.tilt);
  }
};

/** Robust public update (see robustUpdate). */
const modeWraith = (e: Wraith, mode: IntentMode): void => {
  if (mode === 'lunge') wraithStrike(e);
};

/** Robust public update (see robustUpdate). */
export function updateWraith(e: Wraith, dt: number, target: Vec, intent?: Vec | EnemyIntent | null): void {
  const u = e.size / 60;
  robustUpdate(e, dt, target, intent, 160 * u, 220 * u, 10, stepWraith, resetWraith, modeWraith);
}

function stepWraith(e: Wraith, dt: number, target: Vec, intent: Vec | null): void {
  e.t += dt;
  if (tickFx(e, dt)) {
    dying(e, dt, target);
    return;
  }
  e.modeT += dt;
  const u = e.size / 60;
  let speedMul = 1;
  switch (e.mode) {
    case SHOWN:
      e.vis += (1 - e.vis) * damp(6, dt);
      e.charge += (0 - e.charge) * damp(2, dt);
      if (e.modeT > e.dur && !e.mo.mode) wraithStrike(e); // director mode: strikes come via 'lunge'
      break;
    case FADING: {
      const p = Math.min(1, e.modeT / 0.3);
      e.vis = 1 - p * p * 0.88;
      if (p >= 1) {
        e.mode = GHOST;
        e.modeT = 0;
        e.dur = randRange(e, 0.6, 1.1);
        const a = rand(e) * TAU;
        const r = randRange(e, 50, 90) * u;
        e.goalX = target.x + Math.cos(a) * r;
        e.goalY = target.y + Math.sin(a) * r * 0.7 - 30 * u;
      }
      break;
    }
    case GHOST:
      e.vis = 0.1 + 0.05 * (0.5 + 0.5 * Math.sin(e.t * 53)) * (0.5 + 0.5 * Math.sin(e.t * 7.3));
      e.charge = Math.min(1, e.modeT / e.dur);
      speedMul = 4;
      if (e.modeT > e.dur) {
        e.mode = RETURNING;
        e.modeT = 0;
        for (let i = 0; i < e.tendrils.length; i++) whipTendril(e.tendrils[i], (i % 2 ? 1 : -1) * 2.6 * u, i * 0.035);
      }
      break;
    default: {
      const p = Math.min(1, e.modeT / 0.25);
      e.vis = 0.12 + (1 - (1 - p) * (1 - p)) * 0.88;
      e.charge = 1;
      if (p >= 1) {
        e.mode = SHOWN;
        e.modeT = 0;
        e.dur = randRange(e, 2.2, 4.5);
      }
    }
  }

  let dvx: number;
  let dvy: number;
  if (intent && e.mode !== GHOST) {
    dvx = intent.x;
    dvy = intent.y;
  } else {
    const gx = e.mode === GHOST ? e.goalX : target.x + Math.sin(e.t * 0.5 + e.driftPh) * 60 * u;
    const gy = e.mode === GHOST ? e.goalY : target.y - 70 * u + Math.sin(e.t * 0.8 + e.driftPh) * 20 * u;
    const dx = gx - e.x;
    const dy = gy - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const sp = Math.min(d * 1.5, 38 * u * speedMul);
    dvx = (dx / d) * sp;
    dvy = (dy / d) * sp;
  }
  steer(e, dvx, dvy, e.mode === GHOST ? 6 : 2.2, dt);
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  const sp = Math.hypot(e.vx, e.vy);
  if (sp > 4 * u) e.heading = turnToward(e.heading, Math.atan2(e.vy, e.vx), 2.5 * dt);
  // the shroud banks into lateral motion
  e.tilt += (clamp(e.vx / (90 * u), -0.3, 0.3) - e.tilt) * damp(3, dt);

  // occasional idle whip of one strip
  e.whipT -= dt;
  if (e.whipT <= 0) {
    e.whipT = randRange(e, 1.2, 3.5);
    const i = (rand(e) * e.tendrils.length) | 0;
    whipTendril(e.tendrils[i], (rand(e) < 0.5 ? -1 : 1) * randRange(e, 1.5, 3) * u, 0);
  }
  stepTendrils(e, dt, 1 + e.charge * 0.8, 1 + e.charge, 1);
  updateEye(e.eye, e, e.x - 1 * u, e.y - 6 * u, target, dt, 0.4, e.charge);
  updateEye(e.eye2, e, e.x + 5 * u, e.y - 11 * u, target, dt, 0.9, e.charge);
  const ghosting = e.mode === FADING || e.mode === RETURNING || e.mode === GHOST;
  updateGlitch(e, dt, ghosting ? 9 : 0.5, ghosting ? 0.2 : 0.05);
  updateTrail(e, dt, 110 * u);
}

function drawBody(ctx: Ctx2D, e: Wraith, time: number): void {
  const u = e.size / 60;
  const w = Math.max(0.75, 0.9 * Math.sqrt(u));
  const a0 = ctx.globalAlpha;
  ctx.globalAlpha = a0 * e.vis;
  const fill = silFill(e);
  const dying = e.deathT >= 0;
  const fade = dying ? clamp(1 - (e.deathT - DEATH_COLLAPSE) / 0.6, 0, 1) : 1;
  ctx.globalAlpha = a0 * e.vis * fade;
  drawTendrils(ctx, e.hairs, N_HAIR, w * 1.3, w * 0.8, 1, 0);
  drawRibbons(ctx, e.tendrils, N_RIB, 4 * u, fill, edgeA(e, 0.7), Math.max(1, w));
  if (e.shattered) {
    ctx.globalAlpha = a0;
    return;
  }

  ctx.save();
  const bob = Math.sin(time * 1.7 + e.driftPh) * 1.5 * u;
  ctx.translate(e.x, e.y + bob);
  ctx.rotate(e.tilt);
  const breathe = 1 + Math.sin(time * 1.9 + e.driftPh) * 0.025;
  ctx.scale(breathe, 2 - breathe);
  // hood with fluttering hem
  const h = e.hood;
  ctx.beginPath();
  ctx.moveTo(h[0], h[1]);
  const fs = 10;
  const fe = fs + FRINGE * 2;
  for (let i = 2; i < h.length; i += 2) {
    let y = h[i + 1];
    let x = h[i];
    if (i >= fs && i < fe) {
      y += Math.sin(time * 5.2 + i) * 1.8 * u;
      x += Math.sin(time * 3.7 + i * 1.7) * 0.8 * u;
    }
    ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = Math.max(1, w);
  ctx.lineJoin = 'miter';
  ctx.strokeStyle = edgeA(e, 0.65 + e.charge * 0.35);
  ctx.stroke();
  // inner fold lines
  ctx.strokeStyle = orangeA(0.22);
  ctx.beginPath();
  ctx.moveTo(h[0], h[1]);
  ctx.lineTo(-3 * u, -15 * u);
  ctx.moveTo(8 * u, -10 * u);
  ctx.lineTo(9 * u, 6 * u);
  ctx.moveTo(-11 * u, -6 * u);
  ctx.lineTo(-10 * u, 8 * u);
  ctx.stroke();
  // void face hollow
  ctx.fillStyle = PAL.void;
  ctx.beginPath();
  ctx.moveTo(-1 * u, -17 * u);
  ctx.quadraticCurveTo(10 * u, -12 * u, 7 * u, 2 * u);
  ctx.lineTo(-1 * u, 7 * u);
  ctx.lineTo(-9 * u, 1 * u);
  ctx.quadraticCurveTo(-11 * u, -12 * u, -1 * u, -17 * u);
  ctx.fill();
  ctx.strokeStyle = PAL.grayDim;
  ctx.lineWidth = w;
  ctx.stroke();
  // core below the eyes (breathing)
  const cg = 0.3 + 0.15 * Math.sin(time * 2.4 + e.driftPh) + e.charge * 0.7;
  ctx.fillStyle = coreColor(cg);
  ctx.beginPath();
  ctx.moveTo(-1 * u, 1.5 * u);
  ctx.lineTo(1.5 * u, 4 * u);
  ctx.lineTo(-1 * u, 6.5 * u);
  ctx.lineTo(-3.5 * u, 4 * u);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const c = Math.cos(e.tilt);
  const s = Math.sin(e.tilt);
  const ox = e.x;
  const oy = e.y + bob;
  drawGlow(ctx, ox - s * 4 * u, oy + c * 4 * u, (9 + e.charge * 14) * u, (dying ? 0.9 : 0.14 + e.charge * 0.6) * e.vis);
  drawEye(ctx, ox + c * -1 * u - s * -6 * u, oy + s * -1 * u + c * -6 * u, 5.2 * u, e.eye, e.charge, 0.85, e.tilt);
  drawEye(ctx, ox + c * 5 * u - s * -11 * u, oy + s * 5 * u + c * -11 * u, 1.9 * u, e.eye2, e.charge, 0.4, e.tilt + 0.5);
  drawChargeEye(ctx, ox + c * -6.5 * u - s * -12 * u, oy + s * -6.5 * u + c * -12 * u, 2.3 * u, e.eye, e.charge, e.tilt - 0.4);
  drawChargeEye(ctx, ox + c * 3.5 * u - s * -1.5 * u, oy + s * 3.5 * u + c * -1.5 * u, 1.6 * u, e.eye, e.charge, e.tilt + 0.3);
  ctx.globalAlpha = a0;
}

export function drawWraith(ctx: Ctx2D, e: Wraith, time: number): void {
  const a0 = ctx.globalAlpha;
  ctx.globalAlpha = a0 * Math.max(0.2, e.vis);
  drawTrail(ctx, e);
  ctx.globalAlpha = a0;
  drawGlitched(ctx, e, time, e.size * 1.4, drawBody);
  if (e.shattered) {
    drawDebris(ctx, e.debris, time);
    const p = (e.deathT - DEATH_COLLAPSE) / 0.5;
    if (p < 1) drawGlow(ctx, e.x, e.y - 4 * (e.size / 60), (14 + p * 26) * (e.size / 60), (1 - clamp(p, 0, 1)) * 0.9);
  }
}

export function drawWraithDebug(ctx: Ctx2D, e: Wraith): void {
  drawTendrilDebug(ctx, e.tendrils);
  ctx.strokeStyle = PAL.orange;
  ctx.beginPath();
  ctx.arc(e.goalX, e.goalY, 4, 0, TAU);
  ctx.stroke();
}
