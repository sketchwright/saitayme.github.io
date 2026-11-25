// Cyber Defender simulation. Plain mutable objects in fixed-size pools; no
// React state is touched per frame. World space is centred on the core (0,0).
import {
  Bullet,
  C_GRAY,
  C_HOT,
  C_ORANGE,
  C_RED,
  C_WHITE,
  Enemy,
  EnemyKind,
  FloatText,
  GameResult,
  KINDS,
  Leg,
  P_EMBER,
  P_FRAG,
  P_GLITCH,
  P_HEX,
  P_RING,
  P_SPARK,
  Particle,
  Phase,
  POOL_BULLETS,
  POOL_ENEMIES,
  POOL_PARTICLES,
  POOL_SHOTS,
  POOL_TEXTS,
  SfxName,
  Shot,
  TAU,
} from './types';
import { saveBest } from './storage';

export interface GameEvents {
  sound: (name: SfxName) => void;
  phase: (phase: Phase) => void;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const wrapAngle = (a: number) => {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
};
const easeStep = (t: number) => t * t * (3 - 2 * t);

const makeLeg = (): Leg => ({ lx: 0, ly: 0, rx: 0, ry: 0, l1: 1, l2: 1, fx: 0, fy: 0, sx: 0, sy: 0, tx: 0, ty: 0, t: 1, group: 0 });

const makeEnemy = (): Enemy => ({
  active: false, kind: 'crawler', x: 0, y: 0, vx: 0, vy: 0, kx: 0, ky: 0, heading: 0, r: 10, hp: 1, maxHp: 1,
  speed: 0, t: 0, seed: 0, bits: 0, flash: 0, glitch: 0, legs: Array.from({ length: 8 }, makeLeg), legCount: 6,
  stepDur: 0.1, stride: 6, gait: 0, empHit: -1, atk: 0, brood: 0, orbitDir: 1,
});

export class Game {
  phase: Phase = 'menu';
  W = 800;
  H = 600;
  scale = 1;
  hx = 400;
  hy = 300;
  readonly coreR = 30;
  time = 0;
  reducedMotion = false;

  integrity = 100;
  score = 0;
  best = 0;
  newBest = false;
  wave = 0;
  waveTotal = 0;
  waveKilled = 0;
  kills = 0;
  combo = 0;
  maxCombo = 0;
  comboT = 0;
  mult = 1;
  emp = 0;
  empR = -1;
  empSerial = 0;

  shake = 0;
  hitstop = 0;
  damageFlash = 0;
  dying = -1;
  announce = '';
  announceSub = '';
  announceT = 0;
  announceDanger = false;

  queue: EnemyKind[] = [];
  spawnT = 0;
  interT = 0;
  waveActive = false;
  sectors: number[] = [];
  boss: Enemy | null = null;
  demoT = 0;

  aimX = 0;
  aimY = -200;
  pointerX = -1;
  pointerY = -1;
  pointerInside = false;
  pointerMouse = true;
  firing = false;
  firePointer = -1;
  fireT = 0;
  turret = -Math.PI / 2;
  recoil = 0;
  muzzle = 0;
  corePulse = 0;
  empBtn = { x: 0, y: 0, r: 28 };

