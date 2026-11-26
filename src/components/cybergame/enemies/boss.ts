// BOSSES: three distinct creatures selected by `variant` (sector index).
//
//   V0 WARDEN.EXE  firewall fortress spanning the top of the arena: armoured
//                  bastion with wing pylons, a rotating ring of shield
//                  segments (shot off one by one, see bossShieldSegments /
//                  bossBreakSegment) around an exposed core eye. P2 the
//                  plating cracks and a pylon is lost; P3 the shield
//                  shatters and the core drops on its cables and slams.
//   V1 ECHO        corrupted-memory wraith queen (no legs): a towering torn
//                  shroud with a spiked crown, veil ribbons and lashing
//                  needle tendrils, a phase-teleport shimmer, leech tether
//                  to the target. The real one flickers its eye; decoys
//                  (e.bossDecoy) never do.
//   V2 ROGUE EYE   the final eye machine: segmented iris that tracks the
//                  target and dilates for a beam lock, counter-rotating
//                  iris machinery, shell plates, tendrils sweeping in waves,
//                  orbiting glyph rings; frenzy at low HP.
//
// Every variant: three phases (setBossPhase 0|1|2), telegraphs driven by
// e.bossTell (set by the game ~0.6 s before an attack), hit flash + recoil
// (hurtBoss), and a ~2 s death: pieces collapse inward, glitch implosion,
// shockwave ring (bossDeathDone tells when it is over).

import {
  CreateOpts,
  Ctx2D,
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
  dredA,
  drawChargeEye,
  drawDebris,
  drawEye,
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
  robustUpdate,
  silFill,
  steer,
  tickFx,
  updateEye,
  updateGlitch,
  updateTrail,
  voidA,
  whiteA,
  wrapAngle,
  EnemyIntent,
} from './common';
import { Tendril, drawRibbons, drawTendrilDebug, drawTendrils, initTendril, makeTendril, updateTendril, whipTendril } from './tendril';

export const BOSS_SIZE = 170;
export const bossVariantCount = 3;

export type BossTell =
  | 'none'
  | 'charge'
  | 'sweep'
  | 'burst'
  | 'summon'
  | 'laserGrid'
  | 'teleport'
  | 'clone'
  | 'tether'
  | 'spiral'
  | 'beam'
  | 'hack';

/** Total length of the boss death sequence (s). */
export const BOSS_DEATH_TIME = 2.1;
const D_COLLAPSE = 0.9;
const D_IMPLODE = 1.2;

const N_GLYPH = 40;
const N_PLATE = 10;
const N_SEG = 8;
const SEG_HALF = 0.3; // half angular width of a shield segment (rad)

const IDLE = 0;
const CHARGE = 1;
const PULSE = 2;

export interface BossShieldInfo {
  /** number of segments (0 for variants without a shield) */
  n: number;
  /** world-space centre angle of each segment around (cx, cy) */
  angles: Float32Array;
  alive: Uint8Array;
  /** half angular width of each segment */
  half: number;
  /** inner / outer radius of the segment band (px) */
  r0: number;
  r1: number;
  cx: number;
  cy: number;
}

export interface Boss extends EnemyBase {
  kind: 'boss';
  /** 0 Warden, 1 Echo, 2 Rogue Eye */
  variant: number;
  /** current phase index 0|1|2 and its eased value */
  phase: number;
  pf: number;
  /** compat: true once past phase 0; p2 = eased 0..1 of that */
  phase2: boolean;
  p2: number;
  /** set by the game ~0.6 s before an attack */
  bossTell: BossTell;
  /** decoys look identical but never flicker their eye */
  bossDecoy: boolean;
  /** optional: draw an active tether to the target (V1) */
  tetherActive: boolean;
  /** one-frame signal: V0 core slammed into the ground */
  slammed: boolean;
  tellT: number;
  lastTell: BossTell;
  tx: number;
  ty: number;
  // hit recoil (visual offset spring)
  rcx: number;
  rcy: number;
  rcvx: number;
  rcvy: number;
  // ---- V2 (eye machine)
  tendrils: Tendril[];
  tAng: Float32Array;
  ring: number;
  ra: Float32Array;
  rw: Float32Array;
  plateJit: Float32Array;
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
  transT: number;
  // ---- V0 (warden)
  hull: Float32Array;
  wingL: Float32Array;
  wingR: Float32Array;
  keep: Float32Array;
  cracks: Float32Array;
  segRot: number;
  segAlive: Uint8Array;
  segFlash: Float32Array;
  pylonOn: Float32Array;
  drop: number;
  slamT: number;
  shieldInfo: BossShieldInfo;
  // ---- V1 (echo)
  hood: Float32Array;
  ribbons: Tendril[];
  ribbonOn: Uint8Array;
  lashes: Tendril[];
  ghostX: number;
  ghostY: number;
  ghostT: number;
  flickT: number;
  // ---- death
  shattered: boolean;
}

// ---------------------------------------------------------------------------
// Creation

const P = (r: number, pts: number[]): Float32Array => {
  const out = new Float32Array(pts.length);
  for (let i = 0; i < pts.length; i++) out[i] = pts[i] * r;
  return out;
};

export function createBoss(x: number, y: number, seed: number, opts?: CreateOpts): Boss {
  const size = opts?.size ?? BOSS_SIZE;
  const b = makeBase(x, y, seed, size);
  const R = size * 0.3;
  const variant = clamp(Math.floor(opts?.variant ?? 2), 0, bossVariantCount - 1);
  // V2 tendrils
  const nT = 8;
  const tendrils: Tendril[] = [];
  const tAng = new Float32Array(nT);
  for (let i = 0; i < nT; i++) {
    const a = Math.PI / 2 + ((i - (nT - 1) / 2) / nT) * TAU * 0.82 + randRange(b, -0.12, 0.12);
    tAng[i] = a;
    const len = R * randRange(b, 1.6, 2.6);
    const n = 13 + ((rand(b) * 5) | 0);
    const td = makeTendril(n, len / n, randRange(b, 0.65, 0.9), 1.3, i * 0.75, randRange(b, 0.035, 0.06));
    td.dampK = 0.935;
    initTendril(td, x + Math.cos(a) * R, y + Math.sin(a) * R, a);
    tendrils.push(td);
  }
  const glyph = new Uint8Array(N_GLYPH);
  for (let i = 0; i < N_GLYPH; i++) glyph[i] = (rand(b) * GLYPHS.length) | 0;
  const plateOn = new Float32Array(N_PLATE);
  plateOn.fill(1);
  // V1 ribbons + lashes
  const ribbons: Tendril[] = [];
  for (let i = 0; i < 6; i++) {
    const n = 9 + ((rand(b) * 3) | 0);
    const td = makeTendril(n, (R * randRange(b, 1.9, 2.5)) / n, randRange(b, 0.7, 1.1), randRange(b, 1.2, 1.9), i * 0.8, randRange(b, 0.03, 0.05));
    td.dampK = 0.93;
    const tear = new Float32Array(n);
    const hole = 2 + ((rand(b) * (n - 4)) | 0);
    for (let k = 0; k < n; k++) tear[k] = k === hole ? 0.15 : k === hole + 1 ? 0.5 : 0.8 + rand(b) * 0.4;
    td.tear = tear;
    initTendril(td, x, y + R, Math.PI / 2);
    ribbons.push(td);
  }
  const lashes: Tendril[] = [];
  for (let i = 0; i < 3; i++) {
    const n = 14;
    const td = makeTendril(n, (R * randRange(b, 2.2, 2.8)) / n, 0.8, 1.6, i * 1.3, 0.05);
    td.dampK = 0.93;
    initTendril(td, x, y, Math.PI / 2);
    lashes.push(td);
  }
  // V1 hood (units of R, y down): crown point, shoulders, flaring hem
  const hood: number[] = [0, -2.05, 0.32, -1.55, 0.75, -1.25, 1.25, -0.75, 1.45, 0.1, 1.55, 0.95];
  const HEM = 9;
  for (let i = 0; i < HEM; i++) {
    const f = i / (HEM - 1);
    hood.push(1.35 - f * 2.7, 0.95 + (i % 2) * randRange(b, 0.18, 0.42));
  }
  hood.push(-1.55, 0.95, -1.45, 0.1, -1.25, -0.75, -0.75, -1.25, -0.32, -1.55);
  // V0 cracks: 6 jagged runs of 4 points across the hull
  const cracks: number[] = [];
  for (let c = 0; c < 6; c++) {
    let cx = randRange(b, -3, 3);
    let cy = randRange(b, -0.8, 0.2);
    for (let k = 0; k < 4; k++) {
      cracks.push(cx * R, cy * R);
      cx += randRange(b, -0.35, 0.35);
      cy += randRange(b, 0.1, 0.3);
    }
  }
  const segAlive = new Uint8Array(N_SEG);
  segAlive.fill(1);
  const pylonOn = new Float32Array(2);
  pylonOn.fill(1);
  return {
    ...b,
    kind: 'boss',
    variant,
    phase: 0,
    pf: 0,
    phase2: false,
    p2: 0,
    bossTell: 'none',
    bossDecoy: false,
    tetherActive: false,
    slammed: false,
    tellT: 0,
    lastTell: 'none',
    tx: x,
    ty: y + 200,
    rcx: 0,
    rcy: 0,
    rcvx: 0,
    rcvy: 0,
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
    hull: P(R, [-3.4, -0.7, -3.0, -1.0, 3.0, -1.0, 3.4, -0.7, 3.3, 0.1, 2.6, 0.35, 2.2, 0.2, 1.5, 0.45, 1.05, 0.62, 0.62, 1.05, -0.62, 1.05, -1.05, 0.62, -1.5, 0.45, -2.2, 0.2, -2.6, 0.35, -3.3, 0.1]),
    wingL: P(R, [-3.15, -0.82, -1.25, -0.86, -1.1, 0.25, -1.55, 0.36, -2.25, 0.08, -2.62, 0.22, -3.12, 0.02]),
    wingR: P(R, [3.15, -0.82, 1.25, -0.86, 1.1, 0.25, 1.55, 0.36, 2.25, 0.08, 2.62, 0.22, 3.12, 0.02]),
    keep: P(R, [-1.0, -0.88, 1.0, -0.88, 0.95, 0.45, 0.55, 0.88, -0.55, 0.88, -0.95, 0.45]),
    cracks: new Float32Array(cracks),
    segRot: 0,
    segAlive,
    segFlash: new Float32Array(N_SEG),
    pylonOn,
    drop: 0,
    slamT: -1,
    shieldInfo: { n: 0, angles: new Float32Array(N_SEG), alive: segAlive, half: SEG_HALF, r0: 0, r1: 0, cx: x, cy: y },
    hood: P(R, hood),
    ribbons,
    ribbonOn: new Uint8Array([1, 1, 1, 1, 1, 1]),
    lashes,
    ghostX: x,
    ghostY: y,
    ghostT: 0,
    flickT: 1,
    shattered: false,
  };
}

