// LEECH: segmented lance. A spearhead skull trailed by nested chevron
// armour segments (gaps between, one cracked and knocked out of line) and a
// needle tail, with four jointed hook-limbs at the head (IK). It slithers
// with peristaltic surges, coils (segments compress) before a stretched
// lunge, latches (hooks clamp onto points around the target) and drains:
// pulses travel down the spine into a throbbing core.

import {
  CreateOpts,
  Ctx2D,
  DEATH_COLLAPSE,
  EnemyBase,
  EyeTrack,
  PAL,
  Spring,
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
  grayA,
  hotA,
  hurtBase,
  killBase,
  makeBase,
  makeEye,
  makeSpring,
  orangeA,
  rand,
  randRange,
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
import { solveChain } from './ik';

export const LEECH_SIZE = 64;

const SEEK = 0;
const FREEZE = 1;
const LUNGE = 2;
const LATCHED = 3;
const RECOIL = 4;

const CORE_SEG = 4;
const HEAD = [13, 0, 4, -4.4, -2.5, -5.2, -0.6, -1.2, -3.2, 0, -0.6, 1.2, -2.5, 5.2, 4, 4.4];

interface Hook {
  n: number;
  len: Float32Array;
  total: number;
  ax: number; // local attach
  ay: number;
  side: number;
  ang: number; // target angle offset on the victim ring
  tx: number;
  ty: number;
  j: Float32Array;
  twT: number;
  twX: number;
  twY: number;
}

export interface Leech extends EnemyBase {
  kind: 'leech';
  segN: number;
  segLen: number;
  sx: Float32Array;
  sy: Float32Array;
  wid: Float32Array;
  hooks: Hook[];
  mode: number;
  modeT: number;
  cooldown: number;
  latchX: number;
  latchY: number;
  lx: number;
  ly: number;
  drain: number;
  eye: EyeTrack;
  auto: boolean;
  head: Float32Array;
  /** spine length multiplier (spring: <1 coiled, >1 stretched) */
  comp: Spring;
  crack: number;
  shattered: boolean;
}

export function createLeech(x: number, y: number, seed: number, opts?: CreateOpts): Leech {
  const size = opts?.size ?? LEECH_SIZE;
  const b = makeBase(x, y, seed, size);
  const u = size / 64;
  const segN = 9;
  const segLen = 5.6 * u;
  const sx = new Float32Array(segN);
  const sy = new Float32Array(segN);
  const wid = new Float32Array(segN);
  for (let i = 0; i < segN; i++) {
    sx[i] = x;
    sy[i] = y - i * segLen;
    const f = i / (segN - 1);
    wid[i] = (i === 0 ? 4.5 : 6.4 * Math.sin(Math.PI * (0.22 + f * 0.7)) + 1.2) * u * randRange(b, 0.9, 1.1);
  }
  const hooks: Hook[] = [];
  const spec: Array<[number, number, number]> = [
    [-1, 22, -0.9],
    [-1, 14, -0.35],
    [1, 19, 0.5],
    [1, 11, 1.05],
  ];
  for (const [side, l, ang] of spec) {
    const L = l * u * randRange(b, 0.9, 1.15);
    hooks.push({
      n: 3,
      len: new Float32Array([L * 0.42, L * 0.34, L * 0.24]),
      total: L,
      ax: 2 * u,
      ay: side * randRange(b, 2.5, 4) * u,
      side,
      ang,
      tx: x,
      ty: y,
      j: new Float32Array(8),
      twT: 0,
      twX: 0,
      twY: 0,
    });
  }
  const head = new Float32Array(HEAD.length);
  for (let i = 0; i < HEAD.length; i++) head[i] = HEAD[i] * u * 1.3;
  return {
    ...b,
    kind: 'leech',
    segN,
    segLen,
    sx,
    sy,
    wid,
    hooks,
    mode: SEEK,
    modeT: 0,
    cooldown: 0.5,
    latchX: x,
    latchY: y,
    lx: 0,
    ly: 1,
    drain: 0,
    eye: makeEye(),
    auto: true,
    head,
    comp: makeSpring(1),
    crack: 2 + ((rand(b) * 4) | 0),
    shattered: false,
  };
}

/** Bestiary / game hook: release if latched, else freeze-lunge-latch now. */
export function leechToggleLatch(e: Leech): void {
  if (e.deathT >= 0) return;
  if (e.mode === LATCHED) {
    e.mode = RECOIL;
    e.modeT = 0;
  } else if (e.mode === SEEK || e.mode === RECOIL) {
    e.mode = FREEZE;
    e.modeT = 0;
  }
}

export const leechIsLatched = (e: Leech): boolean => e.mode === LATCHED;

/** Optional hit reaction: knockback (tears it off if latched), recoil kink, glitch. */
export function hurtLeech(e: Leech, dx: number, dy: number, strength = 1): void {
  if (e.deathT >= 0) return;
  hurtBase(e, dx, dy, strength);
  e.comp.v -= 4;
  for (const h of e.hooks) {
    h.twX = (rand(e) - 0.5) * 8 * (e.size / 64);
    h.twY = (rand(e) - 0.5) * 8 * (e.size / 64);
  }
  if (e.mode === LATCHED && strength >= 1) {
    e.mode = RECOIL;
    e.modeT = 0;
  }
}

/** Optional death: hooks go limp, the lance breaks apart segment by segment. */
export function killLeech(e: Leech): void {
  killBase(e);
  e.drain = 0;
}

function spine(e: Leech): void {
  const sx = e.sx;
  const sy = e.sy;
  const L = e.segLen * e.comp.x;
  sx[0] = e.x;
  sy[0] = e.y;
  for (let i = 1; i < e.segN; i++) {
    const ddx = sx[i] - sx[i - 1];
    const ddy = sy[i] - sy[i - 1];
    const d = Math.hypot(ddx, ddy) || 1e-4;
    sx[i] = sx[i - 1] + (ddx / d) * L;
    sy[i] = sy[i - 1] + (ddy / d) * L;
  }
}

function dying(e: Leech, dt: number, target: Vec): void {
  const u = e.size / 64;
  const t = e.deathT;
  steer(e, 0, 0, 5, dt);
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  stepSpring(e.comp, 0.7, 120, 0.4, dt);
  spine(e);
  // hooks fold limp toward the body
  const c = Math.cos(e.heading);
  const s = Math.sin(e.heading);
  for (const h of e.hooks) {
    const hx = e.x + c * h.ax - s * h.ay;
    const hy = e.y + s * h.ax + c * h.ay;
    const a = e.heading + h.side * 2.4;
    h.tx += (hx + Math.cos(a) * h.total * 0.35 - h.tx) * damp(8, dt);
    h.ty += (hy + Math.sin(a) * h.total * 0.35 - h.ty) * damp(8, dt);
    solveChain(h.j, h.len, h.n, h.total, hx, hy, h.tx, h.ty, -s * h.side, c * h.side, 0.9, 3);
  }
  if (!e.shattered && t >= DEATH_COLLAPSE) {
    e.shattered = true;
    const d = ensureDebris(e, 22, 0.8);
    addDebrisPoly(d, e.head, e.x, e.y, e.heading, 1, e.sx[3], e.sy[3], 90 * u, e.vx, e.vy, e);
    const tri = new Float32Array(6);
    for (let i = 1; i < e.segN; i++) {
      const w = e.wid[i];
      const L = e.segLen;
      tri[0] = L * 0.5;
      tri[1] = 0;
      tri[2] = -L * 0.35;
      tri[3] = -w;
      tri[4] = -L * 0.35;
      tri[5] = w;
      const a = Math.atan2(e.sy[i - 1] - e.sy[i], e.sx[i - 1] - e.sx[i]);
      addDebrisPoly(d, tri, e.sx[i], e.sy[i], a, 1, e.sx[CORE_SEG], e.sy[CORE_SEG], 80 * u, 0, 0, e);
    }
    burstGlyphs(e, e.sx[CORE_SEG], e.sy[CORE_SEG], 12, 140 * u);
  }
  updateEye(e.eye, e, e.x, e.y, target, dt, 1.5, 1);
  updateGlitch(e, dt, 3.5, 0.2);
  updateTrail(e, dt, 1e9);
}

const resetLeech = (e: Leech): void => {
  const c = Math.cos(e.heading);
  const s = Math.sin(e.heading);
  for (let i = 0; i < e.segN; i++) {
    e.sx[i] = e.x - c * e.segLen * i;
    e.sy[i] = e.y - s * e.segLen * i;
  }
  for (const h of e.hooks) {
    h.tx = e.x + c * h.ax - s * h.ay;
    h.ty = e.y + s * h.ax + c * h.ay;
  }
};

/** Robust public update (see robustUpdate). */
const modeLeech = (e: Leech, mode: IntentMode): void => {
  if (mode === 'lunge' && (e.mode === SEEK || e.mode === RECOIL)) leechToggleLatch(e);
  if (mode === 'evade' && e.mode === LATCHED) leechToggleLatch(e);
};

/** Robust public update (see robustUpdate). */
export function updateLeech(e: Leech, dt: number, target: Vec, intent?: Vec | EnemyIntent | null): void {
  const u = e.size / 64;
  robustUpdate(e, dt, target, intent, 110 * u, 420 * u, 14, stepLeech, resetLeech, modeLeech);
}

function stepLeech(e: Leech, dt: number, target: Vec, intent: Vec | null): void {
  e.t += dt;
  if (tickFx(e, dt)) {
    dying(e, dt, target);
    return;
  }
  e.modeT += dt;
  const u = e.size / 64;
  const dx = target.x - e.x;
  const dy = target.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  const reach = 22 * u;
  let turn = 3.5;
  let compT = 1;
  switch (e.mode) {
    case SEEK: {
      e.cooldown -= dt;
      const surge = 0.35 + 0.65 * Math.pow(Math.max(0, Math.sin(e.t * 5.5)), 2);
      const weave = Math.sin(e.t * 3.2) * 0.55;
      compT = 0.94 + surge * 0.08; // peristaltic squeeze
      let dvx: number;
      let dvy: number;
      if (intent) {
        dvx = intent.x;
        dvy = intent.y;
      } else {
        const a = Math.atan2(dy, dx) + weave;
        const sp = 58 * u * surge * Math.min(1, (dist - reach * 0.8) / (30 * u));
        dvx = Math.cos(a) * sp;
        dvy = Math.sin(a) * sp;
      }
      steer(e, dvx, dvy, 6, dt);
      e.charge += (0 - e.charge) * damp(2, dt);
      e.drain += (0 - e.drain) * damp(2, dt);
      if (e.auto && !e.mo.mode && e.cooldown <= 0 && dist < reach * 3.2) {
        e.mode = FREEZE;
        e.modeT = 0;
      }
      break;
    }
    case FREEZE: {
      steer(e, 0, 0, 25, dt);
      const p = Math.min(1, e.modeT / 0.45);
      e.charge = p;
      compT = 1 - 0.24 * Math.sqrt(p); // coil
      if (rand(e) < dt * 8) e.heading = turnToward(e.heading, Math.atan2(dy, dx), 0.4);
      turn = 0;
      if (p >= 1) {
        e.mode = LUNGE;
        e.modeT = 0;
        e.lx = dx / dist;
        e.ly = dy / dist;
        e.heading = turnToward(e.heading, Math.atan2(dy, dx), 0.45);
        e.comp.v += 5;
      }
      break;
    }
    case LUNGE: {
      const p = Math.min(1, e.modeT / 0.3);
      const want = Math.max(0, dist - reach * 0.75);
      const sp = Math.min(380 * u * (1 - p) * (1 - p), want / Math.max(dt, 1e-3));
      e.vx = e.lx * sp;
      e.vy = e.ly * sp;
      compT = 1.14;
      turn = 10;
      if (p >= 1 || want < 2 * u) {
        if (dist < reach * 1.6) {
          e.mode = LATCHED;
          e.latchX = target.x;
          e.latchY = target.y;
        } else {
          e.mode = SEEK;
          e.cooldown = 0.8;
        }
        e.modeT = 0;
      }
      break;
    }
    case LATCHED: {
      e.latchX = target.x;
      e.latchY = target.y;
      const sx = e.latchX - (dx / dist) * reach * 0.75;
      const sy = e.latchY - (dy / dist) * reach * 0.75;
      e.vx = (sx - e.x) * 10;
      e.vy = (sy - e.y) * 10;
      e.drain = Math.min(1, e.drain + dt * 1.5);
      const pump = Math.pow(0.5 + 0.5 * Math.sin(e.t * 9), 3);
      e.charge = 0.45 + 0.55 * pump;
      compT = 0.92 + pump * 0.08;
      e.heading = turnToward(e.heading, Math.atan2(dy, dx), 6 * dt);
      turn = 0;
      if (e.auto && e.modeT > 2.6 && e.mo.mode !== 'hold') {
        e.mode = RECOIL;
        e.modeT = 0;
      }
      break;
    }
    default: {
      const p = Math.min(1, e.modeT / 0.4);
      const sp = -220 * u * (1 - p) * (1 - p);
      e.vx = Math.cos(e.heading) * sp;
      e.vy = Math.sin(e.heading) * sp;
      e.charge += (0 - e.charge) * damp(4, dt);
      compT = 0.85;
      turn = 0;
      if (p >= 1) {
        e.mode = SEEK;
        e.modeT = 0;
        e.cooldown = randRange(e, 1.2, 2.2);
      }
    }
  }
  stepSpring(e.comp, compT, 160, 0.38, dt);
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  const sp = Math.hypot(e.vx, e.vy);
  if (turn > 0 && sp > 5 * u) e.heading = turnToward(e.heading, Math.atan2(e.vy, e.vx), turn * dt);
  spine(e);

  // hooks
  const c = Math.cos(e.heading);
  const s = Math.sin(e.heading);
  const latched = e.mode === LATCHED;
  const anticip = e.mode === FREEZE || e.mode === LUNGE;
  const vr = 7 * u;
  for (const h of e.hooks) {
    const hx = e.x + c * h.ax - s * h.ay;
    const hy = e.y + s * h.ax + c * h.ay;
    h.twT -= dt;
    if (h.twT <= 0) {
      h.twT = randRange(e, 0.12, 0.7);
      h.twX = (rand(e) - 0.5) * 3 * u;
      h.twY = (rand(e) - 0.5) * 3 * u;
    }
    let gx: number;
    let gy: number;
    if (latched) {
      const a = Math.atan2(-dy, -dx) + h.ang;
      const dig = Math.sin(e.t * 9 + h.ang * 3) * 0.6 * u; // hooks work in rhythm
      gx = e.latchX + Math.cos(a) * (vr + dig);
      gy = e.latchY + Math.sin(a) * (vr + dig);
    } else if (anticip) {
      const f = h.total * 0.8;
      const a = e.heading + h.side * 0.8 + h.ang * 0.3;
      gx = hx + Math.cos(a) * f;
      gy = hy + Math.sin(a) * f;
    } else {
      const a = e.heading + h.side * 1.9;
      const f = h.total * 0.45;
      gx = hx + Math.cos(a) * f + h.twX;
      gy = hy + Math.sin(a) * f + h.twY;
    }
    const k = damp(latched ? 30 : anticip ? 22 : 12, dt);
    h.tx += (gx - h.tx) * k;
    h.ty += (gy - h.ty) * k;
    solveChain(h.j, h.len, h.n, h.total, hx, hy, h.tx, h.ty, -s * h.side, c * h.side, 0.7, 4);
  }

  updateEye(e.eye, e, e.x, e.y, target, dt, 0.4, e.charge);
  updateGlitch(e, dt, 0.35 + e.charge * 1.5, 0.05);
  updateTrail(e, dt, 150 * u);
}

function drawBody(ctx: Ctx2D, e: Leech, time: number): void {
  const u = e.size / 64;
  const w = Math.max(0.75, 0.9 * Math.sqrt(u));
  const lw = Math.max(1, w);
  const n = e.segN;
  const sx = e.sx;
  const sy = e.sy;
  const wid = e.wid;
  const fill = silFill(e);
  const dying = e.deathT >= 0;
  const a0 = ctx.globalAlpha;
  if (dying) ctx.globalAlpha = a0 * clamp(1 - (e.deathT - DEATH_COLLAPSE) / 0.4, 0, 1);

  // hooks: dark limbs with orange edges, off-white barbs
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (const h of e.hooks) {
    ctx.moveTo(h.j[0], h.j[1]);
    for (let i = 1; i <= h.n; i++) ctx.lineTo(h.j[i * 2], h.j[i * 2 + 1]);
  }
  ctx.strokeStyle = edgeA(e, 0.85);
  ctx.lineWidth = w * 1.8 + 2;
  ctx.stroke();
  ctx.strokeStyle = fill;
  ctx.lineWidth = w * 1.8;
  ctx.stroke();
  ctx.strokeStyle = whiteA(0.85);
  ctx.lineWidth = Math.max(0.8, w);
  ctx.beginPath();
  for (const h of e.hooks) {
    const ex = h.j[h.n * 2];
    const ey = h.j[h.n * 2 + 1];
    const dx = ex - h.j[h.n * 2 - 2];
    const dy = ey - h.j[h.n * 2 - 1];
    const d = Math.hypot(dx, dy) || 1;
    const bl = 3.4 * u;
    ctx.moveTo(ex - (dx / d) * bl * 0.4, ey - (dy / d) * bl * 0.4);
    ctx.lineTo(ex, ey);
    ctx.lineTo(ex - (dx / d) * bl - (dy / d) * bl * h.side, ey - (dy / d) * bl + (dx / d) * bl * h.side);
  }
  ctx.stroke();
  ctx.fillStyle = orangeA(1);
  ctx.beginPath();
  const js = Math.max(1.4, 1.6 * w);
  for (const h of e.hooks) for (let i = 1; i < h.n; i++) ctx.rect(h.j[i * 2] - js / 2, h.j[i * 2 + 1] - js / 2, js, js);
  ctx.fill();
  if (e.shattered) {
    ctx.globalAlpha = a0;
    return;
  }

  // cilia needles (ripple wave), every other segment, off-white tips
  ctx.strokeStyle = grayA(0.7);
  ctx.lineWidth = Math.max(0.6, w * 0.7);
  ctx.beginPath();
  for (let i = 2; i < n - 1; i += 2) {
    const dx = sx[i - 1] - sx[i + 1];
    const dy = sy[i - 1] - sy[i + 1];
    const d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d;
    const ny = dx / d;
    const tx = dx / d;
    const ty = dy / d;
    const rip = Math.sin(time * 10 - i * 1.1) * 2 * u;
    const l = wid[i] + 6 * u;
    ctx.moveTo(sx[i] + nx * wid[i] * 0.8, sy[i] + ny * wid[i] * 0.8);
    ctx.lineTo(sx[i] + nx * l - tx * (4 * u + rip), sy[i] + ny * l - ty * (4 * u + rip));
    ctx.moveTo(sx[i] - nx * wid[i] * 0.8, sy[i] - ny * wid[i] * 0.8);
    ctx.lineTo(sx[i] - nx * l - tx * (4 * u - rip), sy[i] - ny * l - ty * (4 * u - rip));
  }
  ctx.stroke();

  // needle tail
  const tdx = sx[n - 1] - sx[n - 2];
  const tdy = sy[n - 1] - sy[n - 2];
  const tl = Math.hypot(tdx, tdy) || 1;
  const tipX = sx[n - 1] + (tdx / tl) * 13 * u;
  const tipY = sy[n - 1] + (tdy / tl) * 13 * u;
  ctx.strokeStyle = orangeA(0.8);
  ctx.lineWidth = Math.max(0.8, w * 1.2);
  ctx.beginPath();
  ctx.moveTo(sx[n - 1], sy[n - 1]);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();
  ctx.fillStyle = whiteA(0.9);
  ctx.fillRect(tipX - 1, tipY - 1, 2, 2);

  // chevron segments (batched): tip forward, swept wings, notch behind
  ctx.beginPath();
  for (let i = 1; i < n; i++) {
    const a = i - 1;
    const b = i < n - 1 ? i + 1 : n - 1;
    let dx = sx[a] - sx[b];
    let dy = sy[a] - sy[b];
    const d = Math.hypot(dx, dy) || 1;
    dx /= d;
    dy /= d;
    const nx = -dy;
    const ny = dx;
    const L = e.segLen * e.comp.x;
    const wv = wid[i] * (1 + 0.06 * Math.sin(time * 6 - i));
    let cx = sx[i];
    let cy = sy[i];
    if (i === e.crack) {
      cx += nx * 1.6 * u;
      cy += ny * 1.6 * u;
    }
    const f = L * 0.52;
    const bk = L * 0.38;
    ctx.moveTo(cx + dx * f, cy + dy * f);
    ctx.lineTo(cx - dx * bk + nx * wv, cy - dy * bk + ny * wv);
    ctx.lineTo(cx - dx * bk * 0.15 + nx * wv * 0.25, cy - dy * bk * 0.15 + ny * wv * 0.25);
    ctx.lineTo(cx - dx * bk * 0.15 - nx * wv * 0.25, cy - dy * bk * 0.15 - ny * wv * 0.25);
    ctx.lineTo(cx - dx * bk - nx * wv, cy - dy * bk - ny * wv);
    ctx.closePath();
  }
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.lineJoin = 'miter';
  ctx.strokeStyle = edgeA(e, 0.8);
  ctx.stroke();

  // drain pulses travelling head -> core
  const ci = CORE_SEG;
  if (e.drain > 0.05) {
    for (let k = 0; k < 3; k++) {
      const f = (time * 1.6 + k / 3) % 1;
      const pos = f * ci;
      const i0 = Math.floor(pos);
      const t = pos - i0;
      const px = sx[i0] + (sx[i0 + 1] - sx[i0]) * t;
      const py = sy[i0] + (sy[i0 + 1] - sy[i0]) * t;
      const r = 1.6 * u * (1 - f * 0.4);
      ctx.fillStyle = hotA(e.drain * (0.4 + 0.6 * f));
      ctx.fillRect(px - r, py - r, r * 2, r * 2);
    }
  }
  // core (breathing) inside its chevron
  const cr = (2.6 + e.charge * 1.4 + Math.sin(time * 2.6 + e.seed) * 0.3) * u;
  const ca = Math.atan2(sy[ci + 1] - sy[ci - 1], sx[ci + 1] - sx[ci - 1]);
  ctx.fillStyle = coreColor(0.3 + e.charge * 0.7);
  ctx.beginPath();
  ctx.ellipse(sx[ci], sy[ci], cr * 0.7, cr, ca, 0, TAU);
  ctx.fill();
  drawGlow(ctx, sx[ci], sy[ci], (8 + e.charge * 12) * u, dying ? 0.9 : 0.15 + e.charge * 0.7);

  // spearhead skull
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.heading);
  ctx.beginPath();
  const H = e.head;
  ctx.moveTo(H[0], H[1]);
  for (let i = 2; i < H.length; i += 2) ctx.lineTo(H[i], H[i + 1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = edgeA(e, 0.95);
  ctx.lineWidth = lw;
  ctx.stroke();
  ctx.strokeStyle = PAL.grayMid;
  ctx.beginPath();
  ctx.moveTo(15 * u, 0);
  ctx.lineTo(8 * u, 0);
  ctx.stroke();
  ctx.restore();
  const c = Math.cos(e.heading);
  const s = Math.sin(e.heading);
  drawEye(ctx, e.x + c * 3.5 * u, e.y + s * 3.5 * u, 3.2 * u, e.eye, e.charge, 0.9, e.heading + Math.PI / 2);
  // charge eye on the second segment
  drawChargeEye(ctx, sx[2], sy[2], 1.8 * u, e.eye, e.charge, Math.atan2(sy[1] - sy[3], sx[1] - sx[3]));
  ctx.globalAlpha = a0;
}

export function drawLeech(ctx: Ctx2D, e: Leech, time: number): void {
  drawTrail(ctx, e);
  drawGlitched(ctx, e, time, e.size * 1.25, drawBody);
  if (e.shattered) {
    drawDebris(ctx, e.debris, time);
    const p = (e.deathT - DEATH_COLLAPSE) / 0.5;
    if (p < 1) drawGlow(ctx, e.sx[CORE_SEG], e.sy[CORE_SEG], (14 + p * 24) * (e.size / 64), (1 - clamp(p, 0, 1)) * 0.9);
  }
}

export function drawLeechDebug(ctx: Ctx2D, e: Leech): void {
  ctx.fillStyle = PAL.white;
  for (let i = 0; i < e.segN; i++) ctx.fillRect(e.sx[i] - 1, e.sy[i] - 1, 2, 2);
  ctx.strokeStyle = PAL.orange;
  ctx.lineWidth = 1;
  for (const h of e.hooks) {
    ctx.beginPath();
    ctx.arc(h.tx, h.ty, 2.5, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = PAL.white;
    for (let i = 0; i <= h.n; i++) ctx.fillRect(h.j[i * 2] - 1.5, h.j[i * 2 + 1] - 1.5, 3, 3);
  }
}
