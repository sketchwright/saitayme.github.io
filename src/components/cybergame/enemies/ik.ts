// Procedural legs: world-planted feet (never slide while planted, except the
// deliberate lunge skid and the damaged dragging limb), fast arced steps in
// alternating diagonal groups with per-leg timing variance and start stagger,
// idle "testing the ground" probes, splay for lunges, flinch steps on hits,
// and detach for deaths. Analytic arachnid solve for 3-4 segment limbs.
// Drawn as dark silhouettes with orange edges, joint squares and off-white
// needle tips. No allocations after construction.

import { Ctx2D, PAL, Rng, TAU, clamp, damp, orangeA, rand, smooth, whiteA } from './common';

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
  /** damaged limb: never steps on its own, gets dragged behind */
  drag: boolean;
  /** segment index drawn with a visible break (-1 = none) */
  broken: number;
  durMul: number;
  thrMul: number;
  liftK: number;
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
  /** -1 attached, else seconds since detached (death) */
  det: number;
  dvx: number;
  dvy: number;
  dva: number;
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
  /** 0..1: rest points pushed outward (lunge splay / crouch) */
  splay: number;
  /** 0..1: planted feet skid along with the body (lunge stop) */
  skid: number;
  /** 0..1: death collapse (legs fold toward the hips) */
  collapse: number;
  idleT: number;
  probeT: number;
  pvx: number;
  pvy: number;
  leanX: number;
  leanY: number;
  /** how far the body sags away from a lifted leg (fraction of threshold) */
  sag: number;
  /** step lead multiplier (legs sharing a side step one at a time, so each must land further ahead) */
  lead: number;
  /** safety re-plants of single over-stretched feet (diagnostics) */
  legSnaps: number;
}

export interface LegSpec {
  hx: number;
  hy: number;
  rx: number;
  ry: number;
  side: number;
  group: number;
  segs: number[];
  drag?: boolean;
  broken?: number;
}

export const makeLeg = (s: LegSpec, r?: Rng): Leg => {
  const n = s.segs.length;
  const len = new Float32Array(s.segs);
  let total = 0;
  for (let i = 0; i < n; i++) total += len[i];
  const rr = (): number => (r ? rand(r) : 0.5);
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
    drag: !!s.drag,
    broken: s.broken ?? -1,
    durMul: 0.82 + rr() * 0.4,
    thrMul: 0.85 + rr() * 0.35,
    liftK: 1,
    fx: 0,
    fy: 0,
    sx: 0,
    sy: 0,
    tx: 0,
    ty: 0,
    p: 0,
    dur: 0.13,
    stepping: false,
    lift: 0,
    flash: 0,
    urg: 0,
    hwx: 0,
    hwy: 0,
    rwx: 0,
    rwy: 0,
    det: -1,
    dvx: 0,
    dvy: 0,
    dva: 0,
    j: new Float32Array((n + 1) * 2),
  };
};

const sideLead = (legs: Leg[]): number => {
  let l = 0;
  let r = 0;
  for (const L of legs) if (!L.drag) L.side < 0 ? l++ : r++;
  return 1.25 + 0.75 * Math.max(0, Math.max(l, r) - 1);
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
  splay: 0,
  skid: 0,
  collapse: 0,
  idleT: 0,
  probeT: 1.2,
  pvx: 0,
  pvy: 0,
  leanX: 0,
  leanY: 0,
  sag: 0.14,
  lead: sideLead(legs),
  legSnaps: 0,
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
    L.det = -1;
  }
  rig.collapse = 0;
  rig.splay = 0;
  rig.skid = 0;
  updateRig(rig, x, y, h, 0, 0, 0, { rs: 1 });
};

/**
 * Snap reset after a teleport / huge jump: every attached foot re-plants on
 * its rest point (no stretched legs), steps cancelled, lean cleared.
 */
export const replantRig = (rig: Rig, x: number, y: number, h: number, vx: number, vy: number): void => {
  const c = Math.cos(h);
  const s = Math.sin(h);
  for (const L of rig.legs) {
    if (L.det >= 0) continue;
    L.fx = x + c * L.rx - s * L.ry;
    L.fy = y + s * L.rx + c * L.ry;
    L.stepping = false;
    L.p = 0;
    L.lift = 0;
    L.flash = 1;
  }
  rig.pvx = vx;
  rig.pvy = vy;
  rig.leanX = rig.leanY = 0;
  rig.idleT = 0;
  updateRig(rig, x, y, h, vx, vy, 0, { rs: 1 });
};