  readonly enemies: Enemy[] = Array.from({ length: POOL_ENEMIES }, makeEnemy);
  readonly bullets: Bullet[] = Array.from({ length: POOL_BULLETS }, () => ({ active: false, x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, life: 0, dmg: 1 }));
  readonly shots: Shot[] = Array.from({ length: POOL_SHOTS }, () => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, r: 5 }));
  readonly particles: Particle[] = Array.from({ length: POOL_PARTICLES }, () => ({ active: false, kind: 0, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, color: 0, drag: 0 }));
  readonly texts: FloatText[] = Array.from({ length: POOL_TEXTS }, () => ({ active: false, x: 0, y: 0, vy: 0, life: 0, max: 1, text: '', color: 0, big: false }));
  activeEnemies = 0;

  private bulletCur = 0;
  private shotCur = 0;
  private partCur = 0;
  private textCur = 0;
  private enemyCur = 0;
  private readonly ev: GameEvents;

  constructor(ev: GameEvents, best: number) {
    this.ev = ev;
    this.best = best;
  }

  // ---------------------------------------------------------------- view
  resize(W: number, H: number): void {
    this.W = W;
    this.H = H;
    this.scale = clamp(Math.min(W, H) / 760, 0.5, 1.1);
    this.hx = W / 2 / this.scale;
    this.hy = H / 2 / this.scale;
    const r = W < 640 ? 30 : 32;
    this.empBtn = { x: W - 20 - r, y: H - 22 - r, r };
  }

  // ---------------------------------------------------------------- input
  private setAim(sx: number, sy: number): void {
    this.pointerX = sx;
    this.pointerY = sy;
    const wx = (sx - this.W / 2) / this.scale;
    const wy = (sy - this.H / 2) / this.scale;
    if (wx * wx + wy * wy > 100) {
      this.aimX = wx;
      this.aimY = wy;
    }
  }

  pointerDown(sx: number, sy: number, button: number, id: number, mouse: boolean): void {
    this.pointerMouse = mouse;
    this.pointerInside = true;
    if (this.phase !== 'playing' || this.dying >= 0) return;
    const b = this.empBtn;
    if ((sx - b.x) ** 2 + (sy - b.y) ** 2 < (b.r + 8) ** 2) {
      this.triggerEmp();
      return;
    }
    if (button === 2) {
      this.triggerEmp();
      return;
    }
    if (button !== 0) return;
    this.setAim(sx, sy);
    this.firing = true;
    this.firePointer = id;
  }

  pointerMove(sx: number, sy: number, id: number, mouse: boolean): void {
    this.pointerMouse = mouse;
    this.pointerInside = true;
    if (mouse || id === this.firePointer) this.setAim(sx, sy);
  }

  pointerUp(id: number): void {
    if (id === this.firePointer) {
      this.firing = false;
      this.firePointer = -1;
    }
  }

  pointerLeave(mouse: boolean): void {
    if (mouse) this.pointerInside = false;
  }

  // ---------------------------------------------------------------- phases
  private setPhase(p: Phase): void {
    if (this.phase === p) return;
    this.phase = p;
    this.ev.phase(p);
  }

  start(): void {
    for (const e of this.enemies) e.active = false;
    for (const b of this.bullets) b.active = false;
    for (const s of this.shots) s.active = false;
    for (const p of this.particles) p.active = false;
    for (const t of this.texts) t.active = false;
    this.activeEnemies = 0;
    this.integrity = 100;
    this.score = 0;
    this.newBest = false;
    this.wave = 0;
    this.kills = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.comboT = 0;
    this.mult = 1;
    this.emp = 0.35;
    this.empR = -1;
    this.shake = 0;
    this.hitstop = 0;
    this.damageFlash = 0;
    this.dying = -1;
    this.queue = [];
    this.boss = null;
    this.waveActive = false;
    this.interT = 0.4;
    this.firing = false;
    this.firePointer = -1;
    this.fireT = 0;
    this.setPhase('playing');
  }

  pause(): void {
    if (this.phase === 'playing' && this.dying < 0) {
      this.firing = false;
      this.firePointer = -1;
      this.setPhase('paused');
    }
  }

  resume(): void {
    if (this.phase === 'paused') this.setPhase('playing');
  }

  togglePause(): void {
    if (this.phase === 'paused') this.resume();
    else this.pause();
  }

  result(): GameResult {
    return { score: this.score, best: this.best, newBest: this.newBest, wave: this.wave, kills: this.kills, maxCombo: this.maxCombo };
  }

  private sfx(n: SfxName): void {
    if (this.phase === 'playing') this.ev.sound(n);
  }

  // ---------------------------------------------------------------- pools
  private particle(kind: number, x: number, y: number, vx: number, vy: number, life: number, size: number, color: number, drag: number): void {
    const p = this.particles[this.partCur];
    this.partCur = (this.partCur + 1) % POOL_PARTICLES;
    p.active = true;
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = p.max = life;
    p.size = size;
    p.color = color;
    p.drag = drag;
  }

  private text(x: number, y: number, text: string, color: number, big: boolean): void {
    const t = this.texts[this.textCur];
    this.textCur = (this.textCur + 1) % POOL_TEXTS;
    t.active = true;
    t.x = x;
    t.y = y;
    t.vy = big ? -22 : -38;
    t.life = t.max = big ? 1.3 : 0.75;
    t.text = text;
    t.color = color;
    t.big = big;
  }

  private sparks(x: number, y: number, dir: number, spread: number, n: number, smin: number, smax: number, color: number): void {
    for (let i = 0; i < n; i++) {
      const a = dir + (Math.random() - 0.5) * spread;
      const s = rand(smin, smax);
      this.particle(P_SPARK, x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.12, 0.3), 1, Math.random() < 0.3 ? C_WHITE : color, 5);
    }
  }

  private shatter(x: number, y: number, r: number, n: number, vx: number, vy: number, hot: boolean): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const d = Math.random() * r;
      const s = rand(40, 210);
      const roll = Math.random();
      const color = roll < 0.35 ? C_GRAY : roll < 0.65 ? C_ORANGE : roll < 0.88 ? C_RED : hot ? C_HOT : C_WHITE;
      this.particle(
        P_FRAG,
        x + Math.cos(a) * d,
        y + Math.sin(a) * d,
        Math.cos(a) * s + vx * 0.4,
        Math.sin(a) * s + vy * 0.4,
        rand(0.35, 0.9),
        rand(1.5, 2.2 + r * 0.12),
        color,
        3.2,
      );
    }
  }

  // ---------------------------------------------------------------- enemies
  private edgeDist(c: number, s: number): number {
    const ax = Math.abs(c);
    const ay = Math.abs(s);
    return Math.min(ax > 1e-4 ? this.hx / ax : 1e9, ay > 1e-4 ? this.hy / ay : 1e9);
  }

  private spawnEnemy(kind: EnemyKind, angle: number, extra = 0): Enemy | null {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const d = this.edgeDist(c, s) + KINDS[kind].r * 2.2 + 20 + extra;
    return this.spawnAt(kind, c * d, s * d);
  }

  private spawnAt(kind: EnemyKind, x: number, y: number): Enemy | null {
    let e: Enemy | null = null;
    for (let i = 0; i < POOL_ENEMIES; i++) {
      const idx = (this.enemyCur + i) % POOL_ENEMIES;
      if (!this.enemies[idx].active) {
        e = this.enemies[idx];
        this.enemyCur = (idx + 1) % POOL_ENEMIES;
        break;
      }
    }
    if (!e) return null;
    const k = KINDS[kind];
    const w = Math.max(1, this.wave);
    let hp = k.hp;
    if (kind === 'brute') hp += Math.max(0, Math.floor((w - 3) / 2));
    else if (kind === 'brooder') hp += Math.floor(w / 4);
    else if (kind === 'boss') hp += 70 * (Math.floor(w / 5) - 1);
    e.active = true;
    e.kind = kind;
    e.x = x;
    e.y = y;
    e.r = k.r;
    e.hp = e.maxHp = hp;
    e.speed = k.speed * rand(0.9, 1.1);
    e.t = 0;
    e.seed = Math.random();
    e.bits = (Math.random() * 1024) | 0;
    e.flash = 0;
    e.glitch = 0;
    e.kx = 0;
    e.ky = 0;
    e.heading = Math.atan2(-y, -x);
    e.vx = Math.cos(e.heading) * e.speed * 0.5;
    e.vy = Math.sin(e.heading) * e.speed * 0.5;
    e.legCount = k.legs;
    e.stepDur = k.stepDur;
    e.gait = 0;
    e.empHit = -1;
    e.atk = 3;
    e.brood = 6;
    e.orbitDir = Math.random() < 0.5 ? -1 : 1;

    // Leg rig: hips around the thorax, feet fanned from front to rear.
    const perSide = k.legs / 2;
    const r = k.r;
    const tx = k.thorax * r;
    const mr = k.mount * r;
    const restR = r * k.reach;
    e.stride = restR * 0.34;
    const ch = Math.cos(e.heading);
    const sh = Math.sin(e.heading);
    let li = 0;
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < perSide; i++) {
        const L = e.legs[li++];
        const f = perSide === 1 ? 0.5 : i / (perSide - 1);
        const ma = 0.55 + f * 1.9;
        const ra = 0.35 + f * 2.45;
        L.lx = tx + Math.cos(ma) * mr;
        L.ly = side * Math.sin(ma) * mr;
        L.rx = tx + Math.cos(ra) * restR;
        L.ry = side * Math.sin(ra) * restR;
        const D = Math.hypot(L.rx - L.lx, L.ry - L.ly);
        L.l1 = D * 0.6;
        L.l2 = D * 0.64;
        L.group = (i + (side > 0 ? 1 : 0)) % 2;
        L.fx = L.sx = L.tx = x + ch * L.rx - sh * L.ry;
        L.fy = L.sy = L.ty = y + sh * L.rx + ch * L.ry;
        L.t = 1;
      }
    }
    this.activeEnemies++;
    return e;
  }

  private groupNeedsStep(e: Enemy, g: number, ch: number, sh: number): boolean {
    for (let i = 0; i < e.legCount; i++) {
      const L = e.legs[i];
      if (L.group !== g) continue;
      const rx = e.x + ch * L.rx - sh * L.ry;
      const ry = e.y + sh * L.rx + ch * L.ry;
      const dx = L.fx - rx;
      const dy = L.fy - ry;
      if (dx * dx + dy * dy > e.stride * e.stride) return true;
    }
    return false;
  }

  private startStep(e: Enemy, g: number, ch: number, sh: number): void {
    const lead = e.stepDur * 1.1;
    for (let i = 0; i < e.legCount; i++) {
      const L = e.legs[i];
      if (L.group !== g) continue;
      L.sx = L.fx;
      L.sy = L.fy;
      L.tx = e.x + ch * L.rx - sh * L.ry + e.vx * lead;
      L.ty = e.y + sh * L.rx + ch * L.ry + e.vy * lead;
      L.t = 0;
    }
  }

  private updateLegs(e: Enemy, dt: number): void {
    const ch = Math.cos(e.heading);
    const sh = Math.sin(e.heading);
    let stepping = false;
    const maxD = e.r * 3.2;
    for (let i = 0; i < e.legCount; i++) {
      const L = e.legs[i];
      if (L.t < 1) {
        L.t = Math.min(1, L.t + dt / e.stepDur);
        const p = easeStep(L.t);
        L.fx = L.sx + (L.tx - L.sx) * p;
        L.fy = L.sy + (L.ty - L.sy) * p;
        if (L.t < 1) stepping = true;
      } else {
        const dx = L.fx - e.x;
        const dy = L.fy - e.y;
        if (dx * dx + dy * dy > maxD * maxD) {
          // Knocked far off its feet: snap the foot back under the body.
          L.fx = e.x + ch * L.rx - sh * L.ry;
          L.fy = e.y + sh * L.rx + ch * L.ry;
        }
      }
    }
    if (!stepping) {
      const g = e.gait;
      if (this.groupNeedsStep(e, g, ch, sh)) {
        this.startStep(e, g, ch, sh);
        e.gait = 1 - g;
      } else if (this.groupNeedsStep(e, 1 - g, ch, sh)) {
        this.startStep(e, 1 - g, ch, sh);
        e.gait = g;
      }
    }
  }

  private moveEnemy(e: Enemy, dt: number, spdMul: number): void {
    e.t += dt;
    const d = Math.hypot(e.x, e.y) || 1;
    const ux = -e.x / d;
    const uy = -e.y / d;
    const px = -uy;
    const py = ux;
    let spd = e.speed * spdMul;
    let weave = 0;
    let tvx: number;
    let tvy: number;
    switch (e.kind) {
      case 'crawler':
      case 'mite':
        spd *= 0.5 + 0.85 * Math.max(0, Math.sin(e.t * 8 + e.seed * 10));
        weave = Math.sin(e.t * 2.3 + e.seed * 6) * 0.6;
        break;
      case 'brooder':
        weave = Math.sin(e.t * 1.2 + e.seed * 6) * 0.35;
        break;
      case 'brute':
        spd *= 0.85 + 0.15 * Math.sin(e.t * 3);
        weave = Math.sin(e.t * 0.7 + e.seed * 6) * 0.12;
        break;
      default:
        break;
    }
    if (e.kind === 'boss') {
      const orbit = Math.max(150, Math.min(230, Math.min(this.hx, this.hy) - 70));
      if (d > orbit + 10) {
        tvx = ux * spd * 1.6;
        tvy = uy * spd * 1.6;
      } else {
        tvx = px * spd * e.orbitDir * 1.3 + ux * (d - orbit) * 0.8;
        tvy = py * spd * e.orbitDir * 1.3 + uy * (d - orbit) * 0.8;
      }
    } else {
      tvx = (ux + px * weave) * spd;
      tvy = (uy + py * weave) * spd;
    }
    const k = 1 - Math.exp(-dt * 6);
    e.vx += (tvx - e.vx) * k;
    e.vy += (tvy - e.vy) * k;
    e.x += (e.vx + e.kx) * dt;
    e.y += (e.vy + e.ky) * dt;
    const kd = Math.exp(-dt * 7);
    e.kx *= kd;
    e.ky *= kd;
    if (e.vx * e.vx + e.vy * e.vy > 4) {
      const target = Math.atan2(e.vy, e.vx);
      e.heading = wrapAngle(e.heading + wrapAngle(target - e.heading) * Math.min(1, dt * (e.kind === 'boss' ? 2.5 : 8)));
    }
    if (e.flash > 0) e.flash -= dt;
    if (e.glitch > 0) e.glitch -= dt;
    else if (Math.random() < dt * (e.kind === 'boss' ? 1.2 + (1 - e.hp / e.maxHp) * 3 : 0.45)) e.glitch = rand(0.05, 0.16);
    this.updateLegs(e, dt);
  }

  private damage(e: Enemy, dmg: number, dx: number, dy: number, knock: number): void {
    e.hp -= dmg;
    e.flash = 0.07;
    if (Math.random() < 0.5) e.glitch = 0.08;
    const kf = KINDS[e.kind].knock;
    e.kx += dx * knock * kf;
    e.ky += dy * knock * kf;
    if (e.hp <= 0) this.kill(e, true);
  }

  private kill(e: Enemy, byPlayer: boolean): void {
    if (!e.active) return;
    e.active = false;
    this.activeEnemies--;
    const k = KINDS[e.kind];
    const playing = this.phase === 'playing';
    const frags = e.kind === 'boss' ? 110 : e.kind === 'brute' ? 34 : e.kind === 'brooder' ? 24 : e.kind === 'crawler' ? 14 : 8;
    this.shatter(e.x, e.y, e.r, frags, e.vx, e.vy, e.kind === 'boss');
    this.particle(P_HEX, e.x, e.y, e.r * 2.2, 0, 0.32, e.r * 0.6, C_ORANGE, 0);
    this.particle(P_RING, e.x, e.y, e.r * 3.5, 0, 0.28, e.r * 0.4, C_RED, 0);
    for (let i = 0; i < 3; i++) this.particle(P_EMBER, e.x + rand(-e.r, e.r), e.y + rand(-e.r, e.r), rand(-30, 30), rand(-30, 30), rand(0.2, 0.45), e.r * rand(1.2, 2.2), i === 0 ? C_RED : C_ORANGE, 2);
    for (let i = 0; i < (e.kind === 'boss' ? 8 : 2); i++) this.particle(P_GLITCH, e.x + rand(-e.r, e.r), e.y + rand(-e.r, e.r) * 1.5, 0, 0, rand(0.08, 0.18), e.r * rand(2, 5), Math.random() < 0.5 ? C_RED : C_ORANGE, 0);
    this.sparks(e.x, e.y, 0, TAU, e.kind === 'boss' ? 40 : 6, 120, 420, C_ORANGE);

    if (playing) {
      const big = e.kind === 'brute' || e.kind === 'boss';
      this.shake = Math.min(this.reducedMotion ? 4 : 26, this.shake + (e.kind === 'boss' ? 24 : e.kind === 'brute' ? 7 : e.kind === 'brooder' ? 5 : e.kind === 'crawler' ? 2.2 : 1));
      this.hitstop = Math.max(this.hitstop, e.kind === 'boss' ? 0.2 : e.kind === 'brute' ? 0.055 : e.kind === 'brooder' ? 0.035 : 0);
      this.sfx(big ? 'bigDeath' : 'death');
    }

    if (byPlayer && playing && this.dying < 0) {
      this.kills++;
      this.waveKilled++;
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.comboT = 2.4;
      const nm = Math.min(8, 1 + Math.floor(this.combo / 6));
      if (nm > this.mult) {
        this.text(0, -this.coreR - 64, `x${nm} ${nm >= 6 ? 'TWIN TRACERS' : nm >= 4 ? 'OVERCLOCK' : 'MULTIPLIER'}`, nm >= 4 ? C_WHITE : C_ORANGE, true);
        this.sfx('combo');
      }
      this.mult = nm;
      const pts = k.score * this.mult;
      this.score += pts;
      if (e.kind !== 'mite') this.text(e.x, e.y - e.r, `+${pts}`, e.kind === 'boss' ? C_WHITE : C_GRAY, e.kind === 'boss');
      const before = this.emp;
      this.emp = Math.min(1, this.emp + k.charge);
      if (before < 1 && this.emp >= 1) {
        this.text(0, this.coreR + 70, 'EMP READY', C_ORANGE, true);
        this.sfx('empReady');
      }
    }

    if (e.kind === 'brooder' && byPlayer) {
      const n = 3 + (this.wave > 6 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + Math.random();
        const m = this.spawnAt('mite', e.x + Math.cos(a) * 8, e.y + Math.sin(a) * 8);
        if (m) {
          m.kx = Math.cos(a) * 160;
          m.ky = Math.sin(a) * 160;
          m.heading = a;
        }
      }
    }
    if (e.kind === 'boss') {
      this.boss = null;
      if (playing) this.say('KERNEL PURGED', `+${k.score * this.mult} // THREAT NEUTRALISED`, false, 2.4);
    }
  }

  // ---------------------------------------------------------------- core
  private hitCore(dmg: number, x: number, y: number): void {
    if (this.dying >= 0) return;
    this.integrity = Math.max(0, this.integrity - dmg);
    this.damageFlash = 1;
    this.shake = Math.min(this.reducedMotion ? 4 : 26, this.shake + 6 + dmg * 0.35);
    this.corePulse = 1;
    this.sparks(x, y, Math.atan2(y, x), 1.6, 10, 80, 300, C_RED);
    this.sfx('damage');
    if (this.combo >= 6) this.text(0, -this.coreR - 64, 'COMBO BROKEN', C_RED, true);
    this.combo = 0;
    this.mult = 1;
    this.comboT = 0;
    if (this.integrity <= 0) this.coreDeath();
  }

  private coreDeath(): void {
    this.dying = 0;
    this.firing = false;
    this.empR = -1;
    this.shatter(0, 0, this.coreR, 140, 0, 0, true);
    for (let i = 0; i < 4; i++) this.particle(P_RING, 0, 0, 260 + i * 140, 0, 0.6 + i * 0.25, this.coreR, i % 2 ? C_RED : C_ORANGE, 0);
    this.particle(P_HEX, 0, 0, 200, 0, 0.7, this.coreR, C_WHITE, 0);
    for (let i = 0; i < 10; i++) this.particle(P_GLITCH, rand(-200, 200), rand(-150, 150), 0, 0, rand(0.1, 0.4), rand(60, 260), C_RED, 0);
    this.sparks(0, 0, 0, TAU, 60, 150, 600, C_ORANGE);
    this.shake = this.reducedMotion ? 5 : 30;
    this.hitstop = 0.25;
    this.ev.sound('gameover');
    if (this.score > this.best) {
      this.best = this.score;
      this.newBest = true;
      saveBest(this.score);
    }
    this.say('CORE COMPROMISED', 'INTEGRITY 0%', true, 2);
  }

  // ---------------------------------------------------------------- waves
  private say(t: string, sub: string, danger: boolean, dur: number): void {
    this.announce = t;
    this.announceSub = sub;
    this.announceDanger = danger;
    this.announceT = dur;
  }

  private buildWave(n: number): EnemyKind[] {
    const boss = n % 5 === 0;
    const total = boss ? 6 + n * 2 : 10 + n * 4;
    const list: EnemyKind[] = [];
    const pBrute = n >= 3 ? Math.min(0.22, 0.06 + (n - 3) * 0.02) : 0;
    const pBrood = n >= 2 ? Math.min(0.24, 0.08 + (n - 2) * 0.02) : 0;
    for (let i = 0; i < total; i++) {
      const r = Math.random();
      list.push(r < pBrute ? 'brute' : r < pBrute + pBrood ? 'brooder' : 'crawler');
    }
    // queue is consumed from the end: boss first, then the rest
    if (boss) list.push('boss');
    return list;
  }

  private nextWave(): void {
    this.wave++;
    this.queue = this.buildWave(this.wave);
    this.waveTotal = this.queue.length;
    this.waveKilled = 0;
    const ns = Math.min(4, 1 + Math.floor(this.wave / 2));
    const base = Math.random() * TAU;
    this.sectors = [];
    for (let i = 0; i < ns; i++) this.sectors.push(base + (i / ns) * TAU + rand(-0.4, 0.4));
    this.spawnT = 1.6;
    this.waveActive = true;
    const isBoss = this.wave % 5 === 0;
    const label = `WAVE ${String(this.wave).padStart(2, '0')}`;
    if (isBoss) {
      this.say(label, 'KERNEL BREACH // LEECH-CLASS SIGNATURE', true, 2.6);
      this.sfx('boss');
    } else {
      this.say(label, `${this.waveTotal} HOSTILE PROCESSES INBOUND`, false, 2.2);
      this.sfx('wave');
    }
  }

  private spawnNext(): void {
    const kind = this.queue.pop();
    if (!kind) return;
    const sector = this.sectors[(Math.random() * this.sectors.length) | 0];
    const a = sector + rand(-0.35, 0.35);
    if (kind === 'boss') {
      this.boss = this.spawnEnemy('boss', a, 40);
      return;
    }
    this.spawnEnemy(kind, a);
    if (kind === 'crawler') {
      let extra = 1 + (this.wave > 6 ? 2 : 1);
      while (extra-- > 0 && this.queue.length && this.queue[this.queue.length - 1] === 'crawler') {
        this.queue.pop();
        this.spawnEnemy('crawler', a + rand(-0.2, 0.2), rand(15, 70));
      }
    }
  }

  // ---------------------------------------------------------------- weapons
  private fire(): void {
    const tip = this.coreR + 20;
    const twin = this.mult >= 6;
    const baseA = this.turret;
    const n = twin ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const a = baseA + (Math.random() - 0.5) * 0.03;
      const off = twin ? (i === 0 ? -5 : 5) : 0;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const b = this.bullets[this.bulletCur];
      this.bulletCur = (this.bulletCur + 1) % POOL_BULLETS;
      b.active = true;
      b.x = b.px = Math.cos(baseA) * tip - Math.sin(baseA) * off;
      b.y = b.py = Math.sin(baseA) * tip + Math.cos(baseA) * off;
      b.vx = c * 980;
      b.vy = s * 980;
      b.life = 1.1;
      b.dmg = 1;
    }
    this.muzzle = 0.05;
    this.recoil = 4;
    this.sparks(Math.cos(baseA) * tip, Math.sin(baseA) * tip, baseA, 0.7, 2, 80, 220, C_HOT);
    this.sfx('shot');
  }

  triggerEmp(): void {
    if (this.phase !== 'playing' || this.dying >= 0 || this.emp < 1) return;
    this.emp = 0;
    this.empR = this.coreR;
    this.empSerial++;
    this.shake = Math.min(this.reducedMotion ? 4 : 26, this.shake + 10);
    this.hitstop = Math.max(this.hitstop, 0.05);
    this.particle(P_HEX, 0, 0, 120, 0, 0.4, this.coreR, C_WHITE, 0);
    this.sfx('emp');
  }

  // ---------------------------------------------------------------- loop
  update(dtIn: number): void {
    const dt = Math.min(dtIn, 0.05);
    this.time += dt;
    if (this.phase === 'paused') return;
    this.shake *= Math.exp(-dt * 10);
    if (this.shake < 0.05) this.shake = 0;
    this.damageFlash = Math.max(0, this.damageFlash - dt * 2.2);
    this.corePulse = Math.max(0, this.corePulse - dt * 3);
    if (this.phase === 'menu') {
      this.simDemo(dt);
      return;
    }
    if (this.phase === 'over') {
      this.updateParticles(dt);
      this.updateTexts(dt);
      return;
    }
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return;
    }
    this.sim(dt);
  }

  private simDemo(dt: number): void {
    this.demoT -= dt;
    if (this.demoT <= 0 && this.activeEnemies < 9) {
      this.demoT = rand(0.5, 1.1);
      const r = Math.random();
      this.spawnEnemy(r < 0.12 ? 'brute' : r < 0.3 ? 'brooder' : 'crawler', Math.random() * TAU);
    }
    this.turret += dt * 0.4;
    for (const e of this.enemies) {
      if (!e.active) continue;
      this.moveEnemy(e, dt, 0.8);
      if (e.x * e.x + e.y * e.y < 160 * 160) this.kill(e, false);
    }
    this.updateParticles(dt);
  }

  private sim(dt: number): void {
    if (this.announceT > 0) this.announceT -= dt;
    if (this.dying >= 0) {
      this.dying += dt;
      if (this.dying > 1.9) {
        this.firing = false;
        this.setPhase('over');
        return;
      }
    }

    // turret + firing
    const targetA = Math.atan2(this.aimY, this.aimX);
    this.turret = wrapAngle(this.turret + wrapAngle(targetA - this.turret) * Math.min(1, dt * 28));
    this.recoil = Math.max(0, this.recoil - dt * 40);
    this.muzzle = Math.max(0, this.muzzle - dt);
    const interval = this.mult >= 4 ? 0.085 : 0.11;
    if (this.fireT > 0) this.fireT -= dt;
    if (this.firing && this.dying < 0) {
      while (this.fireT <= 0) {
        this.fire();
        this.fireT += interval;
      }
    }

    // combo decay
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) {
        this.combo = 0;
        this.mult = 1;
      }
    }

    // waves
    if (this.dying < 0) {
      if (!this.waveActive) {
        this.interT -= dt;
        if (this.interT <= 0) this.nextWave();
      } else if (this.queue.length) {
        this.spawnT -= dt;
        if (this.spawnT <= 0) {
          this.spawnNext();
          const iv = Math.max(0.28, 1.15 - this.wave * 0.065);
          this.spawnT = iv * rand(0.6, 1.4);
          if (this.boss) this.spawnT *= 1.6;
        }
      } else if (this.activeEnemies <= 0 && !this.anyShots()) {
        this.waveActive = false;
        this.interT = 2.8;
        const bonus = this.wave * 50;
        this.score += bonus;
        const heal = Math.min(10, 100 - this.integrity);
        this.integrity += heal;
        this.say(`WAVE ${String(this.wave).padStart(2, '0')} CLEARED`, `+${bonus} BONUS${heal > 0 ? `  //  +${Math.round(heal)}% INTEGRITY` : ''}`, false, 2.2);
        this.sfx('clear');
      }
    }

    // enemies
    const spdMul = 1 + Math.min(0.6, (this.wave - 1) * 0.035);
    const contact = this.coreR + 4;
    for (const e of this.enemies) {
      if (!e.active) continue;
      this.moveEnemy(e, dt, spdMul);
      if (e.kind === 'boss') {
        this.bossAct(e, dt);
        continue;
      }
      const cr = contact + e.r * 0.6;
      if (e.x * e.x + e.y * e.y < cr * cr) {
        this.hitCore(KINDS[e.kind].dmg, e.x, e.y);
        this.kill(e, false);
      }
    }

    // EMP wave
    if (this.empR >= 0) {
      this.empR += 900 * dt;
      const r2 = this.empR * this.empR;
      for (const e of this.enemies) {
        if (!e.active || e.empHit === this.empSerial) continue;
        const d2 = e.x * e.x + e.y * e.y;
        if (d2 < r2) {
          e.empHit = this.empSerial;
          const d = Math.sqrt(d2) || 1;
          this.sparks(e.x, e.y, Math.atan2(e.y, e.x), 1.2, 4, 100, 260, C_WHITE);
          this.damage(e, e.kind === 'boss' ? 14 : 4, e.x / d, e.y / d, 420);
        }
      }
      for (const s of this.shots) if (s.active && s.x * s.x + s.y * s.y < r2) s.active = false;
      if (this.empR > Math.max(this.hx, this.hy) * 1.3) this.empR = -1;
    }

    this.updateBullets(dt);
    this.updateShots(dt);
    this.updateParticles(dt);
    this.updateTexts(dt);
  }

  private anyShots(): boolean {
    for (const s of this.shots) if (s.active) return true;
    return false;
  }

  private bossAct(e: Enemy, dt: number): void {
    const enraged = e.hp < e.maxHp * 0.5;
    const tier = Math.floor(this.wave / 5);
    e.atk -= dt;
    if (e.atk <= 0) {
      e.atk = Math.max(1.0, (enraged ? 1.6 : 2.4) - tier * 0.15);
      const n = 5 + tier + (enraged ? 2 : 0);
      const base = Math.atan2(-e.y, -e.x);
      const spread = 0.75;
      for (let i = 0; i < n; i++) {
        const a = base + (n === 1 ? 0 : (i / (n - 1) - 0.5) * spread);
        const s = this.shots[this.shotCur];
        this.shotCur = (this.shotCur + 1) % POOL_SHOTS;
        s.active = true;
        s.x = e.x + Math.cos(base) * e.r * 0.9;
        s.y = e.y + Math.sin(base) * e.r * 0.9;
        const sp = rand(140, 175);
        s.vx = Math.cos(a) * sp;
        s.vy = Math.sin(a) * sp;
        s.life = 6;
        s.r = 5;
      }
      e.glitch = 0.15;
      this.sparks(e.x, e.y, base, 1.0, 8, 60, 200, C_RED);
    }
    e.brood -= dt;
    if (e.brood <= 0) {
      e.brood = enraged ? 4.5 : 7;
      for (let i = 0; i < 3 + tier; i++) {
        const a = Math.random() * TAU;
        this.spawnAt('crawler', e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r);
      }
    }
  }

  private updateBullets(dt: number): void {
    const lim = Math.max(this.hx, this.hy) + 80;
    for (const b of this.bullets) {
      if (!b.active) continue;
      b.px = b.x;
      b.py = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || Math.abs(b.x) > lim || Math.abs(b.y) > lim) {
        b.active = false;
        continue;
      }
      const sx = b.x - b.px;
      const sy = b.y - b.py;
      const len2 = sx * sx + sy * sy || 1;
      const len = Math.sqrt(len2);
      const dx = sx / len;
      const dy = sy / len;
      let hit = false;
      for (const e of this.enemies) {
        if (!e.active) continue;
        const rr = (e.kind === 'boss' ? e.r * 0.95 : e.r + 3);
        const ex = e.x - b.px;
        const ey = e.y - b.py;
        if (Math.abs(ex) > rr + len || Math.abs(ey) > rr + len) continue;
        const t = clamp((ex * sx + ey * sy) / len2, 0, 1);
        const cx = ex - sx * t;
        const cy = ey - sy * t;
        if (cx * cx + cy * cy < rr * rr) {
          const hx = b.px + sx * t;
          const hy = b.py + sy * t;
          this.sparks(hx, hy, Math.atan2(-dy, -dx), 1.4, 4, 90, 320, C_ORANGE);
          this.particle(P_EMBER, hx, hy, 0, 0, 0.12, 14, C_HOT, 0);
          this.sfx('hit');
          this.damage(e, b.dmg, dx, dy, 70);
          hit = true;
          break;
        }
      }
      if (!hit) {
        for (const s of this.shots) {
          if (!s.active) continue;
          const ex = s.x - b.x;
          const ey = s.y - b.y;
          if (ex * ex + ey * ey < (s.r + 6) * (s.r + 6)) {
            s.active = false;
            this.sparks(s.x, s.y, 0, TAU, 6, 60, 200, C_RED);
            this.score += 2 * this.mult;
            hit = true;
            break;
          }
        }
      }
      if (hit) b.active = false;
    }
  }

  private updateShots(dt: number): void {
    const cr = this.coreR + 8;
    for (const s of this.shots) {
      if (!s.active) continue;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.life <= 0) {
        s.active = false;
        continue;
      }
      if (s.x * s.x + s.y * s.y < cr * cr) {
        s.active = false;
        this.hitCore(4, s.x, s.y);
      }
    }
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      if (p.kind === P_SPARK || p.kind === P_FRAG || p.kind === P_EMBER) {
        const d = Math.exp(-p.drag * dt);
        p.vx *= d;
        p.vy *= d;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }
  }

  private updateTexts(dt: number): void {
    for (const t of this.texts) {
      if (!t.active) continue;
      t.life -= dt;
      t.y += t.vy * dt;
      if (t.life <= 0) t.active = false;
    }
  }
}
