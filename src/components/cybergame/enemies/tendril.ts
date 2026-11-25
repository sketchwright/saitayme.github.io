// Tendrils for flyers: verlet chains rooted at an anchor, pulled toward a
// travelling sine-curl rest shape with stiffness that falls off toward the
// tip, so motion of the body produces follow-through and lag.

import { Ctx2D, PAL, TAU, orangeA } from './common';

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
});

export const initTendril = (td: Tendril, ax: number, ay: number, ang: number): void => {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  for (let i = 0; i < td.n; i++) {
    td.x[i] = td.ox[i] = ax + c * td.seg * i;
    td.y[i] = td.oy[i] = ay + s * td.seg * i;
  }
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
  const n = td.n;
  const x = td.x;
  const y = td.y;
  const ox = td.ox;
  const oy = td.oy;
  x[0] = ox[0] = ax;
  y[0] = oy[0] = ay;
  const k = Math.min(1, dt * 60);
  const dm = Math.pow(td.dampK, k);
  // verlet integrate
  for (let i = 1; i < n; i++) {
    const vx = (x[i] - ox[i]) * dm;
    const vy = (y[i] - oy[i]) * dm;
    ox[i] = x[i];
    oy[i] = y[i];
    x[i] += vx;
    y[i] += vy;
  }
  // pull toward curled rest shape (built from the actual previous node) + length constraint
  let a = ang;
  const st = td.stiff * stiffMul;
  for (let i = 1; i < n; i++) {
    const f = i / (n - 1);
    a += Math.sin(time * td.freq * freqMul - i * 0.6 + td.ph) * td.amp * ampMul * (0.25 + f) * 0.35;
    const ix = x[i - 1] + Math.cos(a) * td.seg;
    const iy = y[i - 1] + Math.sin(a) * td.seg;
    const kk = Math.min(1, st * (1 - f * 0.75) * k);
    x[i] += (ix - x[i]) * kk;
    y[i] += (iy - y[i]) * kk;
    const dx = x[i] - x[i - 1];
    const dy = y[i] - y[i - 1];
    const d = Math.hypot(dx, dy) || 1e-4;
    x[i] = x[i - 1] + (dx / d) * td.seg;
    y[i] = y[i - 1] + (dy / d) * td.seg;
  }
}

/**
 * Batched: root half at w0 (gray-orange), tip half at w1 (orange hairline),
 * vertebra ticks every `tick` nodes, needle barb on the tip.
 */
export function drawTendrils(ctx: Ctx2D, tds: Tendril[], count: number, w0: number, w1: number, alpha: number, tickLen: number): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = PAL.grayMid;
  ctx.lineWidth = w0;
  ctx.beginPath();
  for (let t = 0; t < count; t++) {
    const td = tds[t];
    const h = (td.n * 0.45) | 0;
    ctx.moveTo(td.x[0], td.y[0]);
    for (let i = 1; i <= h; i++) ctx.lineTo(td.x[i], td.y[i]);
  }
  ctx.stroke();
  ctx.strokeStyle = orangeA(0.8 * alpha);
  ctx.lineWidth = w1;
  ctx.beginPath();
  for (let t = 0; t < count; t++) {
    const td = tds[t];
    const h = (td.n * 0.45) | 0;
    ctx.moveTo(td.x[h], td.y[h]);
    for (let i = h + 1; i < td.n; i++) ctx.lineTo(td.x[i], td.y[i]);
    // barb
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
