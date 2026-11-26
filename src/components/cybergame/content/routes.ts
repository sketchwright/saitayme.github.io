// Route choice shown after every upgrade pick: 2-3 cards describing what
// happens next. Every route leads to exactly one wave (or the boss), so a
// sector always has the same number of waves; detours (repair / cache /
// anomaly) happen right before it. Generation is seeded per run.
import type { Rng } from '../rng';
import type { NodeType } from '../types';

export interface RouteInfo {
  name: string;
  line: string;
  reward: string;
  risk: string;
}

export const ROUTE_INFO: Record<NodeType, RouteInfo> = {
  fight: {
    name: 'STANDARD WAVE',
    line: 'Fight the next intrusion wave head-on.',
    reward: '+1500 bonus score, upgrade pick after',
    risk: 'Normal threat',
  },
  elite: {
    name: 'ELITE BREACH',
    line: 'A harder wave with hardened enemies and extra squads.',
    reward: 'Guaranteed RARE or better upgrade, double wave bonus',
    risk: 'Tougher enemies, more shots',
  },
  repair: {
    name: 'REPAIR NODE',
    line: 'Restore 40% integrity and refill shields, then a standard wave.',
    reward: '+40% integrity',
    risk: 'None',
  },
  cache: {
    name: 'DATA CACHE',
    line: 'Decrypt a cache: pick an extra upgrade, then a standard wave.',
    reward: 'Extra 1-of-3 upgrade pick',
    risk: 'None',
  },
  anomaly: {
    name: 'ANOMALY',
    line: 'A random event before the wave. You choose whether to engage.',
    reward: 'Rare modules, max integrity, score',
    risk: 'Integrity loss or a harder wave',
  },
  boss: {
    name: 'SECTOR CORE',
    line: 'Engage the sector intelligence directly.',
    reward: '+3000 score, boss upgrade (rare+), next sector',
    risk: 'Boss fight',
  },
};

/** Options for the next step. `nextIsBoss` = all waves of the sector done. */
export function generateRoutes(rng: Rng, sector: number, nextWave: number, hpFrac: number, nextIsBoss: boolean): NodeType[] {
  if (nextIsBoss) return hpFrac < 0.999 ? ['boss', 'repair'] : ['boss'];
  const out: NodeType[] = ['fight'];
  const pool: Array<[NodeType, number]> = [
    ['elite', sector === 0 && nextWave <= 1 ? 0 : 30],
    ['cache', 30],
    ['anomaly', 22],
    ['repair', hpFrac < 0.5 ? 45 : hpFrac < 0.85 ? 22 : 6],
  ];
  const n = rng.chance(0.55) ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const p = rng.weighted(pool.filter(([t]) => !out.includes(t)), ([, w]) => w);
    if (p) out.push(p[0]);
  }
  return out;
}
