// BOSS: rogue-AI eye. Segmented iris + rotating shell plates, a slowly
// turning outer ring of corrupted glyphs, and eight long segmented tendrils
// with follow-through that occasionally reach for the target. Phase 2 splits
// the shell to expose the core, tendrils go feral, glitching intensifies.

import {
  CreateOpts,
  Ctx2D,
  EnemyBase,
  EyeTrack,
  GLYPHS,
  PAL,
  TAU,
  Vec,
  coreColor,
  damp,
  drawGlitched,
  drawGlow,
  grayA,
  hotA,
  makeBase,
  makeEye,
  monoFont,
  orangeA,
  rand,
  randRange,
  steer,
  updateEye,
  updateGlitch,
  voidA,
  whiteA,
} from './common';
import { Tendril, drawTendrilDebug, drawTendrils, initTendril, makeTendril, updateTendril } from './tendril';

export const BOSS_SIZE = 170;

const N_GLYPH = 40;
const N_PLATE = 10;

const IDLE = 0;
const CHARGE = 1;
const PULSE = 2;

export interface Boss extends EnemyBase {
  kind: 'boss';
  phase2: boolean;
  p2: number;
  tendrils: Tendril[];
  tAng: Float32Array;
  ring: number;
  plateJit: Float32Array;
  glyph: Uint8Array;
  eye: EyeTrack;
  mode: number;
  modeT: number;
  dur: number;
  reachIdx: number;
  reachT: number;
  reachCd: number;
  homeX: number;
  homeY: number;
  pulse: number;
}

export function createBoss(x: number, y: number, seed: number, opts?: CreateOpts): Boss {
  const size = opts?.size ?? BOSS_SIZE;
  const b = makeBase(x, y, seed, size);
  const R = size * 0.3;
  const nT = 8;
  const tendrils: Tendril[] = [];
  const tAng = new Float32Array(nT);
  for (let i = 0; i < nT; i++) {
    // unequal spacing, biased toward the lower half (toward the player)
    const a = Math.PI / 2 + ((i - (nT - 1) / 2) / nT) * TAU * 0.82 + randRange(b, -0.15, 0.15);
    tAng[i] = a;
    const len = R * randRange(b, 1.5, 2.6);
    const n = 13 + ((rand(b) * 5) | 0);
    const td = makeTendril(n, len / n, randRange(b, 0.6, 1.0), randRange(b, 1.1, 1.8), rand(b) * TAU, randRange(b, 0.04, 0.08));
    td.dampK = 0.93;
    initTendril(td, x + Math.cos(a) * R, y + Math.sin(a) * R, a);
    tendrils.push(td);
  }
  const glyph = new Uint8Array(N_GLYPH);
  for (let i = 0; i < N_GLYPH; i++) glyph[i] = (rand(b) * GLYPHS.length) | 0;
  return {
    ...b,
    kind: 'boss',
    phase2: false,
    p2: 0,
    tendrils,
    tAng,
    ring: 0,
    plateJit: new Float32Array(N_PLATE),
    glyph,
    eye: makeEye(),
    mode: IDLE,
    modeT: 0,
    dur: 3,
    reachIdx: -1,
    reachT: 0,
    reachCd: 1.5,
    homeX: x,
    homeY: y,
    pulse: 0,
  };
}

export function setBossPhase(e: Boss, phase: 1 | 2): void {
  e.phase2 = phase === 2;
}

export function bossCharge(e: Boss): void {
  if (e.mode === IDLE) {
    e.mode = CHARGE;
    e.modeT = 0;
  }
}

