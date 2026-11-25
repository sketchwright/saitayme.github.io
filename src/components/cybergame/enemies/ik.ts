// Procedural legs: world-planted feet, threshold-triggered arc steps with
// alternating gait groups, and a pole-seeded FABRIK solve for 3-4 segment
// limbs (bend direction is always "outward" for the leg's side, so knees
// never flip). No allocations after construction.

import { Ctx2D, PAL, Rng, TAU, clamp, easeInOut, orangeA, rand, whiteA } from './common';

export interface Leg {
  n: number; // segment count
  len: Float32Array;
  total: number;
  // local (body frame, +x = forward, +y = right)
  hx: number;
  hy: number;
  rx: number;
  ry: number;
  side: number; // -1 left, +1 right
  group: number; // gait group 0 | 1
  // world state
  fx: number;
  fy: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  p: number;
  dur: number;
  stepping: boolean;
  lift: number;
  flash: number;
  urg: number;
  hwx: number;
  hwy: number;
  rwx: number;
  rwy: number;
  /** solved joints, world space, (n+1)*2 */
  j: Float32Array;
}

export interface Rig {
  legs: Leg[];
  threshold: number;
  baseDur: number;
  bulge: number;
  // derived support response, in body-local px
  offX: number;
  offY: number;
  bob: number;
  stepCount: Int32Array;
}

export interface LegSpec {
  hx: number;
  hy: number;
  rx: number;
  ry: number;
  side: number;
  group: number;
  segs: number[];
}

export const makeLeg = (s: LegSpec): Leg => {
  const n = s.segs.length;
  const len = new Float32Array(s.segs);
  let total = 0;
  for (let i = 0; i < n; i++) total += len[i];
  return {
    n,
    len,
    total,
    hx: s.hx,
    hy: s.hy,
    rx: s.rx,
    ry: s.ry,
    side: s.side,
    group: s.group,
    fx: 0,
    fy: 0,
    sx: 0,
    sy: 0,
    tx: 0,
    ty: 0,
    p: 0,
    dur: 0.16,
    stepping: false,
    lift: 0,
    flash: 0,
    urg: 0,
    hwx: 0,
    hwy: 0,
    rwx: 0,
    rwy: 0,
    j: new Float32Array((n + 1) * 2),
  };
};

export const makeRig = (legs: Leg[], threshold: number, baseDur: number, bulge: number): Rig => ({
  legs,
  threshold,
  baseDur,
  bulge,
  offX: 0,
  offY: 0,
  bob: 0,
  stepCount: new Int32Array(2),
});

/** Plants every foot on its rest position (call once after create). */
export const plantRig = (rig: Rig, x: number, y: number, h: number): void => {
  const c = Math.cos(h);
  const s = Math.sin(h);
  for (const L of rig.legs) {
    L.fx = x + c * L.rx - s * L.ry;
    L.fy = y + s * L.rx + c * L.ry;
    L.stepping = false;
    L.p = 0;
  }
  updateRig(rig, x, y, h, 0, 0, 0, { rs: 1 });
};

const startStep = (rig: Rig, L: Leg, vx: number, vy: number, dur: number, r: Rng): void => {
  L.sx = L.fx;
  L.sy = L.fy;
  const d = dur * (0.85 + rand(r) * 0.3);
  // predictive placement: land where the rest point will be, plus noise
  const jit = rig.threshold * 0.25;
  let tx = L.rwx + vx * d * 1.1 + (rand(r) - 0.5) * jit;
  let ty = L.rwy + vy * d * 1.1 + (rand(r) - 0.5) * jit;
  const hx = tx - L.hwx;
  const hy = ty - L.hwy;
  const hd = Math.hypot(hx, hy);
  const max = L.total * 0.92;
  if (hd > max) {
    tx = L.hwx + (hx / hd) * max;
    ty = L.hwy + (hy / hd) * max;
  }
  L.tx = tx;
  L.ty = ty;
  L.p = 0;
  L.dur = d;
  L.stepping = true;
};

/**
 * Advances steps, triggers new ones (alternating groups) and solves IK.
 * (x,y,h) = body transform, (vx,vy) = body velocity for predictive steps.
 */
