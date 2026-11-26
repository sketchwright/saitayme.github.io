// Sector bosses. Each variant has its own controller logic and attack set;
// there is no shared attack rotation. Visuals of the eye itself come from the
// enemy module (variant / bossTell / bossDecoy fields); the gameplay layers
// drawn here by the renderer are shields, laser walls, shockwaves, tethers,
// beams and the corrupted arena edge.
import { Boss, Enemy, EnemyKind, bossBreakSegment, bossCharge, bossShieldSegments, createEnemy, setBossPhase, spawnEnemy, updateEnemy } from './enemies';
import type { Vec } from './enemies';
import { C_ORANGE, C_RED, C_WHITE, EB_HARD, EB_HOMING, EB_NEEDLE, EB_ORB, EB_PELLET, P_EMBER, P_GLITCH, P_HEX, P_RING, SfxName, TAU, U_DECOY, Unit } from './types';
import type { GroupDef } from './content/sectors';
import type { BossDef } from './content/sectors';

/** What the controller needs from the game. */
export interface BossHost {
  readonly FW: number;
  readonly FH: number;
  px: number;
  py: number;
  time: number;
  hard: boolean;
  units: Unit[];
  ebullet(kind: number, x: number, y: number, vx: number, vy: number): void;
  aimed(kind: number, x: number, y: number, speed: number, n: number, spread: number, baseA?: number): void;
  hurtPlayer(dmg: number, x: number, y: number): void;
  drain(amount: number): void;
  particle(kind: number, x: number, y: number, vx: number, vy: number, life: number, size: number, color: number, drag: number): void;
  sparks(x: number, y: number, dir: number, spread: number, n: number, smin: number, smax: number, color: number): void;
  addShake(v: number): void;
  say(t: string, sub: string, danger: boolean, dur: number): void;
  sfx(n: SfxName): void;
  pushLog(text: string): void;
  spawnGroup(g: GroupDef, elite: boolean, bx?: number, by?: number): number;
  countAlive(): number;
  clearEnemyBullets(): void;
  hackRandomUpgrade(seconds: number): string | null;
  adoptUnit(e: Enemy, kind: EnemyKind, hp: number, state: number): Unit | null;
}

export type BossTell = 'none' | 'laserGrid' | 'charge' | 'teleport' | 'clone' | 'tether' | 'spiral' | 'beam' | 'hack' | 'sweep' | 'burst' | 'summon';

export interface Wall {
  active: boolean;
  y: number;
  gapX: number;
  gapV: number;
  gapW: number;
  hit: boolean;
}

export interface Shock {
  active: boolean;
  x: number;
  y: number;
  r: number;
  max: number;
  hit: boolean;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const TELL = 0.6;
export const SHIELD_SEGS = 8;
const PHASES = [0.66, 0.33];

type Lib = Record<string, unknown>;
/** Sets an optional field the enemy module may read (bossTell, bossDecoy, ...). */
const setField = (e: Enemy, k: string, v: unknown) => {
  (e as unknown as Lib)[k] = v;
};

export class BossCtl {
  readonly def: BossDef;
  readonly variant: 0 | 1 | 2;
  phase = 0;
  intro = 3;
  entering = 3.2;
  inv = 0;
  dying = -1;
  // attack scheduling
  tell: BossTell = 'none';
  tellT = 0;
  attack: string | null = null;
  atkT = 0;
  step = 0;
  gap = 1.5;
  rot = 0;
  private idx = 0;
  private pending: string | null = null;
  private lastTeleport = 0;
  // movement override
  private mx = 0;
  private my = 170;
  private mk = 1.6;
  // WARDEN
  shields: number[] = [];
  shieldMax = 5;
  shieldRot = 0;
  private regenT = 13;
  readonly walls: Wall[] = Array.from({ length: 4 }, () => ({ active: false, y: 0, gapX: 0, gapV: 0, gapW: 90, hit: false }));
  readonly shocks: Shock[] = Array.from({ length: 4 }, () => ({ active: false, x: 0, y: 0, r: 0, max: 300, hit: false }));
  laneX = 0;
  private chargeStage = 0;
  // ECHO
  tether = { on: false, ax: 0, ay: 0, t: 0 };
  private cloneT = 0;
  // ROOT
  beam = 0; // 0 off, 1 telegraph, 2 firing
  beamX = 0;
  inset = 0;
  private hackT = 3;
  desperate = false;