// ---------------------------------------------------------------------------
// Geometry helpers

const tmpV: Vec = { x: 0, y: 0 };

/** V0 core centre (drops on its cables in phase 3). */
const wardenCore = (e: Boss, out: Vec): Vec => {
  const R = e.size * 0.3;
  out.x = e.x + e.rcx + Math.sin(e.t * 1.3) * e.drop * R * 0.12;
  out.y = e.y + e.rcy + R * 0.35 + e.drop * R * 1.9;
  return out;
};

/** Plate i of V2 as a local polygon (6 pts) for debris. */
const PLATE_ARC = new Float32Array(12);
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

/** V0 shield segment i as a local polygon around the core (for debris). */
const SEG_POLY = new Float32Array(8);
const segPoly = (e: Boss, i: number): Float32Array => {
  const R = e.size * 0.3;
  const a = e.segRot + (i * TAU) / N_SEG;
  const r0 = R * 0.62;
  const r1 = R * 0.82;
  SEG_POLY[0] = Math.cos(a - SEG_HALF) * r0;
  SEG_POLY[1] = Math.sin(a - SEG_HALF) * r0;
  SEG_POLY[2] = Math.cos(a - SEG_HALF) * r1;
  SEG_POLY[3] = Math.sin(a - SEG_HALF) * r1;
  SEG_POLY[4] = Math.cos(a + SEG_HALF) * r1;
  SEG_POLY[5] = Math.sin(a + SEG_HALF) * r1;
  SEG_POLY[6] = Math.cos(a + SEG_HALF) * r0;
  SEG_POLY[7] = Math.sin(a + SEG_HALF) * r0;
  return SEG_POLY;
};

const PYLON = new Float32Array(12);
const pylonPoly = (R: number): Float32Array => {
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + Math.PI / 6;
    PYLON[k * 2] = Math.cos(a) * R * 0.34;
    PYLON[k * 2 + 1] = Math.sin(a) * R * 0.42;
  }
  return PYLON;
};

// ---------------------------------------------------------------------------
// Public controls

/**
 * Phase index 0 | 1 | 2 (0 = intact). Each step forward plays that
 * variant's transition (pylon lost + shield damage / veil torn / plates
 * blown; in phase 2 the Warden's shield shatters and its core drops).
 */
export function setBossPhase(e: Boss, phase: number): void {
  const p = clamp(Math.floor(phase), 0, 2);
  if (e.deathT >= 0 || p === e.phase) return;
  const u = e.size / 170;
  const R = e.size * 0.3;
  if (p > e.phase) {
    e.transT = 0;
    glitchForce(e, 1.4);
    e.pulse = 0.001;
    burstGlyphs(e, e.x, e.y, 14, 260 * u);
    if (e.variant === 0) {
      const d = ensureDebris(e, 48, 1.1);
      if (e.pylonOn[0] > 0.5) {
        e.pylonOn[0] = 0;
        addDebrisPoly(d, pylonPoly(R), e.x - R * 2.75, e.y - R * 0.25, 0, 1, e.x, e.y, 160 * u, 0, 0, e);
      }
      if (p === 1) {
        let k = 0;
        for (let i = 0; i < N_SEG && k < 2; i += 3) {
          if (!e.segAlive[i]) continue;
          bossBreakSegment(e, i);
          k++;
        }
      } else {
        wardenCore(e, tmpV);
        for (let i = 0; i < N_SEG; i++) {
          if (!e.segAlive[i]) continue;
          addDebrisPoly(d, segPoly(e, i), tmpV.x, tmpV.y, 0, 1, tmpV.x, tmpV.y, 240 * u, 0, 0, e);
          e.segAlive[i] = 0;
        }
        e.slamT = 0;
      }
    } else if (e.variant === 1) {
      const lose = p === 1 ? [1, 4] : [0, 1, 3, 4];
      for (const i of lose) e.ribbonOn[i] = 0;
      for (let i = 0; i < e.lashes.length; i++) whipTendril(e.lashes[i], (i % 2 ? 1 : -1) * 8 * u, i * 0.05);
      e.ghostX = e.x;
      e.ghostY = e.y;
      e.ghostT = 1;
    } else {
      const d = ensureDebris(e, 40, 1.1);
      for (let i = 0; i < N_PLATE; i += 2) {
        if (e.plateOn[i] < 0.5) continue;
        addDebrisPoly(d, platePoly(e, i), e.x, e.y, 0, 1, e.x, e.y, 220 * u, e.vx, e.vy, e);
        e.plateOn[i] = 0;
      }
      for (let i = 0; i < e.tendrils.length; i++) whipTendril(e.tendrils[i], (i % 2 ? 1 : -1) * 7 * u, i * 0.04);
    }
  } else {
    // stepping back (bestiary / restarts): restore the shell
    e.plateOn.fill(1);
    e.pylonOn.fill(1);
    e.segAlive.fill(1);
    e.ribbonOn.fill(1);
    e.drop = 0;
    e.slamT = -1;
    e.transT = -1;
  }
  e.phase = p;
  e.phase2 = p >= 1;
}

export function bossCharge(e: Boss): void {
  if (e.mode === IDLE && e.deathT < 0) {
    e.mode = CHARGE;
    e.modeT = 0;
  }
}

/** V0: shield segment layout for collision (reused object, read-only). */
export function bossShieldSegments(e: Boss): BossShieldInfo {
  const s = e.shieldInfo;
  if (e.variant !== 0 || e.deathT >= 0) {
    s.n = 0;
    return s;
  }
  const R = e.size * 0.3;
  wardenCore(e, tmpV);
  s.n = N_SEG;
  s.cx = tmpV.x;
  s.cy = tmpV.y;
  s.r0 = R * 0.62;
  s.r1 = R * 0.82;
  for (let i = 0; i < N_SEG; i++) s.angles[i] = e.segRot + (i * TAU) / N_SEG;
  return s;
}

/** V0: shoot one shield segment off (it shatters away from the core). */
export function bossBreakSegment(e: Boss, i: number): void {
  if (e.variant !== 0 || i < 0 || i >= N_SEG || !e.segAlive[i]) return;
  e.segAlive[i] = 0;
  const u = e.size / 170;
  wardenCore(e, tmpV);
  const d = ensureDebris(e, 48, 0.9);
  addDebrisPoly(d, segPoly(e, i), tmpV.x, tmpV.y, 0, 1, tmpV.x, tmpV.y, 200 * u, 0, 0, e);
  glitchForce(e, 0.6);
}

/** True once the ~2 s death sequence has fully played (e.done is set then too). */
export const bossDeathDone = (e: Boss): boolean => e.deathT >= BOSS_DEATH_TIME;

