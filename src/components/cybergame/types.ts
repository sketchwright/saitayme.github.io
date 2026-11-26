// Shared types, pool sizes and palette for Cyber Defender (vertical shooter).
import type { Enemy, EnemyKind } from './enemies';

/** React-visible screens. Everything else lives in refs. */
export type Phase = 'menu' | 'playing' | 'paused' | 'map' | 'pick' | 'anomaly' | 'summary';

export type SfxName =
  | 'shot'
  | 'hit'
  | 'death'
  | 'bigDeath'
  | 'damage'
  | 'shieldHit'
  | 'wave'
  | 'boss'
  | 'clear'
  | 'emp'
  | 'empReady'
  | 'combo'
  | 'gameover'
  | 'pickup'
  | 'select'
  | 'click'
  | 'sector'
  | 'enemyShot'
  | 'laser'
  | 'dash'
  | 'latch'
  | 'synergy'
  | 'victory'
  | 'zap';

/** Logical playfield width; height adapts to the aspect ratio. */
export const FIELD_W = 600;
export const FIELD_MIN_H = 760;

export const TAU = Math.PI * 2;

// ---------------------------------------------------------------- palette
export const ORANGE = '#f07e41';
export const CORE = '#ff5a2a';
export const CORE_DIM = '#8a1c12';
export const WHITE = '#f4efe8';
export const GRAY = '#6a6a6a';

/** Particle colour indices */
export const C_ORANGE = 0;
export const C_RED = 1;
export const C_WHITE = 2;
export const C_GRAY = 3;
export const C_HOT = 4;
export const PALETTE = [ORANGE, CORE, WHITE, '#4a4a4f', '#ffb48a'];

/** Particle kinds */
export const P_SPARK = 0;
export const P_FRAG = 1;
export const P_EMBER = 2;
export const P_RING = 3;
export const P_HEX = 4;
export const P_GLITCH = 5;

export interface Particle {
  active: boolean;
  kind: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: number;
  drag: number;
}

export interface FloatText {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  life: number;
  max: number;
  text: string;
  color: number;
  big: boolean;
}

export interface PBullet {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  pierce: number;
  size: number;
  homing: number;
  life: number;
  crit: boolean;
  drone: boolean;
  lastHit: number;
  target: number;
  retarget: number;
}

/** Enemy projectile kinds */
export const EB_ORB = 0;
export const EB_PELLET = 1;
export const EB_NEEDLE = 2;

export interface EBullet {
  active: boolean;
  kind: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  t: number;
}

/** Pickup kinds (timed buffs + instant repair) */
export const PK_RAPID = 0;
export const PK_SHIELD = 1;
export const PK_OVERCLOCK = 2;
export const PK_REPAIR = 3;

export interface Pickup {
  active: boolean;
  kind: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  t: number;
}

export interface Arc {
  active: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number;
  seed: number;
}

// ---------------------------------------------------------------- units
export const U_ENTER = 0; // walking / flying in from an edge
export const U_ACT = 1; // type behaviour (zig-zag, hold station, drift)
export const U_HUNT = 2; // closing on the player (crawler stalk, leech seek)
export const U_STRIKE = 3; // wraith phased out and relocating
export const U_LATCH = 4; // leech draining the player
export const U_RETREAT = 5; // backing off after a latch / strike
export const U_SWOOP = 6; // flyer following a swoop path (via intent)
export const U_FREE = 7; // fragments: library-driven darting
export const U_DYING = 8; // death animation playing (killEnemy), until e.done
export const U_BOSS = 9;

export type SpawnFrom = 'top' | 'walls' | 'corners' | 'edges' | 'sides' | 'phase' | 'swoop' | 'cluster' | 'boss';

/** Game-side wrapper around a library enemy. Movement is intent-only. */
export interface Unit {
  id: number;
  e: Enemy;
  kind: EnemyKind;
  state: number;
  from: SpawnFrom;
  hp: number;
  maxHp: number;
  r: number;
  /** current goal point */
  gx: number;
  gy: number;
  baseX: number;
  // swoop path (flyers only; followed with intent, never by setting x/y)
  p0x: number;
  p0y: number;
  p1x: number;
  p1y: number;
  p2x: number;
  p2y: number;
  p3x: number;
  p3y: number;
  pt: number;
  pdur: number;
  delay: number;
  t: number;
  stateT: number;
  actT: number;
  shotT: number;
  /** shot tell: seconds left, locked aim, payload */
  tellT: number;
  tellA: number;
  tellKind: number;
  tellN: number;
  tellSpread: number;
  tellSpeed: number;
  cluster: number;
  cidx: number;
  side: number;
  flash: number;
  elite: boolean;
  score: number;
  contact: number;
  pulseHit: number;
  dead: boolean;
  life: number;
  /** seconds spent beside / below the player */
  belowT: number;
}

export const MAX_UNITS = 72;
/** max shot tells / bursts are short; enemies only shoot from fully on-screen positions */
export const TELL_TIME = 0.42;
export const POOL_PBULLETS = 320;
export const POOL_EBULLETS = 360;
export const POOL_PARTICLES = 1100;
export const POOL_TEXTS = 32;
export const POOL_PICKUPS = 16;
export const POOL_ARCS = 40;

// ---------------------------------------------------------------- run / routes
export type NodeType = 'fight' | 'elite' | 'repair' | 'cache' | 'anomaly' | 'boss';

export type OfferSource = 'wave' | 'elite' | 'cache' | 'boss' | 'anomaly';

export interface OwnedUpgrade {
  id: string;
  stacks: number;
}

export interface RunSummary {
  victory: boolean;
  score: number;
  best: number;
  newBest: boolean;
  seed: number;
  seedStr: string;
  sector: number;
  sectorName: string;
  wave: number;
  wavesCleared: number;
  kills: number;
  maxCombo: number;
  time: number;
  build: OwnedUpgrade[];
  synergies: string[];
}

export type { Enemy, EnemyKind };