export function updateRig(rig: Rig, x: number, y: number, h: number, vx: number, vy: number, dt: number, r: Rng): void {
  const c = Math.cos(h);
  const s = Math.sin(h);
  const legs = rig.legs;
  const sc = rig.stepCount;
  sc[0] = 0;
  sc[1] = 0;
  let offX = 0;
  let offY = 0;
  let bob = 0;

  for (let i = 0; i < legs.length; i++) {
    const L = legs[i];
    L.hwx = x + c * L.hx - s * L.hy;
    L.hwy = y + s * L.hx + c * L.hy;
    L.rwx = x + c * L.rx - s * L.ry;
    L.rwy = y + s * L.rx + c * L.ry;
    if (L.stepping) {
      L.p += dt / L.dur;
      if (L.p >= 1) {
        L.p = 1;
        L.stepping = false;
        L.fx = L.tx;
        L.fy = L.ty;
        L.lift = 0;
        L.flash = 1;
      } else {
        const e = easeInOut(L.p);
        L.fx = L.sx + (L.tx - L.sx) * e;
        L.fy = L.sy + (L.ty - L.sy) * e;
        L.lift = Math.sin(Math.PI * L.p);
        sc[L.group]++;
      }
    }
    if (L.flash > 0) L.flash = Math.max(0, L.flash - dt * 4);
    // body sags away from lifted legs, leans toward lagging feet
    const lx = L.hx;
    const ly = L.hy;
    const ll = Math.hypot(lx, ly) || 1;
    offX -= (lx / ll) * L.lift * rig.threshold * 0.12;
    offY -= (ly / ll) * L.lift * rig.threshold * 0.12;
    const dfx = L.fx - L.rwx;
    const dfy = L.fy - L.rwy;
    offX += (c * dfx + s * dfy) * 0.05;
    offY += (-s * dfx + c * dfy) * 0.05;
    bob += L.lift;
  }

  // urgency per planted leg
  let best = -1;
  let bestU = 0;
  for (let i = 0; i < legs.length; i++) {
    const L = legs[i];
    if (L.stepping) {
      L.urg = 0;
      continue;
    }
    let u = Math.hypot(L.fx - L.rwx, L.fy - L.rwy) / rig.threshold;
    const hd = Math.hypot(L.fx - L.hwx, L.fy - L.hwy);
    if (hd > L.total * 0.985) u = Math.max(u, 2.6);
    L.urg = u;
    if (u > bestU) {
      bestU = u;
      best = i;
    }
  }

  if (dt > 0) {
    const sp = Math.hypot(vx, vy);
    const dur = clamp(rig.baseDur - sp * 0.00025, 0.1, rig.baseDur);
    if (best >= 0 && bestU >= 1) {
      const g = legs[best].group;
      if (sc[g ^ 1] === 0) {
        for (const L of legs) {
          if (!L.stepping && L.group === g && L.urg >= 0.6) {
            startStep(rig, L, vx, vy, dur, r);
            sc[g]++;
          }
        }
      }
    }
    // emergency: a badly over-stretched foot may break gait
    for (const L of legs) {
      if (!L.stepping && L.urg > 2.4) startStep(rig, L, vx, vy, dur * 0.8, r);
    }
  }

  const n = legs.length || 1;
  rig.offX = offX / n;
  rig.offY = offY / n;
  rig.bob = bob / n;

  for (const L of legs) {
    // lifted foot projects toward the hip (seen from above)
    const lk = L.lift * 0.22;
    const fx = L.fx + (L.hwx - L.fx) * lk;
    const fy = L.fy + (L.hwy - L.fy) * lk;
    solveLeg(L.j, L.len, L.n, L.hwx, L.hwy, fx, fy, -s * L.side, c * L.side, rig.bulge * (1 + L.lift * 0.6));
  }
}

/**
 * Arachnid leg solve: the needle (last segment) is placed first, dropping
 * steeply onto the foot from the outward side; femur + the middle segments
 * are then a 2-bone analytic solve (law of cosines) from hip to that ankle,
 * knee always on the outward side. Extra middle joints sit on a slight
 * outward bow. Stateless and deterministic, so the bend never flips.
 */
