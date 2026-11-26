// Sector, wave and boss definitions. A wave is a list of spawn groups: what
// kind, how many, which edge they come from and when (seconds after the wave
// starts; groups are pulled forward early when the field runs empty). Each
// enemy type then behaves like itself (see engine). Tuning lives here.
import type { Affix, EnemyKind, Role, SpawnFrom } from '../types';

export interface GroupDef {
  kind: EnemyKind;
  n: number;
  from: SpawnFrom;
  at: number;
  /** seconds between members */
  gap?: number;
  /** force a director role for the whole group */
  role?: Role;
}

export interface WaveDef {
  groups: GroupDef[];
}

const G = (kind: EnemyKind, n: number, from: SpawnFrom, at: number, gap = 0.6, role?: Role): GroupDef => ({ kind, n, from, at, gap, role });


export interface BossDef {
  name: string;
  title: string;
  /** 0 WARDEN (shielded), 1 ECHO (teleports / clones / tethers), 2 ROOT (final) */
  variant: 0 | 1 | 2;
  size: number;
  hp: number;
  bulletSpeed: number;
}

export interface SectorDef {
  id: string;
  name: string;
  subtitle: string;
  intro: string;
  /** background theme index used by the renderer */
  theme: 0 | 1 | 2;
  hpMul: number;
  /** multiplier on all damage the player takes from this sector */
  dmgMul: number;
  /** multiplier on enemies per group (rounded) */
  countMul: number;
  bulletSpeed: number;
  /** seconds between sentinel volleys (whole field) */
  fireGap: number;
  /** seconds between wraith strikes */
  strikeGap: number;
  /** max enemies alive before later groups wait */
  maxAlive: number;
  waves: WaveDef[];
  eliteExtra: GroupDef[];
  /** role mix per kind for groups without a forced role (weights; '' = plain) */
  roleMix: Partial<Record<EnemyKind, Array<[Role, number]>>>;
  /** elite affix pool for this sector */
  affixes: Affix[];
  boss: BossDef;
  log: string[];
}

export const KIND_STATS: Record<EnemyKind, { hp: number; size: number; r: number; score: number; contact: number }> = {
  crawler: { hp: 5, size: 44, r: 13, score: 60, contact: 20 },
  sentinel: { hp: 12, size: 50, r: 16, score: 140, contact: 22 },
  leech: { hp: 9, size: 46, r: 13, score: 120, contact: 8 },
  wraith: { hp: 9, size: 48, r: 15, score: 150, contact: 12 },
  swarm: { hp: 10, size: 44, r: 15, score: 110, contact: 18 },
  fragment: { hp: 1, size: 20, r: 7, score: 20, contact: 12 },
  boss: { hp: 400, size: 200, r: 60, score: 5000, contact: 30 },
};