  constructor(def: BossDef, private readonly host: BossHost) {
    this.def = def;
    this.variant = def.variant;
    this.mx = host.FW / 2;
    this.beamX = host.FW / 2;
    if (this.variant === 0) {
      this.shieldMax = Math.round(4 * (host.hard ? 1.3 : 1));
      this.shields = new Array(SHIELD_SEGS).fill(this.shieldMax);
    }
  }

  // ------------------------------------------------------------ lifecycle
  static create(def: BossDef, host: BossHost, x: number, y: number): Boss {
    const opts = { size: def.size, variant: def.variant };
    const e = createEnemy('boss', x, y, (Math.random() * 0x7fffffff) | 0, opts) as Boss;
    e.dur = 1e9;
    e.reachCd = 1e9;
    setField(e, 'variant', def.variant);
    setField(e, 'bossTell', 'none');
    spawnEnemy(e);
    void host;
    return e;
  }

  get tangible(): boolean {
    return this.inv <= 0 && this.entering <= 0 && this.dying < 0;
  }

  private setTell(e: Enemy, t: BossTell): void {
    this.tell = t;
    setField(e, 'bossTell', t);
  }

  /** Damage that reaches the core (0 if a shield segment absorbed it). */
  filterDamage(u: Unit, dmg: number, x: number, y: number): number {
    if (this.variant !== 0 || this.phase >= 2) return dmg;
    const e = u.e as Boss;
    const info = bossShieldSegments(e);
    if (info.n === 0) return dmg;
    const a = Math.atan2(y - info.cy, x - info.cx);
    let best = -1;
    let bd = Infinity;
    for (let i = 0; i < info.n; i++) {
      let d = a - info.angles[i];
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      if (Math.abs(d) < bd) {
        bd = Math.abs(d);
        best = i;
      }
    }
    // the segment facing the shot (gaps included) takes the hit while it stands
    if (best >= 0 && info.alive[best] && this.shields[best] > 0) {
      this.shields[best] -= dmg;
      this.host.sparks(x, y, a, 1.2, 2, 80, 220, C_WHITE);
      if (this.shields[best] <= 0) {
        this.shields[best] = 0;
        bossBreakSegment(e, best);
        this.host.particle(P_HEX, x, y, 40, 0, 0.3, 10, C_ORANGE, 0);
        this.host.sfx('bigDeath');
      }
      return 0;
    }
    return dmg;
  }

  // ------------------------------------------------------------ update
  update(u: Unit, dt: number, target: Vec, intent: Vec): void {
    const h = this.host;
    const e = u.e as Boss;
    e.dur = 1e9;
    if (this.attack !== 'lash') e.reachCd = 1e9;
    if (this.intro > 0) this.intro -= dt;
    this.rot += dt;
    this.updateHazards(dt, e);

    // default hover; attacks override mx / my
    if (this.entering > 0) {
      this.entering -= dt;
      this.mx = h.FW / 2;
      this.my = 170;
      this.mk = 1.4;
    } else if (!this.attack || this.attack === 'bursts' || this.attack === 'shards' || this.attack === 'spiral' || this.attack === 'tether') {
      const roam = this.variant === 2 && this.phase >= 2;
      this.mx = h.FW / 2 + Math.sin(h.time * (roam ? 0.55 : 0.35)) * h.FW * (roam ? 0.32 : 0.2);
      this.my = (roam ? 210 : 170) + Math.sin(h.time * 0.7) * (roam ? 60 : 16);
      this.mk = 1.5;
    }
    intent.x = clamp((this.mx - e.x) * this.mk, -190, 190);
    intent.y = clamp((this.my - e.y) * this.mk, -260, 260);
    updateEnemy(e, dt, target, this.dying >= 0 ? null : intent);

    if (this.dying >= 0) return;
    if (this.inv > 0) this.inv -= dt;
    if (this.entering > 0) return;

    // phases at 66% / 33%
    const frac = u.hp / u.maxHp;
    if (this.phase < PHASES.length && frac <= PHASES[this.phase]) {
      this.enterPhase(u, e, this.phase + 1);
      return;
    }
    if (this.variant === 2 && !this.desperate && frac < 0.15) {
      this.desperate = true;
      h.say('DESPERATION PROTOCOL', 'ALL PATTERNS ONLINE', true, 1.8);
      h.sfx('stingRoot');
    }
    this.variantTick(u, e, dt);

    // scheduler: tell ~0.6 s, then the attack
    if (this.pending) {
      this.tellT -= dt;
      if (this.tellT <= 0) {
        this.attack = this.pending;
        this.pending = null;
        this.atkT = 0;
        this.step = 0;
        this.startAttack(u, e);
      }
    } else if (this.attack) {
      this.atkT += dt;
      if (this.runAttack(u, e, dt)) {
        this.attack = null;
        this.setTell(e, 'none');
        this.gap = this.gapFor();
      }
    } else {
      this.gap -= dt;
      if (this.gap <= 0) this.queue(e, this.nextAttack());
    }
  }

