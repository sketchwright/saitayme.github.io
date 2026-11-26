// Tendrils for flyers: verlet chains rooted at an anchor, pulled toward a
// travelling sine-curl rest shape with stiffness that falls off toward the
// tip (organic lag + follow-through). Whips are a sideways impulse that
// travels root -> tip. Drawn either as needle tendrils or as torn ribbons.

import { Ctx2D, PAL, TAU, orangeA, whiteA } from './common';

export interface Tendril {
  n: number;
  seg: number;
  x: Float32Array;
  y: Float32Array;
  ox: Float32Array;
  oy: Float32Array;
  amp: number;
  freq: number;
  ph: number;
  stiff: number;
  dampK: number;
  /** -1 idle, else seconds since the whip started */
  whipT: number;
  whipS: number; // signed strength (px)
  /** ribbon width multipliers (torn holes), optional */
  tear: Float32Array | null;
}

export const makeTendril = (n: number, seg: number, amp: number, freq: number, ph: number, stiff: number): Tendril => ({
  n,
  seg,
  x: new Float32Array(n),
  y: new Float32Array(n),
  ox: new Float32Array(n),
  oy: new Float32Array(n),
  amp,
  freq,
  ph,
  stiff,
  dampK: 0.9,
  whipT: -1,
  whipS: 0,
  tear: null,
});

export const initTendril = (td: Tendril, ax: number, ay: number, ang: number): void => {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  for (let i = 0; i < td.n; i++) {
    td.x[i] = td.ox[i] = ax + c * td.seg * i;
    td.y[i] = td.oy[i] = ay + s * td.seg * i;
  }
};

/** Starts a whip: a sideways kick travelling root -> tip. delay in s. */
export const whipTendril = (td: Tendril, strength: number, delay = 0): void => {
  td.whipT = -delay - 1e-4;
  td.whipS = strength;
};

/**
 * ang = rest direction (world radians). ampMul / freqMul scale the curl.
 * stiffMul > 1 makes the tendril snap toward its rest shape (used for reaches).
 */
export function updateTendril(
  td: Tendril,
  ax: number,
  ay: number,
  ang: number,
  dt: number,
  time: number,
  ampMul: number,
  freqMul: number,
  stiffMul: number,
): void {
  if (!(dt > 0)) return;
  // fixed ~1/60 s substeps: the verlet damping / stiffness are per-step, so
  // this keeps the motion identical at 30, 60 or 144 fps (no extra wiggle).
  // The anchor is interpolated from the previous root position.
  const steps = Math.min(4, Math.max(1, Math.round(dt * 60)));
  if (steps === 1) {
    stepTendril(td, ax, ay, ang, dt, time, ampMul, freqMul, stiffMul);
    return;
  }
  const x0 = td.x[0];
  const y0 = td.y[0];
  const h = dt / steps;
  for (let i = 1; i <= steps; i++) {
    const f = i / steps;
    stepTendril(td, x0 + (ax - x0) * f, y0 + (ay - y0) * f, ang, h, time - dt + h * i, ampMul, freqMul, stiffMul);
  }
}

function stepTendril(
  td: Tendril,
  ax: number,
  ay: number,
  ang: number,
  dt: number,
  time: number,
  ampMul: number,
  freqMul: number,
  stiffMul: number,
): void {
  const n = td.n;
  const x = td.x;
  const y = td.y;
  const ox = td.ox;
  const oy = td.oy;
  x[0] = ox[0] = ax;
  y[0] = oy[0] = ay;
  const k = Math.min(1, dt * 60);
  const dm = Math.pow(td.dampK, k);
  for (let i = 1; i < n; i++) {
    const vx = (x[i] - ox[i]) * dm;
    const vy = (y[i] - oy[i]) * dm;
    ox[i] = x[i];
    oy[i] = y[i];
    x[i] += vx;
    y[i] += vy;
  }
  // whip front position along the chain (nodes / s)
  let wf = -1;
  if (td.whipT !== -1) {
    td.whipT += dt;
    if (td.whipT >= 0) {
      wf = td.whipT * 30;
      if (wf > n + 2) td.whipT = -1;
    }
  }
  let a = ang;
  const st = td.stiff * stiffMul;
  for (let i = 1; i < n; i++) {
    const f = i / (n - 1);
    // long, gentle travelling wave (low curvature per joint = organic, no kinks)
    a += Math.sin(time * td.freq * freqMul - i * 0.32 + td.ph) * td.amp * ampMul * (0.2 + f) * 0.2;
    const ix = x[i - 1] + Math.cos(a) * td.seg;
    const iy = y[i - 1] + Math.sin(a) * td.seg;
    const kk = Math.min(1, st * (1 - f * 0.8) * k);
    x[i] += (ix - x[i]) * kk;
    y[i] += (iy - y[i]) * kk;
    if (wf >= 0) {
      const dd = i - wf;
      if (dd > -2.5 && dd < 2.5) {
        // perpendicular kick (smooth bump, ~whipS px total per node)
        const bump = 0.5 + 0.5 * Math.cos((dd / 2.5) * Math.PI);
        const g = bump * td.whipS * (0.3 + f * 0.7) * k * 0.22;
        x[i] += -Math.sin(a) * g;
        y[i] += Math.cos(a) * g;
      }
    }
    const dx = x[i] - x[i - 1];
    const dy = y[i] - y[i - 1];
    const d = Math.hypot(dx, dy) || 1e-4;
    x[i] = x[i - 1] + (dx / d) * td.seg;
    y[i] = y[i - 1] + (dy / d) * td.seg;
  }
  // curvature smoothing (removes single-joint kinks from verlet lag), then
  // re-apply the length constraint
  const sm = 0.3 * k;
  for (let i = 1; i < n - 1; i++) {
    x[i] += ((x[i - 1] + x[i + 1]) * 0.5 - x[i]) * sm;
    y[i] += ((y[i - 1] + y[i + 1]) * 0.5 - y[i]) * sm;
  }
  for (let i = 1; i < n; i++) {
    const dx = x[i] - x[i - 1];
    const dy = y[i] - y[i - 1];
    const d = Math.hypot(dx, dy) || 1e-4;
    x[i] = x[i - 1] + (dx / d) * td.seg;
    y[i] = y[i - 1] + (dy / d) * td.seg;
  }
}