export function solveLeg(
  j: Float32Array,
  len: Float32Array,
  n: number,
  hx: number,
  hy: number,
  fx: number,
  fy: number,
  ox: number,
  oy: number,
  ankleOut: number,
): void {
  const L0 = len[0];
  let Lm = 0;
  for (let i = 1; i < n - 1; i++) Lm += len[i];
  const Ln = len[n - 1];
  let cx = fx - hx;
  let cy = fy - hy;
  const cd = Math.hypot(cx, cy) || 1e-4;
  cx /= cd;
  cy /= cd;
  // outward perpendicular of the chord
  let px = -cy;
  let py = cx;
  if (px * ox + py * oy < 0) {
    px = -px;
    py = -py;
  }
  // ankle: up-and-out from the foot, pulled back toward the hip
  let ax = px * ankleOut - cx * 0.55;
  let ay = py * ankleOut - cy * 0.55;
  const al = Math.hypot(ax, ay) || 1;
  ax = fx + (ax / al) * Ln;
  ay = fy + (ay / al) * Ln;
  // 2-bone hip -> ankle
  let dx = ax - hx;
  let dy = ay - hy;
  let d = Math.hypot(dx, dy) || 1e-4;
  const maxR = L0 + Lm - 1e-3;
  const minR = Math.abs(L0 - Lm) + 1e-3;
  if (d > maxR) {
    ax = hx + (dx / d) * maxR;
    ay = hy + (dy / d) * maxR;
    d = maxR;
  } else if (d < minR) {
    ax = hx + (dx / d) * minR;
    ay = hy + (dy / d) * minR;
    d = minR;
  }
  dx = (ax - hx) / d;
  dy = (ay - hy) / d;
  const cosA = clamp((L0 * L0 + d * d - Lm * Lm) / (2 * L0 * d), -1, 1);
  const sinA = Math.sqrt(1 - cosA * cosA);
  // rotate hip->ankle direction toward the outward side
  let sgn = 1;
  if (-dy * px + dx * py < 0) sgn = -1;
  const kx = hx + (dx * cosA - dy * sinA * sgn) * L0;
  const ky = hy + (dy * cosA + dx * sinA * sgn) * L0;
  j[0] = hx;
  j[1] = hy;
  j[2] = kx;
  j[3] = ky;
  // middle joints along knee -> ankle with a slight outward bow
  let mx = ax - kx;
  let my = ay - ky;
  const md = Math.hypot(mx, my) || 1e-4;
  mx /= md;
  my /= md;
  let bx = -my;
  let by = mx;
  if (bx * px + by * py < 0) {
    bx = -bx;
    by = -by;
  }
  let acc = 0;
  for (let i = 1; i < n - 1; i++) {
    acc += len[i];
    const t = acc / Lm;
    const bow = Math.sin(Math.PI * t) * Lm * 0.12;
    j[(i + 1) * 2] = kx + mx * md * t + bx * bow;
    j[(i + 1) * 2 + 1] = ky + my * md * t + by * bow;
  }
  j[(n - 1) * 2] = ax;
  j[(n - 1) * 2 + 1] = ay;
  j[n * 2] = fx;
  j[n * 2 + 1] = fy;
}

/**
 * Pole-seeded FABRIK. (ox,oy) is the outward direction for the bend; the
 * chain is seeded as an arch bulging that way, then iterated so the solve
 * converges to the same bend family every frame (stateless, no flips).
 */
export function solveChain(
  j: Float32Array,
  len: Float32Array,
  n: number,
  total: number,
  hx: number,
  hy: number,
  tx: number,
  ty: number,
  ox: number,
  oy: number,
  bulge: number,
  iters: number,
): void {
  let dx = tx - hx;
  let dy = ty - hy;
  const d = Math.hypot(dx, dy);
  j[0] = hx;
  j[1] = hy;
  if (d >= total * 0.999 || d < 1e-4) {
    const ux = d < 1e-4 ? ox : dx / d;
    const uy = d < 1e-4 ? oy : dy / d;
    let acc = 0;
    for (let i = 0; i < n; i++) {
      acc += len[i];
      j[i * 2 + 2] = hx + ux * acc;
      j[i * 2 + 3] = hy + uy * acc;
    }
    return;
  }
  // perpendicular to the chord, on the outward side
  let px = -dy / d;
  let py = dx / d;
  if (px * ox + py * oy < 0) {
    px = -px;
    py = -py;
  }
  const slack = Math.sqrt(total * total - d * d) * bulge;
  let acc = 0;
  for (let i = 1; i < n; i++) {
    acc += len[i - 1];
    const t = acc / total;
    const b = Math.sin(Math.PI * Math.min(1, t * 1.15)) * slack;
    j[i * 2] = hx + dx * t + px * b;
    j[i * 2 + 1] = hy + dy * t + py * b;
  }
  j[n * 2] = tx;
  j[n * 2 + 1] = ty;
  for (let it = 0; it < iters; it++) {
    // backward
    j[n * 2] = tx;
    j[n * 2 + 1] = ty;
    for (let i = n - 1; i >= 0; i--) {
      dx = j[i * 2] - j[i * 2 + 2];
      dy = j[i * 2 + 1] - j[i * 2 + 3];
      const l = Math.hypot(dx, dy) || 1e-4;
      j[i * 2] = j[i * 2 + 2] + (dx / l) * len[i];
      j[i * 2 + 1] = j[i * 2 + 3] + (dy / l) * len[i];
    }
    // forward
    j[0] = hx;
    j[1] = hy;
    for (let i = 0; i < n; i++) {
      dx = j[i * 2 + 2] - j[i * 2];
      dy = j[i * 2 + 3] - j[i * 2 + 1];
      const l = Math.hypot(dx, dy) || 1e-4;
      j[i * 2 + 2] = j[i * 2] + (dx / l) * len[i];
      j[i * 2 + 3] = j[i * 2 + 1] + (dy / l) * len[i];
    }
  }
}

