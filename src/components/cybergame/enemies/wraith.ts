// WRAITH: floating hooded shroud with a drifting cluster of eyes and long
// trailing tendrils. Phases out (alpha + heavy slicing), relocates fast while
// near-invisible, then phases back in with a charged flare.

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
  makeBase,
  makeEye,
  orangeA,
  rand,
  randRange,
  steer,
  turnToward,
  updateEye,
  updateGlitch,
  updateTrail,
} from './common';
import { Tendril, drawTendrilDebug, drawTendrils, initTendril, makeTendril, updateTendril } from './tendril';

export const WRAITH_SIZE = 60;

const SHOWN = 0;
const FADING = 1;
const GHOST = 2;
const RETURNING = 3;

interface WEye {
  lx: number;
  ly: number;
  r: number;
  ph: number;
  track: EyeTrack;
}

export interface Wraith extends EnemyBase {
  kind: 'wraith';
  tendrils: Tendril[];
  anchors: Float32Array; // local x,y per tendril
  eyes: WEye[];
  hood: Float32Array; // local outline, last FRINGE pairs flutter
  vis: number;
  mode: number;
  modeT: number;
  dur: number;
  goalX: number;
  goalY: number;
  driftPh: number;
}

const FRINGE = 7;

export function createWraith(x: number, y: number, seed: number, opts?: CreateOpts): Wraith {
  const size = opts?.size ?? WRAITH_SIZE;
  const b = makeBase(x, y, seed, size);
  const u = size / 60;
  // hood: crown spike off-centre, uneven shoulders, ragged fringe
  const pts: number[] = [
    randRange(b, -3, 2) * u, -24 * u,
    6 * u, -15 * u,
    12 * u, -9 * u,
    randRange(b, 13, 16) * u, 0,
    11 * u, 8 * u,
  ];
  for (let i = 0; i < FRINGE; i++) {
    const f = i / (FRINGE - 1);
    pts.push((9 - f * 19) * u, (10 + (i % 2) * randRange(b, 3, 8)) * u);
  }
  pts.push(-14 * u, 2 * u, -11 * u, -10 * u, -5 * u, -16 * u);
  const nT = 5;
  const tendrils: Tendril[] = [];
  const anchors = new Float32Array(nT * 2);
  for (let i = 0; i < nT; i++) {
    const n = 9 + ((rand(b) * 5) | 0);
    const seg = randRange(b, 3.2, 5.2) * u;
    const td = makeTendril(n, seg, randRange(b, 0.8, 1.4), randRange(b, 2, 3.5), rand(b) * TAU, randRange(b, 0.05, 0.11));
    const ax = (8 - (i / (nT - 1)) * 16 + randRange(b, -1.5, 1.5)) * u;
    const ay = 10 * u;
    anchors[i * 2] = ax;
    anchors[i * 2 + 1] = ay;
    initTendril(td, x + ax, y + ay, Math.PI / 2);
    tendrils.push(td);
  }
  const eyes: WEye[] = [
    { lx: -1.5 * u, ly: -5 * u, r: 4.6 * u, ph: 0, track: makeEye() },
    { lx: 5.5 * u, ly: -9 * u, r: 2.1 * u, ph: 1.7, track: makeEye() },
    { lx: 6 * u, ly: -1.5 * u, r: 1.6 * u, ph: 3.1, track: makeEye() },
    { lx: -7 * u, ly: -11 * u, r: 2.6 * u, ph: 4.4, track: makeEye() },
    { lx: -5.5 * u, ly: 2 * u, r: 1.2 * u, ph: 5.2, track: makeEye() },
  ];
  return {
    ...b,
    kind: 'wraith',
    tendrils,
    anchors,
    eyes,
    hood: new Float32Array(pts),
    vis: 1,
    mode: SHOWN,
    modeT: 0,
    dur: randRange(b, 2, 4),
    goalX: x,
    goalY: y,
    driftPh: rand(b) * TAU,
  };
}

/** Phase out now and strike from a new position. */
export function wraithStrike(e: Wraith): void {
  if (e.mode !== SHOWN) return;
  e.mode = FADING;
  e.modeT = 0;
}