export function updateBoss(e: Boss, dt: number, target: Vec, intent?: Vec | null): void {
  e.t += dt;
  e.modeT += dt;
  const R = e.size * 0.3;
  e.p2 += ((e.phase2 ? 1 : 0) - e.p2) * damp(3, dt);
  const p2 = e.p2;

  switch (e.mode) {
    case IDLE:
      e.charge += (0.1 + p2 * 0.25 - e.charge) * damp(2, dt);
      if (e.modeT > e.dur * (1 - p2 * 0.45)) bossCharge(e);
      break;
    case CHARGE: {
      const p = Math.min(1, e.modeT / 1.1);
      e.charge = p;
      if (p >= 1) {
        e.mode = PULSE;
        e.modeT = 0;
        e.pulse = 0.001;
      }
      break;
    }
    default:
      e.charge += (0 - e.charge) * damp(5, dt);
      if (e.modeT > 0.5) {
        e.mode = IDLE;
        e.modeT = 0;
        e.dur = randRange(e, 2.5, 4.5);
      }
  }
  if (e.pulse > 0) {
    e.pulse += dt * 2;
    if (e.pulse > 1) e.pulse = 0;
  }

  // drift: figure-8 around home, or follow intent
  let dvx: number;
  let dvy: number;
  if (intent) {
    dvx = intent.x;
    dvy = intent.y;
    e.homeX = e.x;
    e.homeY = e.y;
  } else {
    const gx = e.homeX + Math.sin(e.t * 0.35) * R * 0.6 + (target.x - e.homeX) * 0.12;
    const gy = e.homeY + Math.sin(e.t * 0.7) * R * 0.18;
    dvx = (gx - e.x) * 1.2;
    dvy = (gy - e.y) * 1.2;
  }
  steer(e, dvx, dvy, 1.5 + p2, dt);
  e.x += e.vx * dt;
  e.y += e.vy * dt;

  e.ring += dt * (0.12 + p2 * 0.25 + e.charge * 0.6);
  for (let i = 0; i < N_PLATE; i++) {
    if (rand(e) < dt * (2 + p2 * 14)) e.plateJit[i] = (rand(e) - 0.5) * (0.04 + p2 * 0.14) * R;
  }
  const corrupt = 0.03 + p2 * 0.25;
  for (let i = 0; i < N_GLYPH; i++) if (rand(e) < corrupt * dt * 10) e.glyph[i] = (rand(e) * GLYPHS.length) | 0;

  // tendril reach: one at a time
  e.reachCd -= dt;
  if (e.reachIdx < 0 && e.reachCd <= 0) {
    e.reachIdx = (rand(e) * e.tendrils.length) | 0;
    e.reachT = 0;
  }
  if (e.reachIdx >= 0) {
    e.reachT += dt * (1 + p2);
    if (e.reachT > 1.2) {
      e.reachIdx = -1;
      e.reachCd = randRange(e, 1.5, 3) * (1 - p2 * 0.6);
    }
  }
  const ampMul = 1 + p2 * 0.45 + e.charge * 0.3;
  const freqMul = 1 + p2 * 1.6 + e.charge * 0.8;
  const toT = Math.atan2(target.y - e.y, target.x - e.x);
  for (let i = 0; i < e.tendrils.length; i++) {
    const a = e.tAng[i] + Math.sin(e.t * 0.4 + i) * 0.08;
    let rest = a;
    let stiff = 1;
    if (i === e.reachIdx) {
      const k = Math.sin(Math.min(1, e.reachT / 1.2) * Math.PI);
      let d = toT - a;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      rest = a + d * k * 0.85;
      stiff = 1 + k * 2.5;
    }
    updateTendril(e.tendrils[i], e.x + Math.cos(a) * R * 0.95, e.y + Math.sin(a) * R * 0.95, rest, dt, e.t, ampMul, freqMul, stiff);
  }
  updateEye(e.eye, e, e.x, e.y, target, dt, 0.15 + p2 * 0.3);
  updateGlitch(e, dt, 0.4 + p2 * 3 + e.charge, 0.04 + p2 * 0.08);
}