  private gapFor(): number {
    const base = [1.3, 1.1, 0.9][this.variant] * (1 - this.phase * 0.15) * (this.host.hard ? 0.8 : 1);
    return this.desperate ? 0.35 : base;
  }

  private queue(e: Boss, a: string): void {
    this.pending = a;
    this.tellT = this.variant === 0 && this.phase >= 2 && a === 'charge' ? 0.45 : TELL;
    const map: Record<string, BossTell> = {
      bursts: 'burst',
      triple: 'burst',
      grid: 'laserGrid',
      charge: 'charge',
      lash: 'sweep',
      shards: 'burst',
      clone: 'clone',
      teleport: 'teleport',
      tether: 'tether',
      spiral: 'spiral',
      spiral2: 'spiral',
      beam: 'beam',
      summon: 'summon',
      hack: 'hack',
      fan: 'burst',
    };
    this.setTell(e, map[a] ?? 'charge');
    bossCharge(e);
    if (a === 'charge') this.laneX = clamp(this.host.px, 60, this.host.FW - 60);
    if (a === 'beam') this.beamX = e.x;
  }

  private nextAttack(): string {
    const lists: string[][][] = [
      // WARDEN: bursts through the shield -> laser grid walls -> lane charges + triple bursts
      [['bursts'], ['grid', 'bursts', 'grid', 'bursts'], ['charge', 'triple', 'charge', 'charge', 'triple']],
      // ECHO: lashes + shards -> clones -> tethers
      [['lash', 'shards', 'teleport'], ['shards', 'lash', 'clone', 'teleport'], ['tether', 'shards', 'lash', 'teleport']],
      // ROOT: spirals -> tracking beam + summons -> everything, with hacks
      [['spiral', 'spiral2'], ['beam', 'spiral', 'summon', 'beam'], ['spiral', 'beam', 'hack', 'fan', 'spiral2', 'summon']],
    ];
    let list = lists[this.variant][Math.min(this.phase, 2)];
    if (this.desperate) list = ['spiral', 'beam', 'fan', 'spiral2'];
    let a = list[this.idx % list.length];
    this.idx++;
    if (a === 'clone' && this.decoys() >= 2) a = 'shards';
    if (a === 'hack' && this.hackT > 0) a = 'fan';
    return a;
  }

  private decoys(): number {
    let n = 0;
    for (const x of this.host.units) if (!x.dead && x.state === U_DECOY) n++;
    return n;
  }