/** Optional hit reaction: flash, recoil away from the hit, machinery spasm. */
export function hurtBoss(e: Boss, dx: number, dy: number, strength = 1): void {
  if (e.deathT >= 0) return;
  hurtBase(e, dx, dy, strength * 0.15);
  const d = Math.hypot(dx, dy) || 1;
  const k = e.size * 0.9 * strength;
  e.rcvx += (dx / d) * k;
  e.rcvy += (dy / d) * k;
  for (let i = 0; i < 3; i++) e.rw[i] += (i % 2 ? -1 : 1) * 3;
  for (let i = 0; i < N_PLATE; i++) e.plateJit[i] = (rand(e) - 0.5) * 0.15 * e.size * 0.3;
  e.segFlash.fill(1);
  const u = e.size / 170;
  const pool = e.variant === 1 ? e.lashes : e.tendrils;
  whipTendril(pool[(rand(e) * pool.length) | 0], 5 * u, 0);
  if (e.variant === 1) e.ghostT = Math.max(e.ghostT, 0.5);
}

/** Optional death: ~2 s of collapse, glitch implosion and shockwave. */
export function killBoss(e: Boss): void {
  if (e.deathT >= 0) return;
  killBase(e);
  const u = e.size / 170;
  // pieces fall inward toward the core
  const d = ensureDebris(e, 64, D_IMPLODE + 0.2);
  if (e.variant === 0) {
    addDebrisPoly(d, e.wingL, e.x, e.y, 0, 1, e.x, e.y, -60 * u, 0, 0, e);
    addDebrisPoly(d, e.wingR, e.x, e.y, 0, 1, e.x, e.y, -60 * u, 0, 0, e);
    wardenCore(e, tmpV);
    for (let i = 0; i < N_SEG; i++) if (e.segAlive[i]) addDebrisPoly(d, segPoly(e, i), tmpV.x, tmpV.y, 0, 1, tmpV.x, tmpV.y, -50 * u, 0, 0, e);
  } else if (e.variant === 1) {
    addDebrisPoly(d, e.hood, e.x, e.y, 0, 1, e.x, e.y, -50 * u, 0, 0, e);
  } else {
    for (let i = 0; i < N_PLATE; i++) if (e.plateOn[i] > 0.5) addDebrisPoly(d, platePoly(e, i), e.x, e.y, 0, 1, e.x, e.y, -70 * u, 0, 0, e);
  }
}

// ---------------------------------------------------------------------------
// Update

const resetBoss = (e: Boss): void => {
  const R = e.size * 0.3;
  for (let i = 0; i < e.tendrils.length; i++) {
    const a = e.tAng[i];
    initTendril(e.tendrils[i], e.x + Math.cos(a) * R * 0.95, e.y + Math.sin(a) * R * 0.95, a);
  }
  for (let i = 0; i < e.ribbons.length; i++) initTendril(e.ribbons[i], e.x + (i / 5 - 0.5) * R * 2.4, e.y + R * 0.95, Math.PI / 2);
  for (const td of e.lashes) initTendril(td, e.x, e.y - R * 0.5, Math.PI / 2);
  // a teleport leaves a shimmering after-image where it was
  if (e.mo.init) {
    e.ghostX = e.mo.px;
    e.ghostY = e.mo.py;
    e.ghostT = 1;
  }
  e.homeX = e.x;
  e.homeY = e.y;
};

/** Robust public update (see robustUpdate). */
export function updateBoss(e: Boss, dt: number, target: Vec, intent?: Vec | EnemyIntent | null): void {
  const u = e.size / 170;
  robustUpdate(e, dt, target, intent, 160 * u, 240 * u, 20, stepBoss, resetBoss);
  if (e.deathT >= 0) e.done = e.deathT >= BOSS_DEATH_TIME;
}

function stepDeath(e: Boss, dt: number): void {
  const u = e.size / 170;
  const t = e.deathT;
  steer(e, 0, 0, 4, dt);
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  for (let i = 0; i < 3; i++) {
    e.rw[i] += ((i % 2 ? -10 : 10) - e.rw[i]) * damp(3, dt);
    e.ra[i] += e.rw[i] * dt;
  }
  stepTendrils(e, dt, Math.min(1, t / D_COLLAPSE));
  if (!e.shattered && t >= D_IMPLODE) {
    e.shattered = true;
    // implosion released: what is left blows outward with the shockwave
    const d = ensureDebris(e, 64, 0.9);
    const R = e.size * 0.3;
    const core = new Float32Array(16);
    for (let k = 0; k < 8; k++) {
      core[k * 2] = Math.cos((k / 8) * TAU) * R * 0.7;
      core[k * 2 + 1] = Math.sin((k / 8) * TAU) * R * 0.7;
    }
    addDebrisPoly(d, core, e.x, e.y, e.ra[0], 1, e.x, e.y, 320 * u, 0, 0, e);
    if (e.variant === 0) addDebrisPoly(d, e.keep, e.x, e.y, 0, 1, e.x, e.y - 1, 260 * u, 0, 0, e);
    burstGlyphs(e, e.x, e.y, 14, 380 * u);
    glitchForce(e, 1.6);
  }
  updateGlitch(e, dt, t < D_IMPLODE ? 9 : 2, 0.3);
  updateTrail(e, dt, 1e9);
}

function stepTendrils(e: Boss, dt: number, limp: number): void {
  const R = e.size * 0.3;
  const fr = clamp(e.pf - 1, 0, 1);
  if (e.variant === 2) {
    const p2 = e.p2;
    const ampMul = (1 + p2 * 0.45 + e.charge * 0.3 + fr * 0.6) * (1 - limp * 0.7);
    const freqMul = (1 + p2 * 1.2 + e.charge * 0.6 + fr * 1.4) * (1 - limp * 0.6);
    const toT = Math.atan2(e.ty - e.y, e.tx - e.x);
    const sweep = e.bossTell === 'sweep' ? 1.8 : 1;
    for (let i = 0; i < e.tendrils.length; i++) {
      const wave = Math.sin(e.t * (0.9 + p2 * 0.8 + fr) - i * 0.7) * (0.2 + p2 * 0.15 + fr * 0.15) * sweep;
      const a = e.tAng[i] + wave;
      let rest = a;
      let stiff = 1 - limp * 0.9;
      if (i === e.reachIdx && limp <= 0) {
        const k = Math.sin(Math.min(1, e.reachT / 1.2) * Math.PI);
        rest = a + wrapAngle(toT - a) * k * 0.85;
        stiff = 1 + k * 2.5;
      }
      if (limp > 0) rest = a + limp * 0.4 * (Math.PI / 2 - a);
      updateTendril(e.tendrils[i], e.x + e.rcx + Math.cos(a) * R * 0.95, e.y + e.rcy + Math.sin(a) * R * 0.95, rest, dt, e.t, ampMul, freqMul, stiff);
    }
  } else if (e.variant === 1) {
    const toT = Math.atan2(e.ty - e.y, e.tx - e.x);
    const sway = Math.sin(e.t * 0.8) * 0.15;
    for (let i = 0; i < e.ribbons.length; i++) {
      const ax = e.x + e.rcx + (i / 5 - 0.5) * R * 2.4;
      const ay = e.y + e.rcy + R * 0.95;
      updateTendril(e.ribbons[i], ax, ay, Math.PI / 2 + sway + (i / 5 - 0.5) * 0.3, dt, e.t, (1 + fr) * (1 - limp * 0.5), 1 + fr, 1 - limp * 0.8);
    }
    const lashing = e.bossTell === 'tether' || e.bossTell === 'charge' || fr > 0;
    for (let i = 0; i < e.lashes.length; i++) {
      const side = i - 1;
      const ax = e.x + e.rcx + side * R * 1.15;
      const ay = e.y + e.rcy - R * 0.55 + Math.abs(side) * R * 0.2;
      let rest = Math.PI / 2 + side * 0.9;
      if (lashing && limp <= 0) rest = rest + wrapAngle(toT - rest) * (0.6 + 0.3 * Math.sin(e.t * 3 + i));
      updateTendril(e.lashes[i], ax, ay, rest, dt, e.t, 1.2 + fr, 1.3 + fr, (lashing ? 1.8 : 1) * (1 - limp * 0.8));
    }
  }
}

