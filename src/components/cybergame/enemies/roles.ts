// Director decorations drawn on top of any enemy: role tells (shieldBearer,
// mender, sniper, suppressor) and subtle elite-affix effects. Everything
// reads optional fields (e.role, e.shieldR, e.mendTarget, e.aim, e.affixes)
// and silently does nothing when they are missing. No glows here: the one
// additive glow per enemy stays with the body.

import { Ctx2D, EnemyBase, PAL, TAU, coreColor, dredA, hotA, orangeA, voidA, whiteA } from './common';

const DASH: number[] = [4, 4];
const NODASH: number[] = [];

const visible = (e: EnemyBase): boolean => e.deathT < 0 && !e.done && e.spawnT >= 0.6;

/** Aim direction for snipers: e.aim as angle, or as a point, else heading. */
const aimAngle = (e: EnemyBase): number => {
  const a = e.aim;
  if (typeof a === 'number' && Number.isFinite(a)) return a;
  if (a && typeof a === 'object' && Number.isFinite(a.x) && Number.isFinite(a.y)) return Math.atan2(a.y - e.y, a.x - e.x);
  return e.heading;
};

export function drawRoleFx(ctx: Ctx2D, e: EnemyBase, time: number): void {
  if (!visible(e)) return;
  const s = e.size;
  const w = Math.max(1, s / 60);
  switch (e.role) {
    case 'shieldBearer': {
      // emitter on the body + a faceted dome arc projected around it
      const r = e.shieldR && e.shieldR > 0 ? e.shieldR : s * 1.3;
      const pulse = 0.5 + 0.5 * Math.sin(time * 3 + e.seed);
      ctx.fillStyle = voidA(0.25);
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, TAU);
      ctx.fill();
      ctx.lineWidth = w;
      ctx.strokeStyle = orangeA(0.35 + 0.25 * pulse);
      ctx.beginPath();
      const segs = 14;
      for (let i = 0; i < segs; i++) {
        const a0 = (i / segs) * TAU + time * 0.25;
        ctx.moveTo(e.x + Math.cos(a0) * r, e.y + Math.sin(a0) * r);
        ctx.arc(e.x, e.y, r, a0, a0 + (TAU / segs) * 0.8);
      }
      ctx.stroke();
      // inner facet ticks
      ctx.strokeStyle = orangeA(0.18);
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU - time * 0.4;
        ctx.moveTo(e.x + Math.cos(a) * r * 0.86, e.y + Math.sin(a) * r * 0.86);
        ctx.lineTo(e.x + Math.cos(a) * r * 0.97, e.y + Math.sin(a) * r * 0.97);
      }
      ctx.stroke();
      // emitter: bright diamond riding on the body
      const ex = e.x;
      const ey = e.y - s * 0.32;
      const k = s * 0.08 * (1 + pulse * 0.4);
      ctx.fillStyle = pulse > 0.8 ? PAL.white : PAL.coreHot;
      ctx.beginPath();
      ctx.moveTo(ex, ey - k);
      ctx.lineTo(ex + k, ey);
      ctx.lineTo(ex, ey + k);
      ctx.lineTo(ex - k, ey);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'mender': {
      const t = e.mendTarget;
      // repair beacon on the mender itself (a pulsing cross)
      const pulse = 0.5 + 0.5 * Math.sin(time * 5 + e.seed);
      const k = s * (0.12 + pulse * 0.04);
      ctx.fillStyle = orangeA(0.6 + 0.4 * pulse);
      ctx.fillRect(e.x - k, e.y - s * 0.5 - k * 0.25, k * 2, k * 0.5);
      ctx.fillRect(e.x - k * 0.25, e.y - s * 0.5 - k, k * 0.5, k * 2);
      if (!t || !Number.isFinite(t.x) || !Number.isFinite(t.y)) break;
      // pulsing tether: dashes travel mender -> ally
      const dx = t.x - e.x;
      const dy = t.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const nx = -dy / d;
      const ny = dx / d;
      const sag = Math.sin(time * 2.4) * d * 0.06;
      const mx = (e.x + t.x) / 2 + nx * sag;
      const my = (e.y + t.y) / 2 + ny * sag;
      ctx.lineWidth = w;
      ctx.strokeStyle = orangeA(0.3);
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.quadraticCurveTo(mx, my, t.x, t.y);
      ctx.stroke();
      ctx.fillStyle = whiteA(0.85);
      for (let i = 0; i < 4; i++) {
        const f = (time * 1.1 + i / 4) % 1;
        const a = 1 - f;
        const px = a * a * e.x + 2 * a * f * mx + f * f * t.x;
        const py = a * a * e.y + 2 * a * f * my + f * f * t.y;
        ctx.fillRect(px - w, py - w, w * 2, w * 2);
      }
      // repair ring on the ally
      ctx.strokeStyle = orangeA(0.5 + 0.4 * pulse);
      ctx.beginPath();
      ctx.arc(t.x, t.y, s * (0.35 + pulse * 0.1), 0, TAU);
      ctx.stroke();
      break;
    }
    case 'sniper': {
      // charging lens: ring contracts as the charge builds; thin aim line
      const a = aimAngle(e);
      const c = Math.min(1, Math.max(0, e.charge));
      const lx = e.x + Math.cos(a) * s * 0.3;
      const ly = e.y + Math.sin(a) * s * 0.3;
      ctx.lineWidth = w;
      ctx.strokeStyle = coreColor(0.4 + c * 0.6);
      ctx.beginPath();
      ctx.arc(lx, ly, s * (0.22 - c * 0.12) + 1, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = c > 0.85 && ((time * 30) | 0) % 2 ? PAL.white : PAL.coreHot;
      ctx.fillRect(lx - w, ly - w, w * 2, w * 2);
      ctx.strokeStyle = hotA(0.15 + c * 0.6);
      ctx.setLineDash(c < 0.6 ? DASH : NODASH);
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + Math.cos(a) * s * 14, ly + Math.sin(a) * s * 14);
      ctx.stroke();
      ctx.setLineDash(NODASH);
      break;
    }
    case 'suppressor': {
      // muzzle heat-up: segmented barrel glow building with charge / fire
      const a = aimAngle(e);
      const heat = Math.min(1, Math.max(0, e.charge * 0.7 + (0.3 + 0.3 * Math.sin(time * 9 + e.seed))));
      const c = Math.cos(a);
      const sn = Math.sin(a);
      const base = s * 0.32;
      for (let i = 0; i < 4; i++) {
        const t = i / 3;
        const px = e.x + c * (base + i * s * 0.07);
        const py = e.y + sn * (base + i * s * 0.07);
        ctx.fillStyle = coreColor(Math.max(0, heat * 1.2 - t * 0.5));
        ctx.fillRect(px - s * 0.035, py - s * 0.035, s * 0.07, s * 0.07);
      }
      // heat shimmer vents
      ctx.strokeStyle = orangeA(0.4 * heat);
      ctx.lineWidth = w;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const off = (i - 1) * s * 0.06;
        const px = e.x + c * (base + s * 0.3) - sn * off;
        const py = e.y + sn * (base + s * 0.3) + c * off;
        const wob = Math.sin(time * 14 + i) * s * 0.02;
        ctx.moveTo(px, py);
        ctx.lineTo(px + c * s * 0.12 - sn * wob, py + sn * s * 0.12 + c * wob);
      }
      ctx.stroke();
      break;
    }
  }
}