  private enterPhase(u: Unit, e: Boss, p: number): void {
    const h = this.host;
    this.phase = p;
    setBossPhase(e, p);
    this.inv = 1.2;
    this.attack = null;
    this.pending = null;
    this.setTell(e, 'none');
    this.beam = 0;
    this.tether.on = false;
    this.gap = 1.4;
    h.clearEnemyBullets();
    h.addShake(16);
    for (let i = 0; i < 6; i++) h.particle(P_GLITCH, e.x + rand(-u.r, u.r), e.y + rand(-u.r, u.r), 0, 0, rand(0.1, 0.3), rand(60, 200), C_RED, 0);
    h.particle(P_RING, e.x, e.y, 400, 0, 0.6, u.r, C_ORANGE, 0);
    h.sfx(this.variant === 0 ? 'stingWarden' : this.variant === 1 ? 'stingEcho' : 'stingRoot');
    const sub = `${this.def.name} // PHASE ${p + 1}`;
    if (this.variant === 0) {
      if (p === 1) h.say('LASER GRID ONLINE', sub, true, 2);
      else {
        // shield shatters
        for (let i = 0; i < SHIELD_SEGS; i++) {
          const a = this.shieldRot + (i + 0.5) * (TAU / SHIELD_SEGS);
          if (this.shields[i] > 0) h.sparks(e.x + Math.cos(a) * u.r, e.y + Math.sin(a) * u.r, a, 0.8, 8, 120, 380, C_WHITE);
          this.shields[i] = 0;
        }
        h.say('SHIELD SHATTERED', `${sub} // IT IS COMING FOR YOU`, true, 2);
      }
    } else if (this.variant === 1) {
      if (p === 1) {
        h.say('ECHO SPLITS', `${sub} // FIND THE REAL ONE`, true, 2);
        this.queue(e, 'clone');
      } else h.say('LEECH TETHERS', `${sub} // MOVE TO BREAK THEM`, true, 2);
    } else {
      if (p === 1) {
        h.say('TRACKING BEAM', sub, true, 2);
        this.summon(e, 3);
      } else h.say('CORRUPTION SPREADS', `${sub} // ARENA COLLAPSING`, true, 2.2);
    }
    h.pushLog(`${this.def.name.toLowerCase()} phase ${p + 1}`);
  }

  private variantTick(u: Unit, e: Boss, dt: number): void {
    const h = this.host;
    if (this.variant === 0) {
      this.shieldRot += dt * (this.phase === 0 ? 0.5 : 0.85);
      if (this.phase === 1) {
        this.regenT -= dt;
        if (this.regenT <= 0) {
          this.regenT = 13;
          const i = this.shields.findIndex((s) => s <= 0);
          if (i >= 0) {
            this.shields[i] = this.shieldMax;
            (e as Boss).segAlive[i] = 1;
          }
        }
      }
    } else if (this.variant === 1) {
      this.lastTeleport += dt;
      if (this.phase >= 1 && this.decoys() < 2 && !this.pending && !this.attack) {
        this.cloneT += dt;
        if (this.cloneT > 10) {
          this.cloneT = 0;
          this.queue(e, 'clone');
        }
      }
      if (this.tether.on) {
        this.tether.t += dt;
        const d = Math.hypot(h.px - this.tether.ax, h.py - this.tether.ay);
        if (d > 170 || this.tether.t > 6) {
          this.tether.on = false;
          setField(u.e, 'tetherActive', false);
          h.sparks(h.px, h.py, -Math.PI / 2, TAU, 10, 80, 260, C_ORANGE);
          h.sfx('zap');
          h.pushLog('tether broken');
        } else h.drain(dt * 7);
      }
    } else {
      if (this.phase >= 2) {
        this.inset = Math.min(h.FW * 0.2, this.inset + dt * 4.5);
        this.hackT -= dt;
        if (h.px < this.inset || h.px > h.FW - this.inset) h.drain(dt * 12);
      }
    }
    void u;
  }