function stepBoss(e: Boss, dt: number, target: Vec, intent: Vec | null): void {
  e.t += dt;
  e.slammed = false;
  // hit recoil spring
  const kS = 160;
  const cS = 2 * Math.sqrt(kS) * 0.5;
  e.rcvx += (-kS * e.rcx - cS * e.rcvx) * dt;
  e.rcvy += (-kS * e.rcy - cS * e.rcvy) * dt;
  e.rcx += e.rcvx * dt;
  e.rcy += e.rcvy * dt;
  if (tickFx(e, dt)) {
    stepDeath(e, dt);
    return;
  }
  e.modeT += dt;
  const R = e.size * 0.3;
  const u = e.size / 170;
  e.tx = target.x;
  e.ty = target.y;
  if (e.bossTell !== e.lastTell) {
    e.lastTell = e.bossTell;
    e.tellT = 0;
    if (e.bossTell === 'teleport' || e.bossTell === 'clone') glitchForce(e, 0.8);
  } else e.tellT += dt;
  e.pf += (e.phase - e.pf) * damp(e.transT >= 0 ? 6 : 3, dt);
  e.p2 = clamp(e.pf, 0, 1);
  const p2 = e.p2;
  const fr = clamp(e.pf - 1, 0, 1);
  if (e.transT >= 0) {
    e.transT += dt;
    if (e.transT > 1.6) e.transT = -1;
  }
  for (let i = 0; i < N_PLATE; i++) {
    const goal = e.phase >= 1 && i % 2 === 0 ? 0 : 1;
    if (goal > e.plateOn[i]) e.plateOn[i] = Math.min(1, e.plateOn[i] + dt * 1.6);
  }
  for (let i = 0; i < N_SEG; i++) e.segFlash[i] = Math.max(0, e.segFlash[i] - dt * 5);
  e.ghostT = Math.max(0, e.ghostT - dt * 1.4);

  switch (e.mode) {
    case IDLE:
      e.charge += (0.1 + p2 * 0.2 + fr * 0.2 - e.charge) * damp(2, dt);
      if (e.modeT > e.dur * (1 - p2 * 0.3 - fr * 0.3)) bossCharge(e);
      break;
    case CHARGE: {
      const p = Math.min(1, e.modeT / 1.1);
      e.charge = p * p * (3 - 2 * p);
      if (p >= 1) {
        e.mode = PULSE;
        e.modeT = 0;
        e.pulse = 0.001;
        const pool = e.variant === 1 ? e.lashes : e.tendrils;
        for (let i = 0; i < pool.length; i++) whipTendril(pool[i], (i % 2 ? 1 : -1) * 4 * u, i * 0.045);
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
  // a tell pushes the charge up so every variant's core visibly winds up
  if (e.bossTell !== 'none') e.charge = Math.max(e.charge, Math.min(1, e.tellT / 0.6));
  if (e.pulse > 0) {
    e.pulse += dt * 2;
    if (e.pulse > 1) e.pulse = 0;
  }

  // movement styles (intent from the game wins)
  let dvx: number;
  let dvy: number;
  if (intent) {
    dvx = intent.x;
    dvy = intent.y;
    e.homeX = e.x;
    e.homeY = e.y;
  } else if (e.variant === 0) {
    // fortress: heavy, slow lateral slide along the top
    const gx = e.homeX + Math.sin(e.t * 0.22) * R * 1.1;
    dvx = (gx - e.x) * 0.8;
    dvy = (e.homeY - e.y) * 0.8;
  } else if (e.variant === 1) {
    // wraith queen: drifting float, jittery in frenzy
    const gx = e.homeX + Math.sin(e.t * 0.5) * R * 1.4 + (e.tx - e.homeX) * 0.15;
    const gy = e.homeY + Math.sin(e.t * 0.83) * R * 0.35;
    dvx = (gx - e.x) * 1.4 + (fr > 0 ? Math.sin(e.t * 9) * 40 * u * fr : 0);
    dvy = (gy - e.y) * 1.4;
  } else {
    const gx = e.homeX + Math.sin(e.t * (0.35 + fr * 0.4)) * R * 0.6 + (e.tx - e.homeX) * 0.12;
    const gy = e.homeY + Math.sin(e.t * 0.7) * R * 0.18;
    dvx = (gx - e.x) * 1.2;
    dvy = (gy - e.y) * 1.2;
  }
  steer(e, dvx, dvy, e.variant === 0 ? 0.9 : 1.5 + p2, dt);
  e.x += e.vx * dt;
  e.y += e.vy * dt;

  // machinery
  e.ring += dt * (0.12 + p2 * 0.25 + e.charge * 0.6 + fr * 0.5);
  const spin = 1 + e.charge * 4 + p2 * 1.5 + fr * 3;
  const kw = damp(2.5, dt);
  e.rw[0] += (0.25 * spin - e.rw[0]) * kw;
  e.rw[1] += (-0.6 * spin - e.rw[1]) * kw;
  e.rw[2] += (0.12 * spin - e.rw[2]) * kw;
  for (let i = 0; i < 3; i++) e.ra[i] += e.rw[i] * dt;
  e.segRot += dt * (0.5 + e.charge * 1.6);
  for (let i = 0; i < N_PLATE; i++) {
    if (rand(e) < dt * (2 + p2 * 10 + fr * 10)) e.plateJit[i] = (rand(e) - 0.5) * (0.03 + p2 * 0.1 + fr * 0.08) * R;
    else e.plateJit[i] -= e.plateJit[i] * damp(6, dt);
  }
  const corrupt = 0.03 + p2 * 0.25 + fr * 0.3;
  for (let i = 0; i < N_GLYPH; i++) if (rand(e) < corrupt * dt * 10) e.glyph[i] = (rand(e) * GLYPHS.length) | 0;

  // V0: phase-3 core drop + slam
  if (e.variant === 0 && e.slamT >= 0) {
    e.slamT += dt;
    const t = e.slamT;
    if (t < 0.45) e.drop = Math.sin(t * 40) * 0.015; // shudder once the shield is gone
    else if (t < 1.05) {
      const p = (t - 0.45) / 0.6;
      e.drop = p * p * p; // accelerating fall
    } else {
      if (e.drop < 0.999) {
        e.slammed = true;
        e.pulse = 0.001;
        glitchForce(e, 1.5);
        wardenCore(e, tmpV);
        burstGlyphs(e, tmpV.x, tmpV.y, 12, 300 * u);
      }
      e.drop = 1 + Math.sin((t - 1.05) * 14) * Math.exp(-(t - 1.05) * 5) * 0.06;
    }
  }
  // the real one flickers its eye in short bursts (decoys never do)
  e.flickT -= dt;
  if (e.flickT < -0.3) e.flickT = randRange(e, 0.8, 1.8);

  // tendril reach (V2)
  e.reachCd -= dt;
  if (e.reachIdx < 0 && e.reachCd <= 0) {
    e.reachIdx = (rand(e) * e.tendrils.length) | 0;
    e.reachT = 0;
  }
  if (e.reachIdx >= 0) {
    e.reachT += dt * (1 + p2 + fr);
    if (e.reachT > 1.2) {
      e.reachIdx = -1;
      e.reachCd = randRange(e, 1.5, 3) * (1 - p2 * 0.5 - fr * 0.3);
    }
  }
  stepTendrils(e, dt, 0);
  if (e.variant === 0) wardenCore(e, tmpV);
  else {
    tmpV.x = e.x;
    tmpV.y = e.variant === 1 ? e.y - R * 0.45 : e.y;
  }
  const dil = e.bossTell === 'beam' ? 1 : Math.max(e.charge, p2 * 0.4);
  updateEye(e.eye, e, tmpV.x, tmpV.y, target, dt, 0.15 + p2 * 0.3 + fr * 0.4, dil);
  updateGlitch(e, dt, 0.4 + p2 * 2 + fr * 4 + e.charge + (e.transT >= 0 ? 10 : 0) + (e.variant === 1 ? 0.8 : 0), 0.04 + p2 * 0.08);
  updateTrail(e, dt, 1e9);
}

// ---------------------------------------------------------------------------
// Drawing: shared bits

// eye-flicker tell: only the real ECHO does it (its decoys never do)
const eyeFlickOff = (e: Boss): boolean => e.variant === 1 && !e.bossDecoy && e.flickT < 0 && ((e.t * 30) | 0) % 2 === 0;

function polyFill(ctx: Ctx2D, pts: Float32Array, ox: number, oy: number): void {
  ctx.moveTo(pts[0] + ox, pts[1] + oy);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i] + ox, pts[i + 1] + oy);
  ctx.closePath();
}

/** Large mechanical iris used by V0's core and V2's eye. */
function drawIris(ctx: Ctx2D, e: Boss, x: number, y: number, er: number, track: number, frenzy: number): void {
  const u = e.size / 170;
  const w = Math.max(1, u);
  const p2 = e.p2;
  const ix = x + e.eye.ox * er * track;
  const iy = y + e.eye.oy * er * track;
  const ir = er * 0.64;
  ctx.fillStyle = voidA(1 - p2 * 0.35);
  ctx.beginPath();
  ctx.arc(x, y, er, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = PAL.grayMid;
  ctx.lineWidth = w;
  ctx.stroke();
  // toothed bezel (slowest ring)
  ctx.fillStyle = orangeA(0.55);
  ctx.beginPath();
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU + e.ra[2];
    const s = (k % 4 === 0 ? 3.2 : 1.8) * u;
    ctx.rect(x + Math.cos(a) * er * 0.93 - s / 2, y + Math.sin(a) * er * 0.93 - s / 2, s, s);
  }
  ctx.fill();
  if (eyeFlickOff(e)) {
    // eye-flicker tell (real boss only): the iris drops out to a bare socket
    ctx.strokeStyle = whiteA(0.8);
    ctx.beginPath();
    ctx.arc(ix, iy, ir * 0.5, 0, TAU);
    ctx.stroke();
    return;
  }
  ctx.fillStyle = coreColor(0.2 + e.charge * 0.6 + p2 * 0.3);
  ctx.beginPath();
  ctx.arc(ix, iy, ir, 0, TAU);
  ctx.fill();
  // blade ring
  ctx.strokeStyle = voidA(0.75);
  ctx.lineWidth = Math.max(0.8, 1.3 * u);
  ctx.beginPath();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU + e.ra[0];
    ctx.moveTo(ix + Math.cos(a) * ir * 0.4, iy + Math.sin(a) * ir * 0.4);
    ctx.lineTo(ix + Math.cos(a + 0.16) * ir, iy + Math.sin(a + 0.16) * ir);
  }
  ctx.stroke();
  // notched counter-rotating ring
  ctx.strokeStyle = coreColor(0.65 + e.charge * 0.35);
  ctx.lineWidth = Math.max(1, 1.8 * u);
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + e.ra[1];
    ctx.moveTo(ix + Math.cos(a) * ir * 0.74, iy + Math.sin(a) * ir * 0.74);
    ctx.arc(ix, iy, ir * 0.74, a, a + 0.75);
  }
  ctx.stroke();
  // aperture pupil: dilates with charge / beam lock, slit once cracked
  const pr = ir * (0.18 + e.eye.dil * 0.5);
  const px = ix + e.eye.ox * er * 0.08;
  const py = iy + e.eye.oy * er * 0.08;
  const sxk = Math.min(1, 1 - p2 * 0.55 + (e.bossTell === 'beam' ? 0.5 : 0));
  ctx.fillStyle = PAL.void;
  ctx.beginPath();
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * TAU + e.ra[0] * 1.5;
    const jx = frenzy > 0 ? Math.sin(e.t * 60 + k) * frenzy * 1.5 * u : 0;
    const vx = Math.cos(a) * pr * sxk + jx;
    const vy = Math.sin(a) * pr * (1 + p2 * 0.4);
    if (k === 0) ctx.moveTo(px + vx, py + vy);
    else ctx.lineTo(px + vx, py + vy);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = orangeA(0.5);
  ctx.lineWidth = w;
  ctx.stroke();
  ctx.fillStyle = coreColor(e.charge);
  ctx.fillRect(px - 1 * u, py - pr * 0.4, 2 * u, pr * 0.8);
  ctx.fillStyle = whiteA(0.9);
  ctx.fillRect(ix - ir * 0.5, iy - ir * 0.55, 2.4 * u, 2.4 * u);
}

