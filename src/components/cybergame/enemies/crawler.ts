// CRAWLER: shard/blade walker. A broken, faceted blade body (nose blade +
// thorax plate + lagging tail shard, with gaps, a missing chunk and loose
// floating fragments), five long asymmetric limbs on true IK (3 left, 2 right
// of which one is snapped and dragged), forward sensor needles, back data
// spines. Stop-start stalking, crouch-compress anticipation, a stretched
// lunge with splayed legs and skidding feet, then overshoot and settle.

import {
  CreateOpts,
  Ctx2D,
  DEATH_COLLAPSE,
  EnemyBase,
  EyeTrack,
  PAL,
  Spring,
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
  hurtBase,
  killBase,
  makeBase,
  makeEye,
  faceTravel,
  makeSpring,
  orangeA,
  polySub,
  rand,
  randRange,
  scaledPoly,
  silFill,
  steer,
  stepSpring,
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
import { Leg, Rig, drawRig, drawRigDebug, makeLeg, makeRig, plantRig, replantRig, rigDetach, rigFlinch, rigSetAir, updateRig } from './ik';

export const CRAWLER_SIZE = 56;
/** body plates are drawn at this multiple of the size unit (body dominates the silhouette) */
const BK = 1.7;

const STALK = 0;
const FREEZE = 1;
const LUNGE = 2;
const RECOVER = 3;
const LUNGE_TIME = 0.36;

// local polygons at size 56 (+x forward)
// broken data shard: an angular front slab (chunk bitten out of its right
// edge) and a stepped rear block, in body units (x BK)
const NOSE = [16, 0.5, 10.5, -6.2, 2, -7.6, 3, -2.2, 0.6, 5.4, 5, 5.8, 6.4, 2.6, 9.2, 5.2];
const THORAX = [-0.6, -8.4, -8.8, -7.4, -12.6, -3.4, -10.6, -2.6, -13.2, 1.8, -9, 7.4, -1.6, 7, -0.6, 2];
const TAIL = [1, -3, -6, -2.2, -8.5, 1.4, -3, 3.6];
const FRAG_ANCHORS = [6, -10, -6.5, 9.6, -15.5, -5];

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
  nose: Float32Array;
  thorax: Float32Array;
  tail: Float32Array;
  frags: Float32Array[];
  fragOff: Float32Array; // per frag: dx, dy (glitch snap offsets)
  fragT: number;
  spines: Float32Array;
  /** squash along heading (spring; <1 crouch, >1 stretch) */
  sq: Spring;
  /** body pull along heading in px (spring) */
  pull: Spring;
  /** idle head twitch (radians, decays) */
  tw: number;
  twT: number;
  shattered: boolean;
}