function drawBody(ctx: Ctx2D, e: Boss, time: number): void {
  const R = e.size * 0.3;
  const u = e.size / 170;
  const p2 = e.p2;
  const x = e.x;
  const y = e.y;
  const w = Math.max(0.8, u);

  drawTendrils(ctx, e.tendrils, e.tendrils.length, 3.2 * u, w, 1, 3 * u);

  // pulse shock ring
  if (e.pulse > 0) {
    ctx.strokeStyle = orangeA((1 - e.pulse) * 0.8);
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.arc(x, y, R * (1.2 + e.pulse * 1.3), 0, TAU);
    ctx.stroke();
  }

  // tick ring
  const tr = R * 1.33;
  ctx.strokeStyle = grayA(0.7);
  ctx.lineWidth = Math.max(0.6, 0.8 * u);
  ctx.beginPath();
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * TAU - e.ring * 0.5;
    const l = i % 6 === 0 ? 5 * u : 2 * u;
    ctx.moveTo(x + Math.cos(a) * tr, y + Math.sin(a) * tr);
    ctx.lineTo(x + Math.cos(a) * (tr + l), y + Math.sin(a) * (tr + l));
  }
  ctx.stroke();

  // glyph ring
  const gr = R * 1.5;
  ctx.font = monoFont(9 * u + 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < N_GLYPH; i++) {
    if (i % 10 === 9 || i % 10 === 0) continue; // segment gaps
    const a = (i / N_GLYPH) * TAU + e.ring;
    const gx = x + Math.cos(a) * gr;
    const gy = y + Math.sin(a) * gr;
    const hot = p2 > 0.5 && (i * 7 + ((time * 6) | 0)) % 11 === 0;
    ctx.fillStyle = hot ? hotA(0.9) : i % 4 === 0 ? orangeA(0.75) : grayA(0.75);
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(GLYPHS[e.glyph[i]], 0, 0);
    ctx.restore();
  }

  // exposed core behind the shell (phase 2)
  drawGlow(ctx, x, y, R * (1.1 + p2 * 0.9 + e.charge * 0.4), 0.18 + p2 * 0.55 + e.charge * 0.35);

  // shell plates
  const gap = 0.07 + p2 * 0.12;
  const r0 = R * 1.0;
  const r1 = R * 1.24;
  for (let i = 0; i < N_PLATE; i++) {
    const a0 = (i / N_PLATE) * TAU - e.ring * 0.8 + gap;
    const a1 = ((i + 1) / N_PLATE) * TAU - e.ring * 0.8 - gap;
    const am = (a0 + a1) * 0.5;
    const off = p2 * R * 0.16 + e.plateJit[i];
    const ox = Math.cos(am) * off;
    const oy = Math.sin(am) * off;
    ctx.beginPath();
    ctx.arc(x + ox, y + oy, r1, a0, a1);
    ctx.arc(x + ox, y + oy, r0, a1, a0, true);
    ctx.closePath();
    ctx.fillStyle = PAL.body;
    ctx.fill();
    ctx.strokeStyle = orangeA(0.7);
    ctx.lineWidth = w;
    ctx.stroke();
  }
  // inner counter-rotating segments
  ctx.strokeStyle = orangeA(0.55);
  ctx.lineWidth = Math.max(0.8, 1.4 * u);
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const a0 = (i / 7) * TAU + e.ring * 1.3;
    ctx.moveTo(x + Math.cos(a0) * R * 0.9, y + Math.sin(a0) * R * 0.9);
    ctx.arc(x, y, R * 0.9, a0, a0 + 0.6);
  }
  ctx.stroke();

  // eyeball
  const er = R * 0.84;
  ctx.fillStyle = voidA(1 - p2 * 0.45);
  ctx.beginPath();
  ctx.arc(x, y, er, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = PAL.grayMid;
  ctx.lineWidth = w;
  ctx.stroke();
  // iris
  const ix = x + e.eye.ox * R * 0.22;
  const iy = y + e.eye.oy * R * 0.22;
  const ir = R * 0.52;
  ctx.fillStyle = coreColor(0.2 + e.charge * 0.6 + p2 * 0.3);
  ctx.beginPath();
  ctx.arc(ix, iy, ir, 0, TAU);
  ctx.fill();
  // segmented iris blades
  ctx.strokeStyle = voidA(0.7);
  ctx.lineWidth = Math.max(0.8, 1.2 * u);
  ctx.beginPath();
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * TAU + e.ring * 0.3;
    ctx.moveTo(ix + Math.cos(a) * ir * 0.38, iy + Math.sin(a) * ir * 0.38);
    ctx.lineTo(ix + Math.cos(a + 0.12) * ir, iy + Math.sin(a + 0.12) * ir);
  }
  ctx.stroke();
  ctx.strokeStyle = coreColor(0.6 + e.charge * 0.4);
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.arc(ix, iy, ir * 0.72, 0, TAU);
  ctx.stroke();
  // pupil: round -> slit in phase 2, contracts on charge
  const pr = ir * (0.42 - e.charge * 0.18);
  const px = ix + e.eye.ox * R * 0.06;
  const py = iy + e.eye.oy * R * 0.06;
  ctx.fillStyle = PAL.void;
  ctx.beginPath();
  ctx.ellipse(px, py, pr * (1 - p2 * 0.65), pr * (1 + p2 * 0.5), 0, 0, TAU);
  ctx.fill();
  if (p2 > 0.3) {
    // secondary pupils orbiting: the eye becomes a cluster
    ctx.fillStyle = voidA(p2);
    for (let k = 0; k < 3; k++) {
      const a = time * (0.8 + k * 0.3) + k * 2.1;
      const rr = ir * 0.62;
      const sr = pr * 0.28;
      ctx.beginPath();
      ctx.arc(ix + Math.cos(a) * rr, iy + Math.sin(a) * rr, sr, 0, TAU);
      ctx.fill();
    }
  }
  // core light inside the pupil
  ctx.fillStyle = coreColor(e.charge);
  ctx.fillRect(px - 1 * u, py - pr * 0.4, 2 * u, pr * 0.8);
  // glints + specular arc
  ctx.fillStyle = whiteA(0.9);
  ctx.fillRect(ix - ir * 0.5, iy - ir * 0.55, 2.2 * u, 2.2 * u);
  ctx.strokeStyle = whiteA(0.18);
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.arc(x, y, er * 0.9, Math.PI * 1.1, Math.PI * 1.45);
  ctx.stroke();
}

export function drawBoss(ctx: Ctx2D, e: Boss, time: number): void {
  drawGlitched(ctx, e, time, e.size * 1.1, drawBody);
}

export function drawBossDebug(ctx: Ctx2D, e: Boss): void {
  drawTendrilDebug(ctx, e.tendrils);
  if (e.reachIdx >= 0) {
    const td = e.tendrils[e.reachIdx];
    ctx.strokeStyle = PAL.orange;
    ctx.beginPath();
    ctx.arc(td.x[td.n - 1], td.y[td.n - 1], 5, 0, TAU);
    ctx.stroke();
  }
}