// ---------------------------------------------------------------------------
// V0 WARDEN.EXE

function drawWarden(ctx: Ctx2D, e: Boss, time: number): void {
  const R = e.size * 0.3;
  const u = e.size / 170;
  const w = Math.max(1, u);
  const fill = silFill(e);
  const x = e.x + e.rcx;
  const y = e.y + e.rcy;
  const cr = clamp(e.pf, 0, 2); // crack amount
  const core = wardenCore(e, tmpV);
  const cx = core.x;
  const cy = core.y;
  // cables to the dropped core
  if (e.drop > 0.02) {
    ctx.strokeStyle = grayA(0.8);
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    for (let k = -1; k <= 1; k++) {
      const ax = x + k * R * 0.45;
      const ay = y + R * 0.7;
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo((ax + cx) / 2 + k * R * 0.3, (ay + cy) / 2 + R * 0.25, cx + k * R * 0.3, cy - R * 0.3);
    }
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(x, y);
  // hull + armour plates
  ctx.beginPath();
  polyFill(ctx, e.hull, 0, 0);
  ctx.fillStyle = PAL.void;
  ctx.fill();
  ctx.lineWidth = w;
  ctx.strokeStyle = edgeA(e, 0.6);
  ctx.stroke();
  const spread = cr * R * 0.06;
  const jL = e.plateJit[0];
  const jR = e.plateJit[1];
  ctx.beginPath();
  polyFill(ctx, e.wingL, -spread + jL, jL * 0.5);
  polyFill(ctx, e.wingR, spread + jR, jR * 0.5);
  polyFill(ctx, e.keep, 0, -spread * 0.5);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineJoin = 'miter';
  ctx.strokeStyle = edgeA(e, 0.85);
  ctx.stroke();
  // battlements along the top edge
  ctx.strokeStyle = edgeA(e, 0.7);
  ctx.beginPath();
  for (let k = -6; k <= 6; k++) {
    if (k === 0) continue;
    ctx.rect(k * R * 0.46 - R * 0.12, -R * 1.18, R * 0.24, R * 0.22);
  }
  ctx.fill();
  ctx.stroke();
  // vents + rivets
  ctx.strokeStyle = PAL.grayMid;
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const vx = -2.9 * R + k * R * 0.22;
    ctx.moveTo(vx, -0.55 * R);
    ctx.lineTo(vx, -0.2 * R);
    ctx.moveTo(-vx, -0.55 * R);
    ctx.lineTo(-vx, -0.2 * R);
  }
  ctx.stroke();
  ctx.fillStyle = orangeA(0.7);
  for (let k = -3; k <= 3; k++) ctx.fillRect(k * R * 0.32 - 1, -R * 0.75, 2 * u, 2 * u);
  // cracks (phase 2+): hot seams with off-white tips
  if (cr > 0.05) {
    const a = Math.min(1, cr);
    const runs = cr > 1.2 ? 6 : 3;
    ctx.strokeStyle = hotA(0.85 * a);
    ctx.lineWidth = Math.max(1, 1.4 * u);
    ctx.beginPath();
    for (let r = 0; r < runs; r++) {
      const o = r * 8;
      ctx.moveTo(e.cracks[o], e.cracks[o + 1]);
      for (let k = 1; k < 4; k++) ctx.lineTo(e.cracks[o + k * 2], e.cracks[o + k * 2 + 1]);
    }
    ctx.stroke();
    ctx.fillStyle = whiteA(0.8 * a);
    for (let r = 0; r < runs; r++) ctx.fillRect(e.cracks[r * 8 + 6] - 1, e.cracks[r * 8 + 7] - 1, 2, 2);
  }
  // wing pylons (emitters for the laser grid)
  const lit = e.bossTell === 'laserGrid' ? Math.min(1, e.tellT / 0.6) : 0;
  for (let s = 0; s < 2; s++) {
    const sg = s ? 1 : -1;
    if (e.pylonOn[s] < 0.5) {
      ctx.strokeStyle = hotA(0.7);
      ctx.lineWidth = Math.max(1, 1.5 * u);
      ctx.beginPath();
      ctx.moveTo(sg * R * 2.5, -R * 0.1);
      ctx.lineTo(sg * R * 2.7, -R * 0.4);
      ctx.lineTo(sg * R * 2.9, -R * 0.15);
      ctx.stroke();
      continue;
    }
    const px = sg * R * 2.75;
    const py = -R * 0.25;
    ctx.beginPath();
    polyFill(ctx, pylonPoly(R), px, py);
    ctx.fillStyle = PAL.bodyHi;
    ctx.fill();
    ctx.lineWidth = w;
    ctx.strokeStyle = edgeA(e, 0.9);
    ctx.stroke();
    ctx.fillStyle = lit > 0 ? (((time * 20) | 0) % 2 ? PAL.white : PAL.coreHot) : coreColor(0.3 + e.charge * 0.5);
    ctx.fillRect(px - R * 0.08, py + R * 0.12, R * 0.16, R * 0.16 + lit * R * 0.2);
  }
  ctx.restore();
  // core socket + core eye
  if (e.drop < 0.05) {
    ctx.fillStyle = PAL.void;
    ctx.beginPath();
    ctx.arc(x, y + R * 0.35, R * 0.62, 0, TAU);
    ctx.fill();
  }
  drawGlow(ctx, cx, cy, R * (1 + e.charge * 0.6 + cr * 0.3), e.deathT >= 0 ? 1 : 0.2 + e.charge * 0.5 + cr * 0.2);
  drawIris(ctx, e, cx, cy, R * 0.52, 0.2, clamp(e.pf - 1, 0, 1));
  // rotating shield segments
  const r0 = R * 0.62;
  const r1 = R * 0.82;
  ctx.beginPath();
  for (let i = 0; i < N_SEG; i++) {
    if (!e.segAlive[i]) continue;
    const a = e.segRot + (i * TAU) / N_SEG;
    ctx.moveTo(cx + Math.cos(a - SEG_HALF) * r1, cy + Math.sin(a - SEG_HALF) * r1);
    ctx.arc(cx, cy, r1, a - SEG_HALF, a + SEG_HALF);
    ctx.arc(cx, cy, r0, a + SEG_HALF, a - SEG_HALF, true);
    ctx.closePath();
  }
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = edgeA(e, 0.95);
  ctx.lineWidth = w;
  ctx.stroke();
  for (let i = 0; i < N_SEG; i++) {
    if (!e.segAlive[i]) continue;
    const a = e.segRot + (i * TAU) / N_SEG;
    ctx.fillStyle = e.segFlash[i] > 0.4 ? PAL.white : orangeA(0.8);
    ctx.fillRect(cx + Math.cos(a) * (r0 + r1) * 0.5 - 1.5 * u, cy + Math.sin(a) * (r0 + r1) * 0.5 - 1.5 * u, 3 * u, 3 * u);
  }
}