export function createCrawler(x: number, y: number, seed: number, opts?: CreateOpts): Crawler {
  const size = opts?.size ?? CRAWLER_SIZE;
  const b = makeBase(x, y, seed, size);
  const u = size / 56;
  const legs: Leg[] = [];
  // [side, hipX, hipY, rest angle off forward (deg), reach, segs, group, drag]
  const specs: Array<[number, number, number, number, number, number, number, boolean]> = [
    // mirrored placement at the body's front and rear corners (not a radial
    // fan); asymmetry only from length and damage: the rear-right limb is
    // snapped and shorter but still walks. Groups = diagonal pairs.
    // [side, hipX, hipY, rest angle off forward (deg), reach, segs, group, damaged]
    [-1, 17, -9.5, 54, 22, 3, 0, false],
    [1, 17, 9.5, 54, 21, 3, 1, false],
    [-1, -14, -11.5, 128, 20, 3, 1, false],
    [1, -14, 11.5, 128, 17, 3, 0, true],
  ];
  for (const [side, hx0, hy0, deg, reach0, n, group, dmg] of specs) {
    const hx = hx0 * u;
    const hy = hy0 * u;
    const ang = (side * deg * Math.PI) / 180;
    const reach = reach0 * u;
    const rx = hx + Math.cos(ang) * reach;
    const ry = hy + Math.sin(ang) * reach;
    const total = reach * randRange(b, 1.7, 1.85); // slack: a lagging foot never hits max reach
    const w = n === 3 ? [0.4, 0.36, 0.24] : [0.3, 0.28, 0.24, 0.18];
    const segs: number[] = [];
    for (let i = 0; i < n; i++) segs.push(total * w[i] * randRange(b, 0.9, 1.1));
    legs.push(makeLeg({ hx, hy, rx, ry, side, group, segs, broken: dmg ? 1 : -1 }, b));
  }
  const rig = makeRig(legs, 9.5 * u, 0.11, 1.5);
  rig.sag = 0.18; // slight bob toward each lifted pair
  const frags: Float32Array[] = [];
  for (let i = 0; i < 3; i++) {
    const r = randRange(b, 1.6, 2.8);
    frags.push(scaledPoly(b, [r * 1.3, 0, -r, -r * 0.8, -r * 0.5, r * 0.9], u * BK, 0.8));
  }
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
    nose: scaledPoly(b, NOSE, u * BK, 1.2),
    thorax: scaledPoly(b, THORAX, u * BK, 1.2),
    tail: scaledPoly(b, TAIL, u * BK, 0.8),
    frags,
    fragOff: new Float32Array(6),
    fragT: 0.5,
    spines: new Float32Array(0),
    sq: makeSpring(1),
    pull: makeSpring(0),
    tw: 0,
    twT: randRange(b, 1, 3),
    shattered: false,
  };
  // data spines on the thorax: [x0,y0,x1,y1] local, pointing back/out
  const sp: number[] = [];
  const ns = 3 + ((rand(e) * 2) | 0);
  for (let i = 0; i < ns; i++) {
    const x0 = randRange(e, -12, -3);
    const side = i % 2 ? 1 : -1;
    const y0 = side * randRange(e, 3, 6);
    const l = randRange(e, 6, 13);
    sp.push(x0 * u * BK, y0 * u * BK, (x0 - l * 0.8) * u * BK, (y0 + side * l * 0.55) * u * BK);
  }
  e.spines = new Float32Array(sp);
  plantRig(rig, x, y, e.heading);
  e.tailA = e.heading;
  return e;
}

/** Force the crouch -> tremble -> lunge sequence now. */
export function crawlerLunge(e: Crawler): void {
  if (e.deathT >= 0 || e.mode === FREEZE || e.mode === LUNGE) return;
  e.mode = FREEZE;
  e.modeT = 0;
  e.freezeDur = 0.55 + rand(e) * 0.35;
}

/** Optional hit reaction: knockback, a limb flinch, brief glitch-out. */
export function hurtCrawler(e: Crawler, dx: number, dy: number, strength = 1): void {
  if (e.deathT >= 0) return;
  hurtBase(e, dx, dy, strength);
  rigFlinch(e.rig, e);
  e.tw = (rand(e) < 0.5 ? -1 : 1) * 0.35;
  e.sq.v -= 3;
}

/** Optional death: limbs collapse and detach, then the blade shatters. */
export function killCrawler(e: Crawler): void {
  killBase(e);
}