  private startAttack(u: Unit, e: Boss): void {
    const h = this.host;
    switch (this.attack) {
      case 'teleport':
        this.teleport(u, e);
        break;
      case 'clone':
        this.spawnClones(u, e);
        break;
      case 'tether':
        this.tether = { on: true, ax: h.px, ay: h.py, t: 0 };
        setField(e, 'tetherActive', true);
        h.sfx('latch');
        break;
      case 'beam':
        this.beam = 1;
        h.sfx('laser');
        break;
      case 'summon':
        this.summon(e, 2 + this.phase);
        break;
      case 'hack': {
        const name = h.hackRandomUpgrade(10);
        this.hackT = 14;
        if (name) h.say('MODULE HACKED', `${name} DISABLED // 10s`, true, 1.8);
        break;
      }
      case 'lash':
        this.mx = clamp(h.px, 120, h.FW - 120);
        this.my = h.FH * 0.33;
        this.mk = 1.6;
        break;
    }
  }

  /** Returns true when finished. */
  private runAttack(u: Unit, e: Boss, dt: number): boolean {
    const h = this.host;
    const t = this.atkT;
    const ph = this.phase;
    const sp = this.def.bulletSpeed * (1 + ph * 0.08) * (h.hard ? 1.1 : 1);
    switch (this.attack) {
      // -------------------------------------------------- WARDEN
      case 'bursts': {
        const n = 4 + ph;
        if (this.step < n && t >= this.step * 0.32) {
          // fire out through the open (destroyed) segments, else straight at the player
          const a0 = Math.atan2(h.py - e.y, h.px - e.x);
          h.aimed(EB_ORB, e.x + Math.cos(a0) * u.r, e.y + Math.sin(a0) * u.r, sp, 3, 0.13, a0);
          this.step++;
          h.sfx('enemyShot');
        }
        return t > n * 0.32 + 0.3;
      }
      case 'grid': {
        if (this.step < 3 && t >= this.step * 1.5) {
          const w = this.walls.find((x) => !x.active);
          if (w) {
            w.active = true;
            w.y = e.y + u.r;
            w.gapW = 92 - ph * 6;
            w.gapX = rand(80, h.FW - 80);
            w.gapV = (Math.random() < 0.5 ? -1 : 1) * rand(55, 85);
            w.hit = false;
            h.sfx('laser');
          }
          this.step++;
        }
        return t > 3.4;
      }
      case 'charge': {
        // slide over the locked lane, drop the core on its cables, slam
        this.mx = this.laneX;
        this.my = 170;
        this.mk = 2.4;
        if (this.chargeStage === 0 && (Math.abs(e.x - this.laneX) < 24 || t > 1.2)) {
          this.chargeStage = 1;
          e.drop = 0;
          e.slamT = 0;
        }
        if (this.chargeStage === 1 && (e.slammed || (e.slamT > 1.1 && e.drop > 0.95))) {
          this.chargeStage = 2;
          const info = bossShieldSegments(e);
          const s = this.shocks.find((x) => !x.active);
          if (s) {
            s.active = true;
            s.x = info.n ? info.cx : e.x;
            s.y = info.n ? info.cy : e.y + u.r;
            s.r = 10;
            s.max = 330;
            s.hit = false;
          }
          h.addShake(14);
          h.sfx('bigDeath');
          h.particle(P_RING, s ? s.x : e.x, s ? s.y : e.y, 200, 0, 0.4, u.r, C_WHITE, 0);
        }
        if (this.chargeStage === 2 && t > 2.4) {
          this.chargeStage = 0;
          return true;
        }
        return t > 4;
      }
      case 'triple': {
        if (this.step < 3 && t >= this.step * 0.4) {
          for (let k = -1; k <= 1; k++) h.aimed(EB_ORB, e.x, e.y + u.r * 0.4, sp * 1.1, 1, 0, Math.atan2(h.py - e.y, h.px - e.x) + k * 0.05);
          this.step++;
          h.sfx('enemyShot');
        }
        return t > 1.3;
      }
      // -------------------------------------------------- ECHO
      case 'teleport':
        return t > 0.2;
      case 'lash': {
        e.reachCd = 1e9;
        if (this.step < 3 && t >= 0.1 + this.step * 0.6) {
          bossCharge(e);
          this.step++;
        }
        // lash contact
        for (const td of e.variant === 1 ? e.lashes : e.tendrils) {
          for (let i = 2; i < td.n; i += 2) {
            const dx = td.x[i] - h.px;
            const dy = td.y[i] - h.py;
            if (dx * dx + dy * dy < 15 * 15) {
              h.hurtPlayer(16, td.x[i], td.y[i]);
              break;
            }
          }
        }
        if (t > 2.2) return true;
        return false;
      }
      case 'shards': {
        const n = 4 + ph;
        if (this.step === 0) {
          this.step = 1;
          this.homingFan(e.x, e.y, n, sp * 0.5);
          for (const d of this.host.units) if (!d.dead && d.state === U_DECOY) this.homingFan(d.e.x, d.e.y, 2, sp * 0.45);
          h.sfx('enemyShot');
        }
        return t > 1.2;
      }
      case 'clone':
        return t > 0.3;
      case 'tether':
        return !this.tether.on || t > 6;
      // -------------------------------------------------- ROOT
      case 'spiral':
      case 'spiral2': {
        const dir = this.attack === 'spiral' ? 1 : -1;
        const dur = 3.4 + ph * 0.4;
        const arms = 4 + ph;
        const step = 0.13 - ph * 0.015;
        while (this.step * step < Math.min(t, dur)) {
          const a0 = dir * (this.rot * (0.8 + ph * 0.25)) + this.step * 0.02;
          for (let k = 0; k < arms; k++) {
            const a = a0 + (k / arms) * TAU;
            h.ebullet(EB_HARD, e.x, e.y, Math.cos(a) * sp * 0.7, Math.sin(a) * sp * 0.7);
          }
          this.step++;
        }
        if (this.step % 5 === 0) h.sfx('enemyShot');
        return t > dur;
      }
      case 'beam': {
        if (this.beam === 1 && t > 0.8) {
          this.beam = 2;
          h.addShake(6);
        }
        const speed = this.beam === 1 ? 90 : 125 + ph * 15;
        this.beamX += clamp(h.px - this.beamX, -speed * dt, speed * dt);
        if (this.beam === 2 && Math.abs(h.px - this.beamX) < 18 && h.py > e.y) h.hurtPlayer(18, h.px, h.py - 10);
        if (this.beam === 2 && Math.random() < dt * 24) h.sparks(this.beamX + rand(-10, 10), h.FH - rand(0, 40), -Math.PI / 2, 1.2, 1, 60, 220, C_ORANGE);
        if (t > 3.8 + ph * 0.4) {
          this.beam = 0;
          return true;
        }
        return false;
      }
      case 'summon':
        return t > 0.5;
      case 'hack':
        return t > 0.3;
      case 'fan': {
        const n = 4;
        if (this.step < n && t >= this.step * 0.28) {
          h.aimed(EB_NEEDLE, e.x, e.y + u.r * 0.4, sp, 7, 0.12);
          this.step++;
          h.sfx('enemyShot');
        }
        return t > n * 0.28 + 0.2;
      }
    }
    return true;
  }

