// Cyber Defender simulation: vertical arcade roguelite. Plain mutable state in
// fixed pools; React only hears about screen changes. World space is the
// logical playfield (FIELD_W wide, FH tall), scaled to the canvas by the
// renderer. Enemies come from ./enemies (motion + animation); this file owns
// formations, dives, combat, upgrades, the node map and the run structure.
import * as EN from './enemies';
import {
  Boss,
  Enemy,
  EnemyKind,
  Vec,
  beginSplit,
  bossCharge,
  createEnemy,
  crawlerLunge,
  leechIsLatched,
  leechToggleLatch,
  sentinelCharge,
  sentinelMuzzle,
  setBossPhase,
  turnToward,
  updateEnemy,
  wraithStrike,
} from './enemies';
import {
  Arc,
  C_GRAY,
  C_HOT,
  C_ORANGE,
  C_RED,
  C_WHITE,
  EB_NEEDLE,
  EB_ORB,
  EB_PELLET,
  EBullet,
  FIELD_MIN_H,
  FIELD_W,
  FloatText,
  MAX_UNITS,
  MapNode,
  NodeType,
  OfferSource,
  OwnedUpgrade,
  P_EMBER,
  P_FRAG,
  P_GLITCH,
  P_HEX,
  P_RING,
  P_SPARK,
  PBullet,
  PK_OVERCLOCK,
  PK_RAPID,
  PK_REPAIR,
  PK_SHIELD,
  POOL_ARCS,
  POOL_EBULLETS,
  POOL_PARTICLES,
  POOL_PBULLETS,
  POOL_PICKUPS,
  POOL_TEXTS,
  Particle,
  Phase,
  Pickup,
  RunSummary,
  SectorMap,
  SfxName,
  TAU,
  U_BOSS,
  U_DIVE,
  U_ENTER,
  U_FORM,
  U_FREE,
  U_GHOST,
  U_LATCH,
  U_RETURN,
  U_SEEK,
  U_SPLIT,
  U_TELL,
  Unit,
} from './types';
import { Rng, deriveSeed, randomSeed, seedToString } from './rng';
import { saveBest } from './storage';
import {
  RARITY_WEIGHT,
  Rarity,
  SYNERGIES,
  Stats,
  UPGRADES,
  UPGRADE_BY_ID,
  UpgradeDef,
  computeStats,
  computeSynergies,
} from './content/upgrades';
import { BossAttack, BossDef, EntryPattern, FLAVOR, KIND_STATS, RowDef, SECTORS, SectorDef } from './content/sectors';
import { generateSectorMap } from './content/nodemap';
import { ANOMALIES, AnomalyCtx, AnomalyDef } from './content/anomalies';

export interface GameEvents {
  sound: (name: SfxName) => void;
  phase: (phase: Phase) => void;
  /** run data visible to React changed (map toast, offers, ...) */
  changed: () => void;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const damp = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);
const bez = (t: number, a: number, b: number, c: number, d: number) => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};

// Optional hurt / kill hooks the enemy module may export later.
type HookFn = (e: Enemy, ...args: number[]) => void;
const LIB = EN as unknown as Record<string, unknown>;
const hurtHook: HookFn | null = typeof LIB.hurtEnemy === 'function' ? (LIB.hurtEnemy as HookFn) : null;
const killHook: HookFn | null = typeof LIB.killEnemy === 'function' ? (LIB.killEnemy as HookFn) : null;

export interface RunState {
  seed: number;
  seedStr: string;
  sector: number;
  maps: SectorMap[];
  current: MapNode | null;
  combatInSector: number;
  wavesCleared: number;
  waveNo: number;
  kills: number;
  maxCombo: number;
  time: number;
  offers: UpgradeDef[];
  offerSource: OfferSource;
  afterPick: 'map' | 'nextSector' | 'victory';
  anomaly: AnomalyDef | null;
  usedAnomalies: string[];
  toast: string;
  hardenNext: boolean;
  build: OwnedUpgrade[];
  mapRng: Rng;
  offerRng: Rng;
  eventRng: Rng;
  victory: boolean;
  lastSynergy: string;
}

interface BossState {
  def: BossDef;
  phase: number;
  attack: BossAttack | null;
  atkT: number;
  atkStep: number;
  atkIdx: number;
  gap: number;
  inv: number;
  entering: number;
  sweep: boolean;
  laser: number; // 0 off, 1 telegraph, 2 firing
  laserX: number;
  reachNext: number;
  dying: number;
  spin: number;
}

const tmpV: Vec = { x: 0, y: 0 };
const intentV: Vec = { x: 0, y: 0 };

export class Game {
  phase: Phase = 'menu';
  // view
  W = 800;
  H = 600;
  scale = 1;
  FW = FIELD_W;
  FH = FIELD_MIN_H;
  fx0 = 0;
  time = 0;
  reducedMotion = false;
  autoFire = true;
  theme = 0;

  // run
  run: RunState | null = null;
  best = 0;
  newBest = false;
  score = 0;
  owned = new Map<string, number>();
  syn = new Set<string>();
  stats: Stats = computeStats(this.owned, this.syn);

  // player
  px = FIELD_W / 2;
  py = FIELD_MIN_H - 90;
  pvx = 0;
  pvy = 0;
  bank = 0;
  hp = 100;
  shield = 0;
  sinceHit = 99;
  inv = 0;
  dashT = 0;
  dashCdT = 0;
  dashDx = 0;
  dashDy = -1;
  pulseCdT = 0;
  pulseR = -1;
  pulseSerial = 0;
  pulseX = 0;
  pulseY = 0;
  fireT = 0;
  muzzle = 0;
  shotSide = 1;
  droneA = 0;
  droneT = 0;
  buffRapid = 0;
  buffShield = 0;
  buffOver = 0;
  buffMax = [8, 6, 7];
  dying = -1;
  hitThisWave = false;
  lowWarned = false;
  readonly trailX = new Float32Array(16);
  readonly trailY = new Float32Array(16);
  trailHead = 0;
  private trailAcc = 0;

  // combat
  units: Unit[] = [];
  private nextId = 1;
  combo = 0;
  comboT = 0;
  mult = 1;
  waveActive = false;
  waveElite = false;
  waveTotal = 0;
  clearT = -1;
  isBoss = false;
  boss: Unit | null = null;
  bs: BossState | null = null;
  sector: SectorDef = SECTORS[0];
  private diveT = 3;
  private fireDirT = 2;
  formDx = 56;
  formDy = 46;
  formTop = 110;
  private swayAmp = 40;
  formT = 0;
  latchedCount = 0;

  // fx
  shake = 0;
  hitstop = 0;
  damageFlash = 0;
  announce = '';
  announceSub = '';
  announceT = 0;
  announceDanger = false;
  log: { text: string; t: number }[] = [];
  private logT = 2;

  // pools
  readonly bullets: PBullet[] = Array.from({ length: POOL_PBULLETS }, () => ({
    active: false, x: 0, y: 0, vx: 0, vy: 0, dmg: 1, pierce: 0, size: 1, homing: 0, life: 0, crit: false, drone: false, lastHit: -1, target: -1, retarget: 0,
  }));
  readonly ebullets: EBullet[] = Array.from({ length: POOL_EBULLETS }, () => ({ active: false, kind: 0, x: 0, y: 0, vx: 0, vy: 0, r: 5, life: 0, t: 0 }));
  readonly particles: Particle[] = Array.from({ length: POOL_PARTICLES }, () => ({ active: false, kind: 0, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, color: 0, drag: 0 }));
  readonly texts: FloatText[] = Array.from({ length: POOL_TEXTS }, () => ({ active: false, x: 0, y: 0, vy: 0, life: 0, max: 1, text: '', color: 0, big: false }));
  readonly pickups: Pickup[] = Array.from({ length: POOL_PICKUPS }, () => ({ active: false, kind: 0, x: 0, y: 0, vx: 0, vy: 0, life: 0, t: 0 }));
  readonly arcs: Arc[] = Array.from({ length: POOL_ARCS }, () => ({ active: false, x1: 0, y1: 0, x2: 0, y2: 0, life: 0, seed: 0 }));
  private bCur = 0;
  private ebCur = 0;
  private pCur = 0;
  private tCur = 0;
  private pkCur = 0;
  private aCur = 0;

  // input
  private keys = { l: false, r: false, u: false, d: false, fire: false };
  pointerX = -1;
  pointerY = -1;
  pointerMouse = true;
  pointerInside = false;
  private pointerFollow = false;
  private fireHeld = false;
  private touchId = -1;
  private touchSX = 0;
  private touchSY = 0;
  private touchPX = 0;
  private touchPY = 0;
  touchUsed = false;
  btnPulse = { x: 0, y: 0, r: 30 };
  btnDash = { x: 0, y: 0, r: 26 };

  private readonly ev: GameEvents;

  constructor(ev: GameEvents, best: number) {
    this.ev = ev;
    this.best = best;
    this.spawnDemo();
  }

  // ================================================================ view
  resize(W: number, H: number): void {
    this.W = W;
    this.H = H;
    this.scale = Math.max(0.3, Math.min(W / FIELD_W, H / FIELD_MIN_H));
    this.FH = H / this.scale;
    this.fx0 = (W - FIELD_W * this.scale) / 2;
    this.py = clamp(this.py, this.FH - 230, this.FH - 40);
    const r = 30;
    this.btnPulse = { x: W - 24 - r, y: H - 30 - r, r };
    this.btnDash = { x: W - 24 - r, y: H - 30 - r * 2 - 26 - 26, r: 26 };
  }

  private toField(sx: number, sy: number): [number, number] {
    return [(sx - this.fx0) / this.scale, sy / this.scale];
  }

  // ================================================================ input
  pointerDown(sx: number, sy: number, button: number, id: number, mouse: boolean): boolean {
    this.pointerMouse = mouse;
    this.pointerInside = true;
    this.pointerX = sx;
    this.pointerY = sy;
    if (this.phase !== 'playing' || this.dying >= 0) return false;
    if (!mouse) this.touchUsed = true;
    if (this.stats.pulse && this.hitBtn(this.btnPulse, sx, sy)) {
      this.triggerPulse();
      return false;
    }
    if (this.stats.dash && this.hitBtn(this.btnDash, sx, sy)) {
      this.triggerDash();
      return false;
    }
    if (mouse && button === 2) {
      this.triggerPulse();
      return false;
    }
    if (mouse && button !== 0) return false;
    this.fireHeld = true;
    if (mouse) {
      this.pointerFollow = true;
    } else if (this.touchId < 0) {
      this.touchId = id;
      this.touchSX = sx;
      this.touchSY = sy;
      this.touchPX = this.px;
      this.touchPY = this.py;
    }
    return true;
  }

  private hitBtn(b: { x: number; y: number; r: number }, sx: number, sy: number): boolean {
    return (sx - b.x) ** 2 + (sy - b.y) ** 2 < (b.r + 8) ** 2;
  }

  pointerMove(sx: number, sy: number, id: number, mouse: boolean): void {
    this.pointerMouse = mouse;
    this.pointerInside = true;
    if (mouse) {
      const moved = Math.abs(sx - this.pointerX) + Math.abs(sy - this.pointerY) > 1;
      this.pointerX = sx;
      this.pointerY = sy;
      if (moved) this.pointerFollow = true;
    } else if (id === this.touchId) {
      this.pointerX = sx;
      this.pointerY = sy;
    }
  }

  pointerUp(id: number, mouse: boolean): void {
    if (mouse) this.fireHeld = false;
    else if (id === this.touchId) {
      this.touchId = -1;
      this.fireHeld = false;
    }
  }

  pointerLeave(mouse: boolean): void {
    if (mouse) {
      this.pointerInside = false;
      this.fireHeld = false;
    }
  }