/** true if another attached leg on L's side is already lifting (gait rule: one per side) */
const sideBusy = (rig: Rig, L: Leg): boolean => {
  for (const o of rig.legs) if (o !== L && o.stepping && o.det < 0 && o.side === L.side) return true;
  return false;
};

const beginStep = (L: Leg, tx: number, ty: number, dur: number, delay: number, liftK: number): void => {
  L.sx = L.fx;
  L.sy = L.fy;
  L.tx = tx;
  L.ty = ty;
  L.dur = dur;
  L.p = -delay / dur; // negative = waiting (staggered start)
  L.stepping = true;
  L.liftK = liftK;
};

const startStep = (rig: Rig, L: Leg, vx: number, vy: number, dur: number, delay: number, r: Rng): void => {
  const d = dur * L.durMul * (0.88 + rand(r) * 0.24);
  // predictive placement: land where the rest point will be, plus noise
  const jit = rig.threshold * 0.3;
  // lead ahead of the rest point, but never past the re-step trigger
  // (otherwise the foot lands "urgent" and immediately steps back)
  let lx = vx * d * rig.lead;
  let ly = vy * d * rig.lead;
  const ll = Math.hypot(lx, ly);
  const lmax = rig.threshold * L.thrMul * 0.75;
  if (ll > lmax) {
    lx *= lmax / ll;
    ly *= lmax / ll;
  }
  let tx = L.rwx + lx + (rand(r) - 0.5) * jit;
  let ty = L.rwy + ly + (rand(r) - 0.5) * jit;
  const hx = tx - L.hwx;
  const hy = ty - L.hwy;
  const hd = Math.hypot(hx, hy);
  const max = L.total * 0.92;
  if (hd > max) {
    tx = L.hwx + (hx / hd) * max;
    ty = L.hwy + (hy / hd) * max;
  }
  beginStep(L, tx, ty, d, delay, 1);
};

/** Hit reaction: one planted leg jerks inward toward the hip and re-plants. */
export const rigFlinch = (rig: Rig, r: Rng): void => {
  const legs = rig.legs;
  const k = (rand(r) * legs.length) | 0;
  for (let i = 0; i < legs.length; i++) {
    const L = legs[(k + i) % legs.length];
    if (L.det >= 0 || L.stepping || sideBusy(rig, L)) continue;
    const tx = L.fx + (L.hwx - L.fx) * 0.45;
    const ty = L.fy + (L.hwy - L.fy) * 0.45;
    beginStep(L, tx, ty, 0.1, 0, 1.8);
    return;
  }
};

/** Death: detach one leg (it drifts away from (ox,oy), spinning). */
export const rigDetach = (L: Leg, ox: number, oy: number, speed: number, r: Rng): void => {
  if (L.det >= 0) return;
  L.det = 0;
  const mx = (L.j[0] + L.j[L.n * 2]) * 0.5;
  const my = (L.j[1] + L.j[L.n * 2 + 1]) * 0.5;
  let dx = mx - ox;
  let dy = my - oy;
  const d = Math.hypot(dx, dy) || 1;
  dx /= d;
  dy /= d;
  const s = speed * (0.6 + rand(r) * 0.8);
  L.dvx = dx * s;
  L.dvy = dy * s;
  L.dva = (rand(r) - 0.5) * 7;
  L.stepping = false;
};