  private homingFan(x: number, y: number, n: number, sp: number): void {
    const a0 = Math.atan2(this.host.py - y, this.host.px - x);
    for (let i = 0; i < n; i++) {
      const a = a0 + (i - (n - 1) / 2) * 0.5;
      this.host.ebullet(EB_HOMING, x, y, Math.cos(a) * sp, Math.sin(a) * sp);
    }
  }

  private teleport(u: Unit, e: Boss): void {
    const h = this.host;
    // a deliberate jump (the module re-plants on teleports)
    h.particle(P_HEX, e.x, e.y, 80, 0, 0.35, u.r, C_WHITE, 0);
    const spots = [h.FW * 0.22, h.FW * 0.5, h.FW * 0.78];
    const decoys = this.host.units.filter((x) => !x.dead && x.state === U_DECOY);
    const order = [0, 1, 2].sort(() => Math.random() - 0.5);
    e.x = spots[order[0]];
    e.y = rand(140, 220);
    this.mx = e.x;
    this.my = e.y;
    decoys.forEach((d, i) => {
      d.e.x = spots[order[(i + 1) % 3]];
      d.e.y = rand(140, 220);
      d.gx = d.e.x;
      d.gy = d.e.y;
    });
    h.particle(P_HEX, e.x, e.y, 80, 0, 0.35, u.r, C_ORANGE, 0);
    h.sfx('dash');
    this.lastTeleport = 0;
  }

