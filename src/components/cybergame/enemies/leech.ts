// LEECH: elongated segmented body that slithers (follow-the-leader spine),
// four jointed hook-limbs at the head (IK). Near the target it freezes,
// lunges, latches (hooks clamp onto points around the target) and drains:
// pulses travel down the spine into a throbbing core.

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
  drawGlitched,
  drawGlow,
  drawTrail,
  grayA,
  hotA,
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
  whiteA,
} from './common';
import { solveChain } from './ik';

export const LEECH_SIZE = 64;

const EYE_PTS = [2.5, -1.8, 1.2, 1.6, -0.6, -0.4];

const SEEK = 0;
const FREEZE = 1;
const LUNGE = 2;
const LATCHED = 3;
const RECOIL = 4;

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
}

export function createLeech(x: number, y: number, seed: number, opts?: CreateOpts): Leech {
  const size = opts?.size ?? LEECH_SIZE;
  const b = makeBase(x, y, seed, size);
  const u = size / 64;
  const segN = 9;
  const segLen = 5.2 * u;
  const sx = new Float32Array(segN);
  const sy = new Float32Array(segN);
  const wid = new Float32Array(segN);
  for (let i = 0; i < segN; i++) {
    sx[i] = x;
    sy[i] = y - i * segLen;
    const f = i / (segN - 1);
    wid[i] = (i === 0 ? 4.5 : 6.5 * Math.sin(Math.PI * (0.25 + f * 0.75)) + 1) * u * randRange(b, 0.9, 1.1);
  }
  const hooks: Hook[] = [];
  const spec: Array<[number, number, number]> = [
    // side, length, ring angle
    [-1, 21, -0.9],
    [-1, 14, -0.35],
    [1, 18, 0.5],
    [1, 11, 1.05],
  ];
  for (const [side, l, ang] of spec) {
    const L = l * u * randRange(b, 0.9, 1.15);
    const len = new Float32Array([L * 0.42, L * 0.34, L * 0.24]);
    hooks.push({
      n: 3,
      len,
      total: L,
      ax: 3 * u,
      ay: side * randRange(b, 2, 3.5) * u,
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
  };
}

/** Bestiary / game hook: release if latched, else freeze-lunge-latch now. */
export function leechToggleLatch(e: Leech): void {
  if (e.mode === LATCHED) {
    e.mode = RECOIL;
    e.modeT = 0;
  } else if (e.mode === SEEK || e.mode === RECOIL) {
    e.mode = FREEZE;
    e.modeT = 0;
  }
}

export const leechIsLatched = (e: Leech): boolean => e.mode === LATCHED;

export function updateLeech(e: Leech, dt: number, target: Vec, intent?: Vec | null): void {
  e.t += dt;
  e.modeT += dt;
  const u = e.size / 64;
  const dx = target.x - e.x;
  const dy = target.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  const reach = 22 * u;
  let turn = 3.5;
  switch (e.mode) {
    case SEEK: {
      e.cooldown -= dt;
      // peristaltic surge + weave
      const surge = 0.35 + 0.65 * Math.pow(Math.max(0, Math.sin(e.t * 5.5)), 2);
      const weave = Math.sin(e.t * 3.2) * 0.55;
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
      if (e.auto && e.cooldown <= 0 && dist < reach * 3.2) {
        e.mode = FREEZE;
        e.modeT = 0;
      }
      break;
    }
    case FREEZE: {
      steer(e, 0, 0, 25, dt);
      const p = Math.min(1, e.modeT / 0.45);
      e.charge = p;
      if (rand(e) < dt * 8) e.heading = turnToward(e.heading, Math.atan2(dy, dx), 0.4);
      turn = 0;
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
      const p = Math.min(1, e.modeT / 0.3);
      const want = Math.max(0, dist - reach * 0.75);
      const sp = Math.min(380 * u * (1 - p) * (1 - p), want / Math.max(dt, 1e-3));
      e.vx = e.lx * sp;
      e.vy = e.ly * sp;
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
      // stay clamped at standoff from the (possibly moving) victim
      e.latchX = target.x;
      e.latchY = target.y;
      const sx = e.latchX - (dx / dist) * reach * 0.75;
      const sy = e.latchY - (dy / dist) * reach * 0.75;
      e.vx = (sx - e.x) * 10;
      e.vy = (sy - e.y) * 10;
      e.drain = Math.min(1, e.drain + dt * 1.5);
      e.charge = 0.45 + 0.55 * Math.pow(0.5 + 0.5 * Math.sin(e.t * 9), 3);
      e.heading = turnToward(e.heading, Math.atan2(dy, dx), 6 * dt);
      turn = 0;
      if (e.auto && e.modeT > 2.6) {
        e.mode = RECOIL;
        e.modeT = 0;
      }
      break;
    }
    default: {
      // recoil: backward burst
      const p = Math.min(1, e.modeT / 0.4);
      const sp = -220 * u * (1 - p) * (1 - p);
      e.vx = Math.cos(e.heading) * sp;
      e.vy = Math.sin(e.heading) * sp;
      e.charge += (0 - e.charge) * damp(4, dt);
      turn = 0;
      if (p >= 1) {
        e.mode = SEEK;
        e.modeT = 0;
        e.cooldown = randRange(e, 1.2, 2.2);
      }
    }
  }
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  const sp = Math.hypot(e.vx, e.vy);
  if (turn > 0 && sp > 5 * u) e.heading = turnToward(e.heading, Math.atan2(e.vy, e.vx), turn * dt);

  // follow-the-leader spine
  const sx = e.sx;
  const sy = e.sy;
  sx[0] = e.x;
  sy[0] = e.y;
  for (let i = 1; i < e.segN; i++) {
    const ddx = sx[i] - sx[i - 1];
    const ddy = sy[i] - sy[i - 1];
    const d = Math.hypot(ddx, ddy) || 1e-4;
    sx[i] = sx[i - 1] + (ddx / d) * e.segLen;
    sy[i] = sy[i - 1] + (ddy / d) * e.segLen;
  }

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
      h.twT = randRange(e, 0.06, 0.5);
      h.twX = (rand(e) - 0.5) * 3 * u;
      h.twY = (rand(e) - 0.5) * 3 * u;
    }
    let gx: number;
    let gy: number;
    if (latched) {
      const a = Math.atan2(-dy, -dx) + h.ang;
      gx = e.latchX + Math.cos(a) * vr;
      gy = e.latchY + Math.sin(a) * vr;
      gx += (Math.random() - 0.5) * 0.8 * u;
      gy += (Math.random() - 0.5) * 0.8 * u;
    } else if (anticip) {
      // splay wide, forward
      const f = h.total * 0.78;
      const a = e.heading + h.side * 0.75 + h.ang * 0.3;
      gx = hx + Math.cos(a) * f;
      gy = hy + Math.sin(a) * f;
    } else {
      // folded back along the head, twitching
      const a = e.heading + h.side * 1.9;
      const f = h.total * 0.45;
      gx = hx + Math.cos(a) * f + h.twX;
      gy = hy + Math.sin(a) * f + h.twY;
    }
    const k = damp(latched ? 30 : anticip ? 22 : 14, dt);
    h.tx += (gx - h.tx) * k;
    h.ty += (gy - h.ty) * k;
    solveChain(h.j, h.len, h.n, h.total, hx, hy, h.tx, h.ty, -s * h.side, c * h.side, 0.7, 4);
  }

  updateEye(e.eye, e, e.x, e.y, target, dt, 0.4);
  updateGlitch(e, dt, 0.35 + e.charge * 1.5, 0.05);
  updateTrail(e, dt, 150 * u);
}