  /** Returns true when the key was consumed. */
  keyDown(code: string, repeat: boolean): boolean {
    switch (code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.keys.l = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.keys.r = true;
        break;
      case 'ArrowUp':
      case 'KeyW':
        this.keys.u = true;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.keys.d = true;
        break;
      case 'Space':
      case 'KeyJ':
        this.keys.fire = true;
        break;
      case 'KeyE':
      case 'KeyK':
        if (!repeat) this.triggerPulse();
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
      case 'KeyL':
        if (!repeat) this.triggerDash();
        break;
      default:
        return false;
    }
    if (code !== 'Space' && code !== 'KeyJ' && code !== 'KeyE' && code !== 'KeyK') this.pointerFollow = false;
    return this.phase === 'playing';
  }

  keyUp(code: string): void {
    switch (code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.keys.l = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.keys.r = false;
        break;
      case 'ArrowUp':
      case 'KeyW':
        this.keys.u = false;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.keys.d = false;
        break;
      case 'Space':
      case 'KeyJ':
        this.keys.fire = false;
        break;
    }
  }

  clearInput(): void {
    this.keys.l = this.keys.r = this.keys.u = this.keys.d = this.keys.fire = false;
    this.fireHeld = false;
    this.touchId = -1;
  }

  // ================================================================ phases
  private setPhase(p: Phase): void {
    if (this.phase === p) return;
    this.phase = p;
    if (p !== 'playing') this.clearInput();
    this.ev.phase(p);
  }

  private sfx(n: SfxName): void {
    if (this.phase === 'playing' || n === 'select' || n === 'click' || n === 'sector' || n === 'synergy' || n === 'pickup') this.ev.sound(n);
  }

  pause(): void {
    if (this.phase === 'playing' && this.dying < 0) this.setPhase('paused');
  }

  resume(): void {
    if (this.phase === 'paused') this.setPhase('playing');
  }

  togglePause(): void {
    if (this.phase === 'paused') this.resume();
    else this.pause();
  }

  start(seed?: number): void {
    const s = seed === undefined ? randomSeed() : seed >>> 0;
    this.run = {
      seed: s,
      seedStr: seedToString(s),
      sector: 0,
      maps: [],
      current: null,
      combatInSector: 0,
      wavesCleared: 0,
      waveNo: 0,
      kills: 0,
      maxCombo: 0,
      time: 0,
      offers: [],
      offerSource: 'wave',
      afterPick: 'map',
      anomaly: null,
      usedAnomalies: [],
      toast: '',
      hardenNext: false,
      build: [],
      mapRng: new Rng(deriveSeed(s, 1)),
      offerRng: new Rng(deriveSeed(s, 2)),
      eventRng: new Rng(deriveSeed(s, 3)),
      victory: false,
      lastSynergy: '',
    };
    for (let i = 0; i < SECTORS.length; i++) this.run.maps.push(generateSectorMap(this.run.mapRng, i));
    this.owned = new Map();
    this.syn = new Set();
    this.stats = computeStats(this.owned, this.syn);
    this.score = 0;
    this.newBest = false;
    this.hp = this.stats.maxHp;
    this.shield = 0;
    this.px = FIELD_W / 2;
    this.py = this.FH - 90;
    this.resetCombat();
    this.sector = SECTORS[0];
    this.theme = 0;
    this.dying = -1;
    this.lowWarned = false;
    this.log = [];
    this.pushLog('antivirus mind linked');
    this.pushLog(`seed ${this.run.seedStr}`);
    this.say(FLAVOR.runStart[0], `SECTOR 1 // ${this.sector.name}`, false, 2.6);
    this.ev.sound('sector');
    this.setPhase('map');
    this.ev.changed();
  }

  private resetCombat(): void {
    this.units = [];
    for (const b of this.bullets) b.active = false;
    for (const b of this.ebullets) b.active = false;
    for (const p of this.pickups) p.active = false;
    for (const a of this.arcs) a.active = false;
    this.waveActive = false;
    this.isBoss = false;
    this.boss = null;
    this.bs = null;
    this.clearT = -1;
    this.combo = 0;
    this.comboT = 0;
    this.mult = 1;
    this.buffRapid = this.buffShield = this.buffOver = 0;
    this.pulseR = -1;
    this.dashT = 0;
    this.inv = 0;
    this.latchedCount = 0;
  }

  /** Map nodes the player may pick right now. */
  reachable(): string[] {
    const r = this.run;
    if (!r) return [];
    const map = r.maps[r.sector];
    if (!r.current) return map.rows[0].map((n) => n.id);
    return r.current.next;
  }

  private findNode(id: string): MapNode | null {
    const r = this.run;
    if (!r) return null;
    const map = r.maps[r.sector];
    if (map.boss.id === id) return map.boss;
    for (const row of map.rows) for (const n of row) if (n.id === id) return n;
    return null;
  }

  chooseNode(id: string): void {
    const r = this.run;
    if (!r || this.phase !== 'map') return;
    if (!this.reachable().includes(id)) return;
    const node = this.findNode(id);
    if (!node) return;
    node.visited = true;
    r.current = node;
    r.toast = '';
    this.sfx('click');
    const t: NodeType = node.type;
    switch (t) {
      case 'fight':
      case 'elite':
        this.beginWave(t === 'elite' || r.hardenNext);
        r.hardenNext = false;
        break;
      case 'boss':
        this.beginBoss();
        break;
      case 'repair': {
        const heal = Math.round(this.stats.maxHp * 0.4);
        const before = this.hp;
        this.hp = Math.min(this.stats.maxHp, this.hp + heal);
        this.shield = this.stats.shieldMax;
        r.toast = `REPAIR COMPLETE // +${Math.round(this.hp - before)} INTEGRITY`;
        this.pushLog('integrity patched');
        this.sfx('pickup');
        this.ev.changed();
        break;
      }
      case 'cache':
        this.openOffer('cache');
        break;
      case 'anomaly': {
        let pool = ANOMALIES.filter((a) => !r.usedAnomalies.includes(a.id));
        if (!pool.length) {
          r.usedAnomalies = [];
          pool = ANOMALIES;
        }
        const a = r.eventRng.pick(pool);
        r.usedAnomalies.push(a.id);
        r.anomaly = a;
        this.setPhase('anomaly');
        this.ev.changed();
        break;
      }
    }
  }

