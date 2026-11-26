// BOSS: rogue-AI eye. Iris machinery of three counter-rotating rings (blade
// ring, notched ring, toothed bezel) with eased angular velocities, an
// aperture pupil that dilates on charge, shell plates, a slowly turning
// ring of corrupted glyphs, three shell lids that open while charging, and
// eight long tendrils that sweep in a coordinated travelling wave, reach
// for the target one at a time and whip in sequence on each pulse.
// Phase 2 transition: alternate plates blow off as debris, the core ring is
// exposed, tendrils go feral, glitching intensifies.

import {
  CreateOpts,
  Ctx2D,
  DEATH_COLLAPSE,
  EnemyBase,
  EyeTrack,
  GLYPHS,
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
  drawGlitched,
  drawGlow,
  drawTrail,
  edgeA,
  ensureDebris,
  glitchForce,
  grayA,
  hotA,
  hurtBase,
  killBase,
  makeBase,
  makeEye,
  monoFont,
  orangeA,
  rand,
  randRange,
  silFill,
  steer,
  tickFx,
  updateEye,
  updateGlitch,
  updateTrail,
  voidA,
  whiteA,
  wrapAngle,
  robustUpdate,
} from './common';
import { Tendril, drawTendrilDebug, drawTendrils, initTendril, makeTendril, updateTendril, whipTendril } from './tendril';

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
  /** iris machinery: angles + eased angular velocities of 3 rings */
  ra: Float32Array;
  rw: Float32Array;
  plateJit: Float32Array;
  /** plate attachment 0..1 (0 = blown off in phase 2) */
  plateOn: Float32Array;
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
  /** -1 idle, else seconds into the phase-2 transition */
  transT: number;
  shattered: boolean;
}

export function createBoss(x: number, y: number, seed: number, opts?: CreateOpts): Boss {
  const size = opts?.size ?? BOSS_SIZE;
  const b = makeBase(x, y, seed, size);
  const R = size * 0.3;
  const nT = 8;
  const tendrils: Tendril[] = [];
  const tAng = new Float32Array(nT);
  for (let i = 0; i < nT; i++) {
    const a = Math.PI / 2 + ((i - (nT - 1) / 2) / nT) * TAU * 0.82 + randRange(b, -0.12, 0.12);
    tAng[i] = a;
    const len = R * randRange(b, 1.6, 2.6);
    const n = 13 + ((rand(b) * 5) | 0);
    // phase locked to the index so curls travel around the ring together
    const td = makeTendril(n, len / n, randRange(b, 0.65, 0.9), 1.3, i * 0.75, randRange(b, 0.035, 0.06));
    td.dampK = 0.935;
    initTendril(td, x + Math.cos(a) * R, y + Math.sin(a) * R, a);
    tendrils.push(td);
  }
  const glyph = new Uint8Array(N_GLYPH);
  for (let i = 0; i < N_GLYPH; i++) glyph[i] = (rand(b) * GLYPHS.length) | 0;
  const plateOn = new Float32Array(N_PLATE);
  plateOn.fill(1);
  return {
    ...b,
    kind: 'boss',
    phase2: false,
    p2: 0,
    tendrils,
    tAng,
    ring: 0,
    ra: new Float32Array(3),
    rw: new Float32Array([0.2, -0.5, 0.12]),
    plateJit: new Float32Array(N_PLATE),
    plateOn,
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
    transT: -1,
    shattered: false,
  };
}

const PLATE_ARC = new Float32Array(12);
/** Plate i as a world polygon (6 pts) for debris. */
const platePoly = (e: Boss, i: number): Float32Array => {
  const R = e.size * 0.3;
  const gap = 0.07 + e.p2 * 0.12;
  const a0 = (i / N_PLATE) * TAU - e.ring * 0.8 + gap;
  const a1 = ((i + 1) / N_PLATE) * TAU - e.ring * 0.8 - gap;
  const r0 = R;
  const r1 = R * 1.24;
  const am = (a0 + a1) / 2;
  const pts = PLATE_ARC;
  pts[0] = Math.cos(a0) * r0;
  pts[1] = Math.sin(a0) * r0;
  pts[2] = Math.cos(a0) * r1;
  pts[3] = Math.sin(a0) * r1;
  pts[4] = Math.cos(am) * r1 * 1.02;
  pts[5] = Math.sin(am) * r1 * 1.02;
  pts[6] = Math.cos(a1) * r1;
  pts[7] = Math.sin(a1) * r1;
  pts[8] = Math.cos(a1) * r0;
  pts[9] = Math.sin(a1) * r0;
  pts[10] = Math.cos(am) * r0 * 0.98;
  pts[11] = Math.sin(am) * r0 * 0.98;
  return pts;
};