/**
 * Batched limb drawing: femur pass (heavier, gray), mid pass (orange
 * hairline), needle pass (thin), joint nubs, plant ticks.
 */
export function drawRig(ctx: Ctx2D, rig: Rig, w: number, tremble: number, alpha: number): void {
  const legs = rig.legs;
  // femurs
  ctx.lineCap = 'round';
  ctx.lineJoin = 'miter';
  ctx.strokeStyle = PAL.grayMid;
  ctx.lineWidth = w * 1.7;
  ctx.beginPath();
  for (const L of legs) {
    ctx.moveTo(L.j[0], L.j[1]);
    ctx.lineTo(L.j[2], L.j[3]);
  }
  ctx.stroke();
  // mid segments
  ctx.strokeStyle = orangeA(0.85 * alpha);
  ctx.lineWidth = w;
  ctx.beginPath();
  for (const L of legs) {
    ctx.moveTo(L.j[2], L.j[3]);
    for (let i = 2; i < L.n; i++) ctx.lineTo(L.j[i * 2] + jit(tremble), L.j[i * 2 + 1] + jit(tremble));
  }
  ctx.stroke();
  // needles
  ctx.strokeStyle = orangeA(0.55 * alpha);
  ctx.lineWidth = Math.max(0.6, w * 0.6);
  ctx.beginPath();
  for (const L of legs) {
    const k = L.n * 2;
    ctx.moveTo(L.j[k - 2], L.j[k - 1]);
    ctx.lineTo(L.j[k], L.j[k + 1]);
  }
  ctx.stroke();
  // joint nubs
  ctx.fillStyle = orangeA(alpha);
  ctx.beginPath();
  const js = w * 1.6;
  for (const L of legs) {
    for (let i = 1; i < L.n; i++) ctx.rect(L.j[i * 2] - js * 0.5, L.j[i * 2 + 1] - js * 0.5, js, js);
  }
  ctx.fill();
  // plant flash ticks (only legs that just landed)
  for (const L of legs) {
    if (L.flash <= 0) continue;
    const k = L.n * 2;
    ctx.fillStyle = whiteA(L.flash * 0.8 * alpha);
    const r = w * (1 + (1 - L.flash) * 2.2);
    ctx.fillRect(L.j[k] - r * 0.5, L.j[k + 1] - 0.5, r, 1);
  }
}

const jit = (t: number): number => (t > 0 ? (Math.random() - 0.5) * t : 0);

export function drawRigDebug(ctx: Ctx2D, rig: Rig): void {
  ctx.lineWidth = 1;
  for (const L of rig.legs) {
    // rest position + threshold circle
    ctx.strokeStyle = 'rgba(150,150,150,0.5)';
    ctx.beginPath();
    ctx.arc(L.rwx, L.rwy, rig.threshold, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(L.rwx - 3, L.rwy);
    ctx.lineTo(L.rwx + 3, L.rwy);
    ctx.moveTo(L.rwx, L.rwy - 3);
    ctx.lineTo(L.rwx, L.rwy + 3);
    ctx.stroke();
    // step target
    if (L.stepping) {
      ctx.strokeStyle = PAL.orange;
      ctx.beginPath();
      ctx.arc(L.tx, L.ty, 3, 0, TAU);
      ctx.moveTo(L.sx, L.sy);
      ctx.lineTo(L.tx, L.ty);
      ctx.stroke();
    }
    // joints
    ctx.fillStyle = L.group === 0 ? PAL.white : PAL.orange;
    for (let i = 0; i <= L.n; i++) ctx.fillRect(L.j[i * 2] - 1.5, L.j[i * 2 + 1] - 1.5, 3, 3);
  }
}
