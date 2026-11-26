// Encounter types: a rule layered on top of a wave. Picked per combat route
// (never the same type twice in a row) from the sector's mix, and shown on
// the route card. The engine implements each id; tuning lives here.

export type EncounterId = 'standard' | 'flood' | 'siege' | 'ambush' | 'blackout' | 'collapse' | 'defend' | 'hunt' | 'corrupt';

export interface EncounterDef {
  id: EncounterId;
  name: string;
  /** one-line rule shown on the route card */
  rule: string;
  /** multiplier on enemies per group */
  countMul: number;
  /** multiplier on enemy hp */
  hpMul: number;
}

export const ENCOUNTERS: Record<EncounterId, EncounterDef> = {
  standard: { id: 'standard', name: 'INTRUSION', rule: 'A mixed hostile wave.', countMul: 1, hpMul: 1 },
  flood: { id: 'flood', name: 'SWARM FLOOD', rule: 'Twice the bodies, half the armour. Keep the lane clear.', countMul: 1.9, hpMul: 0.55 },
  siege: { id: 'siege', name: 'SIEGE', rule: 'Sentinels dig in behind shield bearers. Kill the bearers first, flank the line.', countMul: 1, hpMul: 1.1 },
  ambush: { id: 'ambush', name: 'AMBUSH', rule: 'Hostiles burst in from below and behind. Watch the warning markers.', countMul: 1, hpMul: 1 },
  blackout: { id: 'blackout', name: 'BLACKOUT', rule: 'The arena goes dark. Scan pulses and your muzzle flash reveal enemies.', countMul: 0.9, hpMul: 1 },
  collapse: { id: 'collapse', name: 'COLLAPSING FIREWALL', rule: 'Laser walls sweep down and the arena narrows. Thread the gaps.', countMul: 0.85, hpMul: 1 },
  defend: { id: 'defend', name: 'DEFEND', rule: 'Protect the data node for 45 s. If it falls, you take the hit.', countMul: 1, hpMul: 0.9 },
  hunt: { id: 'hunt', name: 'HUNT', rule: 'A summoner flees. Kill it before it escapes for a bonus module.', countMul: 0.8, hpMul: 1 },
  corrupt: { id: 'corrupt', name: 'CORRUPTED ZONE', rule: 'Corruption pools slow and drain you. Fight around them.', countMul: 1, hpMul: 1 },
};

/** Encounter mix per sector (weights). Sector identity comes from these. */
export const SECTOR_ENCOUNTERS: Array<Array<[EncounterId, number]>> = [
  [
    ['standard', 40],
    ['flood', 24],
    ['siege', 12],
    ['ambush', 12],
    ['collapse', 12],
  ],
  [
    ['standard', 15],
    ['blackout', 20],
    ['corrupt', 20],
    ['hunt', 15],
    ['defend', 15],
    ['ambush', 15],
  ],
  [
    ['standard', 10],
    ['siege', 12],
    ['blackout', 12],
    ['collapse', 14],
    ['defend', 12],
    ['hunt', 12],
    ['corrupt', 14],
    ['flood', 14],
  ],
];

export const DEFEND_TIME = 45;
export const HUNT_ESCAPE = 32;