  resolveAnomaly(accept: boolean): void {
    const r = this.run;
    if (!r || this.phase !== 'anomaly' || !r.anomaly) return;
    const a = r.anomaly;
    r.anomaly = null;
    let offered = false;
    if (accept) {
      const ctx: AnomalyCtx = {
        hurt: (f) => {
          this.hp = Math.max(1, this.hp - this.stats.maxHp * f);
        },
        heal: (f) => {
          this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.maxHp * f);
        },
        offer: (rar) => {
          offered = true;
          this.openOffer('anomaly', rar);
        },
        addScore: (n) => {
          this.score += n;
        },
        loseUpgrade: () => {
          if (!r.build.length) return null;
          const idx = Math.floor(r.eventRng.next() * r.build.length);
          const b = r.build[idx];
          b.stacks--;
          const n = (this.owned.get(b.id) ?? 1) - 1;
          if (n <= 0) this.owned.delete(b.id);
          else this.owned.set(b.id, n);
          if (b.stacks <= 0) r.build.splice(idx, 1);
          this.recomputeStats();
          return UPGRADE_BY_ID[b.id]?.name ?? null;
        },
        maxHp: (d) => {
          this.bonusMaxHp += d;
          this.recomputeStats();
          if (d > 0) this.hp += d;
          this.hp = Math.min(this.hp, this.stats.maxHp);
        },
        hardenNext: () => {
          r.hardenNext = true;
        },
        rng: () => r.eventRng.next(),
      };
      const line = a.run(ctx);
      r.toast = line.toUpperCase();
      this.pushLog(line);
      this.sfx('select');
    } else {
      r.toast = 'ANOMALY IGNORED';
      this.sfx('click');
    }
    if (!offered) {
      r.afterPick = 'map';
      this.setPhase('map');
    }
    this.ev.changed();
  }

  private bonusMaxHp = 0;

  private recomputeStats(): void {
    const prevMax = this.stats.maxHp;
    this.syn = computeSynergies(this.owned);
    this.stats = computeStats(this.owned, this.syn);
    this.stats.maxHp = Math.max(30, this.stats.maxHp + this.bonusMaxHp);
    if (this.stats.maxHp > prevMax) this.hp += this.stats.maxHp - prevMax;
    this.hp = Math.min(this.hp, this.stats.maxHp);
    this.shield = Math.min(this.shield, this.stats.shieldMax);
  }

  private openOffer(source: OfferSource, only?: Rarity[]): void {
    const r = this.run;
    if (!r) return;
    const rng = r.offerRng;
    const avail = UPGRADES.filter((u) => (this.owned.get(u.id) ?? 0) < u.maxStacks && (!only || only.includes(u.rarity)));
    const weights: Record<Rarity, number> =
      source === 'boss' ? { common: 12, rare: 60, corrupted: 28 } : source === 'elite' ? { common: 40, rare: 45, corrupted: 15 } : RARITY_WEIGHT;
    const out: UpgradeDef[] = [];
    const pool = avail.slice();
    if (source === 'elite' || source === 'boss') {
      const strong = pool.filter((u) => u.rarity !== 'common');
      const g = rng.weighted(strong, (u) => weights[u.rarity]);
      if (g) {
        out.push(g);
        pool.splice(pool.indexOf(g), 1);
      }
    }
    while (out.length < 3 && pool.length) {
      const p = rng.weighted(pool, (u) => weights[u.rarity]);
      if (!p) break;
      out.push(p);
      pool.splice(pool.indexOf(p), 1);
    }
    r.offers = out;
    r.offerSource = source;
    if (!out.length) {
      // everything maxed: convert to score
      this.score += 1000;
      r.toast = 'ALL MODULES MAXED // +1000';
      this.finishPick();
      return;
    }
    this.setPhase('pick');
    this.ev.changed();
  }

  chooseUpgrade(index: number): void {
    const r = this.run;
    if (!r || this.phase !== 'pick') return;
    if (index < 0) {
      this.score += 400;
      r.toast = 'UPGRADE SKIPPED // +400';
      this.sfx('click');
      this.finishPick();
      return;
    }
    const def = r.offers[index];
    if (!def) return;
    const prevSyn = new Set(this.syn);
    this.owned.set(def.id, (this.owned.get(def.id) ?? 0) + 1);
    const b = r.build.find((x) => x.id === def.id);
    if (b) b.stacks++;
    else r.build.push({ id: def.id, stacks: 1 });
    this.recomputeStats();
    if (def.id === 'shield' || def.id === 'regen') this.shield = this.stats.shieldMax;
    r.toast = `${def.name} INSTALLED`;
    r.lastSynergy = '';
    for (const s of this.syn) {
      if (!prevSyn.has(s)) {
        const sd = SYNERGIES.find((x) => x.id === s);
        if (sd) {
          r.lastSynergy = sd.name;
          r.toast = `SYNERGY // ${sd.name}: ${sd.desc}`;
          this.pushLog(`synergy ${sd.name.toLowerCase()}`);
        }
      }
    }
    this.pushLog(`module ${def.name.toLowerCase()}`);
    this.sfx(r.lastSynergy ? 'synergy' : 'select');
    this.finishPick();
  }

  private finishPick(): void {
    const r = this.run;
    if (!r) return;
    r.offers = [];
    const next = r.afterPick;
    r.afterPick = 'map';
    if (next === 'victory') {
      this.endRun(true);
      return;
    }
    if (next === 'nextSector') {
      r.sector++;
      r.current = null;
      r.combatInSector = 0;
      this.sector = SECTORS[r.sector];
      this.theme = this.sector.theme;
      this.say(`SECTOR ${r.sector + 1} // ${this.sector.name}`, this.sector.subtitle, false, 3);
      this.pushLog(`descending: ${this.sector.name.toLowerCase()}`);
      this.ev.sound('sector');
    }
    this.setPhase('map');
    this.ev.changed();
  }

  summary(): RunSummary {
    const r = this.run;
    return {
      victory: r?.victory ?? false,
      score: this.score,
      best: this.best,
      newBest: this.newBest,
      seed: r?.seed ?? 0,
      seedStr: r?.seedStr ?? '----',
      sector: (r?.sector ?? 0) + 1,
      sectorName: this.sector.name,
      wave: r?.waveNo ?? 0,
      wavesCleared: r?.wavesCleared ?? 0,
      kills: r?.kills ?? 0,
      maxCombo: r?.maxCombo ?? 0,
      time: r?.time ?? 0,
      build: r ? r.build.map((b) => ({ ...b })) : [],
      synergies: SYNERGIES.filter((s) => this.syn.has(s.id)).map((s) => s.name),
    };
  }

  private endRun(victory: boolean): void {
    const r = this.run;
    if (r) r.victory = victory;
    if (this.score > this.best) {
      this.best = this.score;
      this.newBest = true;
      saveBest(this.score);
    }
    if (victory) this.ev.sound('victory');
    this.setPhase('summary');
    this.ev.changed();
  }

  // ================================================================ pools
  particle(kind: number, x: number, y: number, vx: number, vy: number, life: number, size: number, color: number, drag: number): void {
    const p = this.particles[this.pCur];
    this.pCur = (this.pCur + 1) % POOL_PARTICLES;
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
    const t = this.texts[this.tCur];
    this.tCur = (this.tCur + 1) % POOL_TEXTS;
    t.active = true;
    t.x = x;
    t.y = y;
    t.vy = big ? -22 : -42;
    t.life = t.max = big ? 1.3 : 0.6;
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
      const s = rand(40, 230);
      const roll = Math.random();
      const color = roll < 0.35 ? C_GRAY : roll < 0.65 ? C_ORANGE : roll < 0.88 ? C_RED : hot ? C_HOT : C_WHITE;
      this.particle(P_FRAG, x + Math.cos(a) * d, y + Math.sin(a) * d, Math.cos(a) * s + vx * 0.4, Math.sin(a) * s + vy * 0.4, rand(0.35, 0.9), rand(1.5, 2.4 + r * 0.1), color, 3.2);
    }
  }

  private addShake(v: number): void {
    const cap = this.reducedMotion ? 3 : 22;
    this.shake = Math.min(cap, this.shake + (this.reducedMotion ? v * 0.2 : v));
  }

  private say(t: string, sub: string, danger: boolean, dur: number): void {
    this.announce = t;
    this.announceSub = sub;
    this.announceDanger = danger;
    this.announceT = dur;
  }

  pushLog(text: string): void {
    this.log.push({ text, t: this.time });
    if (this.log.length > 6) this.log.shift();
  }

  private ebullet(kind: number, x: number, y: number, vx: number, vy: number): void {
    const b = this.ebullets[this.ebCur];
    this.ebCur = (this.ebCur + 1) % POOL_EBULLETS;
    b.active = true;
    b.kind = kind;
    b.x = x;
    b.y = y;
    b.vx = vx;
    b.vy = vy;
    b.r = kind === EB_ORB ? 6 : kind === EB_NEEDLE ? 4 : 4.5;
    b.life = 9;
    b.t = 0;
  }

  private aimed(kind: number, x: number, y: number, speed: number, spreadN: number, spread: number, baseA?: number): void {
    const a0 = baseA ?? Math.atan2(this.py - y, this.px - x);
    for (let i = 0; i < spreadN; i++) {
      const a = a0 + (spreadN === 1 ? 0 : (i / (spreadN - 1) - 0.5) * spread * (spreadN - 1));
      this.ebullet(kind, x, y, Math.cos(a) * speed, Math.sin(a) * speed);
    }
  }

  private arc(x1: number, y1: number, x2: number, y2: number): void {
    const a = this.arcs[this.aCur];
    this.aCur = (this.aCur + 1) % POOL_ARCS;
    a.active = true;
    a.x1 = x1;
    a.y1 = y1;
    a.x2 = x2;
    a.y2 = y2;
    a.life = 0.16;
    a.seed = (Math.random() * 1000) | 0;
  }

  // ================================================================ units
  private makeUnit(kind: EnemyKind, x: number, y: number, elite: boolean, sizeOverride?: number): Unit | null {
    if (this.units.length >= MAX_UNITS) return null;
    const ks = KIND_STATS[kind];
    const size = sizeOverride ?? ks.size * (elite ? 1.12 : 1);
    const e = createEnemy(kind, x, y, (Math.random() * 0x7fffffff) | 0, { size });
    if (e.kind === 'leech') e.auto = false;
    const hpMul = this.sector.hpMul * (elite ? 1.6 : 1);
    const hp = Math.max(1, Math.round(ks.hp * hpMul));
    const u: Unit = {
      id: this.nextId++,
      e,
      kind,
      state: U_ENTER,
      hp,
      maxHp: hp,
      r: ks.r * (elite ? 1.1 : 1),
      col: 0,
      row: 0,
      hasSlot: false,
      p0x: x, p0y: y, p1x: x, p1y: y, p2x: x, p2y: y, p3x: x, p3y: y,
      pt: 0,
      pdur: 1,
      toSlot: false,
      delay: 0,
      side: 1,
      t: 0,
      stateT: 0,
      shots: 0,
      shotT: 0,
      flash: 0,
      elite,
      score: Math.round(ks.score * (elite ? 1.6 : 1) * (1 + this.runSector() * 0.3)),
      contact: ks.contact * (elite ? 1.25 : 1),
      pulseHit: -1,
      dead: false,
      life: 0,
    };
    this.units.push(u);
    return u;
  }

  private runSector(): number {
    return this.run ? this.run.sector : 0;
  }

  slotX(u: Unit): number {
    const breath = 1 + 0.05 * Math.sin(this.formT * 1.1);
    return this.FW / 2 + u.col * this.formDx * breath + Math.sin(this.formT * 0.42) * this.swayAmp;
  }

  slotY(u: Unit): number {
    return this.formTop + u.row * this.formDy + Math.sin(this.formT * 1.1 + u.col * 0.4) * 3;
  }

  private setPath(u: Unit, x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, dur: number, toSlot: boolean): void {
    u.p0x = x0;
    u.p0y = y0;
    u.p1x = x1;
    u.p1y = y1;
    u.p2x = x2;
    u.p2y = y2;
    u.p3x = x3;
    u.p3y = y3;
    u.pt = 0;
    u.pdur = dur;
    u.toSlot = toSlot;
  }

  private entryPath(u: Unit, pat: EntryPattern, s: number): void {
    const cx = this.FW / 2;
    const FW = this.FW;
    const FH = this.FH;
    switch (pat) {
      case 'sweep':
        this.setPath(u, cx + s * (FW / 2 + 60), FH * 0.6, cx - s * FW * 0.05, FH * 0.8, cx - s * FW * 0.42, FH * 0.12, 0, 0, 2.6, true);
        break;
      case 'dive':
        this.setPath(u, cx + s * FW * 0.22, -60, cx + s * FW * 0.22, FH * 0.72, cx - s * FW * 0.38, FH * 0.6, 0, 0, 2.6, true);
        break;
      case 'arc':
        this.setPath(u, cx + s * (FW / 2 + 60), 100, cx - s * FW * 0.1, 20, cx - s * FW * 0.28, FH * 0.55, 0, 0, 2.4, true);
        break;
      case 'snake':
        this.setPath(u, cx - s * FW * 0.1, -60, cx + s * FW * 0.65, FH * 0.36, cx - s * FW * 0.65, FH * 0.5, 0, 0, 2.8, true);
        break;
    }
  }

  private beginWave(elite: boolean): void {
    const r = this.run;
    if (!r) return;
    this.resetCombat();
    const sec = this.sector;
    const idx = Math.min(sec.waves.length - 1, r.combatInSector);
    r.combatInSector++;
    r.waveNo++;
    const tmpl = sec.waves[idx];
    const rows = elite ? [sec.eliteExtra, ...tmpl.rows] : tmpl.rows.slice();
    const rng = new Rng(deriveSeed(r.seed, 1000 + r.sector * 64 + (r.current ? r.current.row : 0)));
    let maxCols = 0;
    for (const row of rows) maxCols = Math.max(maxCols, row.cols);
    this.formDx = Math.min(58, (this.FW - 70) / Math.max(1, maxCols));
    this.formDy = rows.length > 4 ? 40 : 46;
    this.formTop = 104;
    this.swayAmp = clamp((this.FW - maxCols * this.formDx) / 2 - 12, 0, 46);
    this.formT = 0;
    this.batchRows = rows;
    this.batchEntries = tmpl.entries;
    this.batchRng = rng;
    this.batchesLeft = (idx >= 2 ? 2 : 1) + (elite ? 1 : 0);
    this.waveClock = 0;
    this.waveTotal = 0;
    const total = this.spawnBatch(0);
    this.waveActive = true;
    this.waveElite = elite;
    this.isBoss = false;
    this.diveT = 4.5;
    this.fireDirT = 3;
    this.hitThisWave = false;
    const label = `SECTOR ${r.sector + 1} // WAVE ${r.combatInSector}`;
    if (elite) {
      this.say(FLAVOR.elite[rng.int(0, FLAVOR.elite.length - 1)], label, true, 2.4);
      this.sfx('boss');
    } else {
      this.say(FLAVOR.wave[rng.int(0, FLAVOR.wave.length - 1)], label, false, 2.2);
      this.sfx('wave');
    }
    this.pushLog(`${elite ? 'elite ' : ''}intrusion: ${total} processes`);
    this.setPhase('playing');
  }

  private batchRows: RowDef[] = [];
  private batchEntries: EntryPattern[] = [];
  private batchRng: Rng = new Rng(1);
  batchesLeft = 0;
  private waveClock = 0;

  /** Spawns one formation pass into the free slots; returns the unit count. */
  private spawnBatch(pass: number): number {
    const rows = this.batchRows;
    const rng = this.batchRng;
    const elite = this.waveElite;
    const taken = new Set<string>();
    for (const u of this.units) if (!u.dead && u.hasSlot) taken.add(`${u.row}:${u.col}`);
    let total = 0;
    const flip = rng.chance(0.5) ? 1 : -1;
    // later passes enter bottom rows first so they reach the player sooner
    const order = rows.map((_, i) => i);
    if (pass > 0) order.reverse();
    order.forEach((ri, oi) => {
      const row = rows[ri];
      const pat = this.batchEntries[(ri + pass + (elite ? 1 : 0)) % this.batchEntries.length];
      const half = Math.ceil(row.cols / 2);
      for (let c = 0; c < row.cols; c++) {
        const col = c - (row.cols - 1) / 2;
        if (taken.has(`${ri}:${col}`)) continue;
        const side = (c < half ? -1 : 1) * flip;
        const k = c < half ? c : c - half;
        const u = this.makeUnit(row.kind, -200, -200, elite && (ri === 0 || rng.chance(0.25)));
        if (!u) continue;
        u.col = col;
        u.row = ri;
        u.hasSlot = true;
        u.side = side;
        u.state = U_ENTER;
        u.delay = (pass ? 0.2 : 0.6) + oi * 1.1 + (side === flip ? 0 : 0.55) + k * 0.13;
        this.entryPath(u, pat, side);
        u.e.x = u.p0x;
        u.e.y = u.p0y;
        total++;
      }
    });
    this.waveTotal += total;
    return total;
  }

  private startDive(u: Unit, skipTell = false): void {
    const e = u.e;
    const s = e.x < this.FW / 2 ? -1 : 1;
    const tx = clamp(this.px + rand(-40, 40), 40, this.FW - 40);
    const spd = 1 + this.runSector() * 0.12;
    if (u.kind === 'crawler' && !skipTell) {
      crawlerLunge(e as EN.Crawler);
      u.state = U_TELL;
      u.stateT = 0;
      return;
    }
    if (u.kind === 'leech') {
      u.state = U_SEEK;
      u.stateT = 0;
      return;
    }
    if (u.kind === 'wraith') {
      wraithStrike(e as EN.Wraith);
      u.state = U_GHOST;
      u.stateT = 0;
      u.shots = 0;
      return;
    }
    u.state = U_DIVE;
    u.stateT = 0;
    u.shots = 0;
    u.shotT = rand(0.4, 0.9);
    if (u.kind === 'sentinel') {
      // slow strafing descent that holds mid-screen
      this.setPath(u, e.x, e.y, e.x + s * 90, e.y + 60, tx - s * 120, this.FH * 0.5, tx + s * 140, this.FH + 70, 4.4 / spd, false);
    } else if (u.kind === 'swarm') {
      this.setPath(u, e.x, e.y, e.x - s * 160, e.y + this.FH * 0.3, tx + s * 160, this.FH * 0.55, tx - s * 40, this.FH + 70, 3.0 / spd, false);
    } else {
      this.setPath(u, e.x, e.y, e.x + s * 110, e.y - 50, tx + s * 70, this.FH * 0.62, tx - s * 60, this.FH + 70, 2.5 / spd, false);
    }
  }

  private returnToSlot(u: Unit): void {
    const e = u.e;
    u.state = U_RETURN;
    u.stateT = 0;
    if (u.hasSlot) {
      this.setPath(u, e.x, e.y, e.x, e.y - 70, this.slotX(u), this.slotY(u) + 90, 0, 0, 1.8, true);
    } else {
      const hx = rand(80, this.FW - 80);
      const hy = rand(150, 260);
      this.setPath(u, e.x, e.y, e.x, e.y - 60, hx, hy + 80, hx, hy, 1.8, false);
    }
  }

  private wrapToTop(u: Unit): void {
    const e = u.e;
    const x = u.hasSlot ? this.slotX(u) : rand(80, this.FW - 80);
    e.x = x;
    e.y = -70;
    e.vx = 0;
    e.vy = 60;
    u.state = U_RETURN;
    u.stateT = 0;
    if (u.hasSlot) this.setPath(u, x, -70, x, 20, this.slotX(u), this.slotY(u) - 50, 0, 0, 1.5, true);
    else {
      const hy = rand(150, 260);
      this.setPath(u, x, -70, x, 40, x, hy - 40, x, hy, 1.5, false);
    }
  }

  private tangible(u: Unit): boolean {
    if (u.dead || u.delay > 0 || u.state === U_SPLIT) return false;
    const e = u.e;
    if (!e.alive) return false;
    if (e.kind === 'wraith' && e.vis < 0.45) return false;
    if (u.state === U_BOSS && this.bs && (this.bs.inv > 0 || this.bs.entering > 0 || this.bs.dying >= 0)) return false;
    return e.y > -30;
  }

  /** Wraith is visible but intangible (for bullets passing through). */
  private updateUnits(dt: number): void {
    const target = tmpV;
    target.x = this.px;
    target.y = this.py;
    const FH = this.FH;
    let latched = 0;
    for (let i = 0; i < this.units.length; i++) {
      const u = this.units[i];
      if (u.dead) continue;
      if (u.delay > 0) {
        u.delay -= dt;
        if (u.delay > 0) continue;
      }
      const e = u.e;
      u.t += dt;
      u.stateT += dt;
      u.flash = Math.max(0, u.flash - dt);
      let auth = 0;
      let dx = 0;
      let dy = 0;
      let useIntent = true;
      // suppress library auto-behaviours we schedule ourselves
      if (e.kind === 'sentinel' && e.mode === 0) e.dur = 1e9;
      if (e.kind === 'wraith' && e.mode === 0 && u.state !== U_GHOST) e.modeT = 0;

      switch (u.state) {
        case U_ENTER: {
          u.pt += dt / u.pdur;
          const t = Math.min(1, u.pt);
          const sx = this.slotX(u);
          const sy = this.slotY(u);
          dx = bez(t, u.p0x, u.p1x, u.p2x, sx);
          dy = bez(t, u.p0y, u.p1y, u.p2y, sy);
          auth = 12;
          if (u.pt >= 1) {
            u.state = U_FORM;
            u.stateT = 0;
          }
          break;
        }
        case U_FORM:
          if (u.hasSlot) {
            dx = this.slotX(u);
            dy = this.slotY(u);
          } else {
            dx = u.p3x + Math.sin(u.t * 0.9 + u.id) * 24;
            dy = u.p3y + Math.sin(u.t * 1.3 + u.id) * 8;
          }
          auth = 7;
          break;
        case U_TELL: {
          // crawler freeze -> lunge, then break into a dive
          useIntent = false;
          if ((e.kind === 'crawler' && e.mode === 0 && u.stateT > 0.25) || u.stateT > 2.5) this.startDive(u, true);
          break;
        }
        case U_DIVE:
        case U_RETURN: {
          u.pt += dt / u.pdur;
          const t = Math.min(1, u.pt);
          const ex = u.toSlot ? this.slotX(u) : u.p3x;
          const ey = u.toSlot ? this.slotY(u) : u.p3y;
          dx = bez(t, u.p0x, u.p1x, u.p2x, ex);
          dy = bez(t, u.p0y, u.p1y, u.p2y, ey);
          auth = 10;
          if (u.state === U_DIVE) {
            this.diveFire(u, dt);
            if (u.pt >= 1) this.wrapToTop(u);
          } else if (u.pt >= 1) {
            if (u.hasSlot) {
              u.state = U_FORM;
              u.stateT = 0;
            } else {
              u.state = U_FORM;
              u.stateT = 0;
              u.p3x = dx;
              u.p3y = dy;
            }
          }
          break;
        }
        case U_SEEK: {
          // leech homing on the player, then latch
          if (e.kind !== 'leech') break;
          const ddx = this.px - e.x;
          const ddy = this.py - e.y;
          const d = Math.hypot(ddx, ddy) || 1;
          const sp = 150 + this.runSector() * 20;
          intentV.x = (ddx / d) * sp + Math.sin(u.t * 3) * 40;
          intentV.y = (ddy / d) * sp;
          if (e.mode !== 0) useIntent = false;
          if (e.mode === 0 && d < 70 && u.stateT > 0.4 && this.dashT <= 0) leechToggleLatch(e);
          if (leechIsLatched(e)) {
            u.state = U_LATCH;
            u.stateT = 0;
            this.sfx('latch');
            this.say(FLAVOR.latch, 'INTEGRITY DRAINING', true, 1.6);
            this.pushLog('leech latched');
          } else if (u.stateT > 6) {
            u.state = U_DIVE;
            this.setPath(u, e.x, e.y, e.x, e.y + 80, e.x, FH * 0.9, e.x, FH + 80, 1.4, false);
          }
          break;
        }
        case U_LATCH: {
          useIntent = false;
          if (e.kind === 'leech' && !leechIsLatched(e)) {
            this.returnToSlot(u);
          } else {
            latched++;
            this.drain(dt * (8 + this.runSector() * 2));
          }
          break;
        }
        case U_GHOST: {
          useIntent = false;
          if (e.kind !== 'wraith') break;
          if (e.mode === 3 && u.shots === 0) {
            u.shots = 1;
            // materialise next to the player and strike
            this.aimed(EB_NEEDLE, e.x, e.y, this.sector.bulletSpeed * 1.25, 3 + this.runSector(), 0.2);
            this.sfx('enemyShot');
            this.particle(P_RING, e.x, e.y, 60, 0, 0.3, 10, C_RED, 0);
          }
          if (e.mode === 0 && u.stateT > 0.5) this.returnToSlot(u);
          else if (u.stateT > 5) this.returnToSlot(u);
          break;
        }
        case U_FREE: {
          useIntent = false;
          u.life -= dt;
          if (u.life <= 0) {
            useIntent = true;
            intentV.x = 0;
            intentV.y = 260;
            if (e.y > FH + 40) u.dead = true;
          }
          break;
        }
        case U_SPLIT: {
          useIntent = false;
          if (e.kind === 'swarm' && e.spawned) {
            for (const f of e.spawned) {
              if (this.units.length >= MAX_UNITS) break;
              const hp = Math.max(1, Math.round(KIND_STATS.fragment.hp * this.sector.hpMul));
              const fu: Unit = {
                ...this.blankUnit(f, 'fragment'),
                hp,
                maxHp: hp,
                state: U_FREE,
                life: rand(5, 8),
              };
              this.units.push(fu);
            }
            e.spawned = null;
          }
          if (e.done) u.dead = true;
          break;
        }
        case U_BOSS:
          this.updateBossUnit(u, dt);
          continue;
      }

      if (auth > 0) {
        intentV.x = clamp((dx - e.x) * 6, -700, 700);
        intentV.y = clamp((dy - e.y) * 6, -700, 700);
      }
      updateEnemy(e, dt, target, useIntent && (auth > 0 || u.state === U_SEEK || u.state === U_FREE) ? intentV : null);
      if (auth > 0) {
        const k = damp(auth, dt);
        e.x += (dx - e.x) * k;
        e.y += (dy - e.y) * k;
      }
      if (u.state === U_FORM && (e.kind === 'crawler' || e.kind === 'leech')) e.heading = turnToward(e.heading, Math.PI / 2, 2.5 * dt);

      // sentinel shots
      if (e.kind === 'sentinel' && e.fired) {
        sentinelMuzzle(e, tmpV);
        const sp = this.sector.bulletSpeed;
        this.aimed(EB_ORB, tmpV.x, tmpV.y, sp, u.elite ? 3 : 1, 0.2, e.aim);
        this.sfx('enemyShot');
        target.x = this.px;
        target.y = this.py;
      }
      // keep free/latch units on the field
      if (u.state === U_FREE && u.life > 0) {
        e.x = clamp(e.x, 10, this.FW - 10);
        e.y = clamp(e.y, -20, FH - 10);
      }
    }
    this.latchedCount = latched;
  }

  private blankUnit(e: Enemy, kind: EnemyKind): Unit {
    const ks = KIND_STATS[kind];
    return {
      id: this.nextId++,
      e,
      kind,
      state: U_FREE,
      hp: ks.hp,
      maxHp: ks.hp,
      r: ks.r,
      col: 0,
      row: 0,
      hasSlot: false,
      p0x: 0, p0y: 0, p1x: 0, p1y: 0, p2x: 0, p2y: 0, p3x: 0, p3y: 0,
      pt: 0,
      pdur: 1,
      toSlot: false,
      delay: 0,
      side: 1,
      t: 0,
      stateT: 0,
      shots: 0,
      shotT: 0,
      flash: 0,
      elite: false,
      score: ks.score,
      contact: ks.contact,
      pulseHit: -1,
      dead: false,
      life: 6,
    };
  }

  private diveFire(u: Unit, dt: number): void {
    if (u.kind === 'sentinel') {
      const e = u.e;
      if (e.kind === 'sentinel' && e.mode === 0 && u.shots < 2 && e.y > 120 && e.y < this.FH * 0.6) {
        u.shotT -= dt;
        if (u.shotT <= 0) {
          sentinelCharge(e);
          u.shots++;
          u.shotT = 1.6;
        }
      }
      return;
    }
    if (this.runSector() === 0 && !u.elite) return;
    if (u.shots > 0 || u.e.y < this.FH * 0.25 || u.e.y > this.FH * 0.55) return;
    u.shotT -= dt;
    if (u.shotT <= 0) {
      u.shots++;
      this.aimed(EB_PELLET, u.e.x, u.e.y + 8, this.sector.bulletSpeed, u.elite ? 3 : 1, 0.22);
      this.sfx('enemyShot');
    }
  }

  private director(dt: number): void {
    if (!this.waveActive || this.clearT >= 0) return;
    let inForm = 0;
    let diving = 0;
    let alive = 0;
    for (const u of this.units) {
      if (u.dead || u.state === U_BOSS) continue;
      if (u.delay > 0) {
        alive++;
        continue;
      }
      alive++;
      if (u.state === U_FORM) inForm++;
      else if (u.state === U_DIVE || u.state === U_TELL || u.state === U_SEEK || u.state === U_GHOST || u.state === U_LATCH) diving++;
    }
    this.waveClock += dt;
    if (!this.isBoss && this.batchesLeft > 0) {
      const passAlive = this.waveTotal > 0 ? alive / this.waveTotal : 0;
      if (passAlive < 0.3 || this.waveClock > 24) {
        this.batchesLeft--;
        this.waveClock = 0;
        const pass = (this.waveElite ? 3 : 2) - this.batchesLeft;
        this.waveTotal = alive;
        const n = this.spawnBatch(pass);
        if (n > 0) {
          this.say('REINFORCEMENTS', `${n} PROCESSES INBOUND`, true, 1.4);
          this.pushLog(`reinforcements: ${n}`);
          this.sfx('wave');
        }
        alive += n;
      }
    }
    const frac = this.waveTotal > 0 ? alive / this.waveTotal : 1;
    const sec = this.sector;
    this.diveT -= dt;
    const maxDivers = this.isBoss ? 4 : sec.maxDivers + (frac < 0.35 ? 1 : 0);
    if (this.diveT <= 0 && inForm > 0 && diving < maxDivers) {
      this.diveT = sec.diveGap * (0.45 + 0.55 * frac) * rand(0.7, 1.3) * (this.isBoss ? 1.4 : 1);
      const n = Math.min(maxDivers - diving, frac < 0.5 ? 2 : 1 + (Math.random() < 0.35 ? 1 : 0));
      for (let k = 0; k < n; k++) {
        const cands = this.units.filter((u) => !u.dead && u.state === U_FORM && u.delay <= 0 && u.stateT > 0.8);
        if (!cands.length) break;
        // prefer the lower rows (closest to the player)
        cands.sort((a, b) => b.row - a.row + (Math.random() - 0.5) * 2.5);
        this.startDive(cands[0]);
      }
    }
    // sentinel fire control
    this.fireDirT -= dt;
    if (this.fireDirT <= 0) {
      const sents = this.units.filter((u) => !u.dead && u.delay <= 0 && u.e.kind === 'sentinel' && u.state === U_FORM && u.e.mode === 0);
      this.fireDirT = sec.fireGap * rand(0.6, 1.3) * (sents.length > 5 ? 0.8 : 1) * (this.isBoss ? 1.6 : 1);
      if (sents.length) {
        const s = sents[(Math.random() * sents.length) | 0];
        if (s.e.kind === 'sentinel') sentinelCharge(s.e);
      }
    }
  }

  // ================================================================ boss
  private beginBoss(): void {
    const r = this.run;
    if (!r) return;
    this.resetCombat();
    r.waveNo++;
    const def = this.sector.boss;
    const u = this.makeUnit('boss', this.FW / 2, -def.size, false, def.size);
    if (!u) return;
    const e = u.e as Boss;
    u.hp = u.maxHp = def.hp;
    u.r = def.size * 0.3;
    u.state = U_BOSS;
    u.score = 5000 * (r.sector + 1);
    u.contact = 30;
    e.dur = 1e9;
    e.reachCd = 1e9;
    this.boss = u;
    this.bs = {
      def,
      phase: 0,
      attack: null,
      atkT: 0,
      atkStep: 0,
      atkIdx: 0,
      gap: 2.2,
      inv: 0,
      entering: 3.2,
      sweep: false,
      laser: 0,
      laserX: this.FW / 2,
      reachNext: 0,
      dying: -1,
      spin: 0,
    };
    this.waveActive = true;
    this.isBoss = true;
    this.batchesLeft = 0;
    this.waveTotal = 1;
    this.waveElite = false;
    this.diveT = 4;
    this.fireDirT = 4;
    this.hitThisWave = false;
    this.formDx = 56;
    this.formDy = 46;
    this.formTop = 300;
    this.swayAmp = 30;
    this.say(FLAVOR.boss, `${def.name} // ${def.title}`, true, 3);
    this.sfx('boss');
    this.pushLog(`breach: ${def.name.toLowerCase()}`);
    this.setPhase('playing');
  }

  private updateBossUnit(u: Unit, dt: number): void {
    const bs = this.bs;
    const e = u.e;
    if (!bs || e.kind !== 'boss') return;
    const def = bs.def;
    const target = tmpV;
    target.x = this.px;
    target.y = this.py;
    e.dur = 1e9;
    if (!bs.sweep) e.reachCd = 1e9;

    // movement
    let hx = this.FW / 2 + Math.sin(this.time * 0.37) * this.FW * 0.24;
    let hy = 175 + Math.sin(this.time * 0.74) * 18;
    let k = 1.6;
    if (bs.entering > 0) {
      bs.entering -= dt;
      hx = this.FW / 2;
      hy = 175;
      k = 1.1;
    } else if (bs.sweep) {
      hx = clamp(this.px, 120, this.FW - 120);
      hy = this.FH * 0.36;
      k = 1.4;
    } else if (bs.laser > 0) {
      k = 0.6;
    }
    intentV.x = clamp((hx - e.x) * 2, -300, 300);
    intentV.y = clamp((hy - e.y) * 2, -300, 300);
    updateEnemy(e, dt, target, intentV);
    const kk = damp(k, dt);
    e.x += (hx - e.x) * kk;
    e.y += (hy - e.y) * kk;

    if (bs.dying >= 0) {
      bs.dying += dt;
      if (Math.random() < dt * 14) {
        const a = Math.random() * TAU;
        const d = Math.random() * u.r;
        this.shatter(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, 20, 10, 0, 0, true);
        this.particle(P_RING, e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, 90, 0, 0.35, 8, C_RED, 0);
        this.addShake(3);
        this.sfx('death');
      }
      if (bs.dying > 1.6) this.finishBoss(u);
      return;
    }
    if (bs.inv > 0) bs.inv -= dt;
    if (bs.entering > 0) return;

    // phase transitions
    const frac = u.hp / u.maxHp;
    if (bs.phase < def.phases.length && frac <= def.phases[bs.phase]) {
      bs.phase++;
      setBossPhase(e, 2);
      bs.inv = 1.4;
      bs.attack = null;
      bs.sweep = false;
      bs.laser = 0;
      bs.gap = 1.6;
      this.clearEnemyBullets();
      this.hitstop = Math.max(this.hitstop, 0.18);
      this.addShake(16);
      for (let i = 0; i < 6; i++) this.particle(P_GLITCH, e.x + rand(-u.r, u.r), e.y + rand(-u.r, u.r), 0, 0, rand(0.1, 0.3), rand(60, 200), C_RED, 0);
      this.particle(P_RING, e.x, e.y, 400, 0, 0.6, u.r, C_ORANGE, 0);
      this.say(bs.phase === 1 ? 'SHELL FRACTURED' : 'CORE EXPOSED', `${def.name} // PHASE ${bs.phase + 1}`, true, 2.2);
      this.ev.sound('boss');
      this.pushLog(`${def.name.toLowerCase()} phase ${bs.phase + 1}`);
      this.bossSummon(u, 2 + bs.phase);
      return;
    }

    // attacks
    if (!bs.attack) {
      bs.gap -= dt;
      if (bs.gap <= 0) {
        const list = def.attacks[Math.min(bs.phase, def.attacks.length - 1)];
        bs.attack = list[bs.atkIdx % list.length];
        bs.atkIdx++;
        bs.atkT = 0;
        bs.atkStep = 0;
        bs.spin = Math.random() * TAU;
        if (bs.attack === 'ring' || bs.attack === 'laser') bossCharge(e);
        if (bs.attack === 'laser') {
          bs.laser = 1;
          bs.laserX = e.x;
        }
        if (bs.attack === 'sweep') {
          bs.sweep = true;
          bs.reachNext = 0.6;
          this.say('TENDRIL SWEEP', 'EVADE', true, 1.2);
        }
      }
    } else {
      this.runAttack(u, e, bs, dt);
    }

    // tendril damage during sweeps
    if (bs.sweep && this.dying < 0) {
      for (const td of e.tendrils) {
        for (let i = 2; i < td.n; i += 2) {
          const ddx = td.x[i] - this.px;
          const ddy = td.y[i] - this.py;
          if (ddx * ddx + ddy * ddy < 14 * 14) {
            this.hurtPlayer(14, td.x[i], td.y[i]);
            break;
          }
        }
      }
    }
    // laser
    if (bs.laser > 0) {
      const tx = this.px;
      bs.laserX += clamp(tx - bs.laserX, -1, 1) * (bs.laser === 1 ? 90 : 55 + bs.phase * 15) * dt;
      if (bs.laser === 2 && Math.abs(this.px - bs.laserX) < 20 && this.py > e.y) this.hurtPlayer(20, this.px, this.py - 10);
    }
  }

  private runAttack(u: Unit, e: Boss, bs: BossState, dt: number): void {
    bs.atkT += dt;
    const t = bs.atkT;
    const sp = bs.def.bulletSpeed * (1 + bs.phase * 0.08);
    const ph = bs.phase;
    const end = (gap: number) => {
      bs.attack = null;
      bs.gap = bs.def.attackGap * gap * (1 - ph * 0.12);
    };
    switch (bs.attack) {
      case 'ring': {
        const bursts = 2 + (ph > 0 ? 1 : 0);
        const at = 1.1 + bs.atkStep * 0.42;
        if (bs.atkStep < bursts && t >= at) {
          const n = 16 + ph * 6;
          const off = bs.spin + bs.atkStep * (Math.PI / n);
          for (let i = 0; i < n; i++) {
            const a = off + (i / n) * TAU;
            this.ebullet(EB_PELLET, e.x + Math.cos(a) * u.r * 0.6, e.y + Math.sin(a) * u.r * 0.6, Math.cos(a) * sp * 0.8, Math.sin(a) * sp * 0.8);
          }
          bs.atkStep++;
          this.sfx('enemyShot');
          this.addShake(2);
        }
        if (t > 1.1 + bursts * 0.42) end(1);
        break;
      }
      case 'fan': {
        const volleys = 4 + ph;
        if (bs.atkStep < volleys && t >= 0.3 + bs.atkStep * 0.3) {
          this.aimed(EB_ORB, e.x, e.y + u.r * 0.5, sp, 5 + ph * 2, 0.13);
          bs.atkStep++;
          this.sfx('enemyShot');
        }
        if (t > 0.5 + volleys * 0.3) end(1);
        break;
      }
      case 'spiral': {
        const dur = 2.6 + ph * 0.6;
        const arms = 2 + ph;
        const step = 0.075;
        while (bs.atkStep * step < Math.min(t, dur)) {
          const a0 = bs.spin + bs.atkStep * step * (2.4 + ph * 0.5);
          for (let k = 0; k < arms; k++) {
            const a = a0 + (k / arms) * TAU;
            this.ebullet(EB_PELLET, e.x, e.y, Math.cos(a) * sp * 0.72, Math.sin(a) * sp * 0.72);
          }
          bs.atkStep++;
        }
        if (bs.atkStep % 6 === 0) this.sfx('enemyShot');
        if (t > dur) end(1.1);
        break;
      }
      case 'sweep': {
        bs.reachNext -= dt;
        if (bs.reachNext <= 0) {
          bs.reachNext = 0.34 - ph * 0.05;
          e.reachIdx = bs.atkStep % e.tendrils.length;
          e.reachT = 0;
          bs.atkStep++;
          const td = e.tendrils[e.reachIdx];
          const tipX = td.x[td.n - 1];
          const tipY = td.y[td.n - 1];
          this.aimed(EB_NEEDLE, tipX, tipY, sp * 0.9, 1 + ph, 0.25);
        }
        if (t > 3.6 + ph * 0.6) {
          bs.sweep = false;
          e.reachIdx = -1;
          end(1.2);
        }
        break;
      }
      case 'laser': {
        if (bs.laser === 1 && t > 1.2) {
          bs.laser = 2;
          this.sfx('laser');
          this.addShake(6);
        }
        if (bs.laser === 2) {
          if (Math.random() < dt * 30) this.sparks(bs.laserX + rand(-12, 12), this.FH - rand(0, 40), -Math.PI / 2, 1.2, 1, 60, 220, C_ORANGE);
          if (Math.random() < dt * 4 && ph > 0) this.aimed(EB_PELLET, e.x, e.y, sp * 0.8, 3, 0.4);
        }
        if (t > 2.9 + ph * 0.3) {
          bs.laser = 0;
          end(1.1);
        }
        break;
      }
      case 'summon':
        if (bs.atkStep === 0) {
          bs.atkStep = 1;
          this.bossSummon(u, 3 + ph * 2);
        }
        if (t > 0.8) end(1.4);
        break;
      case 'rain': {
        const dur = 2.6;
        const step = 0.07 - ph * 0.01;
        while (bs.atkStep * step < Math.min(t, dur)) {
          const x = rand(20, this.FW - 20);
          this.ebullet(EB_NEEDLE, x, -10, rand(-20, 20), sp * rand(0.7, 1.0));
          bs.atkStep++;
        }
        if (t > dur) end(1);
        break;
      }
      default:
        end(1);
    }
  }

  private bossSummon(u: Unit, n: number): void {
    const def = this.bs?.def;
    if (!def) return;
    let living = 0;
    for (const x of this.units) if (!x.dead && x.state !== U_BOSS) living++;
    const count = Math.min(n, 14 - living);
    for (let i = 0; i < count; i++) {
      const kind = def.summon[(Math.random() * def.summon.length) | 0];
      const s = i % 2 === 0 ? -1 : 1;
      const m = this.makeUnit(kind, u.e.x, u.e.y, false);
      if (!m) break;
      m.hasSlot = false;
      m.state = U_RETURN;
      const hx = this.FW / 2 + s * rand(80, this.FW / 2 - 40);
      const hy = rand(230, 330);
      this.setPath(m, u.e.x, u.e.y, u.e.x + s * 140, u.e.y + 40, hx, hy - 90, hx, hy, 1.4 + i * 0.1, false);
      this.particle(P_HEX, u.e.x, u.e.y, 40, 0, 0.3, 12, C_ORANGE, 0);
    }
    this.waveTotal = Math.max(this.waveTotal, count + 1);
  }

  private finishBoss(u: Unit): void {
    const r = this.run;
    u.dead = true;
    const e = u.e;
    this.shatter(e.x, e.y, u.r, 160, 0, 0, true);
    for (let i = 0; i < 4; i++) this.particle(P_RING, e.x, e.y, 300 + i * 160, 0, 0.6 + i * 0.2, u.r * 0.5, i % 2 ? C_RED : C_ORANGE, 0);
    this.particle(P_HEX, e.x, e.y, 260, 0, 0.7, u.r, C_WHITE, 0);
    this.sparks(e.x, e.y, 0, TAU, 50, 150, 600, C_ORANGE);
    this.addShake(24);
    this.hitstop = Math.max(this.hitstop, 0.3);
    this.sfx('bigDeath');
    for (const m of this.units) if (!m.dead && m !== u) this.killUnit(m, false);
    this.clearEnemyBullets();
    this.boss = null;
    if (r) {
      this.score += u.score * this.mult;
      r.kills++;
    }
    this.say(`${this.bs?.def.name ?? 'CORE'} PURGED`, 'SECTOR SECURED', false, 2.6);
    this.pushLog('sector intelligence purged');
  }

  private clearEnemyBullets(): void {
    for (const b of this.ebullets) {
      if (!b.active) continue;
      b.active = false;
      if (Math.random() < 0.4) this.particle(P_EMBER, b.x, b.y, 0, 0, 0.25, 10, C_RED, 0);
    }
  }

  // ================================================================ damage
  private hitUnit(u: Unit, dmg: number, crit: boolean, x: number, y: number, chain: number): void {
    if (u.dead) return;
    u.hp -= dmg;
    u.flash = 0.08;
    if (hurtHook) hurtHook(u.e, x, y);
    if (crit) this.text(x, y - 8, `${Math.round(dmg * 10)}`, C_WHITE, false);
    if (u.hp <= 0) this.killUnit(u, true);
    if (chain > 0) this.chainFrom(u, x, y, dmg * this.stats.chainDmg, chain);
  }

  private chainFrom(src: Unit, x: number, y: number, dmg: number, jumps: number): void {
    let cx = x;
    let cy = y;
    let last = src.id;
    const hit: number[] = [src.id];
    for (let j = 0; j < jumps; j++) {
      let best: Unit | null = null;
      let bd = 150 * 150;
      for (const u of this.units) {
        if (u.dead || hit.includes(u.id) || !this.tangible(u)) continue;
        const ddx = u.e.x - cx;
        const ddy = u.e.y - cy;
        const d = ddx * ddx + ddy * ddy;
        if (d < bd) {
          bd = d;
          best = u;
        }
      }
      if (!best) break;
      this.arc(cx, cy, best.e.x, best.e.y);
      hit.push(best.id);
      last = best.id;
      cx = best.e.x;
      cy = best.e.y;
      this.sparks(cx, cy, 0, TAU, 3, 60, 200, C_WHITE);
      this.hitUnit(best, dmg, false, cx, cy, 0);
    }
    if (last !== src.id) this.sfx('zap');
  }

  private killUnit(u: Unit, byPlayer: boolean): void {
    if (u.dead) return;
    const e = u.e;
    if (u.state === U_BOSS) {
      if (this.bs && this.bs.dying < 0) {
        this.bs.dying = 0;
        this.bs.attack = null;
        this.bs.laser = 0;
        this.bs.sweep = false;
        this.hitstop = Math.max(this.hitstop, 0.25);
        this.addShake(14);
        this.clearEnemyBullets();
        this.ev.sound('bigDeath');
      }
      return;
    }
    if (e.kind === 'swarm' && e.alive && e.splitT < 0) {
      beginSplit(e);
      u.state = U_SPLIT;
    } else {
      u.dead = true;
      e.alive = false;
      if (killHook) killHook(e);
    }
    const big = u.kind === 'sentinel' || u.kind === 'wraith' || u.kind === 'swarm' || u.elite;
    const sz = e.size * 0.35;
    this.shatter(e.x, e.y, sz, u.kind === 'fragment' ? 6 : big ? 26 : 16, e.vx, e.vy, u.elite);
    this.particle(P_HEX, e.x, e.y, sz * 2.4, 0, 0.3, sz * 0.6, C_ORANGE, 0);
    this.particle(P_RING, e.x, e.y, sz * 3.4, 0, 0.26, sz * 0.4, C_RED, 0);
    this.particle(P_EMBER, e.x, e.y, 0, 0, 0.3, sz * 2.2, C_RED, 0);
    if (Math.random() < 0.6) this.particle(P_GLITCH, e.x + rand(-sz, sz), e.y + rand(-sz, sz), 0, 0, rand(0.08, 0.16), sz * rand(2, 4), C_ORANGE, 0);
    this.sparks(e.x, e.y, 0, TAU, 5, 120, 380, C_ORANGE);
    if (this.phase !== 'playing') return;
    this.addShake(big ? 4 : 1.6);
    if (big) this.hitstop = Math.max(this.hitstop, u.elite ? 0.05 : 0.025);
    this.sfx(big ? 'bigDeath' : 'death');
    if (!byPlayer || this.dying >= 0) return;
    const r = this.run;
    if (r) r.kills++;
    this.combo++;
    if (r) r.maxCombo = Math.max(r.maxCombo, this.combo);
    this.comboT = this.stats.comboTime;
    const nm = Math.min(this.stats.comboCap, 1 + Math.floor(this.combo / 8));
    if (nm > this.mult) {
      this.text(this.px, this.py - 60, `x${nm} CHAIN`, nm >= 6 ? C_WHITE : C_ORANGE, true);
      this.sfx('combo');
    }
    this.mult = nm;
    const pts = u.score * this.mult;
    this.score += pts;
    if (u.kind !== 'fragment') this.text(e.x, e.y - e.size * 0.3, `+${pts}`, C_GRAY, false);
    if (this.stats.lifesteal > 0) this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.lifesteal);
    this.maybeDrop(e.x, e.y, u.elite);
    if (this.stats.cascade > 0) this.cascade(e.x, e.y, u.id);
  }

  private cascade(x: number, y: number, srcId: number): void {
    const R = 58;
    const dmg = this.stats.dmg * this.stats.cascade;
    this.particle(P_RING, x, y, R, 0, 0.25, 6, C_HOT, 0);
    this.particle(P_EMBER, x, y, 0, 0, 0.22, R * 1.4, C_ORANGE, 0);
    const hits: Unit[] = [];
    for (const u of this.units) {
      if (u.id === srcId || !this.tangible(u)) continue;
      const ddx = u.e.x - x;
      const ddy = u.e.y - y;
      if (ddx * ddx + ddy * ddy < (R + u.r) * (R + u.r)) hits.push(u);
    }
    const storm = this.syn.has('cascadeArc');
    for (const u of hits) {
      if (storm) this.arc(x, y, u.e.x, u.e.y);
      this.hitUnit(u, dmg, false, u.e.x, u.e.y, storm ? 1 : 0);
    }
  }

  private maybeDrop(x: number, y: number, elite: boolean): void {
    const chance = 0.055 * this.stats.dropRate * (elite ? 2.2 : 1) * (this.isBoss ? 0.6 : 1);
    if (Math.random() > chance) return;
    const opts = this.stats.permOverclock ? [PK_RAPID, PK_OVERCLOCK, PK_REPAIR] : [PK_RAPID, PK_SHIELD, PK_OVERCLOCK, PK_REPAIR, PK_RAPID];
    this.spawnPickup(opts[(Math.random() * opts.length) | 0], x, y);
  }

  private spawnPickup(kind: number, x: number, y: number): void {
    const p = this.pickups[this.pkCur];
    this.pkCur = (this.pkCur + 1) % POOL_PICKUPS;
    p.active = true;
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = rand(-30, 30);
    p.vy = -40;
    p.life = 12;
    p.t = 0;
  }

  private hurtPlayer(dmg: number, x: number, y: number): void {
    if (this.dying >= 0 || this.inv > 0 || this.dashT > 0 || this.phase !== 'playing') return;
    if (this.buffShield > 0) {
      this.inv = 0.25;
      this.sparks(x, y, Math.atan2(y - this.py, x - this.px), 1.4, 8, 80, 260, C_WHITE);
      this.sfx('shieldHit');
      return;
    }
    let d = dmg * this.stats.dmgTaken;
    this.sinceHit = 0;
    this.inv = 0.85;
    this.hitThisWave = true;
    if (this.shield > 0) {
      const a = Math.min(this.shield, d);
      this.shield -= a;
      d -= a;
      this.sfx('shieldHit');
      this.particle(P_HEX, this.px, this.py, 40, 0, 0.3, 22, C_WHITE, 0);
    }
    if (d > 0) {
      this.hp -= d;
      this.damageFlash = 1;
      this.addShake(7 + d * 0.3);
      this.hitstop = Math.max(this.hitstop, 0.05);
      this.sfx('damage');
      this.sparks(x, y, Math.atan2(this.py - y, this.px - x), 1.6, 12, 80, 300, C_RED);
      if (this.combo >= 8) this.text(this.px, this.py - 60, 'CHAIN BROKEN', C_RED, true);
      this.combo = 0;
      this.mult = 1;
      this.comboT = 0;
    }
    this.checkLow();
    if (this.hp <= 0) this.playerDeath();
  }

  private drain(amount: number): void {
    if (this.dying >= 0 || this.buffShield > 0) return;
    let d = amount * this.stats.dmgTaken;
    this.sinceHit = 0;
    this.hitThisWave = true;
    if (this.shield > 0) {
      const a = Math.min(this.shield, d);
      this.shield -= a;
      d -= a;
    }
    this.hp -= d;
    this.damageFlash = Math.max(this.damageFlash, 0.35);
    if (Math.random() < 0.3) this.particle(P_EMBER, this.px + rand(-8, 8), this.py + rand(-8, 8), 0, -30, 0.3, 10, C_RED, 0);
    this.checkLow();
    if (this.hp <= 0) this.playerDeath();
  }

  private checkLow(): void {
    if (!this.lowWarned && this.hp < this.stats.maxHp * 0.3 && this.hp > 0) {
      this.lowWarned = true;
      this.say(FLAVOR.low, 'SEEK REPAIR', true, 1.8);
    } else if (this.hp > this.stats.maxHp * 0.45) this.lowWarned = false;
  }

  private playerDeath(): void {
    this.hp = 0;
    this.dying = 0;
    this.shatter(this.px, this.py, 14, 120, 0, 0, true);
    for (let i = 0; i < 4; i++) this.particle(P_RING, this.px, this.py, 220 + i * 120, 0, 0.6 + i * 0.25, 14, i % 2 ? C_RED : C_ORANGE, 0);
    this.particle(P_HEX, this.px, this.py, 160, 0, 0.7, 16, C_WHITE, 0);
    for (let i = 0; i < 10; i++) this.particle(P_GLITCH, rand(0, this.FW), this.py + rand(-200, 60), 0, 0, rand(0.1, 0.4), rand(60, 260), C_RED, 0);
    this.sparks(this.px, this.py, 0, TAU, 50, 150, 600, C_ORANGE);
    this.addShake(26);
    this.hitstop = 0.25;
    this.ev.sound('gameover');
    this.say('SYSTEM COMPROMISED', 'NEURAL LINK SEVERED', true, 2.2);
    this.pushLog('antivirus mind lost');
  }

  // ================================================================ abilities
  triggerPulse(): void {
    if (this.phase !== 'playing' || this.dying >= 0 || !this.stats.pulse || this.pulseCdT > 0) return;
    this.pulseCdT = this.stats.pulseCd;
    this.pulseR = 10;
    this.pulseX = this.px;
    this.pulseY = this.py;
    this.pulseSerial++;
    this.addShake(9);
    this.hitstop = Math.max(this.hitstop, 0.05);
    this.particle(P_HEX, this.px, this.py, 140, 0, 0.4, 20, C_WHITE, 0);
    this.sfx('emp');
    this.pushLog('firewall pulse discharged');
    if (this.stats.pulseSelfDmg > 0) this.hp = Math.max(1, this.hp - this.stats.pulseSelfDmg);
  }

  triggerDash(): void {
    if (this.phase !== 'playing' || this.dying >= 0 || !this.stats.dash || this.dashCdT > 0) return;
    let dx = (this.keys.r ? 1 : 0) - (this.keys.l ? 1 : 0);
    let dy = (this.keys.d ? 1 : 0) - (this.keys.u ? 1 : 0);
    if (!dx && !dy) {
      const sp = Math.hypot(this.pvx, this.pvy);
      if (sp > 40) {
        dx = this.pvx / sp;
        dy = this.pvy / sp;
      } else dy = -1;
    }
    const d = Math.hypot(dx, dy) || 1;
    this.dashDx = dx / d;
    this.dashDy = dy / d;
    this.dashT = 0.16;
    this.inv = Math.max(this.inv, 0.32);
    this.dashCdT = this.stats.dashCd;
    this.dashHits.clear();
    this.sfx('dash');
    for (let i = 0; i < 10; i++) this.particle(P_SPARK, this.px, this.py, -this.dashDx * rand(100, 300) + rand(-60, 60), -this.dashDy * rand(100, 300) + rand(-60, 60), 0.25, 1, C_WHITE, 4);
    if (this.syn.has('dashShield')) this.shield = Math.min(this.stats.shieldMax, this.shield + 15);
    // shake off leeches
    for (const u of this.units) {
      if (u.state === U_LATCH && u.e.kind === 'leech' && leechIsLatched(u.e)) {
        leechToggleLatch(u.e);
        this.hitUnit(u, 2 * this.stats.dmg, false, u.e.x, u.e.y, 0);
      }
    }
  }

  private dashHits = new Set<number>();

  // ================================================================ loop
  update(dtIn: number): void {
    const dt = Math.min(dtIn, 0.05);
    this.time += dt;
    if (this.phase === 'paused') return;
    this.shake *= Math.exp(-dt * 10);
    if (this.shake < 0.05) this.shake = 0;
    this.damageFlash = Math.max(0, this.damageFlash - dt * 2.4);
    if (this.announceT > 0) this.announceT -= dt;
    this.formT += dt;

    if (this.phase === 'menu') {
      this.updateDemo(dt);
      this.updateParticles(dt);
      return;
    }
    if (this.phase !== 'playing') {
      this.idleShip(dt);
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

  private idleShip(dt: number): void {
    this.bank += (0 - this.bank) * damp(5, dt);
    this.pushTrail(dt);
  }

  private pushTrail(dt: number): void {
    this.trailAcc += dt;
    if (this.trailAcc >= 0.016) {
      this.trailAcc = 0;
      this.trailHead = (this.trailHead + 1) % this.trailX.length;
      this.trailX[this.trailHead] = this.px;
      this.trailY[this.trailHead] = this.py + 14;
    }
    // drift trail points downward (scrolling feel)
    for (let i = 0; i < this.trailY.length; i++) this.trailY[i] += 160 * dt;
  }

  private spawnDemo(): void {
    this.units = [];
    this.formDx = 54;
    this.formDy = 46;
    this.formTop = 120;
    this.swayAmp = 40;
    const rows: [EnemyKind, number][] = [
      ['sentinel', 3],
      ['wraith', 4],
      ['crawler', 6],
    ];
    rows.forEach(([kind, cols], ri) => {
      for (let c = 0; c < cols; c++) {
        const u = this.makeUnit(kind, 0, 0, false);
        if (!u) continue;
        u.col = c - (cols - 1) / 2;
        u.row = ri;
        u.hasSlot = true;
        u.state = U_FORM;
        u.e.x = this.slotX(u);
        u.e.y = this.slotY(u);
      }
    });
  }

  private updateDemo(dt: number): void {
    if (!this.units.length) this.spawnDemo();
    const target = tmpV;
    target.x = this.FW / 2 + Math.sin(this.time * 0.6) * 160;
    target.y = this.FH - 80;
    for (const u of this.units) {
      const e = u.e;
      if (e.kind === 'sentinel' && e.mode === 0) e.dur = 1e9;
      if (e.kind === 'wraith' && e.mode === 0) e.modeT = 0;
      const dx = this.slotX(u);
      const dy = this.slotY(u);
      intentV.x = (dx - e.x) * 6;
      intentV.y = (dy - e.y) * 6;
      updateEnemy(e, dt, target, intentV);
      const k = damp(7, dt);
      e.x += (dx - e.x) * k;
      e.y += (dy - e.y) * k;
      if (e.kind === 'crawler') e.heading = turnToward(e.heading, Math.PI / 2, 2.5 * dt);
    }
  }

  private sim(dt: number): void {
    const r = this.run;
    if (r) r.time += dt;
    if (this.dying >= 0) {
      this.dying += dt;
      this.updateUnits(dt);
      this.updateEBullets(dt);
      this.updateParticles(dt);
      this.updateTexts(dt);
      this.compact();
      if (this.dying > 2) this.endRun(false);
      return;
    }
    this.updatePlayer(dt);
    this.updateWeapons(dt);
    this.director(dt);
    this.updateUnits(dt);
    this.updatePulse(dt);
    this.updateBullets(dt);
    this.updateEBullets(dt);
    this.collidePlayer();
    this.updatePickups(dt);
    this.updateParticles(dt);
    this.updateTexts(dt);
    for (const a of this.arcs) if (a.active && (a.life -= dt) <= 0) a.active = false;
    this.compact();
    this.updateLog(dt);

    // combo decay
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) {
        this.combo = 0;
        this.mult = 1;
      }
    }

    // wave completion
    if (this.waveActive && this.clearT < 0) {
      let alive = 0;
      for (const u of this.units) if (!u.dead) alive++;
      if (alive === 0 && this.batchesLeft <= 0) {
        this.clearT = this.isBoss ? 2.4 : 1.6;
        if (!this.isBoss) {
          const sec = r ? r.sector : 0;
          const bonus = 500 * (sec + 1) * (this.waveElite ? 2 : 1);
          const nohit = this.hitThisWave ? 0 : 1000 * (sec + 1);
          this.score += bonus + nohit;
          const fl = FLAVOR.clear[(Math.random() * FLAVOR.clear.length) | 0];
          this.say(fl, `+${bonus}${nohit ? `  //  FLAWLESS +${nohit}` : ''}`, false, 2);
          this.sfx('clear');
          this.pushLog('wave purged');
        }
      }
    } else if (this.clearT >= 0) {
      this.clearT -= dt;
      if (this.clearT < 0) this.finishWave();
    }
  }

  private finishWave(): void {
    const r = this.run;
    if (!r) return;
    this.waveActive = false;
    r.wavesCleared++;
    // collect leftover pickups
    for (const p of this.pickups) if (p.active) this.collect(p);
    for (const b of this.ebullets) b.active = false;
    for (const b of this.bullets) b.active = false;
    if (this.isBoss) {
      this.isBoss = false;
      this.bs = null;
      r.afterPick = r.sector >= SECTORS.length - 1 ? 'victory' : 'nextSector';
      this.openOffer('boss');
    } else {
      r.afterPick = 'map';
      this.openOffer(this.waveElite ? 'elite' : 'wave');
    }
  }

  private compact(): void {
    let w = 0;
    for (let i = 0; i < this.units.length; i++) {
      const u = this.units[i];
      if (!u.dead) this.units[w++] = u;
    }
    this.units.length = w;
  }

  private updateLog(dt: number): void {
    this.logT -= dt;
    if (this.logT <= 0) {
      this.logT = rand(4, 8);
      const lines = this.sector.log;
      this.pushLog(lines[(Math.random() * lines.length) | 0]);
    }
  }

  private updatePlayer(dt: number): void {
    const st = this.stats;
    const over = this.buffOver > 0 || st.permOverclock;
    const speed = st.moveSpeed * (over ? 1.12 : 1);
    const minY = this.FH - 230;
    const maxY = this.FH - 40;
    let tvx = 0;
    let tvy = 0;
    const kx = (this.keys.r ? 1 : 0) - (this.keys.l ? 1 : 0);
    const ky = (this.keys.d ? 1 : 0) - (this.keys.u ? 1 : 0);
    if (this.touchId >= 0) {
      const [sx, sy] = [this.pointerX, this.pointerY];
      const tx = this.touchPX + ((sx - this.touchSX) / this.scale) * 1.2;
      const ty = this.touchPY + ((sy - this.touchSY) / this.scale) * 1.2;
      tvx = clamp((tx - this.px) * 14, -speed * 2, speed * 2);
      tvy = clamp((ty - this.py) * 14, -speed * 2, speed * 2);
    } else if (kx || ky) {
      const d = Math.hypot(kx, ky) || 1;
      tvx = (kx / d) * speed;
      tvy = (ky / d) * speed * 0.8;
    } else if (this.pointerFollow && this.pointerInside && this.pointerMouse) {
      const [fx, fy] = this.toField(this.pointerX, this.pointerY);
      tvx = clamp((fx - this.px) * 10, -speed * 1.6, speed * 1.6);
      tvy = clamp((clamp(fy, minY, maxY) - this.py) * 10, -speed * 1.6, speed * 1.6);
    }
    const k = damp(18, dt);
    this.pvx += (tvx - this.pvx) * k;
    this.pvy += (tvy - this.pvy) * k;
    if (this.dashT > 0) {
      this.dashT -= dt;
      this.pvx = this.dashDx * 1400;
      this.pvy = this.dashDy * 1400;
      if (Math.random() < 0.8) this.particle(P_EMBER, this.px, this.py, 0, 0, 0.2, 18, C_ORANGE, 0);
      if (this.syn.has('dashShield')) {
        for (const u of this.units) {
          if (this.dashHits.has(u.id) || !this.tangible(u)) continue;
          if ((u.e.x - this.px) ** 2 + (u.e.y - this.py) ** 2 < (u.r + 30) ** 2) {
            this.dashHits.add(u.id);
            this.arc(this.px, this.py, u.e.x, u.e.y);
            this.hitUnit(u, 4 * st.dmg, false, u.e.x, u.e.y, 0);
          }
        }
      }
    }
    this.px = clamp(this.px + this.pvx * dt, 18, this.FW - 18);
    this.py = clamp(this.py + this.pvy * dt, minY, maxY);
    this.bank += (clamp(this.pvx / speed, -1, 1) - this.bank) * damp(10, dt);
    this.pushTrail(dt);

    this.inv = Math.max(0, this.inv - dt);
    this.dashCdT = Math.max(0, this.dashCdT - dt);
    if (this.pulseCdT > 0) {
      this.pulseCdT -= dt;
      if (this.pulseCdT <= 0) {
        this.pulseCdT = 0;
        this.text(this.px, this.py - 50, 'PULSE READY', C_ORANGE, true);
        this.sfx('empReady');
      }
    }
    this.buffRapid = Math.max(0, this.buffRapid - dt);
    this.buffShield = Math.max(0, this.buffShield - dt);
    this.buffOver = Math.max(0, this.buffOver - dt);
    this.sinceHit += dt;
    if (st.shieldMax > 0 && this.sinceHit > st.shieldDelay) this.shield = Math.min(st.shieldMax, this.shield + st.shieldRegen * dt);
    if (st.hpDecay > 0 && this.waveActive && this.clearT < 0) this.hp = Math.max(1, this.hp - st.hpDecay * dt);
  }

  private updateWeapons(dt: number): void {
    const st = this.stats;
    this.muzzle = Math.max(0, this.muzzle - dt);
    this.droneA += dt * 2.1;
    const combat = this.waveActive && this.clearT < 0 && this.units.length > 0;
    const firing = combat && (this.autoFire || this.fireHeld || this.keys.fire);
    const over = this.buffOver > 0 || st.permOverclock;
    const rate = st.fireRate * (this.buffRapid > 0 ? 1.8 : 1) * (this.buffOver > 0 ? 1.35 : 1);
    if (this.fireT > 0) this.fireT -= dt;
    if (firing) {
      let guard = 0;
      while (this.fireT <= 0 && guard++ < 4) {
        this.fire(over);
        this.fireT += 1 / rate;
      }
    } else if (this.fireT < 0) this.fireT = 0;
    if (st.drones > 0) {
      this.droneT -= dt;
      if (firing && this.droneT <= 0) {
        this.droneT = 1 / st.droneRate;
        for (let i = 0; i < st.drones; i++) {
          const [dx, dy] = this.dronePos(i);
          const crit = this.syn.has('droneCrit') && Math.random() < st.crit;
          this.spawnBullet(dx, dy - 6, -Math.PI / 2, st.bulletSpeed * 0.95, st.dmg * 0.6 * (crit ? st.critMult : 1), 0, st.bulletSize * 0.75, st.homing * 0.6, crit, true);
        }
      }
    }
  }

  dronePos(i: number): [number, number] {
    const n = Math.max(1, this.stats.drones);
    const a = this.droneA + (i / n) * TAU;
    return [this.px + Math.cos(a) * 40, this.py + 4 + Math.sin(a) * 20];
  }

  private fire(over: boolean): void {
    const st = this.stats;
    const n = 1 + st.spread;
    const dmg = st.dmg * (over ? 1.5 : 1);
    const size = st.bulletSize * (over ? 1.3 : 1);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (n === 1 ? 0 : (i - (n - 1) / 2) * st.spreadAngle) + (Math.random() - 0.5) * 2 * st.inaccuracy;
      const crit = Math.random() < st.crit;
      const ox = n === 1 ? this.shotSide * 4 : 0;
      this.spawnBullet(this.px + ox, this.py - 18, a, st.bulletSpeed, dmg * (crit ? st.critMult : 1), st.pierce, size, st.homing, crit, false);
    }
    this.shotSide = -this.shotSide;
    this.muzzle = 0.05;
    this.sfx('shot');
  }

  private spawnBullet(x: number, y: number, a: number, sp: number, dmg: number, pierce: number, size: number, homing: number, crit: boolean, drone: boolean): void {
    const b = this.bullets[this.bCur];
    this.bCur = (this.bCur + 1) % POOL_PBULLETS;
    b.active = true;
    b.x = x;
    b.y = y;
    b.vx = Math.cos(a) * sp;
    b.vy = Math.sin(a) * sp;
    b.dmg = dmg;
    b.pierce = pierce;
    b.size = size;
    b.homing = homing;
    b.life = 1.6;
    b.crit = crit;
    b.drone = drone;
    b.lastHit = -1;
    b.target = -1;
    b.retarget = 0;
  }

  private updatePulse(dt: number): void {
    if (this.pulseR < 0) return;
    this.pulseR += 1100 * dt;
    const r2 = this.pulseR * this.pulseR;
    const heal = this.syn.has('pulseLeech');
    for (const u of this.units) {
      if (u.pulseHit === this.pulseSerial || !this.tangible(u)) continue;
      const ddx = u.e.x - this.pulseX;
      const ddy = u.e.y - this.pulseY;
      if (ddx * ddx + ddy * ddy < r2) {
        u.pulseHit = this.pulseSerial;
        this.sparks(u.e.x, u.e.y, Math.atan2(ddy, ddx), 1.2, 4, 100, 260, C_WHITE);
        if (heal) this.hp = Math.min(this.stats.maxHp, this.hp + 1.5);
        if (u.state === U_LATCH && u.e.kind === 'leech') leechToggleLatch(u.e);
        this.hitUnit(u, this.stats.pulseDmg * this.stats.dmg * (u.state === U_BOSS ? 2 : 1), false, u.e.x, u.e.y, 0);
      }
    }
    for (const b of this.ebullets) {
      if (!b.active) continue;
      const ddx = b.x - this.pulseX;
      const ddy = b.y - this.pulseY;
      if (ddx * ddx + ddy * ddy < r2) {
        b.active = false;
        this.particle(P_EMBER, b.x, b.y, 0, 0, 0.2, 9, C_ORANGE, 0);
      }
    }
    if (this.pulseR > Math.max(this.FW, this.FH) * 1.2) this.pulseR = -1;
  }

  private updateBullets(dt: number): void {
    const lim = this.FH + 40;
    for (const b of this.bullets) {
      if (!b.active) continue;
      const px = b.x;
      const py = b.y;
      if (b.homing > 0) {
        b.retarget -= dt;
        let tu: Unit | null = null;
        if (b.retarget <= 0) {
          b.retarget = 0.1;
          let bd = 340 * 340;
          b.target = -1;
          for (const u of this.units) {
            if (!this.tangible(u) || u.e.y > b.y + 30) continue;
            const ddx = u.e.x - b.x;
            const ddy = u.e.y - b.y;
            const d = ddx * ddx + ddy * ddy;
            if (d < bd) {
              bd = d;
              b.target = u.id;
              tu = u;
            }
          }
        } else if (b.target >= 0) {
          for (const u of this.units) if (u.id === b.target) tu = u;
        }
        if (tu && !tu.dead) {
          const cur = Math.atan2(b.vy, b.vx);
          const want = Math.atan2(tu.e.y - b.y, tu.e.x - b.x);
          const na = turnToward(cur, want, b.homing * dt);
          const sp = Math.hypot(b.vx, b.vy);
          b.vx = Math.cos(na) * sp;
          b.vy = Math.sin(na) * sp;
        }
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.y < -30 || b.y > lim || b.x < -30 || b.x > this.FW + 30) {
        b.active = false;
        continue;
      }
      // swept collision vs units
      const sx = b.x - px;
      const sy = b.y - py;
      const len2 = sx * sx + sy * sy || 1;
      const br = 3 * b.size;
      let consumed = false;
      for (const u of this.units) {
        if (u.id === b.lastHit || !this.tangible(u)) continue;
        const e = u.e;
        const rr = u.r + br;
        const ex = e.x - px;
        const ey = e.y - py;
        if (Math.abs(ex) > rr + 40 || Math.abs(ey) > rr + 40) continue;
        const t = clamp((ex * sx + ey * sy) / len2, 0, 1);
        const cx = ex - sx * t;
        const cy = ey - sy * t;
        if (cx * cx + cy * cy < rr * rr) {
          const hx = px + sx * t;
          const hy = py + sy * t;
          this.sparks(hx, hy, Math.atan2(-sy, -sx), 1.4, 3, 90, 300, C_ORANGE);
          this.particle(P_EMBER, hx, hy, 0, 0, 0.1, 12 * b.size, b.crit ? C_WHITE : C_HOT, 0);
          this.sfx('hit');
          const firstHit = b.lastHit === -1;
          const chain = this.stats.chain > 0 && (!b.drone || b.crit) && (firstHit || this.syn.has('arcPierce')) ? this.stats.chain : 0;
          this.hitUnit(u, b.dmg, b.crit, hx, hy, chain);
          if (b.pierce > 0) {
            b.pierce--;
            b.lastHit = u.id;
          } else {
            consumed = true;
            break;
          }
        }
      }
      if (consumed) {
        b.active = false;
        continue;
      }
      // shoot down enemy projectiles
      for (const eb of this.ebullets) {
        if (!eb.active) continue;
        const ddx = eb.x - b.x;
        const ddy = eb.y - b.y;
        const rr = eb.r + br + 2;
        if (ddx * ddx + ddy * ddy < rr * rr) {
          eb.active = false;
          this.sparks(eb.x, eb.y, 0, TAU, 5, 60, 200, C_RED);
          this.score += 5 * this.mult;
          if (b.pierce > 0) b.pierce--;
          else b.active = false;
          break;
        }
      }
    }
  }

  private updateEBullets(dt: number): void {
    const FH = this.FH;
    for (const b of this.ebullets) {
      if (!b.active) continue;
      b.t += dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.y > FH + 30 || b.y < -60 || b.x < -40 || b.x > this.FW + 40) {
        b.active = false;
        continue;
      }
      const ddx = b.x - this.px;
      const ddy = b.y - this.py;
      const rr = b.r + 5;
      if (ddx * ddx + ddy * ddy < rr * rr && this.dying < 0) {
        if (this.inv > 0 || this.dashT > 0) continue;
        b.active = false;
        this.hurtPlayer(b.kind === EB_ORB ? 12 : 9, b.x, b.y);
      }
    }
  }

  private collidePlayer(): void {
    if (this.dying >= 0) return;
    for (const u of this.units) {
      if (u.state === U_LATCH || !this.tangible(u)) continue;
      const e = u.e;
      const rr = u.r * (u.state === U_BOSS ? 0.8 : 0.85) + 10;
      const ddx = e.x - this.px;
      const ddy = e.y - this.py;
      if (ddx * ddx + ddy * ddy < rr * rr) {
        if (this.inv > 0 || this.dashT > 0) continue;
        this.hurtPlayer(u.contact, e.x, e.y);
        if (u.state !== U_BOSS) this.hitUnit(u, 4 * this.stats.dmg + 3, false, e.x, e.y, 0);
      }
    }
  }

  private updatePickups(dt: number): void {
    const mag = this.stats.magnet;
    const pull = this.clearT >= 0;
    for (const p of this.pickups) {
      if (!p.active) continue;
      p.t += dt;
      p.life -= dt;
      if (p.life <= 0 || p.y > this.FH + 30) {
        p.active = false;
        continue;
      }
      const ddx = this.px - p.x;
      const ddy = this.py - p.y;
      const d = Math.hypot(ddx, ddy) || 1;
      if (d < mag || pull) {
        const s = pull ? 700 : 260 + (1 - d / mag) * 300;
        p.vx += ((ddx / d) * s - p.vx) * damp(8, dt);
        p.vy += ((ddy / d) * s - p.vy) * damp(8, dt);
      } else {
        p.vx *= Math.exp(-dt * 2);
        p.vy += (70 - p.vy) * damp(2, dt);
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (d < 24) this.collect(p);
    }
  }

  private collect(p: Pickup): void {
    p.active = false;
    const dur = this.stats.buffDur;
    let label = '';
    switch (p.kind) {
      case PK_RAPID:
        this.buffRapid = this.buffMax[0] = 8 * dur;
        label = 'RAPID FIRE';
        break;
      case PK_SHIELD:
        this.buffShield = this.buffMax[1] = 6 * dur;
        label = 'AEGIS SHIELD';
        break;
      case PK_OVERCLOCK:
        this.buffOver = this.buffMax[2] = 7 * dur;
        label = 'OVERCLOCK ENGAGED';
        break;
      case PK_REPAIR:
        this.hp = Math.min(this.stats.maxHp, this.hp + 12);
        label = '+12 INTEGRITY';
        break;
    }
    this.text(this.px, this.py - 44, label, C_WHITE, true);
    this.particle(P_HEX, this.px, this.py, 60, 0, 0.3, 14, C_ORANGE, 0);
    this.sfx('pickup');
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