function dying(e: Crawler, dt: number, target: Vec): void {
  const u = e.size / 56;
  const t = e.deathT;
  steer(e, 0, 0, 6, dt);
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  e.rig.collapse = Math.min(1, t / DEATH_COLLAPSE);
  e.rig.splay = 0;
  e.rig.skid = 0;
  rigSetAir(e.rig, false);
  // limbs give out one by one, then detach
  const legs = e.rig.legs;
  for (let i = 0; i < legs.length; i++) if (t > 0.12 + i * 0.045) rigDetach(legs[i], e.x, e.y, 55 * u, e);
  stepSpring(e.sq, 0.82, 260, 0.5, dt);
  e.tremble = 1.6 * u;
  if (!e.shattered && t >= DEATH_COLLAPSE) {
    e.shattered = true;
    const d = ensureDebris(e, 18, 0.75);
    const c = e.heading;
    addDebrisPoly(d, e.nose, e.x, e.y, c, 1, e.x, e.y, 120 * u, e.vx, e.vy, e);
    addDebrisPoly(d, e.thorax, e.x, e.y, c, 1, e.x, e.y, 110 * u, e.vx, e.vy, e);
    addDebrisPoly(d, e.tail, e.x - Math.cos(e.tailA) * 15 * u * BK, e.y - Math.sin(e.tailA) * 15 * u * BK, e.tailA, 1, e.x, e.y, 90 * u, 0, 0, e);
    burstGlyphs(e, e.x, e.y, 10, 150 * u);
  }
  updateRig(e.rig, e.x, e.y, e.heading, e.vx, e.vy, dt, e);
  updateEye(e.eye, e, e.x, e.y, target, dt, 1.5, 1);
  updateGlitch(e, dt, 3.5, 0.2);
  updateTrail(e, dt, 1e9);
}

const resetCrawler = (e: Crawler): void => {
  rigSetAir(e.rig, false);
  replantRig(e.rig, e.x, e.y, e.heading, e.vx, e.vy);
  e.tailA = e.heading;
};

/** Robust public update: dt capped + substepped, intent clamped + smoothed, teleports re-plant. */
const modeCrawler = (e: Crawler, mode: IntentMode): void => {
  if (mode === 'lunge') crawlerLunge(e);
};

/** Robust public update. intent: raw velocity, or a director mode (EnemyIntent). */
export function updateCrawler(e: Crawler, dt: number, target: Vec, intent?: Vec | EnemyIntent | null): void {
  const u = e.size / 56;
  robustUpdate(e, dt, target, intent, 110 * u, 480 * u, 14, stepCrawler, resetCrawler, modeCrawler);
}