/**
 * Advances steps, triggers new ones (alternating groups, staggered) and
 * solves IK. (x,y,h) = body transform, (vx,vy) = body velocity.
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
  let nAtt = 0;
  const spread = 1 + rig.splay * 0.38 - rig.collapse * 0.45;
  const sp = Math.hypot(vx, vy);

  for (let i = 0; i < legs.length; i++) {
    const L = legs[i];
    if (L.det >= 0) {
      // detached: drift, spin about the middle, no solve
      L.det += dt;
      const k = Math.exp(-3 * dt);
      L.dvx *= k;
      L.dvy *= k;
      const da = L.dva * dt;
      const ca = Math.cos(da);
      const sa = Math.sin(da);
      const mx = (L.j[0] + L.j[L.n * 2]) * 0.5;
      const my = (L.j[1] + L.j[L.n * 2 + 1]) * 0.5;
      for (let q = 0; q <= L.n; q++) {
        const px = L.j[q * 2] - mx;
        const py = L.j[q * 2 + 1] - my;
        L.j[q * 2] = mx + ca * px - sa * py + L.dvx * dt;
        L.j[q * 2 + 1] = my + sa * px + ca * py + L.dvy * dt;
      }
      continue;
    }
    nAtt++;
    L.hwx = x + c * L.hx - s * L.hy;
    L.hwy = y + s * L.hx + c * L.hy;
    const rx = L.hx + (L.rx - L.hx) * spread;
    const ry = L.hy + (L.ry - L.hy) * spread;
    L.rwx = x + c * rx - s * ry;
    L.rwy = y + s * rx + c * ry;
    {
      // safety: a foot far beyond reach (knockback, bad input) snaps home
      const sx = L.stepping ? L.tx : L.fx;
      const sy = L.stepping ? L.ty : L.fy;
      if (Math.hypot(sx - L.hwx, sy - L.hwy) > L.total * 1.45) {
        rig.legSnaps++;
        L.fx = L.rwx;
        L.fy = L.rwy;
        L.stepping = false;
        L.lift = 0;
        L.flash = 1;
      }
    }
    if (L.stepping) {
      L.p += dt / L.dur;
      if (L.p >= 1) {
        L.p = 1;
        L.stepping = false;
        L.fx = L.tx;
        L.fy = L.ty;
        L.lift = 0;
        L.flash = 1;
      } else if (L.p > 0) {
        const e = smooth(L.p);
        // chord + outward arc
        const ax = L.tx - L.sx;
        const ay = L.ty - L.sy;
        const arc = Math.sin(Math.PI * L.p) * Math.min(rig.threshold * 0.45, Math.hypot(ax, ay) * 0.3);
        const ox = -s * L.side;
        const oy = c * L.side;
        L.fx = L.sx + ax * e + ox * arc;
        L.fy = L.sy + ay * e + oy * arc;
        L.lift = Math.sin(Math.PI * Math.pow(L.p, 0.8)) * L.liftK;
        sc[L.group]++;
      } else sc[L.group]++;
    } else if (rig.collapse > 0) {
      // death: feet scrape inward
      const k = damp(3 * rig.collapse, dt);
      L.fx += (L.rwx - L.fx) * k;
      L.fy += (L.rwy - L.fy) * k;
    } else if (L.drag) {
      // dragged: pulled along when the hip gets too far, scrapes
      const dx = L.fx - L.hwx;
      const dy = L.fy - L.hwy;
      const d = Math.hypot(dx, dy) || 1e-4;
      const max = L.total * 0.86;
      if (d > max) {
        L.fx = L.hwx + (dx / d) * max;
        L.fy = L.hwy + (dy / d) * max;
        L.flash = Math.max(L.flash, 0.5);
      }
    } else if (rig.skid > 0 && sp > 1) {
      // lunge stop: planted feet skid with the body
      L.fx += vx * dt * rig.skid;
      L.fy += vy * dt * rig.skid;
      L.flash = Math.max(L.flash, 0.7 * rig.skid);
    }
    if (L.flash > 0) L.flash = Math.max(0, L.flash - dt * 4);
    // body sags away from lifted legs, leans toward lagging feet
    const lx = L.hx;
    const ly = L.hy;
    const ll = Math.hypot(lx, ly) || 1;
    offX -= (lx / ll) * L.lift * rig.threshold * rig.sag;
    offY -= (ly / ll) * L.lift * rig.threshold * rig.sag;
    const dfx = L.fx - L.rwx;
    const dfy = L.fy - L.rwy;
    offX += (c * dfx + s * dfy) * 0.05;
    offY += (-s * dfx + c * dfy) * 0.05;
    bob += L.lift;
  }

  // urgency per planted leg
  let best = -1;
  let bestU = 0;
  let stepping = 0;
  for (let i = 0; i < legs.length; i++) {
    const L = legs[i];
    if (L.stepping) stepping++;
    if (L.stepping || L.drag || L.det >= 0) {
      L.urg = 0;
      continue;
    }
    let u = Math.hypot(L.fx - L.rwx, L.fy - L.rwy) / (rig.threshold * L.thrMul);
    const hd = Math.hypot(L.fx - L.hwx, L.fy - L.hwy);
    if (hd > L.total * 0.985) u = Math.max(u, 2.6);
    L.urg = u;
    if (u > bestU) {
      bestU = u;
      best = i;
    }
  }

  if (dt > 0 && rig.collapse <= 0) {
    const dur = clamp(rig.baseDur - sp * 0.0004, 0.085, rig.baseDur);
    if (best >= 0 && bestU >= 1) {
      const g = legs[best].group;
      if (sc[g ^ 1] === 0) {
        let delay = 0;
        for (const L of legs) {
          if (!L.stepping && !L.drag && L.det < 0 && L.group === g && L.urg >= 0.55 && !sideBusy(rig, L)) {
            startStep(rig, L, vx, vy, dur, delay, r);
            delay += dur * (0.12 + rand(r) * 0.22); // ripple, not lockstep
            sc[g]++;
          }
        }
      }
    }
    // emergency: a badly over-stretched foot may break gait
    for (const L of legs) {
      if (!L.stepping && !L.drag && L.det < 0 && L.urg > 2.4 && !sideBusy(rig, L)) startStep(rig, L, vx, vy, dur * 0.8, 0, r);
    }
    // idle: test the ground with one leg / rare spasm of the dragged limb
    if (sp < rig.threshold * 0.6 && stepping === 0 && rig.splay < 0.1) {
      rig.idleT += dt;
      if (rig.idleT > rig.probeT) {
        rig.idleT = 0;
        rig.probeT = 0.7 + rand(r) * 1.8;
        const L = legs[(rand(r) * legs.length) | 0];
        if (L.det < 0 && !sideBusy(rig, L)) {
          const k = L.drag ? 0.9 : 0.5;
          const px = L.fx + (L.rwx - L.fx) * k + (rand(r) - 0.5) * rig.threshold * 0.5;
          const py = L.fy + (L.rwy - L.fy) * k + (rand(r) - 0.5) * rig.threshold * 0.5;
          beginStep(L, px, py, L.drag ? 0.32 : 0.19, 0, L.drag ? 0.6 : 1.7);
        }
      }
    } else rig.idleT = 0;
  }

  // lean into acceleration + forward tilt with speed (world -> local)
  if (dt > 0) {
    const ax = (vx - rig.pvx) / dt;
    const ay = (vy - rig.pvy) / dt;
    rig.pvx = vx;
    rig.pvy = vy;
    const lim = rig.threshold * 0.7;
    const k = damp(10, dt);
    rig.leanX += (clamp(ax * 0.004, -lim, lim) - rig.leanX) * k;
    rig.leanY += (clamp(ay * 0.004, -lim, lim) - rig.leanY) * k;
  }
  const tilt = Math.min(sp * 0.012, rig.threshold * 0.35);
  offX += (c * rig.leanX + s * rig.leanY) * nAtt + tilt * nAtt;
  offY += (-s * rig.leanX + c * rig.leanY) * nAtt;

  const n = nAtt || 1;
  rig.offX = offX / n;
  rig.offY = offY / n;
  rig.bob = bob / n;

  for (const L of legs) {
    if (L.det >= 0) continue;
    // lifted foot projects toward the hip (seen from above)
    const lk = L.lift * 0.2;
    let fx = L.fx + (L.hwx - L.fx) * lk;
    let fy = L.fy + (L.hwy - L.fy) * lk;
    // never solve beyond max reach: the drawn foot is clamped to the leg's span
    const dx = fx - L.hwx;
    const dy = fy - L.hwy;
    const d = Math.hypot(dx, dy);
    const maxD = L.total * 0.97;
    const minD = L.total * 0.32; // closer than this folds the segments onto themselves
    if (d > maxD) {
      fx = L.hwx + (dx / d) * maxD;
      fy = L.hwy + (dy / d) * maxD;
    } else if (d < minD) {
      // push out from the hip (outward side when the foot sits on the hip)
      const ux = d > 1e-3 ? dx / d : -s * L.side;
      const uy = d > 1e-3 ? dy / d : c * L.side;
      fx = L.hwx + ux * minD;
      fy = L.hwy + uy * minD;
    }
    solveLeg(L.j, L.len, L.n, L.hwx, L.hwy, fx, fy, -s * L.side, c * L.side, rig.bulge * (1 + L.lift * 0.6 + rig.collapse));
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
  let px = -cy;
  let py = cx;
  if (px * ox + py * oy < 0) {
    px = -px;
    py = -py;
  }
  let ax = px * ankleOut - cx * 0.55;
  let ay = py * ankleOut - cy * 0.55;
  const al = Math.hypot(ax, ay) || 1;
  ax = fx + (ax / al) * Ln;
  ay = fy + (ay / al) * Ln;
  let dx = ax - hx;
  let dy = ay - hy;
  let d = Math.hypot(dx, dy) || 1e-4;
  const maxR = L0 + Lm - 1e-3;
  const minR = Math.abs(L0 - Lm) + 1e-3;
  if (d > maxR) {
    // ankle out of reach: put it on the hip-foot line instead (keeps the
    // needle at its true length; foot is already within total reach)
    const fd = Math.hypot(fx - hx, fy - hy) || 1e-4;
    const t = clamp((fd - Ln) / fd, 0, 1);
    ax = hx + (fx - hx) * t;
    ay = hy + (fy - hy) * t;
    dx = ax - hx;
    dy = ay - hy;
    d = Math.min(Math.hypot(dx, dy) || 1e-4, maxR);
    if (Math.hypot(dx, dy) > maxR) {
      const k = maxR / Math.hypot(dx, dy);
      ax = hx + dx * k;
      ay = hy + dy * k;
    }
  } else if (d < minR) {
    ax = hx + (dx / d) * minR;
    ay = hy + (dy / d) * minR;
    d = minR;
  }
  dx = (ax - hx) / d;
  dy = (ay - hy) / d;
  const cosA = clamp((L0 * L0 + d * d - Lm * Lm) / (2 * L0 * d), -1, 1);
  const sinA = Math.sqrt(1 - cosA * cosA);
  let sgn = 1;
  if (-dy * px + dx * py < 0) sgn = -1;
  const kx = hx + (dx * cosA - dy * sinA * sgn) * L0;
  const ky = hy + (dy * cosA + dx * sinA * sgn) * L0;
  j[0] = hx;
  j[1] = hy;
  j[2] = kx;
  j[3] = ky;
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
    j[n * 2] = tx;
    j[n * 2 + 1] = ty;
    for (let i = n - 1; i >= 0; i--) {
      dx = j[i * 2] - j[i * 2 + 2];
      dy = j[i * 2 + 1] - j[i * 2 + 3];
      const l = Math.hypot(dx, dy) || 1e-4;
      j[i * 2] = j[i * 2 + 2] + (dx / l) * len[i];
      j[i * 2 + 1] = j[i * 2 + 3] + (dy / l) * len[i];
    }
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

// ---------------------------------------------------------------------------
// Drawing

// segment roles: 0 femur, 1 tibia, 2 metatarsus, 3 needle
const ROLE_W = [2.3, 1.7, 1.2, 0.8];
const roleOf = (k: number, n: number): number => (k === 0 ? 0 : k === n - 1 ? 3 : k === 1 ? 1 : 2);

// deterministic tremble (identical across the outline / fill passes)
const trem = (t: number, i: number, amt: number): number => (amt > 0 ? Math.sin(t * 97 + i * 12.9898) * amt : 0);

function segPath(ctx: Ctx2D, legs: Leg[], role: number, detached: boolean, tremble: number, time: number): boolean {
  let any = false;
  ctx.beginPath();
  for (let li = 0; li < legs.length; li++) {
    const L = legs[li];
    if (detached !== L.det >= 0) continue;
    for (let k = 0; k < L.n; k++) {
      if (roleOf(k, L.n) !== role) continue;
      const tA = k > 0 && k < L.n ? trem(time, li * 7 + k, tremble) : 0;
      const tB = k + 1 < L.n ? trem(time, li * 7 + k + 1, tremble) : 0;
      const x0 = L.j[k * 2] + tA;
      const y0 = L.j[k * 2 + 1] - tA;
      const x1 = L.j[k * 2 + 2] + tB;
      const y1 = L.j[k * 2 + 3] - tB;
      if (k === L.broken) {
        // snapped segment: two stubs with a gap
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + (x1 - x0) * 0.42, y0 + (y1 - y0) * 0.42);
        ctx.moveTo(x0 + (x1 - x0) * 0.6, y0 + (y1 - y0) * 0.6 + 1);
        ctx.lineTo(x1, y1);
      } else {
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
      }
      any = true;
    }
  }
  return any;
}

function drawLegSet(ctx: Ctx2D, rig: Rig, w: number, tremble: number, alpha: number, time: number, detached: boolean, fill: string): void {
  const legs = rig.legs;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // edge pass (orange outline) then silhouette pass on top
  for (let role = 0; role < 4; role++) {
    if (!segPath(ctx, legs, role, detached, tremble, time)) continue;
    const lw = w * ROLE_W[role];
    ctx.strokeStyle = role === 0 ? orangeA(0.55 * alpha) : orangeA(0.85 * alpha);
    ctx.lineWidth = lw + 2;
    ctx.stroke();
    ctx.strokeStyle = fill;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
  // off-white needle tips + knee data spines
  ctx.lineWidth = Math.max(0.7, w * 0.8);
  ctx.strokeStyle = whiteA(0.85 * alpha);
  ctx.beginPath();
  for (const L of legs) {
    if (detached !== L.det >= 0) continue;
    const k = L.n * 2;
    const ax = L.j[k - 2];
    const ay = L.j[k - 1];
    const fx = L.j[k];
    const fy = L.j[k + 1];
    ctx.moveTo(ax + (fx - ax) * 0.62, ay + (fy - ay) * 0.62);
    ctx.lineTo(fx, fy);
  }
  ctx.stroke();
  ctx.strokeStyle = orangeA(0.6 * alpha);
  ctx.beginPath();
  for (let li = 0; li < legs.length; li++) {
    const L = legs[li];
    if (detached !== L.det >= 0 || li % 2 === 1) continue;
    const dx = L.j[2] - L.j[0];
    const dy = L.j[3] - L.j[1];
    const d = Math.hypot(dx, dy) || 1;
    const sl = w * 4.2;
    const mx = L.j[0] + dx * 0.6;
    const my = L.j[1] + dy * 0.6;
    // spine points back along the femur and out
    ctx.moveTo(mx, my);
    ctx.lineTo(mx - (dx / d) * sl * 0.6 + (-dy / d) * sl * L.side * 0.8, my - (dy / d) * sl * 0.6 + (dx / d) * sl * L.side * 0.8);
  }
  ctx.stroke();
  // joint squares
  ctx.fillStyle = orangeA(alpha);
  ctx.beginPath();
  const js = Math.max(1.4, w * 1.7);
  for (const L of legs) {
    if (detached !== L.det >= 0) continue;
    for (let i = 1; i < L.n; i++) ctx.rect(L.j[i * 2] - js * 0.5, L.j[i * 2 + 1] - js * 0.5, js, js);
  }
  ctx.fill();
}

/**
 * Batched limb drawing: dark tapered silhouettes with orange edges, broken
 * segments, off-white needle tips, knee spines, joint squares, plant / skid
 * ticks. Detached (dying) legs are drawn as a separate fading set.
 */
