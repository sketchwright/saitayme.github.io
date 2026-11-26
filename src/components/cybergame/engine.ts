// Cyber Defender simulation: vertical arcade roguelite. Plain mutable state in
// fixed pools; React only hears about screen changes. World space is the
// logical playfield (FIELD_W wide, FH tall), scaled to the canvas by the
// renderer. Enemies come from ./enemies (motion + animation, always driven by
// smooth intent velocities, never by setting positions); this file owns
// spawning, type behaviours, combat, upgrades, routes and the run structure.
import {
  Boss,
  Enemy,
  EnemyIntent,
  EnemyKind,
  Vec,
  crawlerLunge,
  createEnemy,
  hurtEnemy,
  killEnemy,
  leechIsLatched,
  leechToggleLatch,
  sentinelCharge,
  sentinelMuzzle,
  spawnEnemy,
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
  EB_HARD,
  EB_HOMING,
  EB_NEEDLE,
  EB_ORB,
  EB_PELLET,
  EBullet,
  FIELD_MIN_H,
  FIELD_W,
  FloatText,
  MAX_UNITS,
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
  SfxName,
  TAU,
  TELL_TIME,
  Affix,
  Role,
  U_ACT,
  U_BOSS,
  U_DECOY,
  U_DYING,
  U_ENTER,
  U_FREE,
  U_HUNT,
  U_LATCH,
  U_RETREAT,
  U_STRIKE,
  U_SWOOP,
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
import { FLAVOR, GroupDef, KIND_STATS, SECTORS, SectorDef } from './content/sectors';
import { BossCtl, BossHost } from './bosses';
import { generateRoutes } from './content/routes';
import { DEFEND_TIME, ENCOUNTERS, EncounterId, HUNT_ESCAPE, SECTOR_ENCOUNTERS } from './content/encounters';
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

/** Fraction of the field height the player may use (lower part). */
export const PLAYER_ZONE = 0.6;

export interface RunState {
  seed: number;
  seedStr: string;
  sector: number;
  /** waves cleared in the current sector */
  waveInSector: number;
  routes: NodeType[];
  /** encounter type of the wave each route leads to */
  routeEnc: EncounterId[];
  pendingEnc: EncounterId;
  lastEnc: EncounterId;
  /** what starts once the current detour (cache / anomaly) is resolved */
  pending: 'wave' | 'boss';
  wavesCleared: number;
  waveNo: number;
  kills: number;
  maxCombo: number;
  time: number;
  offers: UpgradeDef[];
  offerSource: OfferSource;
  afterPick: 'routes' | 'pending' | 'nextSector' | 'victory';
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

const tmpV: Vec = { x: 0, y: 0 };
const intentV: Vec = { x: 0, y: 0 };
const rolePoint: Vec = { x: 0, y: 0 };
const roleIntent: EnemyIntent = { mode: 'hold', point: rolePoint, radius: 0, angle: 0 };
const HOLD: EnemyIntent = { mode: 'hold' };

export interface HazWall {
  active: boolean;
  y: number;
  gapX: number;
  gapV: number;
  gapW: number;
  hit: boolean;
}
export interface Pool {
  x: number;
  y: number;
  r: number;
  a: number; // 0..1 fade (telegraph while < 1)
  vx: number;
  vy: number;
}
export interface Blast {
  active: boolean;
  x: number;
  y: number;
  t: number;
  max: number;
}
export interface Beam {
  active: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number;
}

export class Game implements BossHost {
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
  /** EMP charge (kills fill it); each use in a sector raises the cost */
  empCharge = 0;
  empCost = 1;
  private empUses = 0;
  /** healing left this wave (all sources share it) and lifesteal fatigue */
  healBudget = 0;
  /** on-kill healing (lifesteal / vampiric) has its own per-wave budget so the vampiric drawback stays worth it */
  stealBudget = 0;
  /** recent healing, shown as a floating +N and a pulse on the integrity bar */
  healFlash = 0;
  private healShow = 0;
  private healShowT = 0;
  private lsRecent = 0;
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
  private alarmT = 0;
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
  bc: BossCtl | null = null;
  /** upgrade temporarily disabled by the final boss */
  hacked: string | null = null;
  hackT = 0;
  sector: SectorDef = SECTORS[0];
  private fireDirT = 2;
  private strikeT = 4;
  private groups: GroupDef[] = [];
  private groupIdx = 0;
  private waveClock = 0;
  private clusterSeq = 0;
  private fightBonus = false;
  /** HARD difficulty: tougher, denser, harder-hitting enemies */
  hard = false;
  // ---- encounter state
  enc: EncounterId = 'standard';
  private encHp = 1;
  readonly hazWalls: HazWall[] = Array.from({ length: 4 }, () => ({ active: false, y: 0, gapX: 0, gapV: 0, gapW: 100, hit: false }));
  private hazT = 0;
  inset = 0;
  scanR = -1;
  private scanT = 0;
  pools: Pool[] = [];
  private poolT = 0;
  slowed = false;
  node = { on: false, x: 0, y: 0, hp: 100, max: 100, t: 0 };
  huntId = -1;
  huntT = 0;
  readonly blasts: Blast[] = Array.from({ length: 8 }, () => ({ active: false, x: 0, y: 0, t: 0, max: 0.7 }));
  readonly beams: Beam[] = Array.from({ length: 8 }, () => ({ active: false, x1: 0, y1: 0, x2: 0, y2: 0, life: 0 }));
  private encBonus = false;

  private dmgScale(): number {
    return this.sector.dmgMul * (this.hard ? 1.3 : 1);
  }

  /** repair node strength drops as the run goes deeper */
  repairFrac(): number {
    return 0.25;
  }
  /** seconds since the last kill in this wave (stall safety valve) */
  private sinceKill = 0;
  stallPull = false;
  /** debug counter: units pushed back up from beside / below the ship */
  belowEvents = 0;

  latchedCount = 0;
  /** dev-only slow motion (backquote) */
  debug = false;
  timeScale = 1;

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
    this.py = clamp(this.py, this.FH * (1 - PLAYER_ZONE), this.FH - 40);
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
      case 'Backquote':
        // dev-only slow motion; compiled out of production builds
        if (import.meta.env.DEV && this.debug && !repeat) {
          this.timeScale = this.timeScale < 1 ? 1 : 0.2;
          this.pushLog(`debug: time x${this.timeScale}`);
        }
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

  sfx(n: SfxName): void {
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
      waveInSector: 0,
      routes: [],
      routeEnc: [],
      pendingEnc: 'standard',
      lastEnc: 'standard',
      pending: 'wave',
      wavesCleared: 0,
      waveNo: 0,
      kills: 0,
      maxCombo: 0,
      time: 0,
      offers: [],
      offerSource: 'wave',
      afterPick: 'routes',
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
    this.ev.sound('sector');
    this.beginWave(false, false);
    this.say(FLAVOR.runStart[0], `SECTOR 1 // ${this.sector.name} // WAVE 1`, false, 2.6);
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
    this.enc = 'standard';
    this.encHp = 1;
    this.inset = 0;
    this.scanR = -1;
    this.pools = [];
    this.slowed = false;
    this.node.on = false;
    this.huntId = -1;
    for (const w of this.hazWalls) w.active = false;
    for (const b of this.blasts) b.active = false;
    for (const b of this.beams) b.active = false;
    if (this.hacked) {
      this.hacked = null;
      this.hackT = 0;
      this.recomputeStats();
    }
    this.bc = null;
    this.clearT = -1;
    this.combo = 0;
    this.comboT = 0;
    this.mult = 1;
    this.buffRapid = this.buffShield = this.buffOver = 0;
    this.pulseR = -1;
    this.healBudget = this.stats.maxHp * (this.hard ? 0.2 : 0.3);
    this.stealBudget = this.stats.maxHp * (this.hard ? 0.4 : 0.5);
    this.dashT = 0;
    this.inv = 0;
    this.latchedCount = 0;
  }

  private makeRoutes(): void {
    const r = this.run;
    if (!r) return;
    const waves = this.sector.waves.length;
    r.routes = generateRoutes(r.mapRng, r.sector, r.waveInSector + 1, this.hp / this.stats.maxHp, r.waveInSector >= waves);
    const used: EncounterId[] = [];
    r.routeEnc = r.routes.map((t) => {
      if (t === 'boss') return 'standard';
      const id = this.pickEncounter(used);
      used.push(id);
      return id;
    });
    this.setPhase('map');
    this.ev.changed();
  }

  /** Starts whatever the route led to (a wave or the boss). */
  private continuePending(): void {
    const r = this.run;
    if (!r) return;
    if (r.pending === 'boss') this.beginBoss();
    else {
      this.beginWave(r.hardenNext, false);
      r.hardenNext = false;
    }
    this.ev.changed();
  }

  chooseRoute(index: number): void {
    const r = this.run;
    if (!r || this.phase !== 'map') return;
    const t = r.routes[index];
    if (!t) return;
    r.pendingEnc = r.routeEnc[index] ?? 'standard';
    r.toast = '';
    this.sfx('click');
    const bossStep = r.waveInSector >= this.sector.waves.length;
    r.pending = bossStep ? 'boss' : 'wave';
    switch (t) {
      case 'fight':
        this.beginWave(r.hardenNext, true);
        r.hardenNext = false;
        break;
      case 'elite':
        this.beginWave(true, false);
        r.hardenNext = false;
        break;
      case 'boss':
        this.score += 3000;
        this.beginBoss();
        break;
      case 'repair': {
        const before = this.hp;
        this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.maxHp * this.repairFrac());
        this.shield = this.stats.shieldMax;
        this.pushLog(`integrity patched +${Math.round(this.hp - before)}`);
        this.sfx('pickup');
        this.continuePending();
        this.say('REPAIR COMPLETE', `+${Math.round(this.hp - before)} INTEGRITY`, false, 2);
        break;
      }
      case 'cache':
        r.afterPick = 'pending';
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
          this.heal(this.stats.maxHp * f, 'node');
        },
        offer: (rar) => {
          offered = true;
          r.afterPick = 'pending';
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
    if (!offered) this.continuePending();
    this.ev.changed();
  }

  private bonusMaxHp = 0;

  private recomputeStats(): void {
    const prevMax = this.stats.maxHp;
    const active = new Map(this.owned);
    if (this.hacked) active.delete(this.hacked);
    this.syn = computeSynergies(active);
    this.stats = computeStats(active, this.syn);
    this.stats.maxHp = Math.max(30, this.stats.maxHp + this.bonusMaxHp);
    if (this.stats.maxHp > prevMax) this.hp += this.stats.maxHp - prevMax;
    this.hp = Math.min(this.hp, this.stats.maxHp);
    this.shield = Math.min(this.shield, this.stats.shieldMax);
  }

  private openOffer(source: OfferSource, only?: Rarity[]): void {
    const r = this.run;
    if (!r) return;
    const rng = r.offerRng;
    const cleared = r.wavesCleared;
    const avail = UPGRADES.filter(
      (u) => (this.owned.get(u.id) ?? 0) < u.maxStacks && (!only || only.includes(u.rarity)) && (only !== undefined || (u.unlock ?? 0) <= cleared),
    );
    // sector 1 is mostly common; rare / corrupted show up more deeper in
    const bySector: Record<Rarity, number>[] = [
      { common: 78, rare: 20, corrupted: 2 },
      { common: 52, rare: 36, corrupted: 12 },
      { common: 38, rare: 42, corrupted: 20 },
    ];
    const weights: Record<Rarity, number> =
      source === 'boss' ? { common: 12, rare: 60, corrupted: 28 } : source === 'elite' ? { common: 40, rare: 48, corrupted: 12 } : bySector[r.sector] ?? RARITY_WEIGHT;
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
    r.afterPick = 'routes';
    if (next === 'victory') {
      this.endRun(true);
      return;
    }
    if (next === 'nextSector') {
      r.sector++;
      r.waveInSector = 0;
      this.sector = SECTORS[r.sector];
      this.theme = this.sector.theme;
      this.pushLog(`descending: ${this.sector.name.toLowerCase()}`);
      this.ev.sound('sector');
      this.empUses = 0;
      this.empCost = 1;
      this.makeRoutes();
      return;
    }
    if (next === 'pending') {
      this.continuePending();
      return;
    }
    this.makeRoutes();
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

  sparks(x: number, y: number, dir: number, spread: number, n: number, smin: number, smax: number, color: number): void {
    for (let i = 0; i < n; i++) {
      const a = dir + (Math.random() - 0.5) * spread;
      const s = rand(smin, smax);
      this.particle(P_SPARK, x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.12, 0.3), 1, Math.random() < 0.3 ? C_WHITE : color, 5);
    }
  }

  shatter(x: number, y: number, r: number, n: number, vx: number, vy: number, hot: boolean): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const d = Math.random() * r;
      const s = rand(40, 230);
      const roll = Math.random();
      const color = roll < 0.35 ? C_GRAY : roll < 0.65 ? C_ORANGE : roll < 0.88 ? C_RED : hot ? C_HOT : C_WHITE;
      this.particle(P_FRAG, x + Math.cos(a) * d, y + Math.sin(a) * d, Math.cos(a) * s + vx * 0.4, Math.sin(a) * s + vy * 0.4, rand(0.35, 0.9), rand(1.5, 2.4 + r * 0.1), color, 3.2);
    }
  }

  addShake(v: number): void {
    const cap = this.reducedMotion ? 3 : 22;
    this.shake = Math.min(cap, this.shake + (this.reducedMotion ? v * 0.2 : v));
  }

  say(t: string, sub: string, danger: boolean, dur: number): void {
    this.announce = t;
    this.announceSub = sub;
    this.announceDanger = danger;
    this.announceT = dur;
  }

  pushLog(text: string): void {
    this.log.push({ text, t: this.time });
    if (this.log.length > 6) this.log.shift();
  }

  ebullet(kind: number, x: number, y: number, vx: number, vy: number): void {
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

  aimed(kind: number, x: number, y: number, speed: number, spreadN: number, spread: number, baseA?: number): void {
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
    // always a fresh entity: entities are never reused
    const e = createEnemy(kind, x, y, (Math.random() * 0x7fffffff) | 0, { size });
    if (e.kind === 'leech') e.auto = false;
    const hpMul = this.sector.hpMul * this.encHp * (1 + (0.03 + 0.06 * this.runSector()) * (this.run ? this.run.waveInSector : 0)) * (elite ? 1.8 : 1) * (this.hard ? 1.3 : 1);
    const hp = Math.max(1, Math.round(ks.hp * hpMul));
    const u: Unit = {
      id: this.nextId++,
      e,
      kind,
      state: U_ENTER,
      from: 'top',
      hp,
      maxHp: hp,
      r: ks.r * (elite ? 1.1 : 1),
      gx: x,
      gy: y,
      baseX: x,
      p0x: x, p0y: y, p1x: x, p1y: y, p2x: x, p2y: y, p3x: x, p3y: y,
      pt: 0,
      pdur: 1,
      delay: 0,
      t: 0,
      stateT: 0,
      actT: rand(2, 5),
      shotT: rand(3, 6),
      tellT: 0,
      tellA: 0,
      tellKind: EB_PELLET,
      tellN: 1,
      tellSpread: 0,
      tellSpeed: 0,
      cluster: 0,
      cidx: 0,
      side: 1,
      flash: 0,
      elite,
      score: Math.round(ks.score * (elite ? 1.6 : 1) * (1 + this.runSector() * 0.3)),
      contact: ks.contact * (elite ? 1.3 : 1),
      pulseHit: -1,
      dead: false,
      life: 0,
      belowT: 0,
      role: '',
      roleT: rand(1.5, 3),
      dome: 0,
      domeMax: 0,
      affixes: [],
      ward: 0,
      phaseT: 0,
      phaseCd: rand(2, 4),
      hunted: false,
      stunT: 0,
      stunMax: 1,
      carrier: false,
      minion: false,
    };
    this.units.push(u);
    return u;
  }

  private runSector(): number {
    return this.run ? this.run.sector : 0;
  }

  private onScreen(e: Enemy, m: number): boolean {
    return e.x >= m && e.x <= this.FW - m && e.y >= m && e.y <= this.FH - m;
  }

  /** Fully materialised and not phased out: allowed to shoot. */
  private visibleForFire(u: Unit): boolean {
    const e = u.e;
    if (u.dead || u.state === U_DYING || u.delay > 0 || !e.alive || e.spawnT < 1) return false;
    if (e.kind === 'wraith' && (e.vis < 0.9 || e.mode !== 0)) return false;
    return this.onScreen(e, 14);
  }

  /** Smooth, speed-capped intent toward a goal (slows on arrival). */
  private goal(u: Unit, gx: number, gy: number, speed: number): Vec {
    const dx = gx - u.e.x;
    const dy = gy - u.e.y;
    const d = Math.hypot(dx, dy) || 1;
    const v = Math.min(speed, d * 1.4);
    intentV.x = (dx / d) * v;
    intentV.y = (dy / d) * v;
    return intentV;
  }

  private stationFor(side: number): [number, number] {
    if (Math.random() < 0.6) return [side < 0 ? rand(40, 70) : this.FW - rand(40, 70), rand(110, this.FH * 0.36)];
    return [rand(80, this.FW - 80), rand(70, 140)];
  }

  /** Spawns one group; returns how many units were created. */
  spawnGroup(g: GroupDef, elite: boolean, bx = 0, by = 0): number {
    const FW = this.FW;
    const FH = this.FH;
    const cs = Math.random() < 0.5 ? -1 : 1;
    const cluster = ++this.clusterSeq;
    let made = 0;
    for (let i = 0; i < g.n; i++) {
      const side = g.from === 'swoop' || g.from === 'cluster' ? cs : i % 2 === 0 ? cs : -cs;
      let x = 0;
      let y = 0;
      let gx = 0;
      let gy = 0;
      switch (g.from) {
        case 'top':
          x = rand(50, FW - 50);
          y = -32;
          gx = x + rand(-40, 40);
          gy = rand(70, 130);
          break;
        case 'walls':
          x = side < 0 ? 26 : FW - 26;
          y = -32;
          gx = x;
          gy = rand(FH * 0.2, FH * 0.34);
          break;
        case 'corners':
          x = side < 0 ? -32 : FW + 32;
          y = rand(-30, 50);
          gx = side < 0 ? rand(90, 180) : FW - rand(90, 180);
          gy = rand(90, 170);
          break;
        case 'edges': {
          [gx, gy] = this.stationFor(side);
          x = gx;
          y = -34;
          break;
        }
        case 'sides':
          x = side < 0 ? -36 : FW + 36;
          y = rand(FH * 0.42, FH * 0.72);
          gx = side < 0 ? 80 : FW - 80;
          gy = y;
          break;
        case 'phase':
          x = rand(60, FW - 60);
          y = rand(70, FH * 0.4);
          gx = x;
          gy = y;
          break;
        case 'swoop':
          x = side < 0 ? -40 : FW + 40;
          y = rand(40, 90);
          break;
        case 'cluster':
          x = side < 0 ? -30 : FW + 30;
          y = rand(50, 140) + i * 22;
          gx = FW / 2;
          gy = FH * 0.25;
          break;
        case 'boss':
          x = bx + rand(-30, 30);
          y = by + 30;
          gx = x;
          gy = y + 40;
          break;
        case 'pincer': {
          // both flanks at once, same height
          const ps = i % 2 === 0 ? -1 : 1;
          x = ps < 0 ? -36 : FW + 36;
          y = FH * 0.22 + Math.floor(i / 2) * 26;
          gx = ps < 0 ? 90 : FW - 90;
          gy = y;
          break;
        }
        case 'below':
          // ambush: from below, after a warning marker, never straight under the ship
          x = rand(40, FW - 40);
          if (Math.abs(x - this.px) < 120) x = this.px < FW / 2 ? rand(Math.min(FW - 40, this.px + 120), FW - 40) : rand(40, Math.max(40, this.px - 120));
          y = FH + 34;
          gx = x;
          gy = FH * 0.45;
          break;
      }
      if (g.kind === 'sentinel' && (g.from === 'boss' || g.from === 'phase' || g.from === 'top' || g.from === 'corners')) [gx, gy] = this.stationFor(side);
      const eliteChance = this.phase === 'menu' ? 0 : (elite ? 0.55 : g.from === 'boss' ? 0 : 0.04 + 0.04 * (this.run ? this.run.waveInSector : 0) + 0.05 * this.runSector()) * (this.hard ? 1.6 : 1);
      const u = this.makeUnit(g.kind, x, y, Math.random() < eliteChance);
      if (!u) break;
      made++;
      u.from = g.from;
      u.side = side;
      u.gx = gx;
      u.gy = gy;
      u.baseX = gx;
      u.cluster = cluster;
      u.cidx = i;
      u.delay = i * (g.gap ?? 0.6);
      u.p3y = rand(FH * 0.36, FH * 0.5); // crawler hunt line
      u.state = U_ENTER;
      if (g.kind === 'wraith') {
        if (g.from === 'swoop') {
          u.state = U_SWOOP;
          const cx = FW / 2;
          const k = i - (g.n - 1) / 2;
          u.p0x = x;
          u.p0y = y;
          u.p1x = cx + side * FW * 0.15;
          u.p1y = FH * 0.55;
          u.p2x = cx - side * FW * 0.35;
          u.p2y = FH * 0.22;
          u.p3x = cx + k * 58;
          u.p3y = 120 + Math.abs(k) * 24;
          u.pdur = 4.6;
          u.pt = 0;
        } else u.state = U_ACT;
      }
      if ((g.kind === 'leech' || g.kind === 'crawler') && g.from === 'boss') u.state = U_HUNT;
      if (g.from === 'below') {
        u.delay = Math.max(u.delay, 1.4 + i * 0.15);
        u.p2x = x;
      }
      if (g.from === 'pincer') u.delay = Math.floor(i / 2) * (g.gap ?? 0.3);
      this.applyRole(u, g.role ?? this.pickRole(g.kind));
      if (u.elite) this.rollAffixes(u);
      if (u.delay <= 0) spawnEnemy(u.e);
    }
    return made;
  }

  // ================================================================ roles & affixes
  private pickRole(kind: EnemyKind): Role {
    const mix = this.sector.roleMix[kind];
    if (!mix || this.phase === 'menu') return '';
    const r = this.weighted(mix);
    return r ?? '';
  }

  private weighted<T>(items: Array<[T, number]>): T | null {
    let total = 0;
    for (const [, w] of items) total += w;
    let x = Math.random() * total;
    for (const [v, w] of items) {
      x -= w;
      if (x <= 0) return v;
    }
    return items.length ? items[items.length - 1][0] : null;
  }

  private applyRole(u: Unit, role: Role): void {
    if (role === 'shieldBearer') {
      let n = 0;
      for (const o of this.units) if (!o.dead && o.state !== U_DYING && o.role === 'shieldBearer') n++;
      if (n >= 2) role = '';
    }
    u.role = role;
    u.roleT = rand(1.5, 3);
    if (role === 'shieldBearer') {
      u.domeMax = Math.round(u.maxHp * 0.8);
      u.dome = u.domeMax;
      u.e.shieldR = 105;
    }
    u.e.role = role || undefined;
  }

  private rollAffixes(u: Unit): void {
    const pool = this.sector.affixes.slice();
    const n = Math.random() < (this.hard ? 0.25 + 0.25 * this.runSector() : this.runSector() >= 2 ? 0.4 : 0) ? 2 : 1;
    const out: Affix[] = [];
    for (let i = 0; i < n && pool.length; i++) out.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]);
    u.affixes = out;
    u.e.affixes = out;
    if (out.includes('Shielded')) u.ward = Math.round(u.maxHp * 0.6);
  }

  private hasAffix(u: Unit, a: Affix): boolean {
    return u.affixes.length > 0 && u.affixes.includes(a);
  }

  /** Role behaviour for units past their entry. Returns the intent (or undefined = not handled). */
  private roleTick(u: Unit, dt: number, playing: boolean): Vec | EnemyIntent | null | undefined {
    const e = u.e;
    const hasted = this.hasAffix(u, 'Hasted') ? 1.6 : 1;
    // sentinels hand back to the station logic when they must relocate
    if (e.kind === 'sentinel' && u.pt === 0) {
      u.actT -= dt;
      if (u.actT <= 0 || this.stallPull || e.x < this.inset + 40 || e.x > this.FW - this.inset - 40) return undefined;
    }
    // defend encounters: half the attackers go for the node instead of the player
    const toNode = this.node.on && u.id % 2 === 0;
    const px = toNode ? this.node.x : this.px;
    const py = toNode ? this.node.y : this.py;
    const dx = px - e.x;
    const dy = py - e.y;
    const dp = Math.hypot(dx, dy) || 1;
    u.roleT -= dt * hasted;
    switch (u.role) {
      case 'flanker': {
        if (e.kind !== 'crawler' && e.kind !== 'fragment') return undefined;
        if (e.mode !== 0) return null;
        const fa = u.side < 0 ? -Math.PI * 0.82 : -Math.PI * 0.18;
        if (playing && u.roleT <= 0 && dp < 200 && e.kind === 'crawler') {
          crawlerLunge(e);
          u.roleT = rand(2.2, 3.4);
        }
        return this.goal(u, clamp(px + Math.cos(fa) * 150, 30, this.FW - 30), clamp(py + Math.sin(fa) * 150, 40, this.FH - 40), 86 * hasted);
      }
      case 'diver': {
        if (e.kind === 'crawler' && e.mode !== 0) return null;
        if (playing && dp < 74 && e.kind === 'crawler') crawlerLunge(e);
        return this.goal(u, px, py, 86 * hasted);
      }
      case 'surrounder': {
        const a = -Math.PI / 2 + ((u.cidx % 5) - 2) * 0.42 + (u.cluster % 2 ? 0.2 : -0.2);
        this.swarmShot(u, dt, playing);
        return this.goal(u, clamp(px + Math.cos(a) * 175, 30, this.FW - 30), clamp(py + Math.sin(a) * 175, 40, this.FH - 40), 70);
      }
      case 'dodger': {
        if (e.kind !== 'wraith') return undefined;
        if (u.state === U_STRIKE) return null;
        // sidestep incoming player fire, else circle above the player
        let threat = false;
        for (const b of this.bullets) {
          if (!b.active || b.y < e.y || b.y - e.y > 140) continue;
          if (Math.abs(b.x - e.x) < 36) {
            threat = true;
            break;
          }
        }
        if (threat && u.roleT <= 0) {
          u.roleT = 1.1;
          u.p2y = 0.38;
        }
        if (u.p2y > 0) {
          u.p2y -= dt;
          roleIntent.mode = 'evade';
          roleIntent.threatDir = { x: 0, y: -1 };
          return roleIntent;
        }
        roleIntent.threatDir = undefined;
        rolePoint.x = clamp(this.px, 160, this.FW - 160);
        rolePoint.y = Math.max(150, this.py - 230);
        roleIntent.mode = 'orbit';
        roleIntent.radius = 130;
        if (playing && u.shotT === -1 && this.visibleForFire(u)) {
          u.shotT = rand(3, 5);
          this.queueTell(u, EB_NEEDLE, 3 + this.runSector(), 0.18, this.sector.bulletSpeed * 1.15);
        }
        return roleIntent;
      }
      case 'mender': {
        let best: Unit | null = null;
        let bf = 1;
        for (const o of this.units) {
          if (o === u || o.dead || o.state === U_DYING || o.state === U_BOSS || o.delay > 0 || o.role === 'mender') continue;
          const f = o.hp / o.maxHp;
          if (f >= bf) continue;
          if ((o.e.x - e.x) ** 2 + (o.e.y - e.y) ** 2 > 280 * 280) continue;
          bf = f;
          best = o;
        }
        if (best) {
          e.mendTarget = best.e;
          best.hp = Math.min(best.maxHp, best.hp + best.maxHp * 0.025 * dt);
          if (Math.random() < dt * 6) this.particle(P_EMBER, best.e.x, best.e.y, 0, -20, 0.3, 10, C_ORANGE, 0);
          rolePoint.x = clamp(best.e.x, 90, this.FW - 90);
          rolePoint.y = clamp(best.e.y - 20, 90, this.FH - 90);
          roleIntent.mode = 'orbit';
          roleIntent.radius = 70;
        } else {
          e.mendTarget = null;
          rolePoint.x = this.FW / 2 + Math.sin(u.t * 0.3 + u.id) * 160;
          rolePoint.y = this.FH * 0.25;
          roleIntent.mode = 'orbit';
          roleIntent.radius = 60;
        }
        if (e.kind === 'swarm') this.swarmShot(u, dt, playing);
        return roleIntent;
      }
      case 'shieldBearer': {
        if (u.dome <= 0) {
          e.role = undefined;
          if (u.roleT <= 0) {
            u.dome = u.domeMax;
            e.role = 'shieldBearer';
            e.shieldR = 105;
          }
        }
        if (e.kind === 'sentinel') return u.state === U_ACT ? HOLD : undefined;
        rolePoint.x = this.FW / 2 + Math.sin(u.t * 0.2 + u.id) * this.FW * 0.25;
        rolePoint.y = this.FH * 0.22;
        roleIntent.mode = 'orbit';
        roleIntent.radius = 50;
        return roleIntent;
      }
      case 'suppressor':
      case 'sniper': {
        if (e.kind !== 'sentinel' || u.state !== U_ACT) return undefined;
        const sniper = u.role === 'sniper';
        if (u.pt === 0 && u.roleT <= 0 && playing && this.visibleForFire(u) && this.onScreen(e, 30)) {
          u.pt = 1;
          u.roleT = (sniper ? 1.7 : 0.75) * (this.hard ? 0.75 : 1);
          u.tellA = Math.atan2(this.py - e.y, this.px - e.x);
        } else if (u.pt === 1) {
          // charge: sniper keeps tracking until the last 0.45 s, suppressor locks immediately
          if (sniper && u.roleT > 0.45) u.tellA = Math.atan2(this.py - e.y, this.px - e.x);
          if (u.roleT <= 0) {
            u.pt = 2;
            u.p2y = 0;
            u.shotT = 0;
          }
        } else if (u.pt === 2) {
          if (!this.visibleForFire(u)) u.pt = 0;
          else if (sniper) {
            this.sniperBeam(u);
            u.pt = 0;
            u.roleT = rand(5, 7) / hasted;
          } else {
            u.shotT -= dt;
            if (u.shotT <= 0) {
              u.shotT = 0.09;
              const sp = this.sector.bulletSpeed * 1.05;
              this.ebullet(EB_ORB, e.x + Math.cos(u.tellA) * 20, e.y + Math.sin(u.tellA) * 20, Math.cos(u.tellA) * sp, Math.sin(u.tellA) * sp);
              this.sfx('enemyShot');
              u.p2y++;
              if (u.p2y >= (this.runSector() === 0 ? 4 : 6)) {
                u.pt = 0;
                u.roleT = rand(3.5, 5) / hasted;
              }
            }
          }
        }
        return HOLD;
      }
    }
    return undefined;
  }

  private swarmShot(u: Unit, dt: number, playing: boolean): void {
    if (!playing || this.runSector() === 0) return;
    u.shotT -= dt;
    if (u.shotT <= 0 && this.visibleForFire(u)) {
      u.shotT = rand(3.5, 6) / (1 + 0.3 * this.runSector());
      this.queueTell(u, EB_PELLET, 2 + this.runSector(), 0.22, this.sector.bulletSpeed * 0.85);
    }
  }

  private sniperBeam(u: Unit): void {
    const e = u.e;
    const a = u.tellA;
    const x2 = e.x + Math.cos(a) * 1400;
    const y2 = e.y + Math.sin(a) * 1400;
    const b = this.beams.find((x) => !x.active);
    if (b) {
      b.active = true;
      b.x1 = e.x;
      b.y1 = e.y;
      b.x2 = x2;
      b.y2 = y2;
      b.life = 0.25;
    }
    this.sfx('laser');
    this.addShake(4);
    // distance from the player to the beam ray
    const vx = Math.cos(a);
    const vy = Math.sin(a);
    const t = (this.px - e.x) * vx + (this.py - e.y) * vy;
    if (t > 0) {
      const d = Math.abs((this.px - e.x) * vy - (this.py - e.y) * vx);
      if (d < 13) this.hurtPlayer(26, this.px, this.py);
    }
  }

  /** Damage routed through wards and shield-bearer domes. Returns what reaches hp. */
  private absorb(u: Unit, dmg: number, x: number, y: number): number {
    if (u.ward > 0) {
      const a = Math.min(u.ward, dmg);
      u.ward -= a;
      dmg -= a;
      if (Math.random() < 0.4) this.sparks(x, y, -Math.PI / 2, 1.4, 2, 80, 220, C_WHITE);
      if (u.ward <= 0) this.particle(P_HEX, u.e.x, u.e.y, 50, 0, 0.3, u.r, C_WHITE, 0);
      if (dmg <= 0) return 0;
    }
    if (u.role === 'shieldBearer' || u.state === U_BOSS) return dmg;
    for (const b of this.units) {
      if (b.role !== 'shieldBearer' || b.dome <= 0 || b.dead || b.state === U_DYING) continue;
      if ((b.e.x - u.e.x) ** 2 + (b.e.y - u.e.y) ** 2 > 105 * 105) continue;
      b.dome -= dmg;
      this.sparks(x, y, Math.atan2(y - b.e.y, x - b.e.x), 1.2, 2, 80, 220, C_WHITE);
      if (b.dome <= 0) {
        b.dome = 0;
        b.roleT = 8;
        b.e.role = undefined;
        this.particle(P_RING, b.e.x, b.e.y, 120, 0, 0.35, 30, C_WHITE, 0);
        this.sfx('shieldHit');
      }
      return 0;
    }
    return dmg;
  }

  private affixTick(u: Unit, dt: number): void {
    if (!u.affixes.length) return;
    const e = u.e;
    if (this.hasAffix(u, 'Phasing')) {
      if (u.phaseT > 0) u.phaseT -= dt;
      else {
        u.phaseCd -= dt;
        if (u.phaseCd < 0.45 && Math.random() < 0.5) u.flash = 0.03; // flicker tell
        if (u.phaseCd <= 0) {
          u.phaseT = 1.1;
          u.phaseCd = rand(3.5, 5);
        }
      }
    }
    if (this.hasAffix(u, 'Vampiric') && (e.x - this.px) ** 2 + (e.y - this.py) ** 2 < 230 * 230) {
      u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.05 * dt);
    }
  }

  private onAffixDeath(u: Unit): void {
    const e = u.e;
    if (this.hasAffix(u, 'Splitting') && u.kind !== 'fragment') {
      for (let k = -1; k <= 1; k += 2) {
        const kind: EnemyKind = u.kind === 'sentinel' || u.kind === 'swarm' ? 'crawler' : u.kind;
        const m = this.makeUnit(kind, e.x + k * 16, e.y, false, KIND_STATS[kind].size * 0.75);
        if (!m) break;
        m.hp = m.maxHp = Math.max(1, Math.round(u.maxHp * 0.3));
        m.state = kind === 'leech' || kind === 'crawler' ? U_HUNT : U_ACT;
        m.from = 'boss';
        m.side = k;
        this.applyRole(m, kind === 'crawler' ? 'diver' : '');
        spawnEnemy(m.e);
      }
    }
    if (this.hasAffix(u, 'Volatile')) {
      const b = this.blasts.find((x) => !x.active);
      if (b) {
        b.active = true;
        b.x = e.x;
        b.y = e.y;
        b.t = 0.7;
        b.max = 0.7;
      }
    }
  }

  // ================================================================ encounters
  private pickEncounter(avoid: EncounterId[]): EncounterId {
    const r = this.run;
    // the first two waves of the run stay standard so new players can learn
    if (r && r.sector === 0 && r.waveInSector < 2) return 'standard';
    const mix = SECTOR_ENCOUNTERS[this.runSector()] ?? SECTOR_ENCOUNTERS[0];
    const opts = mix.filter(([id]) => !avoid.includes(id) && id !== (r ? r.lastEnc : 'standard'));
    const rng = r ? r.mapRng : null;
    let total = 0;
    for (const [, w] of opts) total += w;
    let x = (rng ? rng.next() : Math.random()) * total;
    for (const [id, w] of opts) {
      x -= w;
      if (x <= 0) return id;
    }
    return opts.length ? opts[0][0] : 'standard';
  }

  private setupEncounter(id: EncounterId, groups: GroupDef[]): void {
    const FW = this.FW;
    const FH = this.FH;
    this.enc = id;
    this.inset = 0;
    this.hazT = 3;
    for (const w of this.hazWalls) w.active = false;
    this.scanR = -1;
    this.scanT = 1;
    this.pools = [];
    this.poolT = 0;
    this.node.on = false;
    this.huntId = -1;
    this.encBonus = false;
    switch (id) {
      case 'siege':
        groups.push({ kind: 'sentinel', n: this.runSector() === 0 ? 1 : 2, from: 'top', at: 0, gap: 0.6, role: 'shieldBearer' });
        groups.push({ kind: 'sentinel', n: this.runSector() === 0 ? 1 : 2, from: 'edges', at: 1.5, gap: 0.6, role: 'suppressor' });
        break;
      case 'ambush':
        for (let i = 0; i < groups.length; i++) {
          const g = groups[i];
          if (g.kind !== 'sentinel' && (this.runSector() > 1 || i % 2 === 1)) groups[i] = { ...g, from: 'below' };
        }
        break;
      case 'corrupt':
        for (let i = 0; i < 3; i++) this.pools.push({ x: rand(70, FW - 70), y: rand(FH * 0.5, FH * 0.9), r: rand(48, 64), a: 0, vx: rand(-12, 12), vy: rand(-8, 8) });
        this.poolT = 14;
        break;
      case 'defend':
        this.node = { on: true, x: FW / 2, y: FH * 0.5, hp: 100, max: 100, t: DEFEND_TIME };
        break;
      case 'hunt':
        groups.push({ kind: 'swarm', n: 1, from: 'top', at: 0.5, gap: 0 });
        break;
    }
  }

  private encounterTick(dt: number): void {
    const FW = this.FW;
    const FH = this.FH;
    // collapsing firewall: walls + narrowing arena
    if (this.enc === 'collapse' && this.clearT < 0) {
      this.inset = Math.min(FW * 0.16, this.inset + dt * 2.4);
      this.hazT -= dt;
      if (this.hazT <= 0) {
        this.hazT = rand(4.5, 6);
        const w = this.hazWalls.find((x) => !x.active);
        if (w) {
          w.active = true;
          w.y = -10;
          w.gapW = 110;
          w.gapX = rand(this.inset + 70, FW - this.inset - 70);
          w.gapV = (Math.random() < 0.5 ? -1 : 1) * rand(40, 70);
          w.hit = false;
          this.sfx('laser');
        }
      }
    }
    for (const w of this.hazWalls) {
      if (!w.active) continue;
      w.y += 95 * dt;
      w.gapX += w.gapV * dt;
      if (w.gapX < this.inset + 60 || w.gapX > FW - this.inset - 60) w.gapV = -w.gapV;
      if (!w.hit && Math.abs(this.py - w.y) < 8 && Math.abs(this.px - w.gapX) > w.gapW / 2) {
        w.hit = true;
        this.hurtPlayer(14, this.px, w.y);
      }
      if (w.y > FH + 20) w.active = false;
    }
    if (this.inset > 0 && (this.px < this.inset || this.px > FW - this.inset)) this.drain(dt * 10);
    // blackout scan pulse
    if (this.enc === 'blackout') {
      this.scanT -= dt;
      if (this.scanT <= 0) {
        this.scanT = 3.2;
        this.scanR = 10;
        this.sfx('empReady');
      }
      if (this.scanR >= 0) {
        this.scanR += 520 * dt;
        if (this.scanR > Math.max(FW, FH) * 1.3) this.scanR = -1;
      }
    }
    // corrupted pools: drift, relocate with a fade-in telegraph
    this.slowed = false;
    if (this.pools.length) {
      this.poolT -= dt;
      for (const pl of this.pools) {
        pl.a = Math.min(1, pl.a + dt / 1.5);
        pl.x = clamp(pl.x + pl.vx * dt, 50, FW - 50);
        pl.y = clamp(pl.y + pl.vy * dt, FH * 0.45, FH - 40);
        if (pl.a >= 1 && (this.px - pl.x) ** 2 + (this.py - pl.y) ** 2 < pl.r * pl.r) {
          this.slowed = true;
          this.drain(dt * 5);
        }
      }
      if (this.poolT <= 0) {
        this.poolT = 14;
        const pl = this.pools[(Math.random() * this.pools.length) | 0];
        pl.x = rand(70, FW - 70);
        pl.y = rand(FH * 0.5, FH * 0.9);
        pl.a = 0;
      }
    }
    // defend the node
    const n = this.node;
    if (n.on && this.clearT < 0) {
      n.t -= dt;
      for (const u of this.units) {
        if (!this.tangible(u) || u.state === U_BOSS) continue;
        if ((u.e.x - n.x) ** 2 + (u.e.y - n.y) ** 2 < (u.r + 26) ** 2) {
          n.hp -= u.contact * 0.8;
          this.killUnit(u, false);
        }
      }
      for (const b of this.ebullets) {
        if (b.active && (b.x - n.x) ** 2 + (b.y - n.y) ** 2 < 22 * 22) {
          b.active = false;
          n.hp -= 4;
        }
      }
      if (n.hp <= 0) {
        n.on = false;
        this.hp = Math.max(1, this.hp - 30 * this.sector.dmgMul);
        this.damageFlash = 1;
        this.say('NODE LOST', 'FEEDBACK SURGE // -INTEGRITY', true, 2);
        this.sfx('damage');
      } else if (n.t <= 0) {
        n.on = false;
        this.encBonus = true;
        this.groupIdx = this.groups.length;
        for (const u of this.units) if (!u.dead && u.state !== U_DYING) this.killUnit(u, false);
        this.say('NODE SECURED', 'BONUS MODULE UNLOCKED', false, 2);
        this.sfx('clear');
      }
    }
    // hunt: the summoner flees, summons, escapes
    if (this.huntId >= 0) {
      const h = this.units.find((x) => x.id === this.huntId);
      if (!h || h.dead || h.state === U_DYING) this.huntId = -1;
      else {
        this.huntT -= dt;
        h.roleT -= dt;
        if (h.roleT < 0.5 && h.roleT + dt >= 0.5) this.particle(P_RING, h.e.x, h.e.y, 60, 0, 0.5, 20, C_RED, 0); // summon tell
        if (h.roleT <= 0) {
          h.roleT = 5;
          for (let k = 0; k < 2; k++) this.spawnGroup({ kind: 'crawler', n: 1, from: 'boss', at: 0, gap: 0, role: 'diver' }, false, h.e.x, h.e.y);
        }
        if (this.huntT <= 0 && h.e.y < -30) {
          h.dead = true;
          this.huntId = -1;
          this.say('TARGET ESCAPED', 'NO BONUS', true, 1.6);
        }
      }
    }
  }

  /** Hunt target behaviour: keep away from the player, then escape upward. */
  private huntIntent(u: Unit): Vec {
    if (this.huntT <= 0) return this.goal(u, u.e.x, -80, 90);
    const away = u.e.x < this.px ? -1 : 1;
    const gx = clamp(u.e.x + away * 120, 60, this.FW - 60);
    return this.goal(u, gx, 90 + Math.sin(u.t * 0.8) * 40, 70);
  }

  private tangible(u: Unit): boolean {
    if (u.dead || u.delay > 0 || u.state === U_DYING) return false;
    const e = u.e;
    if (!e.alive) return false;
    if (e.kind === 'wraith' && e.vis < 0.45) return false;
    if (u.phaseT > 0) return false;
    if (u.state === U_BOSS && this.bc && !this.bc.tangible) return false;
    return e.x > -12 && e.x < this.FW + 12 && e.y > -12 && e.y < this.FH + 12;
  }

  /** Start a shot tell: core flash + aim line for TELL_TIME, then fire if still visible. */
  private queueTell(u: Unit, kind: number, n: number, spread: number, speed: number): void {
    if (u.tellT > 0 || this.phase !== 'playing') return;
    u.tellT = this.hard ? TELL_TIME * 0.75 : TELL_TIME;
    u.tellA = Math.atan2(this.py - u.e.y, this.px - u.e.x);
    u.tellKind = kind;
    u.tellN = n;
    u.tellSpread = spread;
    u.tellSpeed = speed;
  }

  private releaseTell(u: Unit): void {
    if (!this.visibleForFire(u) || this.phase !== 'playing' || this.dying >= 0) return;
    const e = u.e;
    this.aimed(u.tellKind, e.x, e.y, u.tellSpeed, u.tellN, u.tellSpread, u.tellA);
    this.particle(P_EMBER, e.x, e.y, 0, 0, 0.15, 26, C_RED, 0);
    this.sfx('enemyShot');
  }

  countAlive(): number {
    let n = 0;
    for (const u of this.units) if (!u.dead && u.state !== U_DYING) n++;
    return n;
  }

  private beginWave(elite: boolean, fightBonus: boolean): void {
    const r = this.run;
    if (!r) return;
    this.resetCombat();
    r.waveNo++;
    const sec = this.sector;
    const idx = Math.min(sec.waves.length - 1, r.waveInSector);
    const cnt = sec.countMul * (1 + (0.03 + 0.06 * r.sector) * idx) * (this.hard ? 1.2 : 1);
    const pace = (1 - 0.06 * idx) * (this.hard ? 0.85 : 1);
    const enc = r.pendingEnc;
    r.pendingEnc = 'standard';
    r.lastEnc = enc;
    const ed = ENCOUNTERS[enc];
    this.encHp = ed.hpMul;
    const encCount = r.sector === 0 ? 1 + (ed.countMul - 1) * 0.55 : ed.countMul;
    const groups: GroupDef[] = sec.waves[idx].groups.map((x) => ({ ...x, n: Math.max(1, Math.round(x.n * cnt * (x.role ? 1 : encCount))), at: x.at * pace }));
    if (elite) for (const g of sec.eliteExtra) groups.push({ ...g, n: Math.round(g.n * cnt) + 1 });
    this.setupEncounter(enc, groups);
    groups.sort((a, b) => a.at - b.at);
    this.groups = groups;
    this.groupIdx = 0;
    this.sinceKill = 0;
    this.stallPull = false;
    this.waveClock = 0;
    this.waveTotal = groups.reduce((a, g) => a + g.n, 0);
    this.waveActive = true;
    this.waveElite = elite;
    this.fightBonus = fightBonus;
    this.isBoss = false;
    this.fireDirT = 2.5;
    this.strikeT = 4;
    this.hitThisWave = false;
    this.healBudget = this.stats.maxHp * (this.hard ? 0.2 : 0.3);
    this.stealBudget = this.stats.maxHp * (this.hard ? 0.4 : 0.5);
    const label = `SECTOR ${r.sector + 1} // WAVE ${r.waveInSector + 1}/${sec.waves.length}`;
    if (elite) {
      this.say(FLAVOR.elite[(Math.random() * FLAVOR.elite.length) | 0], label, true, 2.4);
      this.sfx('boss');
    } else {
      this.say(FLAVOR.wave[(Math.random() * FLAVOR.wave.length) | 0], label, false, 2.2);
      this.sfx('wave');
    }
    if (enc !== 'standard') this.say(ed.name, ed.rule.toUpperCase(), enc === 'ambush' || enc === 'hunt', 3);
    this.pushLog(`${elite ? 'elite ' : ''}${ed.name.toLowerCase()}: ${this.waveTotal} processes`);
    this.setPhase('playing');
  }

  private updateUnits(dt: number): void {
    const target = tmpV;
    const FH = this.FH;
    const FW = this.FW;
    const playing = this.phase === 'playing';
    let latched = 0;
    // swarm cluster anchors drift slowly across the upper / middle field
    const wc = this.waveClock;
    for (let i = 0; i < this.units.length; i++) {
      const u = this.units[i];
      if (u.dead) continue;
      if (u.delay > 0) {
        u.delay -= dt;
        if (u.delay > 0) continue;
        spawnEnemy(u.e);
      }
      target.x = this.px;
      target.y = this.py;
      const e = u.e;
      u.t += dt;
      u.stateT += dt;
      u.flash = Math.max(0, u.flash - dt);
      if (u.state === U_BOSS) {
        this.updateBossUnit(u, dt);
        continue;
      }
      if (u.state === U_DECOY) {
        if (this.bc) this.bc.updateDecoy(u, dt, target, intentV);
        else u.dead = true;
        continue;
      }
      if (u.state === U_DYING) {
        updateEnemy(e, dt, target, null);
        this.adoptFragments(u);
        if (e.done) u.dead = true;
        continue;
      }
      if (u.stunT > 0) {
        u.stunT -= dt;
        u.tellT = 0;
        u.pt = 0;
        e.vx = 0;
        e.vy = 0;
        e.kvx = 0;
        e.kvy = 0;
        e.charge = 0;
        if (Math.random() < dt * 6) this.particle(P_SPARK, e.x + rand(-u.r, u.r), e.y + rand(-u.r, u.r), rand(-60, 60), rand(-60, 60), 0.15, 1, C_WHITE, 4);
        continue;
      }
      // suppress library auto-attacks we schedule ourselves
      if (e.kind === 'sentinel' && e.mode === 0) e.dur = 1e9;
      if (e.kind === 'wraith' && e.mode === 0 && u.state !== U_STRIKE) e.modeT = 0;

      let intent: Vec | EnemyIntent | null = null;
      const dxp = this.px - e.x;
      const dyp = this.py - e.y;
      const dp = Math.hypot(dxp, dyp) || 1;
      this.affixTick(u, dt);
      let handled = false;
      if (u.carrier && this.boss && this.bc) {
        const b = this.boss.e;
        intent = this.goal(u, b.x, b.y, e.kind === 'fragment' ? 40 : 32);
        handled = true;
        if ((b.x - e.x) ** 2 + (b.y - e.y) ** 2 < (this.boss.r * 0.7) ** 2) {
          this.bc.carrierArrived(this.boss, b as Boss);
          u.dead = true;
          e.alive = false;
          continue;
        }
      } else if (u.hunted) {
        intent = this.huntIntent(u);
        handled = true;
      } else if (u.role && (u.state === U_ACT || u.state === U_HUNT)) {
        const ri = this.roleTick(u, dt, playing);
        if (ri !== undefined) {
          intent = ri;
          handled = true;
        }
      }
      if (!handled) switch (e.kind) {
        case 'crawler': {
          if (u.state === U_ENTER) {
            intent = this.goal(u, u.gx, u.gy, 80);
            if (this.onScreen(e, 16) && (u.role === 'diver' || u.role === 'flanker' || Math.hypot(u.gx - e.x, u.gy - e.y) < 30 || u.stateT > 7)) {
              u.state = U_ACT;
              u.stateT = 0;
              u.baseX = e.x;
            }
          } else if (u.state === U_ACT) {
            // skitter down in a zig-zag, drifting off the walls
            u.baseX += (FW / 2 - u.baseX) * Math.min(1, dt * 0.15);
            const zx = clamp(u.baseX + Math.sin(u.t * 1.5 + u.id * 1.7) * 90, 30, FW - 30);
            intent = this.goal(u, zx, e.y + 70, 78);
            if (e.y > u.p3y || dp < 170) {
              u.state = U_HUNT;
              u.stateT = 0;
              u.actT = rand(0.8, 2);
            }
          } else if (u.state === U_HUNT && u.from === 'boss') {
            // boss summons: kamikaze straight at the ship through the firing line
            if (e.mode === 0) {
              intent = this.goal(u, this.px, this.py, 86);
              if (playing && dp < 72) crawlerLunge(e);
            }
          } else if (u.state === U_HUNT) {
            if (e.mode !== 0) {
              // freeze / lunge / recover run inside the module; then back off upward
              if (e.mode === 3) {
                u.state = U_RETREAT;
                u.stateT = 0;
              }
            } else {
              // hover in a band above the ship, inside its horizontal reach
              u.actT -= dt;
              const closing = u.actT <= 0;
              const hx = clamp(this.px + Math.sin(u.t * 0.9 + u.id * 2.3) * (closing ? 12 : 80), 24, FW - 24);
              const hy = Math.max(40, this.py - (closing ? 52 : 95 + (u.id % 3) * 22));
              intent = this.goal(u, hx, hy, 84);
              if (closing && Math.abs(e.x - this.px) < 30 && e.y < this.py - 30 && e.y > this.py - 80 && playing) {
                // lunge straight down through the firing line
                crawlerLunge(e);
                u.actT = rand(1.6, 3);
              } else if (closing && u.actT < -2.5) u.actT = rand(0.5, 1.2);
            }
          } else if (u.state === U_RETREAT) {
            intent = this.goal(u, e.x, Math.max(40, this.py - 170), 84);
            if (u.stateT > 1.1 && e.mode === 0) {
              u.state = U_HUNT;
              u.stateT = 0;
            }
          }
          break;
        }
        case 'sentinel': {
          if (u.state === U_ENTER) {
            intent = this.goal(u, u.gx, u.gy, 38);
            if (Math.hypot(u.gx - e.x, u.gy - e.y) < 10 || u.stateT > 16) {
              u.state = U_ACT;
              u.stateT = 0;
              u.actT = rand(12, 18);
            }
          } else if (u.state === U_RETREAT) {
            u.state = U_ENTER;
            u.gy = Math.min(u.gy, FH * 0.38);
          } else {
            u.actT -= dt;
            const edge = this.inset + 40;
            if ((e.x < edge || e.x > FW - edge || this.stallPull) && e.mode === 0) u.actT = 0;
            if (u.actT <= 0 && e.mode === 0) {
              if (this.stallPull) u.gx = rand(FW * 0.3, FW * 0.7);
              u.gx = clamp(this.stallPull ? u.gx : e.x + rand(-140, 140), Math.max(44, edge), Math.min(FW - 44, FW - edge));
              u.gy = clamp(e.y + rand(-50, 50), 70, FH * 0.38);
              u.state = U_ENTER;
              u.stateT = 0;
            }
          }
          break;
        }
        case 'leech': {
          if (u.state === U_ENTER || u.state === U_HUNT) {
            if (u.state === U_ENTER && this.onScreen(e, 10)) {
              u.state = U_HUNT;
              u.stateT = 0;
            }
            if (e.mode === 0) {
              const w = Math.sin(u.t * 2.6 + u.id) * 0.4;
              const ax = dxp / dp - (dyp / dp) * w;
              const ay = dyp / dp + (dxp / dp) * w;
              const al = Math.hypot(ax, ay) || 1;
              intentV.x = (ax / al) * 72;
              intentV.y = (ay / al) * 72;
              intent = intentV;
              u.actT -= dt;
              if (playing && u.state === U_HUNT && dp < 72 && u.actT <= 0 && this.dashT <= 0 && this.latchedCount < 2) {
                leechToggleLatch(e);
                u.actT = 1.2;
              }
            }
            if (leechIsLatched(e)) {
              u.state = U_LATCH;
              u.stateT = 0;
              this.sfx('latch');
              this.say(FLAVOR.latch, 'INTEGRITY DRAINING', true, 1.6);
              this.pushLog('leech latched');
            }
          } else if (u.state === U_LATCH) {
            if (!leechIsLatched(e)) {
              u.state = U_RETREAT;
              u.stateT = 0;
            } else {
              latched++;
              if (playing) this.drain(dt * 9);
            }
          } else if (u.state === U_RETREAT) {
            intent = this.goal(u, e.x - (dxp / dp) * 120, Math.max(60, Math.min(e.y - 160, this.py - 170)), 79);
            if (u.stateT > 1.6) {
              u.state = U_HUNT;
              u.stateT = 0;
              u.actT = 0.8;
            }
          }
          break;
        }
        case 'wraith': {
          if (u.state === U_SWOOP) {
            u.pt = Math.min(1, u.pt + dt / u.pdur);
            const t = u.pt;
            const t2 = Math.min(1, t + 0.02);
            const qx = bez(t, u.p0x, u.p1x, u.p2x, u.p3x);
            const qy = bez(t, u.p0y, u.p1y, u.p2y, u.p3y);
            const vx = (bez(t2, u.p0x, u.p1x, u.p2x, u.p3x) - qx) / (0.02 * u.pdur);
            const vy = (bez(t2, u.p0y, u.p1y, u.p2y, u.p3y) - qy) / (0.02 * u.pdur);
            intentV.x = clamp(vx + (qx - e.x) * 2.5, -120, 120);
            intentV.y = clamp(vy + (qy - e.y) * 2.5, -120, 120);
            intent = intentV;
            if (u.pt >= 1) {
              u.state = U_ACT;
              u.stateT = 0;
              u.gx = u.p3x;
              u.gy = u.p3y;
              u.actT = rand(2, 4);
            }
          } else if (u.state === U_RETREAT) {
            intent = this.goal(u, e.x, Math.max(60, this.py - 220), 95);
            if (u.stateT > 1.2) {
              u.state = U_ACT;
              u.stateT = 0;
              u.gy = rand(70, FH * 0.35);
            }
          } else if (u.state === U_STRIKE) {
            // phased out and relocating next to the player (library-driven)
            if ((e.mode === 0 && u.stateT > 0.4) || u.stateT > 5) {
              u.state = U_ACT;
              u.stateT = 0;
              u.shotT = -1; // strike shot pending once fully visible
              u.gx = clamp(e.x + rand(-80, 80), 60, FW - 60);
              u.gy = rand(70, FH * 0.35);
              u.actT = rand(2.5, 4);
            }
          } else {
            u.actT -= dt;
            if (u.actT <= 0 || Math.hypot(u.gx - e.x, u.gy - e.y) < 16) {
              u.gx = rand(60, FW - 60);
              u.gy = rand(70, FH * 0.42);
              u.actT = rand(3, 5);
            }
            intent = this.goal(u, u.gx, u.gy, u.shotT === -1 ? 20 : 60);
            if (playing && u.shotT === -1 && this.visibleForFire(u)) {
              u.shotT = rand(3, 5);
              this.queueTell(u, EB_NEEDLE, 3 + this.runSector(), 0.18, this.sector.bulletSpeed * 1.15);
            }
          }
          break;
        }
        case 'swarm': {
          const ax = FW / 2 + Math.sin(wc * 0.22 + u.cluster * 2.1) * FW * 0.3;
          const ay = FH * (0.24 + 0.12 * Math.sin(wc * 0.31 + u.cluster));
          const a = u.cidx * 2.09 + u.t * 0.35;
          intent = this.goal(u, ax + Math.cos(a) * 38, ay + Math.sin(a) * 30, u.state === U_ENTER || u.state === U_RETREAT ? 75 : 55);
          if ((u.state === U_ENTER && this.onScreen(e, 12)) || (u.state === U_RETREAT && u.stateT > 1.2)) u.state = U_ACT;
          if (playing && this.runSector() > 0 && u.state === U_ACT) {
            u.shotT -= dt;
            if (u.shotT <= 0 && this.visibleForFire(u)) {
              u.shotT = rand(3.5, 6) / (1 + 0.3 * this.runSector());
              this.queueTell(u, EB_PELLET, 2 + this.runSector(), 0.22, this.sector.bulletSpeed * 0.85);
            }
          }
          break;
        }
        case 'fragment': {
          u.life -= dt;
          if (u.state === U_RETREAT) {
            intent = this.goal(u, e.x, Math.max(40, this.py - 180), 200);
            if (u.stateT > 0.9) {
              u.state = U_FREE;
              u.stateT = 0;
            }
          } else if (u.life <= 0) {
            intentV.x = 0;
            intentV.y = 220;
            intent = intentV;
            if (e.y > FH + 30) u.dead = true;
          }
          break;
        }
        default:
          break;
      }
      // safety valve: wave stalled with no kills -> draw everything to the upper middle
      if (this.stallPull && playing && u.state !== U_LATCH && u.state !== U_STRIKE && e.kind !== 'sentinel') {
        intent = this.goal(u, FW / 2 + Math.sin(u.id * 1.7) * FW * 0.3, FH * 0.25 + Math.cos(u.id * 2.1) * 40, e.kind === 'fragment' ? 200 : 90);
      }
      updateEnemy(e, dt, target, intent);
      // nothing may idle beside / below the ship: after 1 s it backs off upward
      if (playing && e.y > this.py - 20 && u.state !== U_LATCH && u.state !== U_STRIKE && u.state !== U_RETREAT && !(e.kind === 'fragment' && u.life <= 0)) {
        u.belowT += dt;
        if (u.belowT > 1 && (e.kind !== 'crawler' || e.mode === 0) && (e.kind !== 'leech' || e.mode === 0)) {
          u.belowT = 0;
          u.state = U_RETREAT;
          u.stateT = 0;
          this.belowEvents++;
        }
      } else u.belowT = 0;

      // shot tells
      if (u.tellT > 0) {
        u.tellT -= dt;
        if (u.tellT <= 0) {
          u.tellT = 0;
          this.releaseTell(u);
        }
      }
      // sentinel shots: the library's charge-up (core + aim line) is the tell
      if (e.kind === 'sentinel' && e.fired && playing && this.visibleForFire(u)) {
        sentinelMuzzle(e, tmpV);
        this.aimed(EB_ORB, tmpV.x, tmpV.y, this.sector.bulletSpeed, 3 + (u.elite ? 2 : 0) + (this.runSector() >= 2 ? 2 : 0), 0.26, e.aim);
        this.sfx('enemyShot');
      }
    }
    this.latchedCount = latched;
  }

  /** Swarm nodes split into fragments after killEnemy; adopt them as units. */
  private adoptFragments(u: Unit): void {
    const e = u.e;
    if (e.kind !== 'swarm' || !e.spawned) return;
    for (const f of e.spawned) {
      if (this.units.length >= MAX_UNITS) break;
      const hp = Math.max(1, Math.round(KIND_STATS.fragment.hp * this.sector.hpMul));
      const fu: Unit = { ...this.blankUnit(f, 'fragment'), hp, maxHp: hp, state: U_FREE, life: rand(5, 8), minion: u.minion };
      this.units.push(fu);
    }
    e.spawned = null;
  }

  private blankUnit(e: Enemy, kind: EnemyKind): Unit {
    const ks = KIND_STATS[kind];
    return {
      id: this.nextId++,
      e,
      kind,
      state: U_FREE,
      from: 'phase',
      hp: ks.hp,
      maxHp: ks.hp,
      r: ks.r,
      gx: e.x,
      gy: e.y,
      baseX: e.x,
      p0x: 0, p0y: 0, p1x: 0, p1y: 0, p2x: 0, p2y: 0, p3x: 0, p3y: 0,
      pt: 0,
      pdur: 1,
      delay: 0,
      t: 0,
      stateT: 0,
      actT: 0,
      shotT: 0,
      tellT: 0,
      tellA: 0,
      tellKind: EB_PELLET,
      tellN: 1,
      tellSpread: 0,
      tellSpeed: 0,
      cluster: 0,
      cidx: 0,
      side: 1,
      flash: 0,
      elite: false,
      score: ks.score,
      contact: ks.contact,
      pulseHit: -1,
      dead: false,
      life: 6,
      belowT: 0,
      role: '',
      roleT: 2,
      dome: 0,
      domeMax: 0,
      affixes: [],
      ward: 0,
      phaseT: 0,
      phaseCd: 3,
      hunted: false,
      stunT: 0,
      stunMax: 1,
      carrier: false,
      minion: false,
    };
  }

  private director(dt: number): void {
    if (!this.waveActive || this.clearT >= 0) return;
    const sec = this.sector;
    if (!this.isBoss) {
      this.sinceKill += dt;
      if (this.sinceKill > 12 && !this.stallPull && this.countAlive() > 0) {
        this.stallPull = true;
        this.pushLog('stall: purge sweep');
      }
      this.waveClock += dt;
      let alive = this.countAlive();
      while (this.groupIdx < this.groups.length) {
        const g = this.groups[this.groupIdx];
        const due = this.waveClock >= g.at || alive <= 2;
        if (!due || alive >= sec.maxAlive) break;
        if (this.waveClock < g.at) this.waveClock = g.at;
        const made = this.spawnGroup(g, this.waveElite);
        alive += made;
        if (this.enc === 'hunt' && this.huntId < 0 && g.kind === 'swarm' && g.n === 1 && made) {
          const h = this.units[this.units.length - 1];
          h.hunted = true;
          h.elite = true;
          h.hp = h.maxHp = Math.round(h.maxHp * 3);
          h.role = '';
          h.e.role = undefined;
          h.roleT = 3;
          this.huntId = h.id;
          this.huntT = HUNT_ESCAPE;
        }
        this.groupIdx++;
      }
    }
    // sentinel volleys: one at a time, only from fully visible stations
    this.fireDirT -= dt;
    if (this.fireDirT <= 0) {
      const sents = this.units.filter((u) => u.e.kind === 'sentinel' && (u.role === '' || u.role === 'shieldBearer') && u.state === U_ACT && u.e.mode === 0 && this.visibleForFire(u) && this.onScreen(u.e, 30));
      const waveK = 1 - 0.06 * (this.run ? Math.min(5, this.run.waveInSector) : 0);
      this.fireDirT = sec.fireGap * waveK * rand(0.7, 1.3) * (sents.length > 3 ? 0.75 : 1) * (this.isBoss ? 1.6 : 1) * (this.hard ? 0.8 : 1);
      if (sents.length) {
        const s = sents[(Math.random() * sents.length) | 0];
        if (s.e.kind === 'sentinel') sentinelCharge(s.e);
      }
    }
    // wraith strikes
    this.strikeT -= dt;
    if (this.strikeT <= 0) {
      this.strikeT = sec.strikeGap * rand(0.8, 1.3);
      let striking = 0;
      for (const u of this.units) if (u.state === U_STRIKE) striking++;
      if (striking < 1 + this.runSector()) {
        const cands = this.units.filter((u) => u.e.kind === 'wraith' && u.state === U_ACT && u.stateT > 2.5 && u.shotT !== -1 && this.visibleForFire(u));
        if (cands.length) {
          const w = cands[(Math.random() * cands.length) | 0];
          if (w.e.kind === 'wraith') {
            wraithStrike(w.e);
            w.state = U_STRIKE;
            w.stateT = 0;
          }
        }
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
    const e = BossCtl.create(def, this, this.FW / 2, -def.size * 0.6);
    // scale with the player's build: average build at this point -> base hp
    // sqrt: a stronger build still kills faster, just not proportionally faster
    const REF = [1.6, 2.6, 3.4];
    const powerK = clamp(this.stats.power / REF[def.variant], 0.4, 3) * 1.15;
    const u = this.adoptUnit(e, 'boss', Math.round(def.hp * powerK * (this.hard ? 1.3 : 1)), U_BOSS);
    if (!u) return;
    u.r = def.size * 0.3;
    u.score = 5000 * (r.sector + 1);
    u.contact = 30;
    this.boss = u;
    this.bc = new BossCtl(def, this);
    this.waveActive = true;
    this.isBoss = true;
    this.groups = [];
    this.groupIdx = 0;
    this.waveTotal = 1;
    this.waveElite = false;
    this.fireDirT = 4;
    this.strikeT = 5;
    this.hitThisWave = false;
    this.healBudget = this.stats.maxHp * (this.hard ? 0.2 : 0.3);
    this.stealBudget = this.stats.maxHp * (this.hard ? 0.4 : 0.5);
    this.sfx(def.variant === 0 ? 'stingWarden' : def.variant === 1 ? 'stingEcho' : 'stingRoot');
    this.pushLog(`breach: ${def.name.toLowerCase()}`);
    this.setPhase('playing');
  }

  /** Wraps an externally created entity as a unit (boss, decoys). */
  /** Weak, quick boss minion (feeds on-kill perks). Carriers fly to the boss. */
  spawnMinion(kind: EnemyKind, x: number, y: number, carrier: boolean): Unit | null {
    const u = this.makeUnit(kind, x, y, false, KIND_STATS[kind].size * (kind === 'sentinel' ? 0.85 : 0.9));
    if (!u) return null;
    u.hp = u.maxHp = Math.max(1, Math.round(u.maxHp * 0.3));
    u.minion = true;
    u.carrier = carrier;
    u.from = 'boss';
    u.score = Math.round(u.score * 0.4);
    if (kind === 'fragment') {
      u.state = U_FREE;
      u.life = rand(6, 9);
    } else if (kind === 'crawler') {
      u.state = U_HUNT;
      this.applyRole(u, 'diver');
    } else if (kind === 'sentinel') {
      [u.gx, u.gy] = this.stationFor(Math.random() < 0.5 ? -1 : 1);
      u.state = U_ENTER;
    } else u.state = U_ACT;
    if (carrier) {
      u.state = U_FREE;
      u.life = 99;
    }
    spawnEnemy(u.e);
    return u;
  }

  adoptUnit(e: Enemy, kind: EnemyKind, hp: number, state: number): Unit | null {
    if (this.units.length >= MAX_UNITS) return null;
    const u: Unit = { ...this.blankUnit(e, kind), hp, maxHp: hp, state };
    this.units.push(u);
    return u;
  }

  /** Final boss: disable a random owned upgrade for a while. */
  hackRandomUpgrade(seconds: number): string | null {
    const r = this.run;
    if (!r || !r.build.length) return null;
    const pick = r.build[(Math.random() * r.build.length) | 0];
    this.hacked = pick.id;
    this.hackT = seconds;
    this.recomputeStats();
    this.ev.changed();
    return UPGRADE_BY_ID[pick.id]?.name ?? null;
  }

  private updateBossUnit(u: Unit, dt: number): void {
    const bc = this.bc;
    const e = u.e;
    if (!bc || e.kind !== 'boss') return;
    tmpV.x = this.px;
    tmpV.y = this.py;
    bc.update(u, dt, tmpV, intentV);
    if (bc.dying >= 0) {
      bc.dying += dt;
      if (Math.random() < dt * 14) {
        const a = Math.random() * TAU;
        const d = Math.random() * u.r;
        this.shatter(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, 20, 10, 0, 0, true);
        this.particle(P_RING, e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, 90, 0, 0.35, 8, C_RED, 0);
        this.addShake(3);
        this.sfx('death');
      }
      if (bc.dying > 1.6) this.finishBoss(u);
    }
  }

  private finishBoss(u: Unit): void {
    const r = this.run;
    const e = u.e;
    u.state = U_DYING;
    killEnemy(e);
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
    this.bc?.clearHazards();
    this.say(`${this.bc?.def.name ?? 'CORE'} PURGED`, 'SECTOR SECURED', false, 2.6);
    this.pushLog('sector intelligence purged');
  }

  clearEnemyBullets(): void {
    for (const b of this.ebullets) {
      if (!b.active) continue;
      b.active = false;
      if (Math.random() < 0.4) this.particle(P_EMBER, b.x, b.y, 0, 0, 0.25, 10, C_RED, 0);
    }
  }

  // ================================================================ damage
  private hitUnit(u: Unit, dmg: number, crit: boolean, x: number, y: number, chain: number, dx = 0, dy = -1): void {
    if (u.dead || u.state === U_DYING) return;
    if (u.state === U_BOSS && this.bc) {
      dmg = this.bc.filterDamage(u, dmg, x, y);
      if (dmg <= 0) {
        u.flash = 0.04;
        return;
      }
      dmg = this.bc.armor(u, dmg);
      const floor = this.bc.floor(u);
      if (u.hp - dmg < floor) {
        dmg = Math.max(0, u.hp - floor);
        if (!this.bc.gateOpen()) {
          this.bc.gated = 0.25;
          if (Math.random() < 0.3) this.sparks(x, y, -Math.PI / 2, 1.4, 2, 80, 240, C_WHITE);
        }
      }
      if (dmg <= 0) {
        u.flash = 0.03;
        return;
      }
      if (this.bc.ward > 0) {
        const a = Math.min(this.bc.ward, dmg);
        this.bc.ward -= a;
        dmg -= a;
        if (Math.random() < 0.3) this.sparks(x, y, -Math.PI / 2, 1.2, 2, 80, 220, C_WHITE);
        if (dmg <= 0) {
          u.flash = 0.03;
          return;
        }
      }
      // every 5% of boss hp lost counts as a kill for on-kill perks
      this.bc.breachAcc += dmg;
      const step = u.maxHp * 0.1;
      while (this.bc.breachAcc >= step && this.bc.breaches < 9) {
        this.bc.breachAcc -= step;
        this.bc.breaches++;
        this.breach(u, x, y, (u.hp - dmg) / u.maxHp);
      }
    }
    dmg = this.absorb(u, dmg, x, y);
    if (dmg <= 0) {
      u.flash = 0.03;
      return;
    }
    u.hp -= dmg;
    u.flash = 0.08;
    hurtEnemy(u.e, dx, dy, clamp((dmg / u.maxHp) * 3, 0.3, 1));
    if (crit) this.text(x, y - 8, `${Math.round(dmg * 10)}`, C_WHITE, false);
    if (u.hp <= 0) this.killUnit(u, true);
    if (chain > 0) this.chainFrom(u, x, y, dmg * this.stats.chainDmg, chain);
  }

  /** Boss "kill": on-kill perks fire at the last hit point. */
  private breachCombo = 0;

  private breach(u: Unit, x: number, y: number, frac: number): void {
    const bc = this.bc;
    if (!bc) return;
    bc.marks.push({ f: Math.max(0, frac), t: 0.8 });
    if (bc.marks.length > 8) bc.marks.shift();
    this.text(x, y - 14, 'BREACH', C_WHITE, false);
    this.particle(P_HEX, x, y, 40, 0, 0.25, 8, C_WHITE, 0);
    // a floor, not a feed: everything at 35% of a real kill; minions are the main feed
    const k = 0.35;
    if (this.stats.lifesteal > 0) this.heal(this.stats.lifesteal * k, 'steal');
    // explosion and chain from a breach only reach minions (the boss is the source and excluded)
    if (this.stats.cascade > 0) this.cascade(x, y, u.id, k);
    if (this.stats.chain > 0) this.chainFrom(u, x, y, this.stats.dmg * 2 * this.stats.chainDmg * k, this.stats.chain);
    this.breachCombo += k;
    if (this.breachCombo >= 1) {
      this.breachCombo -= 1;
      this.combo++;
      this.comboT = this.stats.comboTime;
      this.mult = Math.min(this.stats.comboCap, 1 + Math.floor(this.combo / 8));
    }
    if (this.stats.pulse) this.empCharge = Math.min(this.empCost, this.empCharge + 0.07 * this.stats.pulseRecharge * k);
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
    if (u.dead || u.state === U_DYING) return;
    const e = u.e;
    if (u.state === U_BOSS) {
      if (this.bc && this.bc.dying < 0) {
        this.bc.dying = 0;
        this.bc.clearHazards();
        this.hitstop = Math.max(this.hitstop, 0.25);
        this.addShake(14);
        this.clearEnemyBullets();
        this.ev.sound('bigDeath');
      }
      return;
    }
    if (u.state === U_DECOY && this.bc) this.bc.explodeDecoy(u);
    if (byPlayer) this.onAffixDeath(u);
    if (u.hunted && byPlayer) {
      this.encBonus = true;
      this.score += 2000;
      this.say('TARGET PURGED', '+2000 // BONUS MODULE', false, 2);
    }
    // death animation (swarm nodes split into fragments); unit stays until e.done
    u.state = U_DYING;
    u.tellT = 0;
    killEnemy(e);
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
    this.sinceKill = 0;
    this.stallPull = false;
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
    if (this.stats.lifesteal > 0) this.heal(this.stats.lifesteal, 'steal');
    if (this.stats.pulse) {
      const before = this.empCharge;
      this.empCharge = Math.min(this.empCost, this.empCharge + 0.07 * this.stats.pulseRecharge * (u.elite ? 2 : 1));
      if (before < this.empCost && this.empCharge >= this.empCost) {
        this.text(this.px, this.py - 50, 'EMP READY', C_ORANGE, true);
        this.sfx('empReady');
      }
    }
    this.maybeDrop(e.x, e.y, u.elite);
    if (this.stats.cascade > 0) this.cascade(e.x, e.y, u.id);
  }

  private cascade(x: number, y: number, srcId: number, scale = 1): void {
    const R = 58;
    const dmg = this.stats.dmg * this.stats.cascade * scale;
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
    const opts = this.stats.permOverclock ? [PK_RAPID, PK_OVERCLOCK, PK_RAPID, PK_OVERCLOCK] : [PK_RAPID, PK_SHIELD, PK_OVERCLOCK, PK_RAPID, PK_SHIELD, PK_OVERCLOCK];
    if (Math.random() < 0.12) opts.push(PK_REPAIR);
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

  hurtPlayer(dmg: number, x: number, y: number): void {
    if (this.dying >= 0 || this.inv > 0 || this.dashT > 0 || this.phase !== 'playing') return;
    if (this.buffShield > 0) {
      this.inv = 0.25;
      this.sparks(x, y, Math.atan2(y - this.py, x - this.px), 1.4, 8, 80, 260, C_WHITE);
      this.sfx('shieldHit');
      return;
    }
    let d = dmg * this.stats.dmgTaken * this.dmgScale();
    this.sinceHit = 0;
    this.inv = 0.7;
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

  drain(amount: number): void {
    if (this.dying >= 0 || this.buffShield > 0) return;
    let d = amount * this.stats.dmgTaken * this.dmgScale();
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
    if (this.phase !== 'playing' || this.dying >= 0 || !this.stats.pulse || this.empCharge < this.empCost) return;
    this.empCharge -= this.empCost;
    this.empUses++;
    this.empCost = 1 + 0.35 * this.empUses;
    this.empHealed = 0;
    this.pulseR = 10;
    this.pulseX = this.px;
    this.pulseY = this.py;
    this.pulseSerial++;
    this.addShake(9);
    this.hitstop = Math.max(this.hitstop, 0.05);
    this.particle(P_HEX, this.px, this.py, 140, 0, 0.4, 20, C_WHITE, 0);
    this.sfx('emp');
    this.pushLog('emp discharged');
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
    const dt = Math.min(dtIn, 0.05) * this.timeScale;
    this.time += dt;
    if (this.phase === 'paused') return;
    this.shake *= Math.exp(-dt * 10);
    if (this.shake < 0.05) this.shake = 0;
    this.damageFlash = Math.max(0, this.damageFlash - dt * 2.4);
    if (this.announceT > 0) this.announceT -= dt;

    if (this.phase === 'menu') {
      this.updateDemo(dt);
      this.updateParticles(dt);
      return;
    }
    if (this.phase !== 'playing') {
      // finish death animations behind the overlays
      for (const u of this.units) {
        if (u.state !== U_DYING || u.dead) continue;
        updateEnemy(u.e, dt, tmpV, null);
        if (u.e.done) u.dead = true;
      }
      this.compact();
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

  private demoT = 0;

  /** Attract mode behind the start screen: the real behaviours, no combat. */
  private spawnDemo(): void {
    this.units = [];
    this.demoT = 0;
    this.waveClock = 0;
    this.spawnGroup({ kind: 'sentinel', n: 2, from: 'edges', at: 0, gap: 0.5 }, false);
    this.spawnGroup({ kind: 'crawler', n: 4, from: 'walls', at: 0, gap: 0.9 }, false);
    this.spawnGroup({ kind: 'wraith', n: 2, from: 'phase', at: 0, gap: 1.5 }, false);
    this.spawnGroup({ kind: 'swarm', n: 3, from: 'cluster', at: 0, gap: 0.3 }, false);
  }

  private updateDemo(dt: number): void {
    this.demoT += dt;
    this.waveClock += dt;
    if (!this.units.length || this.demoT > 30) this.spawnDemo();
    this.px = this.FW / 2 + Math.sin(this.time * 0.5) * 170;
    this.py = this.FH - 90;
    this.updateUnits(dt);
    this.compact();
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
    this.encounterTick(dt);
    this.updateBlasts(dt);
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
      if (this.countAlive() === 0 && this.groupIdx >= this.groups.length && !this.node.on) {
        this.clearT = this.isBoss ? 2.4 : 1.6;
        if (!this.isBoss) {
          const sec = r ? r.sector : 0;
          const bonus = 500 * (sec + 1) * (this.waveElite ? 2 : 1);
          const nohit = this.hitThisWave ? 0 : 1000 * (sec + 1);
          const route = this.fightBonus ? 1500 : 0;
          this.score += bonus + nohit + route;
          // sector 1 only: a small patch after each wave
          if (sec === 0) this.heal(this.stats.maxHp * 0.08, 'wave');
          const fl = FLAVOR.clear[(Math.random() * FLAVOR.clear.length) | 0];
          this.say(fl, `+${bonus + route}${nohit ? `  //  FLAWLESS +${nohit}` : ''}`, false, 2);
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
      this.bc = null;
      r.afterPick = r.sector >= SECTORS.length - 1 ? 'victory' : 'nextSector';
      this.openOffer('boss');
    } else {
      r.waveInSector++;
      r.afterPick = 'routes';
      this.openOffer(this.waveElite || this.encBonus ? 'elite' : 'wave');
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
    const speed = st.moveSpeed * (over ? 1.12 : 1) * (this.slowed ? 0.55 : 1);
    const minY = this.FH * (1 - PLAYER_ZONE);
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
    if (st.pulse && this.empCharge < this.empCost && this.waveActive) this.empCharge = Math.min(this.empCost, this.empCharge + (dt / 120) * st.pulseRecharge);
    this.lsRecent = Math.max(0, this.lsRecent - dt * 2);
    this.healFlash = Math.max(0, this.healFlash - dt * 2.5);
    this.healShowT -= dt;
    if (this.healShowT <= 0 && this.healShow >= 0.5) {
      this.text(this.px, this.py - 34, `+${Math.round(this.healShow)}`, C_WHITE, false);
      this.healShow = 0;
      this.healShowT = 0.3;
    }
    this.buffRapid = Math.max(0, this.buffRapid - dt);
    this.buffShield = Math.max(0, this.buffShield - dt);
    this.buffOver = Math.max(0, this.buffOver - dt);
    this.sinceHit += dt;
    if (this.hackT > 0) {
      this.hackT -= dt;
      if (this.hackT <= 0) {
        this.hacked = null;
        this.recomputeStats();
        this.pushLog('module restored');
        this.ev.changed();
      }
    }
    if (this.hp > 0 && this.hp < this.stats.maxHp * 0.25) {
      this.alarmT -= dt;
      if (this.alarmT <= 0) {
        this.alarmT = 1.4;
        this.sfx('alarm');
      }
    } else this.alarmT = 0;
    if (st.shieldMax > 0 && this.sinceHit > st.shieldDelay) this.shield = Math.min(st.shieldMax, this.shield + st.shieldRegen * dt);
    if (st.hpDecay > 0 && this.waveActive && this.clearT < 0 && !(this.isBoss && this.bc && (this.bc.inv > 0 || this.bc.entering > 0)))
      this.hp = Math.max(1, this.hp - st.hpDecay * (this.isBoss ? 0.5 : 1) * dt);
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
          let aim = -Math.PI / 2;
          let bd = 170 * 170;
          for (const u of this.units) {
            if (!this.tangible(u) || u.e.y < this.py - 120) continue;
            const ex = u.e.x - dx;
            const ey = u.e.y - dy;
            const d2 = ex * ex + ey * ey;
            if (d2 < bd) {
              bd = d2;
              aim = Math.atan2(ey, ex);
            }
          }
          this.spawnBullet(dx, dy - 6, aim, st.bulletSpeed * 0.95, st.dmg * 0.6 * (crit ? st.critMult : 1), 0, st.bulletSize * 0.75, st.homing * 0.6, crit, true);
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
    // latched leeches sit beside the hull: every volley hits them point-blank
    if (this.latchedCount > 0) {
      for (const u of this.units) {
        if (u.state !== U_LATCH || u.dead) continue;
        this.sparks(u.e.x, u.e.y, Math.atan2(u.e.y - this.py, u.e.x - this.px), 1, 2, 80, 220, C_HOT);
        this.hitUnit(u, dmg * 0.7, false, u.e.x, u.e.y, 0, u.e.x - this.px, u.e.y - this.py);
        break;
      }
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

  private empHealed = 0;

  /** All integrity healing goes through here: per-wave cap, boss rules, lifesteal fatigue. */
  heal(amount: number, kind: 'steal' | 'pickup' | 'node' | 'wave' | 'emp' | 'other'): number {
    if (amount <= 0 || this.dying >= 0) return 0;
    if (this.isBoss && this.bc && (this.bc.inv > 0 || this.bc.entering > 0)) return 0; // no heals in transitions
    let a = amount * (this.isBoss ? 0.5 : 1);
    if (kind === 'steal') {
      a /= 1 + Math.min(this.lsRecent, 5) * 0.13;
      this.lsRecent += 1;
      if (this.waveActive) {
        a = Math.min(a, this.stealBudget);
        this.stealBudget -= a;
      }
    } else if (kind !== 'node' && this.waveActive) {
      a = Math.min(a, this.healBudget);
      this.healBudget -= a;
    }
    const before = this.hp;
    this.hp = Math.min(this.stats.maxHp, this.hp + a);
    const got = this.hp - before;
    if (got > 0) {
      this.healFlash = 1;
      this.healShow += got;
    }
    return got;
  }

  /** EMP: stuns, strips shields, clears enemy shots. Small capped damage; bosses only get interrupted. */
  private updatePulse(dt: number): void {
    if (this.pulseR < 0) return;
    // full-field reach from the ship (the old 380 only covered the lower half, where few enemies sit)
    const maxR = 900 * this.stats.pulseRadius;
    this.pulseR += 1100 * dt;
    const r2 = this.pulseR * this.pulseR;
    const siphon = this.syn.has('pulseLeech');
    for (const u of this.units) {
      if (u.pulseHit === this.pulseSerial || u.dead || u.state === U_DYING || u.delay > 0) continue;
      const ddx = u.e.x - this.pulseX;
      const ddy = u.e.y - this.pulseY;
      if (ddx * ddx + ddy * ddy >= r2) continue;
      u.pulseHit = this.pulseSerial;
      this.sparks(u.e.x, u.e.y, Math.atan2(ddy, ddx), 1.2, 5, 100, 260, C_WHITE);
      if (u.state === U_BOSS) {
        if (this.bc) this.bc.interrupt(u.e);
        continue;
      }
      u.stunT = u.stunMax = u.elite ? this.stats.pulseStun * 0.55 : this.stats.pulseStun;
      u.phaseT = 0;
      u.tellT = 0;
      u.pt = 0;
      this.text(u.e.x, u.e.y - u.r - 14, 'STUNNED', C_WHITE, false);
      u.ward = 0;
      if (u.role === 'shieldBearer' && u.dome > 0) {
        u.dome = 0;
        u.roleT = 6;
        u.e.role = undefined;
      }
      if (u.state === U_LATCH && u.e.kind === 'leech') leechToggleLatch(u.e);
      // small, capped, never kills elites
      const d = Math.min(u.maxHp * 0.08, 2 + 1.5 * this.runSector());
      u.hp = u.elite ? Math.max(1, u.hp - d) : u.hp - d;
      u.flash = 0.08;
      if (u.hp <= 0) this.killUnit(u, true);
      if (siphon && this.empHealed < 6) {
        this.empHealed++;
        this.heal(1, 'emp');
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
    if (this.pulseR > maxR) this.pulseR = -1;
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
      // shoot down enemy projectiles (pattern bullets are immune)
      for (const eb of this.ebullets) {
        if (!eb.active || eb.kind === EB_HARD) continue;
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
      if (b.kind === EB_HOMING) {
        const cur = Math.atan2(b.vy, b.vx);
        const na = turnToward(cur, Math.atan2(this.py - b.y, this.px - b.x), 1.15 * dt);
        const sp = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(na) * sp;
        b.vy = Math.sin(na) * sp;
      }
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

  private updateBlasts(dt: number): void {
    for (const b of this.beams) if (b.active && (b.life -= dt) <= 0) b.active = false;
    for (const b of this.blasts) {
      if (!b.active) continue;
      b.t -= dt;
      if (b.t <= 0) {
        b.active = false;
        // volatile detonation
        this.particle(P_RING, b.x, b.y, 85, 0, 0.35, 10, C_RED, 0);
        this.particle(P_EMBER, b.x, b.y, 0, 0, 0.35, 120, C_RED, 0);
        this.addShake(6);
        this.sfx('bigDeath');
        if ((this.px - b.x) ** 2 + (this.py - b.y) ** 2 < 85 * 85) this.hurtPlayer(18, b.x, b.y);
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TAU;
          this.ebullet(EB_PELLET, b.x, b.y, Math.cos(a) * 150, Math.sin(a) * 150);
        }
      }
    }
  }

  private collidePlayer(): void {
    if (this.dying >= 0) return;
    for (const u of this.units) {
      if (u.state === U_LATCH || u.stunT > 0 || !this.tangible(u)) continue;
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
        this.heal(8, 'pickup');
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