function stepCrawler(e: Crawler, dt: number, target: Vec, intent: Vec | null): void {
  e.t += dt;
  if (tickFx(e, dt)) {
    dying(e, dt, target);
    return;
  }
  e.modeT += dt;
  const u = e.size / 56;
  const dx = target.x - e.x;
  const dy = target.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  const walk = 66 * u;
  let turnRate = 4.5;
  let sqT = 1;
  let pullT = 0;
  const rig = e.rig;

  switch (e.mode) {
    case STALK: {
      e.burstT -= dt;
      if (e.burstT <= 0) {
        e.moving = !e.moving;
        e.burstT = e.moving ? randRange(e, 0.3, 0.8) : randRange(e, 0.12, 0.5);
      }
      let dvx: number;
      let dvy: number;
      if (intent) {
        dvx = intent.x;
        dvy = intent.y;
      } else {
        const stand = 55 * u;
        const tx = -dy / dist;
        const ty = dx / dist;
        const radial = dist > stand ? 1 : dist < stand * 0.7 ? -0.6 : 0;
        dvx = (dx / dist) * radial * walk + tx * walk * 0.6;
        dvy = (dy / dist) * radial * walk + ty * walk * 0.6;
      }
      const holding = e.mo.mode === 'hold';
      const k = holding ? 0 : e.mo.mode ? 1 : e.moving ? 1 : 0.04;
      steer(e, dvx * k, dvy * k, holding ? 14 : e.moving ? 9 : 16, dt);
      if (holding) {
        sqT = 0.9;
        pullT = -1.5 * u;
        rig.splay += (0.3 - rig.splay) * damp(8, dt);
        e.heading = turnToward(e.heading, Math.atan2(dy, dx), 2.5 * dt); // brace facing the target
      }
      e.tremble = e.moving ? 0 : 0.25 * u;
      e.charge += (0 - e.charge) * damp(3, dt);
      if (e.mo.mode !== 'hold') rig.splay += (0 - rig.splay) * damp(6, dt);
      rig.skid = 0;
      e.cooldown -= dt;
      if (!intent && e.cooldown <= 0 && dist < 240 * u && dist > 35 * u && rand(e) < dt * 0.9) crawlerLunge(e);
      // idle head twitch
      e.twT -= dt;
      if (e.twT <= 0) {
        e.twT = randRange(e, 0.8, 3.2);
        e.tw = (rand(e) < 0.5 ? -1 : 1) * randRange(e, 0.12, 0.3);
      }
      break;
    }
    case FREEZE: {
      steer(e, 0, 0, 30, dt);
      const p = Math.min(1, e.modeT / e.freezeDur);
      e.charge = p;
      e.tremble = (0.3 + p * 1.3) * u;
      // crouch: compress, pull back, legs splay a little for grip
      sqT = 1 - 0.17 * Math.sqrt(p);
      pullT = -4 * u * Math.sqrt(p);
      rig.splay += (0.35 * p - rig.splay) * damp(10, dt);
      if (rand(e) < dt * 9) e.heading = turnToward(e.heading, Math.atan2(dy, dx), 0.5);
      turnRate = 0;
      if (p >= 1) {
        e.mode = LUNGE;
        e.modeT = 0;
        e.lx = dx / dist;
        e.ly = dy / dist;
        e.heading = turnToward(e.heading, Math.atan2(dy, dx), 0.45);
        e.sq.v += 6; // snap into the stretch
        rig.splay = 1;
        rigSetAir(rig, true); // pounce: all feet leave the ground
      }
      break;
    }
    case LUNGE: {
      const p = Math.min(1, e.modeT / LUNGE_TIME);
      const sp = 450 * u * (1 - p) * (1 - p);
      e.vx = e.lx * sp;
      e.vy = e.ly * sp;
      e.charge = 1 - p * 0.6;
      e.tremble = 0;
      turnRate = 0;
      e.heading = turnToward(e.heading, Math.atan2(e.ly, e.lx), 12 * dt);
      sqT = p < 0.45 ? 1.16 : 1;
      pullT = 3 * u;
      rig.splay = 1 - p * 0.6;
      rig.skid = 0;
      if (p >= 1) {
        e.mode = RECOVER;
        e.modeT = 0;
        rigSetAir(rig, false); // land: feet plant where they are
        e.sq.v -= 5; // impact squash, settles with overshoot
      }
      break;
    }
    default: {
      steer(e, 0, 0, 8, dt);
      e.charge += (0 - e.charge) * damp(5, dt);
      e.tremble = 0.2 * u;
      rig.splay += (0 - rig.splay) * damp(5, dt);
      if (e.modeT > 0.45) {
        e.mode = STALK;
        e.cooldown = randRange(e, 1.4, 3.2);
      }
    }
  }

  // grounded: face the travel direction first, and never move faster than
  // the gait can carry (no trailing / sliding feet)
  if (!rig.air) {
    if (e.mode === STALK && e.mo.mode !== 'evade') faceTravel(e); // evade = a sidestep, legs strafe
    const v = Math.hypot(e.vx, e.vy);
    if (v > rig.vmax) {
      e.vx *= rig.vmax / v;
      e.vy *= rig.vmax / v;
    }
  }
  stepSpring(e.sq, sqT, 240, 0.42, dt);
  stepSpring(e.pull, pullT, 200, 0.45, dt);
  e.tw += (0 - e.tw) * damp(14, dt);

  e.x += e.vx * dt;
  e.y += e.vy * dt;
  const sp = Math.hypot(e.vx, e.vy);
  if (turnRate > 0 && sp > 0.5 * u) e.heading = turnToward(e.heading, Math.atan2(e.vy, e.vx), turnRate * dt);
  e.tailA = turnToward(e.tailA, e.heading, 4 * dt);

  e.palpT -= dt;
  if (e.palpT <= 0) {
    e.palpT = randRange(e, 0.06, 0.5);
    e.palpA = randRange(e, 0.05, 0.6);
    e.palpB = -randRange(e, 0.05, 0.6);
  }
  // loose fragments: glitch-snap out, ease back
  e.fragT -= dt;
  const fo = e.fragOff;
  if (e.fragT <= 0) {
    e.fragT = randRange(e, 0.4, 2);
    const i = ((rand(e) * 3) | 0) * 2;
    fo[i] = (rand(e) - 0.5) * 7 * u;
    fo[i + 1] = (rand(e) - 0.5) * 7 * u;
  }
  const fk = damp(7, dt);
  for (let i = 0; i < 6; i++) fo[i] -= fo[i] * fk;

  updateRig(rig, e.x, e.y, e.heading, e.vx, e.vy, dt, e);
  const c = Math.cos(e.heading);
  const s = Math.sin(e.heading);
  updateEye(e.eye, e, e.x + c * 10 * u * BK, e.y + s * 10 * u * BK, target, dt, 0.35, e.charge);
  updateGlitch(e, dt, 0.35 + e.charge * 2.2 + (e.mode === LUNGE ? 3 : 0), e.charge * 0.1);
  updateTrail(e, dt, 170 * u);
}