/**
 * Batched needle tendrils: dark core with an orange edge on the root half,
 * orange hairline tip, vertebra ticks, off-white barb.
 */
export function drawTendrils(ctx: Ctx2D, tds: Tendril[], count: number, w0: number, w1: number, alpha: number, tickLen: number): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // root half: edge + dark core
  ctx.beginPath();
  for (let t = 0; t < count; t++) {
    const td = tds[t];
    const h = (td.n * 0.5) | 0;
    ctx.moveTo(td.x[0], td.y[0]);
    for (let i = 1; i <= h; i++) ctx.lineTo(td.x[i], td.y[i]);
  }
  ctx.strokeStyle = orangeA(0.6 * alpha);
  ctx.lineWidth = w0 + 2;
  ctx.stroke();
  ctx.strokeStyle = PAL.void;
  ctx.lineWidth = w0;
  ctx.stroke();
  ctx.strokeStyle = orangeA(0.85 * alpha);
  ctx.lineWidth = w1;
  ctx.beginPath();
  for (let t = 0; t < count; t++) {
    const td = tds[t];
    const h = (td.n * 0.5) | 0;
    ctx.moveTo(td.x[h], td.y[h]);
    for (let i = h + 1; i < td.n; i++) ctx.lineTo(td.x[i], td.y[i]);
  }
  ctx.stroke();
  ctx.strokeStyle = whiteA(0.85 * alpha);
  ctx.lineWidth = Math.max(0.7, w1 * 0.9);
  ctx.beginPath();
  for (let t = 0; t < count; t++) {
    const td = tds[t];
    const e = td.n - 1;
    const dx = td.x[e] - td.x[e - 1];
    const dy = td.y[e] - td.y[e - 1];
    ctx.moveTo(td.x[e], td.y[e]);
    ctx.lineTo(td.x[e] - dx * 0.9 - dy * 0.55, td.y[e] - dy * 0.9 + dx * 0.55);
  }
  ctx.stroke();
  if (tickLen > 0) {
    ctx.strokeStyle = orangeA(0.45 * alpha);
    ctx.lineWidth = Math.max(0.6, w1 * 0.8);
    ctx.beginPath();
    for (let t = 0; t < count; t++) {
      const td = tds[t];
      for (let i = 2; i < td.n - 2; i += 2) {
        const dx = td.x[i + 1] - td.x[i - 1];
        const dy = td.y[i + 1] - td.y[i - 1];
        const d = Math.hypot(dx, dy) || 1;
        const l = tickLen * (1 - i / td.n);
        const nx = (-dy / d) * l;
        const ny = (dx / d) * l;
        ctx.moveTo(td.x[i] - nx, td.y[i] - ny);
        ctx.lineTo(td.x[i] + nx, td.y[i] + ny);
      }
    }
    ctx.stroke();
  }
}

/**
 * Batched torn ribbons (shroud strips): tapered filled polygons, width
 * modulated by td.tear (holes / frays), near-black fill + orange edge.
 */
export function drawRibbons(ctx: Ctx2D, tds: Tendril[], count: number, w: number, fill: string, edge: string, lw: number): void {
  ctx.beginPath();
  for (let t = 0; t < count; t++) {
    const td = tds[t];
    const n = td.n;
    // left edge out, right edge back
    for (let pass = 0; pass < 2; pass++) {
      const sgn = pass === 0 ? 1 : -1;
      for (let k = 0; k < n; k++) {
        const i = pass === 0 ? k : n - 1 - k;
        const a = i > 0 ? i - 1 : 0;
        const b = i < n - 1 ? i + 1 : n - 1;
        const dx = td.x[b] - td.x[a];
        const dy = td.y[b] - td.y[a];
        const d = Math.hypot(dx, dy) || 1;
        const f = i / (n - 1);
        let ww = w * (1 - f * 0.85) * (td.tear ? td.tear[i] : 1);
        if (pass === 1 && (i & 1) === 1) ww *= 0.55; // frayed rear edge
        const px = td.x[i] + (-dy / d) * ww * sgn;
        const py = td.y[i] + (dx / d) * ww * sgn;
        if (pass === 0 && k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
    }
    ctx.closePath();
  }
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.lineJoin = 'miter';
  ctx.strokeStyle = edge;
  ctx.stroke();
}

export function drawTendrilDebug(ctx: Ctx2D, tds: Tendril[]): void {
  ctx.fillStyle = PAL.white;
  for (const td of tds) {
    for (let i = 0; i < td.n; i++) ctx.fillRect(td.x[i] - 1, td.y[i] - 1, 2, 2);
    ctx.strokeStyle = 'rgba(150,150,150,0.6)';
    ctx.beginPath();
    ctx.arc(td.x[0], td.y[0], 3, 0, TAU);
    ctx.stroke();
  }
}