export function drawAffixFx(ctx: Ctx2D, e: EnemyBase, time: number): void {
  if (!visible(e) || !e.affixes) return;
  const s = e.size;
  const w = Math.max(1, s / 70);
  for (let ai = 0; ai < e.affixes.length; ai++) {
    switch (e.affixes[ai]) {
      case 'Shielded': {
        // thin rotating hex shell
        ctx.strokeStyle = orangeA(0.4);
        ctx.lineWidth = w;
        ctx.beginPath();
        for (let k = 0; k <= 6; k++) {
          const a = (k / 6) * TAU + time * 0.6;
          const x = e.x + Math.cos(a) * s * 0.62;
          const y = e.y + Math.sin(a) * s * 0.62;
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        break;
      }
      case 'Splitting': {
        // hot fault line across the body, flickering open
        const a = e.heading + Math.PI / 2;
        const open = 0.5 + 0.5 * Math.sin(time * 4 + e.seed);
        ctx.strokeStyle = hotA(0.4 + 0.4 * open);
        ctx.lineWidth = w * (1 + open);
        ctx.beginPath();
        ctx.moveTo(e.x - Math.cos(a) * s * 0.35, e.y - Math.sin(a) * s * 0.35);
        ctx.lineTo(e.x + Math.cos(a) * s * 0.06 + Math.cos(e.heading) * s * 0.05, e.y + Math.sin(a) * s * 0.06 + Math.sin(e.heading) * s * 0.05);
        ctx.lineTo(e.x + Math.cos(a) * s * 0.35, e.y + Math.sin(a) * s * 0.35);
        ctx.stroke();
        break;
      }
      case 'Phasing': {
        // dark scanlines sliding over the body, the body "half there"
        ctx.fillStyle = voidA(0.55);
        const top = e.y - s * 0.5;
        for (let i = 0; i < 5; i++) {
          const f = (time * 0.9 + i / 5) % 1;
          ctx.fillRect(e.x - s * 0.55, top + f * s, s * 1.1, Math.max(1, s * 0.03));
        }
        break;
      }
      case 'Vampiric': {
        // dark-red droplets orbiting inward
        for (let i = 0; i < 5; i++) {
          const f = (time * 0.7 + i / 5) % 1;
          const a = i * 1.257 + time * 1.4;
          const r = s * (0.75 - f * 0.4);
          ctx.fillStyle = dredA(0.9 * (1 - f * 0.5));
          ctx.fillRect(e.x + Math.cos(a) * r - w, e.y + Math.sin(a) * r - w, w * 2, w * 2.6);
        }
        break;
      }
      case 'Hasted': {
        // speed streaks trailing behind the motion
        const v = Math.hypot(e.vx, e.vy);
        const a = v > 5 ? Math.atan2(e.vy, e.vx) : e.heading;
        const c = Math.cos(a);
        const sn = Math.sin(a);
        ctx.strokeStyle = orangeA(0.45);
        ctx.lineWidth = w;
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const off = (i - 1) * s * 0.22;
          const len = s * (0.35 + 0.15 * Math.sin(time * 20 + i));
          const bx = e.x - c * s * 0.45 - sn * off;
          const by = e.y - sn * s * 0.45 + c * off;
          ctx.moveTo(bx, by);
          ctx.lineTo(bx - c * len, by - sn * len);
        }
        ctx.stroke();
        break;
      }
      case 'Volatile': {
        // pulsing warning ring with ticks (it will blow)
        const p = 0.5 + 0.5 * Math.sin(time * 6 + e.seed);
        ctx.strokeStyle = coreColor(0.4 + p * 0.6);
        ctx.lineWidth = w * (1 + p);
        ctx.beginPath();
        ctx.arc(e.x, e.y, s * (0.5 + p * 0.06), 0, TAU);
        ctx.stroke();
        ctx.strokeStyle = whiteA(0.5 * p);
        ctx.beginPath();
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * TAU + Math.PI / 4;
          ctx.moveTo(e.x + Math.cos(a) * s * 0.58, e.y + Math.sin(a) * s * 0.58);
          ctx.lineTo(e.x + Math.cos(a) * s * 0.7, e.y + Math.sin(a) * s * 0.7);
        }
        ctx.stroke();
        break;
      }
    }
  }
}