export function updateWraith(e: Wraith, dt: number, target: Vec, intent?: Vec | null): void {
  e.t += dt;
  e.modeT += dt;
  const u = e.size / 60;
  let speedMul = 1;
  switch (e.mode) {
    case SHOWN:
      e.vis += (1 - e.vis) * damp(6, dt);
      e.charge += (0 - e.charge) * damp(2, dt);
      if (e.modeT > e.dur) wraithStrike(e);
      break;
    case FADING: {
      const p = Math.min(1, e.modeT / 0.3);
      e.vis = 1 - p * 0.88;
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
      e.vis = 0.1 + Math.random() * 0.06;
      e.charge = Math.min(1, e.modeT / e.dur);
      speedMul = 4;
      if (e.modeT > e.dur) {
        e.mode = RETURNING;
        e.modeT = 0;
      }
      break;
    default: {
      const p = Math.min(1, e.modeT / 0.25);
      e.vis = 0.12 + p * 0.88;
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

  // tendrils trail opposite the motion, hang "down-back" when still
  const back = Math.atan2(-Math.sin(e.heading) * Math.min(1, sp / (30 * u)) + 0.9, -Math.cos(e.heading) * Math.min(1, sp / (30 * u)));
  const ampMul = 1 + e.charge * 0.8;
  for (let i = 0; i < e.tendrils.length; i++) {
    updateTendril(e.tendrils[i], e.x + e.anchors[i * 2], e.y + e.anchors[i * 2 + 1], back + (i - 2) * 0.12, dt, e.t, ampMul, 1 + e.charge, 1);
  }
  for (const ey of e.eyes) updateEye(ey.track, e, e.x + ey.lx, e.y + ey.ly, target, dt, 0.6);
  const ghosting = e.mode === FADING || e.mode === RETURNING || e.mode === GHOST;
  updateGlitch(e, dt, ghosting ? 9 : 0.5, ghosting ? 0.2 : 0.05);
  updateTrail(e, dt, 110 * u);
}

function drawBody(ctx: Ctx2D, e: Wraith, time: number): void {
  const u = e.size / 60;
  const w = Math.max(0.75, 0.9 * Math.sqrt(u));
  const a0 = ctx.globalAlpha;
  ctx.globalAlpha = a0 * e.vis;
  drawTendrils(ctx, e.tendrils, e.tendrils.length, w * 1.6, w, 1, 1.8 * u);

  ctx.save();
  ctx.translate(e.x, e.y + Math.sin(time * 1.7 + e.driftPh) * 1.5 * u);
  // hood with fluttering fringe
  const h = e.hood;
  ctx.beginPath();
  ctx.moveTo(h[0], h[1]);
  const fs = 10;
  const fe = fs + FRINGE * 2;
  for (let i = 2; i < h.length; i += 2) {
    let y = h[i + 1];
    let x = h[i];
    if (i >= fs && i < fe) {
      y += Math.sin(time * 6 + i) * 1.8 * u;
      x += Math.sin(time * 4.3 + i * 1.7) * 0.8 * u;
    }
    ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = PAL.body;
  ctx.fill();
  ctx.lineWidth = w;
  ctx.strokeStyle = orangeA(0.6 + e.charge * 0.4);
  ctx.stroke();
  // inner void / face hollow
  ctx.fillStyle = PAL.void;
  ctx.beginPath();
  ctx.ellipse(-1 * u, -4 * u, 9.5 * u, 11 * u, 0.15, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = PAL.grayDim;
  ctx.stroke();
  // hood seam lines
  ctx.strokeStyle = orangeA(0.25);
  ctx.beginPath();
  ctx.moveTo(h[0], h[1]);
  ctx.lineTo(-2 * u, -15 * u);
  ctx.moveTo(12 * u, -9 * u);
  ctx.lineTo(8 * u, 4 * u);
  ctx.stroke();
  // core below the eyes
  ctx.fillStyle = coreColor(e.charge);
  ctx.beginPath();
  ctx.moveTo(-2 * u, 5 * u);
  ctx.lineTo(1 * u, 7.5 * u);
  ctx.lineTo(-2 * u, 10 * u);
  ctx.lineTo(-4.5 * u, 7.5 * u);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  drawGlow(ctx, e.x - 2 * u, e.y + 7 * u, (8 + e.charge * 12) * u, 0.15 + e.charge * 0.6);
  for (const ey of e.eyes) {
    const dx = Math.sin(time * 1.3 + ey.ph) * 1.2 * u;
    const dy = Math.cos(time * 1.1 + ey.ph * 1.3) * 1.0 * u;
    drawEye(ctx, e.x + ey.lx + dx, e.y + ey.ly + dy, ey.r, ey.track, e.charge, 0.3);
  }
  ctx.globalAlpha = a0;
}

export function drawWraith(ctx: Ctx2D, e: Wraith, time: number): void {
  const a0 = ctx.globalAlpha;
  ctx.globalAlpha = a0 * Math.max(0.2, e.vis);
  drawTrail(ctx, e);
  ctx.globalAlpha = a0;
  drawGlitched(ctx, e, time, e.size * 1.4, drawBody);
}

export function drawWraithDebug(ctx: Ctx2D, e: Wraith): void {
  drawTendrilDebug(ctx, e.tendrils);
  ctx.strokeStyle = PAL.orange;
  ctx.beginPath();
  ctx.arc(e.goalX, e.goalY, 4, 0, TAU);
  ctx.stroke();
}