export function setBossPhase(e: Boss, phase: 1 | 2): void {
  const to2 = phase === 2;
  if (to2 && !e.phase2 && e.deathT < 0) {
    // transition: alternate plates blow off
    e.transT = 0;
    const u = e.size / 170;
    const d = ensureDebris(e, 40, 1.1);
    for (let i = 0; i < N_PLATE; i += 2) {
      if (e.plateOn[i] < 0.5) continue;
      addDebrisPoly(d, platePoly(e, i), e.x, e.y, 0, 1, e.x, e.y, 220 * u, e.vx, e.vy, e);
      e.plateOn[i] = 0;
    }
    burstGlyphs(e, e.x, e.y, 14, 260 * u);
    glitchForce(e, 1.4);
    e.pulse = 0.001;
    for (let i = 0; i < e.tendrils.length; i++) whipTendril(e.tendrils[i], (i % 2 ? 1 : -1) * 7 * u, i * 0.04);
  }
  e.phase2 = to2;
}

export function bossCharge(e: Boss): void {
  if (e.mode === IDLE && e.deathT < 0) {
    e.mode = CHARGE;
    e.modeT = 0;
  }
}

/** Optional hit reaction: recoil, iris spasm, plates rattle, glitch. */
export function hurtBoss(e: Boss, dx: number, dy: number, strength = 1): void {
  if (e.deathT >= 0) return;
  hurtBase(e, dx, dy, strength * 0.25);
  for (let i = 0; i < 3; i++) e.rw[i] += (i % 2 ? -1 : 1) * 3;
  for (let i = 0; i < N_PLATE; i++) e.plateJit[i] = (rand(e) - 0.5) * 0.15 * e.size * 0.3;
  const k = (rand(e) * e.tendrils.length) | 0;
  whipTendril(e.tendrils[k], 5 * (e.size / 170), 0);
}

/** Optional death: tendrils go limp, every plate blows, the eye shatters. */
export function killBoss(e: Boss): void {
  killBase(e);
}

function stepTendrils(e: Boss, dt: number, target: Vec, limp: number): void {
  const R = e.size * 0.3;
  const p2 = e.p2;
  const ampMul = (1 + p2 * 0.45 + e.charge * 0.3) * (1 - limp * 0.7);
  const freqMul = (1 + p2 * 1.2 + e.charge * 0.6) * (1 - limp * 0.6);
  const toT = Math.atan2(target.y - e.y, target.x - e.x);
  for (let i = 0; i < e.tendrils.length; i++) {
    // coordinated sweep: a wave travelling around the ring
    const wave = Math.sin(e.t * (0.9 + p2 * 0.8) - i * 0.7) * (0.2 + p2 * 0.15);
    const a = e.tAng[i] + wave;
    let rest = a;
    let stiff = 1 - limp * 0.9;
    if (i === e.reachIdx && limp <= 0) {
      const k = Math.sin(Math.min(1, e.reachT / 1.2) * Math.PI);
      rest = a + wrapAngle(toT - a) * k * 0.85;
      stiff = 1 + k * 2.5;
    }
    if (limp > 0) rest = a + limp * 0.8 * (Math.PI / 2 - a) * 0.5;
    updateTendril(e.tendrils[i], e.x + Math.cos(a) * R * 0.95, e.y + Math.sin(a) * R * 0.95, rest, dt, e.t, ampMul, freqMul, stiff);
  }
}

const resetBoss = (e: Boss): void => {
  const R = e.size * 0.3;
  for (let i = 0; i < e.tendrils.length; i++) {
    const a = e.tAng[i];
    initTendril(e.tendrils[i], e.x + Math.cos(a) * R * 0.95, e.y + Math.sin(a) * R * 0.95, a);
  }
  e.homeX = e.x;
  e.homeY = e.y;
};

/** Robust public update (see robustUpdate). */
export function updateBoss(e: Boss, dt: number, target: Vec, intent?: Vec | null): void {
  const u = e.size / 170;
  robustUpdate(e, dt, target, intent, 160 * u, 240 * u, 20, stepBoss, resetBoss);
}