function drawBody(ctx: Ctx2D, e: Crawler, time: number): void {
  const u = e.size / 56;
  const w = Math.max(0.75, 0.9 * Math.sqrt(u));
  const dying = e.deathT >= 0;
  const fill = silFill(e);
  drawRig(ctx, e.rig, w, e.tremble, 1, time, fill);
  if (e.shattered) return;

  const c = Math.cos(e.heading);
  const s = Math.sin(e.heading);
  const tj = e.tremble ? Math.sin(time * 83) * e.tremble : 0;
  const pull = e.pull.x;
  const ox = c * (e.rig.offX + pull) - s * e.rig.offY + tj;
  const oy = s * (e.rig.offX + pull) + c * e.rig.offY - tj * 0.6;
  const bx = e.x + ox;
  const by = e.y + oy;
  const lw = Math.max(1, w);
  const U = u * BK;

  // tail shard: lags behind on a short spine
  const ta = e.tailA;
  const tx = bx - Math.cos(ta) * 15 * U;
  const ty = by - Math.sin(ta) * 15 * U;
  ctx.strokeStyle = orangeA(0.5);
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(bx - c * 10 * U, by - s * 10 * U);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(ta + 0.25);
  ctx.beginPath();
  polySub(ctx, e.tail, 0, 0);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = edgeA(e, 0.65);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(e.heading + e.tw);
  const breathe = 1 + Math.sin(time * 2.3 + e.seed) * 0.02;
  const sq = e.sq.x;
  ctx.scale(sq * breathe, (1 / Math.sqrt(sq)) * (1 - e.rig.bob * 0.1));
  // core: hot slit visible through the gap between the plates
  const gap = (0.8 + e.charge * 1.8) * U;
  const cg = 0.12 + 0.12 * Math.sin(time * 3.1 + e.seed) + e.charge * 0.85;
  ctx.fillStyle = coreColor(cg);
  ctx.fillRect(-1.6 * U, -5 * U, 2.4 * U, 10 * U);
  // sensor needles (twitching) with off-white tips
  ctx.lineWidth = Math.max(0.6, w * 0.8);
  ctx.strokeStyle = orangeA(0.7);
  ctx.beginPath();
  const n1x = 13 * U + Math.cos(-e.palpA) * 12 * U;
  const n1y = -3 * U + Math.sin(-e.palpA) * 12 * U;
  const n2x = 12 * U + Math.cos(-e.palpB) * 9 * U;
  const n2y = 3 * U + Math.sin(-e.palpB) * 9 * U;
  ctx.moveTo(13 * U, -3 * U);
  ctx.lineTo(n1x, n1y);
  ctx.moveTo(12 * U, 3 * U);
  ctx.lineTo(n2x, n2y);
  // data spines
  const sp = e.spines;
  for (let i = 0; i < sp.length; i += 4) {
    ctx.moveTo(sp[i], sp[i + 1]);
    ctx.lineTo(sp[i + 2], sp[i + 3]);
  }
  ctx.stroke();
  ctx.fillStyle = whiteA(0.9);
  const ts = Math.max(1, 1.2 * U);
  ctx.fillRect(n1x - ts * 0.5, n1y - ts * 0.5, ts, ts);
  ctx.fillRect(n2x - ts * 0.5, n2y - ts * 0.5, ts, ts);
  for (let i = 0; i < sp.length; i += 8) ctx.fillRect(sp[i + 2] - ts * 0.5, sp[i + 3] - ts * 0.5, ts, ts);
  // plates (batched): nose blade forward of the gap, thorax behind
  ctx.beginPath();
  polySub(ctx, e.nose, gap * 0.5, 0);
  polySub(ctx, e.thorax, -gap * 0.5, 0);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.lineJoin = 'miter';
  ctx.strokeStyle = edgeA(e, 0.8 + e.charge * 0.2);
  ctx.stroke();
  // facet seams
  ctx.strokeStyle = PAL.grayMid;
  ctx.lineWidth = Math.max(0.6, w * 0.7);
  ctx.beginPath();
  ctx.moveTo(19 * U + gap * 0.5, 0.4 * U);
  ctx.lineTo(6 * U + gap * 0.5, -1.2 * U);
  ctx.lineTo(3.4 * U + gap * 0.5, -5.6 * U);
  ctx.moveTo(-3 * U - gap * 0.5, -6.6 * U);
  ctx.lineTo(-8 * U - gap * 0.5, 0);
  ctx.lineTo(-4 * U - gap * 0.5, 6.2 * U);
  ctx.stroke();
  // loose fragments
  ctx.beginPath();
  const fo = e.fragOff;
  for (let i = 0; i < 3; i++) {
    const fx = FRAG_ANCHORS[i * 2] * U + fo[i * 2] + Math.sin(time * 1.7 + i * 2.1) * 0.8 * U;
    const fy = FRAG_ANCHORS[i * 2 + 1] * U + fo[i * 2 + 1];
    polySub(ctx, e.frags[i], fx, fy);
  }
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = edgeA(e, 0.7);
  ctx.lineWidth = Math.max(0.7, w * 0.8);
  ctx.stroke();
  ctx.restore();

  const ex = bx + c * 10 * U;
  const ey = by + s * 10 * U;
  drawGlow(ctx, bx, by, (7 + e.charge * 12) * U, (dying ? 0.9 : 0.16 + e.charge * 0.75) * (0.9 + 0.1 * Math.sin(time * 3.1)));
  // the single focal point: bright even at idle so it reads at 40 px
  drawEye(ctx, ex, ey, 4 * U, e.eye, Math.max(0.65, e.charge), 0.55 + e.charge * 0.45, e.heading + Math.PI / 2);
}

export function drawCrawler(ctx: Ctx2D, e: Crawler, time: number): void {
  drawTrail(ctx, e);
  if (e.shattered) {
    drawGlitched(ctx, e, time, e.size * 1.3, drawBody);
    drawDebris(ctx, e.debris, time);
    const p = (e.deathT - DEATH_COLLAPSE) / 0.5;
    if (p < 1) drawGlow(ctx, e.x, e.y, (14 + p * 26) * (e.size / 56), (1 - clamp(p, 0, 1)) * 0.95);
    return;
  }
  drawGlitched(ctx, e, time, e.size * 1.3, drawBody);
}

export function drawCrawlerDebug(ctx: Ctx2D, e: Crawler): void {
  drawRigDebug(ctx, e.rig);
}