export function drawRig(ctx: Ctx2D, rig: Rig, w: number, tremble: number, alpha: number, time = 0, fill: string = PAL.void): void {
  drawLegSet(ctx, rig, w, tremble, alpha, time, false, fill);
  let det = 0;
  for (const L of rig.legs) if (L.det >= 0) det = Math.max(det, L.det);
  if (det > 0) {
    let fa = 1;
    for (const L of rig.legs) if (L.det >= 0) fa = Math.min(fa, 1 - L.det / 0.75);
    if (fa > 0.02) drawLegSet(ctx, rig, w, 0, alpha * fa, time, true, fill);
  }
  // plant flash / skid ticks
  for (const L of rig.legs) {
    if (L.flash <= 0 || L.det >= 0) continue;
    const k = L.n * 2;
    ctx.fillStyle = whiteA(L.flash * 0.8 * alpha);
    const r = w * (1.2 + (1 - L.flash) * 2.6);
    ctx.fillRect(L.j[k] - r * 0.5, L.j[k + 1] - 0.5, r, 1);
  }
}

export function drawRigDebug(ctx: Ctx2D, rig: Rig): void {
  ctx.lineWidth = 1;
  for (const L of rig.legs) {
    ctx.strokeStyle = L.drag ? 'rgba(240,126,65,0.5)' : 'rgba(150,150,150,0.5)';
    ctx.beginPath();
    ctx.arc(L.rwx, L.rwy, rig.threshold * L.thrMul, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(L.rwx - 3, L.rwy);
    ctx.lineTo(L.rwx + 3, L.rwy);
    ctx.moveTo(L.rwx, L.rwy - 3);
    ctx.lineTo(L.rwx, L.rwy + 3);
    ctx.stroke();
    if (L.stepping) {
      ctx.strokeStyle = PAL.orange;
      ctx.beginPath();
      ctx.arc(L.tx, L.ty, 3, 0, TAU);
      ctx.moveTo(L.sx, L.sy);
      ctx.lineTo(L.tx, L.ty);
      ctx.stroke();
    }
    ctx.fillStyle = L.group === 0 ? PAL.white : PAL.orange;
    for (let i = 0; i <= L.n; i++) ctx.fillRect(L.j[i * 2] - 1.5, L.j[i * 2 + 1] - 1.5, 3, 3);
  }
}