function stepBoss(e: Boss, dt: number, target: Vec, intent: Vec | null): void {
  e.t += dt;
  const R = e.size * 0.3;
  const u = e.size / 170;
  if (tickFx(e, dt)) {
    steer(e, 0, 20 * u, 2, dt);
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    for (let i = 0; i < 3; i++) {
      e.rw[i] += ((i % 2 ? -8 : 8) - e.rw[i]) * damp(4, dt);
      e.ra[i] += e.rw[i] * dt;
    }
    stepTendrils(e, dt, target, Math.min(1, e.deathT / DEATH_COLLAPSE));
    if (!e.shattered && e.deathT >= DEATH_COLLAPSE) {
      e.shattered = true;
      const d = ensureDebris(e, 48, 0.85);
      for (let i = 0; i < N_PLATE; i++) {
        if (e.plateOn[i] < 0.5) continue;
        addDebrisPoly(d, platePoly(e, i), e.x, e.y, 0, 1, e.x, e.y, 200 * u, 0, 0, e);
      }
      // eyeball shards
      const eb = new Float32Array(16);
      for (let k = 0; k < 8; k++) {
        eb[k * 2] = Math.cos((k / 8) * TAU) * R * 0.84;
        eb[k * 2 + 1] = Math.sin((k / 8) * TAU) * R * 0.84;
      }
      addDebrisPoly(d, eb, e.x, e.y, e.ra[0], 1, e.x, e.y, 120 * u, 0, 0, e);
      burstGlyphs(e, e.x, e.y, 14, 280 * u);
    }
    updateEye(e.eye, e, e.x, e.y, target, dt, 1.5, 1);
    updateGlitch(e, dt, 10, 0.2);
    updateTrail(e, dt, 1e9);
    return;
  }
  e.modeT += dt;
  e.p2 += ((e.phase2 ? 1 : 0) - e.p2) * damp(e.transT >= 0 ? 6 : 3, dt);
  const p2 = e.p2;
  if (e.transT >= 0) {
    e.transT += dt;
    if (e.transT > 1.2) e.transT = -1;
  }
  // plates re-attach when going back to phase 1
  for (let i = 0; i < N_PLATE; i++) {
    const goal = e.phase2 && i % 2 === 0 ? 0 : 1;
    if (goal > e.plateOn[i]) e.plateOn[i] = Math.min(1, e.plateOn[i] + dt * 1.6);
  }

  switch (e.mode) {
    case IDLE:
      e.charge += (0.1 + p2 * 0.25 - e.charge) * damp(2, dt);
      if (e.modeT > e.dur * (1 - p2 * 0.45)) bossCharge(e);
      break;
    case CHARGE: {
      const p = Math.min(1, e.modeT / 1.1);
      e.charge = p * p * (3 - 2 * p);
      if (p >= 1) {
        e.mode = PULSE;
        e.modeT = 0;
        e.pulse = 0.001;
        for (let i = 0; i < e.tendrils.length; i++) whipTendril(e.tendrils[i], (i % 2 ? 1 : -1) * 4 * u, i * 0.045);
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
  // iris machinery: eased angular velocities, different speeds/directions
  const spin = 1 + e.charge * 4 + p2 * 1.5;
  const W0 = 0.25 * spin;
  const W1 = -0.6 * spin;
  const W2 = 0.12 * spin;
  const kw = damp(2.5, dt);
  e.rw[0] += (W0 - e.rw[0]) * kw;
  e.rw[1] += (W1 - e.rw[1]) * kw;
  e.rw[2] += (W2 - e.rw[2]) * kw;
  for (let i = 0; i < 3; i++) e.ra[i] += e.rw[i] * dt;

  for (let i = 0; i < N_PLATE; i++) {
    if (rand(e) < dt * (2 + p2 * 10)) e.plateJit[i] = (rand(e) - 0.5) * (0.03 + p2 * 0.1) * R;
    else e.plateJit[i] -= e.plateJit[i] * damp(6, dt);
  }
  const corrupt = 0.03 + p2 * 0.25;
  for (let i = 0; i < N_GLYPH; i++) if (rand(e) < corrupt * dt * 10) e.glyph[i] = (rand(e) * GLYPHS.length) | 0;

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
  stepTendrils(e, dt, target, 0);
  updateEye(e.eye, e, e.x, e.y, target, dt, 0.15 + p2 * 0.3, Math.max(e.charge, p2 * 0.4));
  updateGlitch(e, dt, 0.4 + p2 * 2.5 + e.charge + (e.transT >= 0 ? 10 : 0), 0.04 + p2 * 0.08);
  updateTrail(e, dt, 1e9);
}

function drawBody(ctx: Ctx2D, e: Boss, time: number): void {
  const R = e.size * 0.3;
  const u = e.size / 170;
  const p2 = e.p2;
  const x = e.x;
  const y = e.y;
  const w = Math.max(1, u);
  const fill = silFill(e);
  const dying = e.deathT >= 0;
  const a0 = ctx.globalAlpha;
  if (dying) ctx.globalAlpha = a0 * clamp(1 - (e.deathT - DEATH_COLLAPSE) / 0.6, 0, 1);

  drawTendrils(ctx, e.tendrils, e.tendrils.length, 3.4 * u, w, 1, 3 * u);
  if (e.shattered) {
    ctx.globalAlpha = a0;
    return;
  }

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
    if (i % 10 === 9 || i % 10 === 0) continue;
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

  // single glow: core (swells with phase 2 / charge / transition)
  const tf = e.transT >= 0 ? Math.max(0, 1 - e.transT / 0.6) : 0;
  drawGlow(ctx, x, y, R * (1.1 + p2 * 0.9 + e.charge * 0.4 + tf * 0.8), dying ? 1 : 0.18 + p2 * 0.5 + e.charge * 0.35 + tf * 0.6);

  // exposed core ring + veins (visible where plates are gone)
  const r0 = R * 1.0;
  const r1 = R * 1.24;
  if (p2 > 0.02) {
    const beat = 0.5 + 0.5 * Math.sin(time * 5);
    ctx.strokeStyle = coreColor(0.5 + beat * 0.5 * p2);
    ctx.lineWidth = (r1 - r0) * 0.55 * p2;
    ctx.beginPath();
    ctx.arc(x, y, (r0 + r1) / 2, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = hotA(0.8 * p2);
    ctx.lineWidth = w;
    ctx.beginPath();
    for (let k = 0; k < 20; k++) {
      const a = (k / 20) * TAU + e.ra[1] * 0.2;
      ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
      ctx.lineTo(x + Math.cos(a + 0.05) * r1 * 1.05, y + Math.sin(a + 0.05) * r1 * 1.05);
    }
    ctx.stroke();
  }

  // shell plates (batched); blown plates slide back in when re-attaching
  const gap = 0.07 + p2 * 0.12;
  ctx.beginPath();
  for (let i = 0; i < N_PLATE; i++) {
    const on = e.plateOn[i];
    if (on <= 0.01) continue;
    const a0p = (i / N_PLATE) * TAU - e.ring * 0.8 + gap;
    const a1p = ((i + 1) / N_PLATE) * TAU - e.ring * 0.8 - gap;
    const am = (a0p + a1p) * 0.5;
    const off = p2 * R * 0.1 + e.plateJit[i] + (1 - on) * (1 - on) * R * 0.8;
    const ox = x + Math.cos(am) * off;
    const oy = y + Math.sin(am) * off;
    ctx.moveTo(ox + Math.cos(a0p) * r1, oy + Math.sin(a0p) * r1);
    ctx.arc(ox, oy, r1, a0p, a1p);
    ctx.arc(ox, oy, r0, a1p, a0p, true);
    ctx.closePath();
  }
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = edgeA(e, 0.75);
  ctx.lineWidth = w;
  ctx.stroke();
  // shell lids on the odd plates open while charging
  for (let i = 1; i < N_PLATE; i += 3) {
    const am = ((i + 0.5) / N_PLATE) * TAU - e.ring * 0.8;
    const rr = (r0 + r1) / 2 + p2 * R * 0.1;
    drawChargeEye(ctx, x + Math.cos(am) * rr, y + Math.sin(am) * rr, 4.2 * u, e.eye, e.charge, am + Math.PI / 2);
  }

  // eyeball
  const er = R * 0.84;
  ctx.fillStyle = voidA(1 - p2 * 0.35);
  ctx.beginPath();
  ctx.arc(x, y, er, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = PAL.grayMid;
  ctx.lineWidth = w;
  ctx.stroke();
  // ring 3: toothed bezel (slowest)
  ctx.fillStyle = orangeA(0.55);
  ctx.beginPath();
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU + e.ra[2];
    const cx = x + Math.cos(a) * er * 0.93;
    const cy = y + Math.sin(a) * er * 0.93;
    const s = (k % 4 === 0 ? 3.2 : 1.8) * u;
    ctx.rect(cx - s / 2, cy - s / 2, s, s);
  }
  ctx.fill();
  // iris
  const ix = x + e.eye.ox * R * 0.22;
  const iy = y + e.eye.oy * R * 0.22;
  const ir = R * 0.54;
  ctx.fillStyle = coreColor(0.2 + e.charge * 0.6 + p2 * 0.3);
  ctx.beginPath();
  ctx.arc(ix, iy, ir, 0, TAU);
  ctx.fill();
  // ring 1: blade ring
  ctx.strokeStyle = voidA(0.75);
  ctx.lineWidth = Math.max(0.8, 1.3 * u);
  ctx.beginPath();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU + e.ra[0];
    ctx.moveTo(ix + Math.cos(a) * ir * 0.4, iy + Math.sin(a) * ir * 0.4);
    ctx.lineTo(ix + Math.cos(a + 0.16) * ir, iy + Math.sin(a + 0.16) * ir);
  }
  ctx.stroke();
  // ring 2: notched ring (counter-rotating)
  ctx.strokeStyle = coreColor(0.65 + e.charge * 0.35);
  ctx.lineWidth = Math.max(1, 1.8 * u);
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + e.ra[1];
    ctx.moveTo(ix + Math.cos(a) * ir * 0.74, iy + Math.sin(a) * ir * 0.74);
    ctx.arc(ix, iy, ir * 0.74, a, a + 0.75);
  }
  ctx.stroke();
  ctx.strokeStyle = voidA(0.8);
  ctx.lineWidth = Math.max(0.8, u);
  ctx.beginPath();
  ctx.arc(ix, iy, ir, 0, TAU);
  ctx.stroke();
  // aperture pupil: heptagon that dilates with charge, slit in phase 2
  const dil = e.eye.dil;
  const pr = ir * (0.2 + dil * 0.42);
  const px = ix + e.eye.ox * R * 0.06;
  const py = iy + e.eye.oy * R * 0.06;
  const sxk = 1 - p2 * 0.62;
  ctx.fillStyle = PAL.void;
  ctx.beginPath();
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * TAU + e.ra[0] * 1.5;
    const vx = Math.cos(a) * pr * sxk;
    const vy = Math.sin(a) * pr * (1 + p2 * 0.45);
    if (k === 0) ctx.moveTo(px + vx, py + vy);
    else ctx.lineTo(px + vx, py + vy);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = orangeA(0.5);
  ctx.lineWidth = w;
  ctx.stroke();
  if (p2 > 0.3) {
    ctx.fillStyle = voidA(p2);
    for (let k = 0; k < 3; k++) {
      const a = e.ra[1] * 1.4 + k * 2.1;
      const rr = ir * 0.62;
      ctx.beginPath();
      ctx.arc(ix + Math.cos(a) * rr, iy + Math.sin(a) * rr, pr * 0.24, 0, TAU);
      ctx.fill();
    }
  }
  ctx.fillStyle = coreColor(e.charge);
  ctx.fillRect(px - 1 * u, py - pr * 0.4, 2 * u, pr * 0.8);
  ctx.fillStyle = whiteA(0.9);
  ctx.fillRect(ix - ir * 0.5, iy - ir * 0.55, 2.4 * u, 2.4 * u);
  ctx.strokeStyle = whiteA(0.18);
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.arc(x, y, er * 0.86, Math.PI * 1.1, Math.PI * 1.45);
  ctx.stroke();
  ctx.globalAlpha = a0;
}

export function drawBoss(ctx: Ctx2D, e: Boss, time: number): void {
  drawTrail(ctx, e);
  drawGlitched(ctx, e, time, e.size * 1.15, drawBody);
  drawDebris(ctx, e.debris, time);
  if (e.shattered) {
    const p = (e.deathT - DEATH_COLLAPSE) / 0.6;
    if (p < 1) drawGlow(ctx, e.x, e.y, e.size * (0.4 + p * 0.5), (1 - clamp(p, 0, 1)) * 0.95);
  }
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