  private spawnClones(u: Unit, e: Boss): void {
    const h = this.host;
    const need = 2 - this.decoys();
    for (let i = 0; i < need; i++) {
      const d = createEnemy('boss', e.x, e.y, (Math.random() * 0x7fffffff) | 0, { size: this.def.size * 0.92 });
      setField(d, 'variant', 1);
      setField(d, 'bossDecoy', true);
      setField(d, 'bossTell', 'none');
      (d as Boss).dur = 1e9;
      (d as Boss).reachCd = 1e9;
      spawnEnemy(d);
      const du = h.adoptUnit(d, 'boss', 1, U_DECOY);
      if (du) {
        du.r = u.r;
        du.score = 300;
      }
    }
    this.teleport(u, e);
    h.sfx('stingEcho');
  }

  updateDecoy(d: Unit, dt: number, target: Vec, intent: Vec): void {
    const e = d.e as Boss;
    e.dur = 1e9;
    e.reachCd = 1e9;
    const h = this.host;
    if (Math.abs(d.gx - e.x) < 12) d.gx = clamp(e.x + rand(-120, 120), 80, h.FW - 80);
    intent.x = clamp((d.gx - e.x) * 1.2, -120, 120);
    intent.y = clamp((d.gy - e.y) * 1.2, -120, 120);
    updateEnemy(e, dt, target, intent);
  }

  /** Decoys burst into a ring of pellets when shot. */
  explodeDecoy(d: Unit): void {
    const h = this.host;
    const n = 12;
    const off = Math.random() * TAU;
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * TAU;
      h.ebullet(EB_PELLET, d.e.x, d.e.y, Math.cos(a) * 150, Math.sin(a) * 150);
    }
    h.particle(P_RING, d.e.x, d.e.y, 160, 0, 0.4, 20, C_RED, 0);
    h.particle(P_EMBER, d.e.x, d.e.y, 0, 0, 0.4, 90, C_RED, 0);
    h.addShake(6);
    h.say('DECOY', 'NOT THE REAL ONE', false, 0.9);
  }

  private summon(e: Boss, n: number): void {
    const h = this.host;
    const kinds: EnemyKind[] = ['crawler', 'wraith', 'leech', 'swarm'];
    const room = 6 - (h.countAlive() - 1);
    for (let i = 0; i < Math.min(n, room); i++) h.spawnGroup({ kind: kinds[(Math.random() * kinds.length) | 0], n: 1, from: 'boss', at: 0, gap: 0 }, false, e.x, e.y);
    h.particle(P_HEX, e.x, e.y, 60, 0, 0.35, 16, C_ORANGE, 0);
  }

  private updateHazards(dt: number, e: Boss): void {
    const h = this.host;
    for (const w of this.walls) {
      if (!w.active) continue;
      w.y += (110 + this.phase * 15) * dt;
      w.gapX += w.gapV * dt;
      if (w.gapX < 70 || w.gapX > h.FW - 70) w.gapV = -w.gapV;
      if (!w.hit && Math.abs(h.py - w.y) < 8 && Math.abs(h.px - w.gapX) > w.gapW / 2) {
        w.hit = true;
        h.hurtPlayer(18, h.px, w.y);
      }
      if (w.y > h.FH + 20) w.active = false;
    }
    for (const s of this.shocks) {
      if (!s.active) continue;
      s.r += 300 * dt;
      const d = Math.hypot(h.px - s.x, h.py - s.y);
      if (!s.hit && Math.abs(d - s.r) < 10) {
        s.hit = true;
        h.hurtPlayer(16, h.px, h.py);
      }
      if (s.r > s.max) s.active = false;
    }
    void e;
  }

  clearHazards(): void {
    for (const w of this.walls) w.active = false;
    for (const s of this.shocks) s.active = false;
    this.beam = 0;
    this.tether.on = false;
  }

  isDecoy(u: Unit): boolean {
    return u.state === U_DECOY;
  }
}