// ---------------------------------------------------------------------------
// V1 ECHO

const RIB: Tendril[] = [];
const DASH: number[] = [6, 5];
const NODASH: number[] = [];

function drawEchoBody(ctx: Ctx2D, e: Boss, time: number, ox: number, oy: number, ghost: boolean): void {
  const R = e.size * 0.3;
  const u = e.size / 170;
  const w = Math.max(1, u);
  const fill = ghost ? PAL.void : silFill(e);
  const fr = clamp(e.pf - 1, 0, 1);
  const x = e.x + e.rcx + ox;
  const y = e.y + e.rcy + oy + Math.sin(time * 1.4) * R * 0.06;
  if (!ghost) {
    drawTendrils(ctx, e.lashes, e.lashes.length, 3 * u, w, 1, 2.4 * u);
    let n = 0;
    for (let i = 0; i < e.ribbons.length; i++) if (e.ribbonOn[i]) RIB[n++] = e.ribbons[i];
    drawRibbons(ctx, RIB, n, R * 0.22, fill, edgeA(e, 0.7), w);
  }
  ctx.save();
  ctx.translate(x, y);
  // hood with fluttering hem
  const h = e.hood;
  ctx.beginPath();
  ctx.moveTo(h[0], h[1]);
  for (let i = 2; i < h.length; i += 2) {
    let hx = h[i];
    let hy = h[i + 1];
    if (i >= 12 && i < 30) {
      hy += Math.sin(time * (4 + fr * 6) + i) * R * (0.05 + fr * 0.08);
      hx += Math.sin(time * 3 + i * 1.7) * R * 0.03;
    }
    ctx.lineTo(hx, hy);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = w;
  ctx.lineJoin = 'miter';
  ctx.strokeStyle = ghost ? orangeA(0.5) : edgeA(e, 0.7 + e.charge * 0.3);
  ctx.stroke();
  if (ghost) {
    ctx.restore();
    return;
  }
  // crown of spikes
  ctx.beginPath();
  for (let k = -2; k <= 2; k++) {
    const bx = k * R * 0.28;
    const by = -R * 1.45 - (2 - Math.abs(k)) * R * 0.18;
    const sh = R * (0.45 + (2 - Math.abs(k)) * 0.2) * (1 + Math.sin(time * 2 + k) * 0.05);
    ctx.moveTo(bx - R * 0.08, by + R * 0.1);
    ctx.lineTo(bx + k * R * 0.06, by - sh);
    ctx.lineTo(bx + R * 0.08, by + R * 0.1);
  }
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = edgeA(e, 0.85);
  ctx.stroke();
  ctx.fillStyle = whiteA(0.8);
  for (let k = -2; k <= 2; k++) {
    const sh = R * (0.45 + (2 - Math.abs(k)) * 0.2);
    ctx.fillRect(k * R * 0.34 - 1, -R * 1.45 - (2 - Math.abs(k)) * R * 0.18 - sh - 1, 2, 2);
  }
  // void face hollow
  ctx.fillStyle = PAL.void;
  ctx.beginPath();
  ctx.moveTo(0, -R * 1.2);
  ctx.quadraticCurveTo(R * 0.95, -R * 0.85, R * 0.7, R * 0.2);
  ctx.lineTo(0, R * 0.6);
  ctx.lineTo(-R * 0.7, R * 0.2);
  ctx.quadraticCurveTo(-R * 0.95, -R * 0.85, 0, -R * 1.2);
  ctx.fill();
  ctx.strokeStyle = PAL.grayDim;
  ctx.stroke();
  // torn holes (phase 2+)
  if (e.pf > 0.3) {
    const a = Math.min(1, e.pf);
    ctx.fillStyle = PAL.void;
    ctx.strokeStyle = hotA(0.6 * a);
    ctx.beginPath();
    ctx.moveTo(R * 1.0, -R * 0.2);
    ctx.lineTo(R * 1.25, R * 0.15);
    ctx.lineTo(R * 1.05, R * 0.45 * a);
    ctx.closePath();
    ctx.moveTo(-R * 1.1, R * 0.35);
    ctx.lineTo(-R * 0.9, R * 0.6);
    ctx.lineTo(-R * 1.2, R * 0.7 * a);
    ctx.closePath();
    if (e.pf > 1.3) {
      ctx.moveTo(-R * 0.5, -R * 1.45);
      ctx.lineTo(-R * 0.25, -R * 1.2);
      ctx.lineTo(-R * 0.6, -R * 1.05);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
  }
  // core below the face
  const cg = 0.3 + 0.15 * Math.sin(time * 2.4) + e.charge * 0.7;
  ctx.fillStyle = coreColor(cg);
  ctx.beginPath();
  ctx.moveTo(0, R * 0.05);
  ctx.lineTo(R * 0.14, R * 0.25);
  ctx.lineTo(0, R * 0.45);
  ctx.lineTo(-R * 0.14, R * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // eyes: big main eye (the real one flickers), memory lids open on charge
  drawGlow(ctx, x, y - R * 0.45, R * (0.9 + e.charge * 0.6 + fr * 0.4), e.deathT >= 0 ? 1 : 0.18 + e.charge * 0.5);
  if (!eyeFlickOff(e)) drawEye(ctx, x, y - R * 0.45, R * 0.4, e.eye, Math.max(0.6, e.charge), 0.9, 0);
  else {
    ctx.strokeStyle = whiteA(0.9);
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x - R * 0.4, y - R * 0.45);
    ctx.lineTo(x + R * 0.4, y - R * 0.45);
    ctx.stroke();
  }
  drawChargeEye(ctx, x - R * 0.42, y - R * 0.88, R * 0.14, e.eye, e.charge, -0.4);
  drawChargeEye(ctx, x + R * 0.42, y - R * 0.88, R * 0.14, e.eye, e.charge, 0.4);
  drawChargeEye(ctx, x - R * 0.35, y - R * 0.05, R * 0.11, e.eye, e.charge, 0.3);
  drawChargeEye(ctx, x + R * 0.35, y - R * 0.05, R * 0.11, e.eye, e.charge, -0.3);
}

function drawTether(ctx: Ctx2D, e: Boss, time: number, k: number, active: boolean): void {
  const R = e.size * 0.3;
  const u = e.size / 170;
  const sx = e.x + e.rcx;
  const sy = e.y + e.rcy + R * 0.25;
  const tx = e.tx;
  const ty = e.ty;
  const dx = tx - sx;
  const dy = ty - sy;
  const d = Math.hypot(dx, dy) || 1;
  const nx = -dy / d;
  const ny = dx / d;
  const sag = Math.sin(time * 3) * R * 0.25 * (active ? 0.4 : 1);
  const mx = (sx + tx) / 2 + nx * sag;
  const my = (sy + ty) / 2 + ny * sag;
  ctx.lineCap = 'round';
  if (!active) {
    // telegraph: thin dashed reach line growing toward the target
    ctx.setLineDash(DASH);
    ctx.strokeStyle = hotA(0.45 + 0.55 * k * (0.6 + 0.4 * Math.sin(time * 40)));
    ctx.lineWidth = Math.max(1.5, 2.2 * u);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(mx, my, sx + dx * k, sy + dy * k);
    ctx.stroke();
    ctx.setLineDash(NODASH);
    return;
  }
  ctx.strokeStyle = orangeA(0.8);
  ctx.lineWidth = 3 * u + 2;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo(mx, my, tx, ty);
  ctx.stroke();
  ctx.strokeStyle = PAL.void;
  ctx.lineWidth = 3 * u;
  ctx.stroke();
  // drain pulses travelling target -> boss
  ctx.fillStyle = hotA(0.9);
  for (let i = 0; i < 4; i++) {
    const f = 1 - ((time * 1.4 + i / 4) % 1);
    const a = 1 - f;
    const px = a * a * sx + 2 * a * f * mx + f * f * tx;
    const py = a * a * sy + 2 * a * f * my + f * f * ty;
    ctx.fillRect(px - 2 * u, py - 2 * u, 4 * u, 4 * u);
  }
  // hooks clamped on the target
  ctx.strokeStyle = whiteA(0.85);
  ctx.lineWidth = Math.max(1, u);
  ctx.beginPath();
  for (let k2 = 0; k2 < 3; k2++) {
    const a = Math.atan2(-dy, -dx) + (k2 - 1) * 0.9;
    ctx.moveTo(tx + Math.cos(a) * 10 * u, ty + Math.sin(a) * 10 * u);
    ctx.lineTo(tx + Math.cos(a + 0.5) * 4 * u, ty + Math.sin(a + 0.5) * 4 * u);
  }
  ctx.stroke();
}

function drawEcho(ctx: Ctx2D, e: Boss, time: number): void {
  const R = e.size * 0.3;
  const fr = clamp(e.pf - 1, 0, 1);
  const a0 = ctx.globalAlpha;
  // after-image left by a teleport
  if (e.ghostT > 0) {
    ctx.globalAlpha = a0 * e.ghostT * 0.5;
    drawEchoBody(ctx, e, time, e.ghostX - e.x, e.ghostY - e.y, true);
    ctx.globalAlpha = a0;
  }
  // shimmer copies (teleport / clone tell, frenzy)
  const tk = e.bossTell === 'teleport' || e.bossTell === 'clone' ? Math.min(1, e.tellT / 0.6) : 0;
  const sh = Math.max(tk, fr * 0.6);
  if (sh > 0.05) {
    const off = R * (0.15 + sh * 0.35) * Math.sin(time * 23);
    ctx.globalAlpha = a0 * 0.3 * sh;
    drawEchoBody(ctx, e, time, off, 0, true);
    drawEchoBody(ctx, e, time, -off * 0.7, R * 0.05, true);
    ctx.globalAlpha = a0;
  }
  if (e.bossTell === 'tether') drawTether(ctx, e, time, Math.min(1, e.tellT / 0.6), false);
  if (e.tetherActive) drawTether(ctx, e, time, 1, true);
  drawEchoBody(ctx, e, time, 0, 0, false);
}

// ---------------------------------------------------------------------------
// V2 ROGUE EYE

function drawEyeMachine(ctx: Ctx2D, e: Boss, time: number): void {
  const R = e.size * 0.3;
  const u = e.size / 170;
  const p2 = e.p2;
  const fr = clamp(e.pf - 1, 0, 1);
  const jit = fr > 0 ? Math.sin(time * 47) * fr * 2 * u : 0;
  const x = e.x + e.rcx + jit;
  const y = e.y + e.rcy;
  const w = Math.max(1, u);
  const fill = silFill(e);
  drawTendrils(ctx, e.tendrils, e.tendrils.length, 3.4 * u, w, 1, 3 * u);
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
  // orbiting glyph rings (two, counter-rotating; the outer one tilted)
  ctx.font = monoFont(9 * u + 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let ringI = 0; ringI < 2; ringI++) {
    const gr = R * (ringI ? 1.78 : 1.5);
    const sq = ringI ? 0.55 : 1;
    const rot = ringI ? -e.ring * 0.7 : e.ring;
    for (let i = ringI; i < N_GLYPH; i += ringI ? 2 : 1) {
      if (i % 10 === 9 || i % 10 === 0) continue;
      const a = (i / N_GLYPH) * TAU + rot;
      const gx = x + Math.cos(a) * gr;
      const gy = y + Math.sin(a) * gr * sq;
      const hot = (p2 > 0.5 || fr > 0) && (i * 7 + ((time * 6) | 0)) % 11 === 0;
      ctx.fillStyle = hot ? hotA(0.9) : i % 4 === 0 ? orangeA(0.75) : grayA(ringI ? 0.45 : 0.75);
      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillText(GLYPHS[e.glyph[i]], 0, 0);
      ctx.restore();
    }
  }
  const tf = e.transT >= 0 ? Math.max(0, 1 - e.transT / 0.6) : 0;
  drawGlow(ctx, x, y, R * (1.1 + p2 * 0.9 + e.charge * 0.4 + tf * 0.8 + fr * 0.3), e.deathT >= 0 ? 1 : 0.18 + p2 * 0.45 + e.charge * 0.35 + tf * 0.6);
  const r0 = R;
  const r1 = R * 1.24;
  if (p2 > 0.02) {
    const beat = 0.5 + 0.5 * Math.sin(time * (5 + fr * 8));
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
  for (let i = 1; i < N_PLATE; i += 3) {
    const am = ((i + 0.5) / N_PLATE) * TAU - e.ring * 0.8;
    const rr = (r0 + r1) / 2 + p2 * R * 0.1;
    drawChargeEye(ctx, x + Math.cos(am) * rr, y + Math.sin(am) * rr, 4.2 * u, e.eye, e.charge, am + Math.PI / 2);
  }
  // the iris tracks the target harder than on the other bosses
  drawIris(ctx, e, x, y, R * 0.84, 0.3, fr);
  ctx.strokeStyle = whiteA(0.18);
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.arc(x, y, R * 0.72, Math.PI * 1.1, Math.PI * 1.45);
  ctx.stroke();
  if (fr > 0.05) {
    // frenzy: hot veins flicker across the sclera
    ctx.strokeStyle = hotA(0.7 * fr * (0.5 + 0.5 * Math.sin(time * 31)));
    ctx.beginPath();
    for (let k = 0; k < 9; k++) {
      const a = k * 0.7 + e.ra[2] * 3;
      ctx.moveTo(x + Math.cos(a) * R * 0.82, y + Math.sin(a) * R * 0.82);
      ctx.lineTo(x + Math.cos(a + 0.15) * R * 0.62, y + Math.sin(a + 0.15) * R * 0.62);
    }
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Tells (drawn on top of every variant)

function emitter(e: Boss, out: Vec): Vec {
  const R = e.size * 0.3;
  if (e.variant === 0) return wardenCore(e, out);
  out.x = e.x + e.rcx;
  out.y = e.y + e.rcy - (e.variant === 1 ? R * 0.45 : 0);
  return out;
}

function drawTells(ctx: Ctx2D, e: Boss, time: number): void {
  const tell = e.bossTell;
  if (tell === 'none' || e.deathT >= 0) return;
  const R = e.size * 0.3;
  const u = e.size / 170;
  const k = Math.min(1, e.tellT / 0.6);
  const flick = 0.6 + 0.4 * Math.sin(time * 38);
  const em = emitter(e, tmpV);
  const ex = em.x;
  const ey = em.y;
  ctx.lineWidth = Math.max(1, u);
  switch (tell) {
    case 'laserGrid': {
      // lattice of thin firing lines projected below the emitters
      ctx.strokeStyle = hotA(0.45 * k * flick);
      ctx.setLineDash(k < 1 ? DASH : NODASH);
      ctx.beginPath();
      const top = e.y + R * 0.6;
      const depth = R * 7 * k;
      for (let i = -4; i <= 4; i++) {
        const lx = e.x + i * R * 0.75;
        ctx.moveTo(lx, top);
        ctx.lineTo(lx, top + depth);
      }
      for (let j = 1; j <= 4; j++) {
        const ly = top + j * R * 1.6;
        if (ly > top + depth) break;
        ctx.moveTo(e.x - R * 3, ly);
        ctx.lineTo(e.x + R * 3, ly);
      }
      ctx.stroke();
      ctx.setLineDash(NODASH);
      break;
    }
    case 'charge':
    case 'burst': {
      // particles converging on the core
      ctx.fillStyle = hotA(0.9 * k);
      for (let i = 0; i < 18; i++) {
        const f = (time * 1.6 + i / 18) % 1;
        const a = i * 2.39996;
        const r = R * (2.4 - 1.9 * f);
        ctx.fillRect(ex + Math.cos(a) * r - 1.5 * u, ey + Math.sin(a) * r - 1.5 * u, 3 * u, 3 * u);
      }
      if (tell === 'burst') {
        ctx.strokeStyle = orangeA(0.6 * k * flick);
        ctx.setLineDash(DASH);
        ctx.beginPath();
        ctx.arc(ex, ey, R * (1.4 + 1.4 * k), 0, TAU);
        ctx.stroke();
        ctx.setLineDash(NODASH);
      }
      break;
    }
    case 'teleport': {
      // vertical scan bars sweeping the body
      ctx.fillStyle = whiteA(0.35 * k);
      for (let i = 0; i < 3; i++) {
        const f = (time * 2.5 + i / 3) % 1;
        ctx.fillRect(e.x - R * 1.6 + f * R * 3.2, e.y - R * 2.2, 1.5 * u, R * 3.4);
      }
      break;
    }
    case 'clone': {
      // outlines splitting apart left / right
      ctx.strokeStyle = orangeA(0.5 * k);
      ctx.setLineDash(DASH);
      ctx.beginPath();
      for (let s = -1; s <= 1; s += 2) {
        ctx.moveTo(e.x + s * R * 2 * k + R * 0.9, e.y);
        ctx.arc(e.x + s * R * 2 * k, e.y, R * 0.9, 0, TAU);
      }
      ctx.stroke();
      ctx.setLineDash(NODASH);
      break;
    }
    case 'tether':
      if (e.variant !== 1) drawTether(ctx, e, time, k, false);
      break;
    case 'spiral': {
      ctx.fillStyle = orangeA(0.85 * k);
      for (let arm = 0; arm < 3; arm++) {
        for (let j = 0; j < 9; j++) {
          const a = time * 3 + j * 0.42 + (arm * TAU) / 3;
          const r = R * (0.8 + j * 0.3);
          const s = (5 - j * 0.3) * u;
          ctx.fillRect(ex + Math.cos(a) * r - s / 2, ey + Math.sin(a) * r - s / 2, s, s);
        }
      }
      break;
    }
    case 'beam': {
      // aim line from the dilating eye to the target, thickening as it locks
      const dx = e.tx - ex;
      const dy = e.ty - ey;
      const d = Math.hypot(dx, dy) || 1;
      ctx.strokeStyle = hotA((0.3 + 0.6 * k) * flick);
      ctx.lineWidth = Math.max(1, (1 + k * 3) * u);
      ctx.setLineDash(k < 0.7 ? DASH : NODASH);
      ctx.beginPath();
      ctx.moveTo(ex + (dx / d) * R * 0.6, ey + (dy / d) * R * 0.6);
      ctx.lineTo(e.tx, e.ty);
      ctx.stroke();
      ctx.setLineDash(NODASH);
      ctx.strokeStyle = whiteA(0.7 * k);
      ctx.lineWidth = Math.max(1, u);
      ctx.beginPath();
      ctx.arc(e.tx, e.ty, (14 - 8 * k) * u, 0, TAU);
      ctx.stroke();
      break;
    }
    case 'hack': {
      // falling glyph columns + a corruption box over the eye
      ctx.font = monoFont(10 * u + 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let c = 0; c < 8; c++) {
        const cx = e.x + (c - 3.5) * R * 0.55;
        for (let j = 0; j < 5; j++) {
          const f = (time * 1.2 + c * 0.17 + j * 0.2) % 1;
          ctx.fillStyle = j === 0 ? whiteA(0.95 * k) : orangeA((0.9 - j * 0.14) * k);
          ctx.fillText(GLYPHS[(c * 7 + j * 3 + ((time * 10) | 0)) % GLYPHS.length], cx, e.y - R * 1.5 + f * R * 3.5);
        }
      }
      ctx.strokeStyle = whiteA(0.6 * k);
      ctx.strokeRect(ex - R * 0.5, ey - R * 0.5, R, R);
      break;
    }
    case 'sweep': {
      ctx.strokeStyle = orangeA(0.6 * k * flick);
      ctx.lineWidth = Math.max(1, 2 * u);
      ctx.beginPath();
      ctx.arc(e.x, e.y, R * 2.6, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      break;
    }
    case 'summon': {
      ctx.strokeStyle = orangeA(0.8 * k);
      for (let i = 0; i < 3; i++) {
        const a = Math.PI / 2 + (i - 1) * 0.9;
        const px = e.x + Math.cos(a) * R * 2.2;
        const py = e.y + Math.sin(a) * R * 2.2;
        ctx.beginPath();
        for (let q = 0; q < 6; q++) {
          const b = (q / 6) * TAU + time * 3;
          const r = R * 0.3 * k;
          if (q === 0) ctx.moveTo(px + Math.cos(b) * r, py + Math.sin(b) * r);
          else ctx.lineTo(px + Math.cos(b) * r, py + Math.sin(b) * r);
        }
        ctx.closePath();
        ctx.stroke();
      }
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Draw entry

function drawBody(ctx: Ctx2D, e: Boss, time: number): void {
  if (e.variant === 0) drawWarden(ctx, e, time);
  else if (e.variant === 1) drawEcho(ctx, e, time);
  else drawEyeMachine(ctx, e, time);
}

export function drawBoss(ctx: Ctx2D, e: Boss, time: number): void {
  drawTrail(ctx, e);
  const ext = e.size * (e.variant === 0 ? 2 : e.variant === 1 ? 1.6 : 1.15);
  if (e.deathT < 0) {
    if (e.variant === 0 && e.pulse > 0) {
      wardenCore(e, tmpV);
      ctx.strokeStyle = orangeA((1 - e.pulse) * 0.9);
      ctx.lineWidth = Math.max(1, (e.size / 170) * 2);
      ctx.beginPath();
      ctx.arc(tmpV.x, tmpV.y, e.size * 0.3 * (0.8 + e.pulse * 3), 0, TAU);
      ctx.stroke();
    }
    drawGlitched(ctx, e, time, ext, drawBody);
    drawTells(ctx, e, time);
    drawDebris(ctx, e.debris, time);
    return;
  }
  // death: collapse (shrink + shake) -> glitch implosion -> shockwave ring
  const t = e.deathT;
  const R = e.size * 0.3;
  if (t < D_IMPLODE) {
    const p = t / D_IMPLODE;
    const s = t < D_COLLAPSE ? 1 - 0.18 * (t / D_COLLAPSE) : 0.82 * (1 - (t - D_COLLAPSE) / (D_IMPLODE - D_COLLAPSE));
    const sh = Math.sin(time * 70) * R * 0.05 * p;
    ctx.save();
    ctx.translate(e.x + sh, e.y);
    ctx.scale(Math.max(0.01, s), Math.max(0.01, s * (t > D_COLLAPSE ? 0.6 + 0.4 * s : 1)));
    ctx.translate(-e.x, -e.y);
    drawGlitched(ctx, e, time, ext, drawBody);
    ctx.restore();
    if (t > D_COLLAPSE) {
      // implosion point: off-white cross collapsing to nothing
      const q = (t - D_COLLAPSE) / (D_IMPLODE - D_COLLAPSE);
      ctx.fillStyle = whiteA(0.6 + 0.4 * q);
      const r = R * 0.3 * (1 - q) + 2;
      ctx.fillRect(e.x - r, e.y - r * 0.2, r * 2, r * 0.4);
      ctx.fillRect(e.x - r * 0.2, e.y - r, r * 0.4, r * 2);
    }
  } else {
    const q = clamp((t - D_IMPLODE) / (BOSS_DEATH_TIME - D_IMPLODE), 0, 1);
    const rr = e.size * (0.3 + q * 2.6);
    const u = e.size / 170;
    ctx.lineWidth = Math.max(1, (1 - q) * 10 * u);
    ctx.strokeStyle = orangeA((1 - q) * 0.9);
    ctx.beginPath();
    ctx.arc(e.x, e.y, rr, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, (1 - q) * 3);
    ctx.strokeStyle = whiteA((1 - q) * 0.8);
    ctx.beginPath();
    ctx.arc(e.x, e.y, rr * 0.92, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = dredA((1 - q) * 0.9);
    ctx.beginPath();
    ctx.arc(e.x, e.y, rr * 0.75, 0, TAU);
    ctx.stroke();
    drawGlow(ctx, e.x, e.y, R * (2.5 - q * 1.5), (1 - q) * 0.9);
  }
  drawDebris(ctx, e.debris, time);
}

export function drawBossDebug(ctx: Ctx2D, e: Boss): void {
  if (e.variant === 2) drawTendrilDebug(ctx, e.tendrils);
  if (e.variant === 1) {
    drawTendrilDebug(ctx, e.ribbons);
    drawTendrilDebug(ctx, e.lashes);
  }
  if (e.variant === 0) {
    const s = bossShieldSegments(e);
    ctx.strokeStyle = 'rgba(150,150,150,0.6)';
    ctx.beginPath();
    ctx.arc(s.cx, s.cy, s.r0, 0, TAU);
    ctx.moveTo(s.cx + s.r1, s.cy);
    ctx.arc(s.cx, s.cy, s.r1, 0, TAU);
    ctx.stroke();
  }
  if (e.reachIdx >= 0 && e.variant === 2) {
    const td = e.tendrils[e.reachIdx];
    ctx.strokeStyle = PAL.orange;
    ctx.beginPath();
    ctx.arc(td.x[td.n - 1], td.y[td.n - 1], 5, 0, TAU);
    ctx.stroke();
  }
}