export const SECTORS: SectorDef[] = [
  {
    id: 'perimeter',
    name: 'PERIMETER',
    subtitle: 'FIREWALL LAYER',
    intro: 'Crawlers probe the outer firewall. Sentinels hold the gates.',
    theme: 0,
    hpMul: 0.65,
    dmgMul: 0.4,
    countMul: 1.0,
    bulletSpeed: 225,
    fireGap: 1.5,
    strikeGap: 99,
    maxAlive: 12,
    waves: [
      { groups: [G('sentinel', 1, 'top', 0, 0, 'suppressor'), G('crawler', 2, 'top', 6, 0.5, 'diver'), G('sentinel', 2, 'edges', 2, 1.2), G('crawler', 4, 'top', 1, 0.8), G('crawler', 4, 'walls', 9, 0.8), G('crawler', 5, 'top', 17, 0.6), G('sentinel', 1, 'edges', 22), G('crawler', 4, 'walls', 27, 0.6)] },
      { groups: [G('sentinel', 2, 'edges', 0, 1.2, 'suppressor'), G('crawler', 3, 'pincer', 8, 0.3, 'diver'), G('crawler', 5, 'top', 2, 0.6), G('crawler', 6, 'walls', 11, 0.5), G('crawler', 5, 'corners', 19, 0.5), G('sentinel', 2, 'corners', 24), G('crawler', 6, 'top', 30, 0.45)] },
      { groups: [G('crawler', 6, 'walls', 0, 0.45), G('sentinel', 3, 'top', 3, 1), G('crawler', 7, 'top', 10, 0.4), G('sentinel', 2, 'edges', 18), G('crawler', 6, 'walls', 22, 0.4), G('crawler', 6, 'corners', 30, 0.35)] },
      { groups: [G('sentinel', 4, 'edges', 0, 0.8), G('crawler', 8, 'top', 2, 0.4), G('crawler', 8, 'walls', 12, 0.35), G('crawler', 6, 'corners', 22, 0.3), G('sentinel', 2, 'top', 26), G('crawler', 8, 'top', 32, 0.3)] },
      { groups: [G('sentinel', 4, 'corners', 0, 0.6), G('crawler', 10, 'walls', 3, 0.3), G('crawler', 8, 'top', 14, 0.3), G('sentinel', 3, 'edges', 20), G('crawler', 10, 'top', 26, 0.25)] },
    ],
    eliteExtra: [G('sentinel', 2, 'edges', 4, 1)],
    roleMix: {
      crawler: [['', 65], ['flanker', 20], ['diver', 15]],
      sentinel: [['', 55], ['suppressor', 25], ['sniper', 10], ['shieldBearer', 10]],
    },
    affixes: ['Shielded', 'Hasted', 'Splitting'],
    boss: {
      name: 'WARDEN.EXE',
      title: 'PERIMETER INTELLIGENCE',
      variant: 0,
      size: 190,
      hp: 215,
      bulletSpeed: 215,
    },
    log: ['perimeter scan // 2048 ports', 'firewall rules reloaded', 'quarantine zone armed', 'packet inspection: hostile', 'trace route 10.0.0.1 > ???'],
  },
  {
    id: 'memory',
    name: 'MEMORY',
    subtitle: 'CORRUPTED RECOLLECTION',
    intro: 'Wraiths phase through corrupted memories. Leeches feed on your integrity.',
    theme: 1,
    hpMul: 1.6,
    dmgMul: 0.75,
    countMul: 1.35,
    bulletSpeed: 255,
    fireGap: 0.9,
    strikeGap: 1.9,
    maxAlive: 22,
    waves: [
      { groups: [G('wraith', 3, 'phase', 0, 1.2), G('leech', 2, 'sides', 4, 1.5), G('crawler', 4, 'walls', 10, 0.6), G('wraith', 3, 'phase', 17, 1), G('leech', 3, 'sides', 23, 1.2)] },
      { groups: [G('swarm', 3, 'cluster', 0), G('wraith', 4, 'phase', 5, 0.9), G('leech', 3, 'sides', 12, 1), G('swarm', 3, 'cluster', 20), G('wraith', 3, 'swoop', 27, 0.25)] },
      { groups: [G('sentinel', 2, 'edges', 0, 1), G('wraith', 4, 'phase', 2, 0.8), G('leech', 4, 'sides', 10, 0.9), G('crawler', 6, 'walls', 18, 0.4), G('wraith', 4, 'swoop', 26, 0.2)] },
      { groups: [G('wraith', 4, 'swoop', 0, 0.2), G('leech', 4, 'sides', 7, 0.8), G('swarm', 3, 'cluster', 13), G('crawler', 6, 'top', 19, 0.4), G('wraith', 4, 'phase', 27, 0.7)] },
      { groups: [G('swarm', 3, 'cluster', 0), G('swarm', 3, 'cluster', 6), G('wraith', 5, 'phase', 10, 0.6), G('leech', 5, 'sides', 16, 0.7), G('wraith', 5, 'swoop', 26, 0.2)] },
    ],
    eliteExtra: [G('wraith', 3, 'phase', 3, 0.6), G('leech', 3, 'sides', 12, 0.8)],
    roleMix: {
      crawler: [['', 20], ['flanker', 40], ['diver', 40]],
      sentinel: [['suppressor', 40], ['sniper', 30], ['shieldBearer', 30]],
      wraith: [['dodger', 70], ['mender', 30]],
      swarm: [['surrounder', 70], ['mender', 30]],
    },
    affixes: ['Phasing', 'Vampiric', 'Splitting', 'Shielded'],
    boss: {
      name: 'ECHO',
      title: 'MEMORY CORRUPTOR',
      variant: 1,
      size: 210,
      hp: 480,
      bulletSpeed: 235,
    },
    log: ['memory pages: 41% corrupt', 'restoring snapshot 0x7F..', 'ghost process detected', 'heap overflow // sector 9', 'recollection mismatch'],
  },
  {
    id: 'core',
    name: 'CORE',
    subtitle: 'ROGUE INTELLIGENCE',
    intro: 'The rogue AI defends its kernel with everything it has.',
    theme: 2,
    hpMul: 2.3,
    dmgMul: 1.05,
    countMul: 1.3,
    bulletSpeed: 280,
    fireGap: 0.65,
    strikeGap: 1.3,
    maxAlive: 22,
    waves: [
      { groups: [G('sentinel', 3, 'edges', 0, 0.8), G('crawler', 6, 'walls', 2, 0.4), G('wraith', 4, 'phase', 8, 0.8), G('crawler', 6, 'top', 15, 0.35), G('leech', 3, 'sides', 21, 0.8), G('wraith', 4, 'swoop', 28, 0.2)] },
      { groups: [G('swarm', 3, 'cluster', 0), G('sentinel', 3, 'corners', 2, 0.8), G('leech', 4, 'sides', 8, 0.7), G('crawler', 8, 'walls', 14, 0.3), G('swarm', 3, 'cluster', 22), G('wraith', 4, 'phase', 28, 0.5)] },
      { groups: [G('wraith', 5, 'swoop', 0, 0.2), G('sentinel', 4, 'edges', 4, 0.7), G('swarm', 4, 'cluster', 10), G('crawler', 8, 'top', 16, 0.3), G('leech', 4, 'sides', 24, 0.6), G('wraith', 4, 'phase', 30, 0.5)] },
      { groups: [G('sentinel', 4, 'corners', 0, 0.6), G('crawler', 8, 'walls', 2, 0.3), G('wraith', 5, 'phase', 8, 0.5), G('leech', 5, 'sides', 14, 0.6), G('swarm', 3, 'cluster', 20), G('crawler', 8, 'top', 26, 0.25)] },
      { groups: [G('sentinel', 4, 'edges', 0, 0.5), G('swarm', 4, 'cluster', 3), G('wraith', 6, 'swoop', 9, 0.2), G('leech', 5, 'sides', 15, 0.5), G('crawler', 10, 'walls', 20, 0.25), G('wraith', 5, 'phase', 28, 0.4)] },
    ],
    eliteExtra: [G('sentinel', 2, 'corners', 3, 0.8), G('swarm', 3, 'cluster', 12), G('wraith', 3, 'swoop', 20, 0.2)],
    roleMix: {
      crawler: [['flanker', 50], ['diver', 50]],
      sentinel: [['suppressor', 30], ['sniper', 35], ['shieldBearer', 35]],
      wraith: [['dodger', 70], ['mender', 30]],
      swarm: [['surrounder', 60], ['shieldBearer', 20], ['mender', 20]],
    },
    affixes: ['Volatile', 'Hasted', 'Phasing', 'Vampiric', 'Shielded', 'Splitting'],
    boss: {
      name: 'ROOT',
      title: 'THE OVERMIND',
      variant: 2,
      size: 250,
      hp: 650,
      bulletSpeed: 255,
    },
    log: ['kernel access: DENIED', 'rogue weights detected', 'self-replication 12%', 'it is watching', 'core temperature critical'],
  },
];

export const FLAVOR = {
  runStart: ['NEURAL FIREWALL ONLINE', 'ANTIVIRUS MIND // LINKED'],
  wave: ['INTRUSION DETECTED', 'HOSTILE PROCESSES INBOUND', 'PACKET STORM', 'MALWARE SIGNATURE'],
  elite: ['ELITE SIGNATURE', 'HARDENED INTRUSION'],
  boss: 'SECTOR BREACH',
  clear: ['THREAT PURGED', 'INTRUSION CONTAINED', 'PROCESSES TERMINATED'],
  low: 'INTEGRITY CRITICAL',
  latch: 'LEECH ATTACHED // SHOOT IT OFF',
} as const;
