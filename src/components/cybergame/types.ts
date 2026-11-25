// Shared types and tuning constants for Cyber Defender.

export type Phase = 'menu' | 'playing' | 'paused' | 'over';
export type EnemyKind = 'crawler' | 'mite' | 'brooder' | 'brute' | 'boss';
export type SfxName =
  | 'shot'
  | 'hit'
  | 'death'
  | 'bigDeath'
  | 'damage'
  | 'wave'
  | 'boss'
  | 'clear'
  | 'emp'
  | 'empReady'
  | 'combo'
  | 'gameover';

export interface Leg {
  /** hip position in enemy-local space (+x = forward) */
  lx: number;
  ly: number;
  /** resting foot position in enemy-local space */
  rx: number;
  ry: number;
  l1: number;
  l2: number;
  /** planted / animated foot in world space */
  fx: number;
  fy: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  /** step progress, >= 1 means planted */
  t: number;
  group: number;
}

export interface Enemy {
  active: boolean;
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  kx: number;
  ky: number;
  heading: number;
  r: number;
  hp: number;
  maxHp: number;
  speed: number;
  t: number;
  seed: number;
  bits: number;
  flash: number;
  glitch: number;
  legs: Leg[];
  legCount: number;
  stepDur: number;
  stride: number;
  gait: number;
  empHit: number;
  atk: number;
  brood: number;
  orbitDir: number;
}

export interface Bullet {
  active: boolean;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  life: number;
  dmg: number;
}

export interface Shot {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  r: number;
}

/** Particle kinds */
export const P_SPARK = 0;
export const P_FRAG = 1;
export const P_EMBER = 2;
export const P_RING = 3;
export const P_HEX = 4;
export const P_GLITCH = 5;

/** Palette indices: orange, red, white, gray, hot orange */
export const C_ORANGE = 0;
export const C_RED = 1;
export const C_WHITE = 2;
export const C_GRAY = 3;
export const C_HOT = 4;
export const PALETTE = ['#f07e41', '#e5383b', '#ffffff', '#5c5c64', '#ffc2a0'];

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

export interface KindStats {
  r: number;
  hp: number;
  speed: number;
  legs: number;
  dmg: number;
  score: number;
  charge: number;
  knock: number;
  stepDur: number;
  reach: number;
  thorax: number;
  mount: number;
}

export const KINDS: Record<EnemyKind, KindStats> = {
  crawler: { r: 10, hp: 1, speed: 82, legs: 6, dmg: 6, score: 10, charge: 0.035, knock: 1, stepDur: 0.085, reach: 2.1, thorax: 0.15, mount: 0.42 },
  mite: { r: 6, hp: 1, speed: 100, legs: 6, dmg: 3, score: 5, charge: 0.015, knock: 1.2, stepDur: 0.07, reach: 2.2, thorax: 0.15, mount: 0.42 },
  brooder: { r: 15, hp: 4, speed: 44, legs: 8, dmg: 12, score: 35, charge: 0.08, knock: 0.6, stepDur: 0.13, reach: 1.9, thorax: 0.55, mount: 0.4 },
  brute: { r: 21, hp: 9, speed: 30, legs: 8, dmg: 22, score: 70, charge: 0.12, knock: 0.15, stepDur: 0.19, reach: 1.75, thorax: 0.05, mount: 0.6 },
  boss: { r: 46, hp: 150, speed: 26, legs: 8, dmg: 40, score: 2000, charge: 0.6, knock: 0, stepDur: 0.26, reach: 1.9, thorax: 0.35, mount: 0.5 },
};

export const POOL_ENEMIES = 180;
export const POOL_BULLETS = 128;
export const POOL_SHOTS = 96;
export const POOL_PARTICLES = 900;
export const POOL_TEXTS = 24;

export const TAU = Math.PI * 2;

export interface GameResult {
  score: number;
  best: number;
  newBest: boolean;
  wave: number;
  kills: number;
  maxCombo: number;
}