function drawBody(ctx: Ctx2D, e: Leech, time: number): void {
  const u = e.size / 64;
  const w = Math.max(0.75, 0.9 * Math.sqrt(u));
  const n = e.segN;
  const sx = e.sx;
  const sy = e.sy;
  const wid = e.wid;

  // cilia needles along the body (ripple wave), drawn first
  ctx.strokeStyle = grayA(0.7);
  ctx.lineWidth = Math.max(0.6, w * 0.7);
  ctx.beginPath();
  for (let i = 1; i < n - 1; i++) {
    const dx = sx[i - 1] - sx[i + 1];
    const dy = sy[i - 1] - sy[i + 1];
    const d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d;
    const ny = dx / d;
    const tx = dx / d;
    const ty = dy / d;
    const rip = Math.sin(time * 12 - i * 1.1) * 2 * u;
    const l = wid[i] + (3 + (i % 3) * 2) * u;
    ctx.moveTo(sx[i] + nx * wid[i], sy[i] + ny * wid[i]);
    ctx.lineTo(sx[i] + nx * l - tx * (3 * u + rip), sy[i] + ny * l - ty * (3 * u + rip));
    const l2 = wid[i] + (2 + ((i + 1) % 3) * 2.5) * u;
    ctx.moveTo(sx[i] - nx * wid[i], sy[i] - ny * wid[i]);
    ctx.lineTo(sx[i] - nx * l2 - tx * (3 * u - rip), sy[i] - ny * l2 - ty * (3 * u - rip));
  }
  ctx.stroke();

  // body outline: left edge forward, right edge back
  ctx.beginPath();
  for (let pass = 0; pass < 2; pass++) {
    const sgn = pass === 0 ? 1 : -1;
    for (let k = 0; k < n; k++) {
      const i = pass === 0 ? k : n - 1 - k;
      const a = i > 0 ? i - 1 : 0;
      const b = i < n - 1 ? i + 1 : n - 1;
      const dx = sx[a] - sx[b];
      const dy = sy[a] - sy[b];
      const d = Math.hypot(dx, dy) || 1;
      const wv = wid[i] * (1 + 0.08 * Math.sin(time * 7 - i));
      const px = sx[i] + (-dy / d) * wv * sgn;
      const py = sy[i] + (dx / d) * wv * sgn;
      if (pass === 0 && k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    if (pass === 0) {
      // pointed tail
      const dx = sx[n - 1] - sx[n - 2];
      const dy = sy[n - 1] - sy[n - 2];
      ctx.lineTo(sx[n - 1] + dx * 1.6, sy[n - 1] + dy * 1.6);
    }
  }
  ctx.closePath();
  ctx.fillStyle = PAL.body;
  ctx.fill();
  ctx.lineWidth = w;
  ctx.strokeStyle = orangeA(0.7);
  ctx.stroke();
  // rib plates
  ctx.strokeStyle = PAL.grayMid;
  ctx.beginPath();
  for (let i = 1; i < n - 1; i++) {
    const dx = sx[i - 1] - sx[i + 1];
    const dy = sy[i - 1] - sy[i + 1];
    const d = Math.hypot(dx, dy) || 1;
    const wv = wid[i] * 0.8;
    ctx.moveTo(sx[i] + (-dy / d) * wv, sy[i] + (dx / d) * wv);
    ctx.lineTo(sx[i] - (-dy / d) * wv, sy[i] - (dx / d) * wv);
  }
  ctx.stroke();

  // drain pulses travelling head -> core
  const ci = 4;
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
  // core
  const cr = (3.2 + e.charge * 1.6) * u;
  ctx.fillStyle = coreColor(e.charge);
  ctx.beginPath();
  ctx.ellipse(sx[ci], sy[ci], cr, cr * 0.7, Math.atan2(sy[ci + 1] - sy[ci - 1], sx[ci + 1] - sx[ci - 1]), 0, TAU);
  ctx.fill();
  drawGlow(ctx, sx[ci], sy[ci], (8 + e.charge * 12) * u, 0.15 + e.charge * 0.7);

  // hooks
  ctx.lineCap = 'round';
  ctx.strokeStyle = orangeA(0.9);
  ctx.lineWidth = w;
  ctx.beginPath();
  for (const h of e.hooks) {
    ctx.moveTo(h.j[0], h.j[1]);
    for (let i = 1; i <= h.n; i++) ctx.lineTo(h.j[i * 2], h.j[i * 2 + 1]);
    // barb: curl back inward
    const ex = h.j[h.n * 2];
    const ey = h.j[h.n * 2 + 1];
    const dx = ex - h.j[h.n * 2 - 2];
    const dy = ey - h.j[h.n * 2 - 1];
    const d = Math.hypot(dx, dy) || 1;
    const bl = 3.2 * u;
    ctx.lineTo(ex - (dx / d) * bl - (dy / d) * bl * h.side, ey - (dy / d) * bl + (dx / d) * bl * h.side);
  }
  ctx.stroke();
  ctx.fillStyle = PAL.white;
  for (const h of e.hooks) ctx.fillRect(h.j[2] - 0.75, h.j[3] - 0.75, 1.5, 1.5);

  // head wedge + eye cluster
  const c = Math.cos(e.heading);
  const s = Math.sin(e.heading);
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.heading);
  ctx.beginPath();
  ctx.moveTo(7 * u, 0);
  ctx.lineTo(2 * u, -4.5 * u);
  ctx.lineTo(-4 * u, -5 * u);
  ctx.lineTo(-3 * u, 4.6 * u);
  ctx.lineTo(3 * u, 3.8 * u);
  ctx.closePath();
  ctx.fillStyle = PAL.bodyHi;
  ctx.fill();
  ctx.strokeStyle = orangeA(0.9);
  ctx.stroke();
  ctx.restore();
  const ex = e.eye.ox * 0.9 * u;
  const ey = e.eye.oy * 0.9 * u;
  for (let k = 0; k < 3; k++) {
    const lx = EYE_PTS[k * 2] * u;
    const ly = EYE_PTS[k * 2 + 1] * u;
    const wx = e.x + c * lx - s * ly;
    const wy = e.y + s * lx + c * ly;
    const r = (k === 0 ? 1.5 : 1.0) * u;
    ctx.fillStyle = coreColor(0.3 + e.charge * 0.7);
    ctx.fillRect(wx - r, wy - r, r * 2, r * 2);
    ctx.fillStyle = whiteA(0.9);
    ctx.fillRect(wx + ex - 0.6, wy + ey - 0.6, 1.2, 1.2);
  }
}

export function drawLeech(ctx: Ctx2D, e: Leech, time: number): void {
  drawTrail(ctx, e);
  drawGlitched(ctx, e, time, e.size * 1.2, drawBody);
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
