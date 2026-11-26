// Upgrade + synergy definitions. Data-driven: add an entry to UPGRADES (and,
// optionally, a SYNERGY that requires it) and the offer system, HUD icons and
// run summary pick it up automatically. `apply` mutates a fresh Stats object
// once per stack; the engine never special-cases upgrade ids except through
// the flags/numbers in Stats.

export type Rarity = 'common' | 'rare' | 'corrupted';

export interface Stats {
  maxHp: number;
  moveSpeed: number;
  fireRate: number; // shots / s
  dmg: number;
  bulletSpeed: number;
  bulletSize: number;
  spread: number; // extra bullets in the fan
  spreadAngle: number;
  inaccuracy: number;
  pierce: number;
  homing: number;
  crit: number;
  critMult: number;
  chain: number; // arc jumps per hit
  chainDmg: number; // fraction of hit damage
  drones: number;
  droneRate: number;
  /** EMP pulse: stuns, strips shields, clears shots. Recharges from kills. */
  pulse: boolean;
  pulseStun: number; // seconds
  pulseRadius: number; // multiplier on the base radius
  pulseRecharge: number; // multiplier on charge gained per kill
  pulseSelfDmg: number;
  /** additive same-category bonuses (summed, then applied once) */
  dmgAdd: number;
  rateAdd: number;
  /** estimated DPS multiplier vs the starting kit: raw and after the soft cap */
  rawPower: number;
  power: number;
  lifesteal: number; // integrity per kill
  shieldMax: number;
  shieldRegen: number; // per s
  shieldDelay: number; // s after a hit
  comboCap: number;
  comboTime: number;
  magnet: number;
  dash: boolean;
  dashCd: number;
  buffDur: number; // multiplier on timed pickups
  dropRate: number; // multiplier on pickup drop chance
  cascade: number; // kill explosion damage multiplier (0 = none)
  dmgTaken: number;
  hpDecay: number; // integrity / s lost during combat
  permOverclock: boolean;
}

export const baseStats = (): Stats => ({
  maxHp: 100,
  moveSpeed: 360,
  fireRate: 5.2,
  dmg: 0.9,
  bulletSpeed: 820,
  bulletSize: 0.8,
  spread: 0,
  spreadAngle: 0.16,
  inaccuracy: 0.015,
  pierce: 0,
  homing: 0,
  crit: 0.03,
  critMult: 2,
  chain: 0,
  chainDmg: 0.55,
  drones: 0,
  droneRate: 2.6,
  pulse: false,
  pulseStun: 2.2,
  pulseRadius: 1,
  pulseRecharge: 1,
  pulseSelfDmg: 0,
  dmgAdd: 0,
  rateAdd: 0,
  rawPower: 1,
  power: 1,
  lifesteal: 0,
  shieldMax: 0,
  shieldRegen: 0,
  shieldDelay: 3,
  comboCap: 8,
  comboTime: 2.4,
  magnet: 60,
  dash: false,
  dashCd: 2.4,
  buffDur: 1,
  dropRate: 1,
  cascade: 0,
  dmgTaken: 1,
  hpDecay: 0,
  permOverclock: false,
});

export interface UpgradeDef {
  id: string;
  name: string;
  rarity: Rarity;
  maxStacks: number;
  desc: string;
  drawback?: string;
  /** 24x24 SVG path data (stroke-only glyph) */
  icon: string;
  /** waves cleared before this can be offered (strong effects come later) */
  unlock?: number;
  apply: (s: Stats) => void;
}

const I = {
  rate: 'M4 18h4M10 18h4M16 18h4M6 14l2-8M12 14l2-8M18 14l2-8',
  dmg: 'M12 3l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6L3 10l6-1z',
  speed: 'M3 12h12M11 7l5 5-5 5M18 6v12',
  size: 'M12 4a8 8 0 1 0 0.01 0M12 9a3 3 0 1 0 0.01 0',
  hp: 'M12 3v18M3 12h18M7 7h10v10H7z',
  shield: 'M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z',
  magnet: 'M6 4v8a6 6 0 0 0 12 0V4M6 8h4M14 8h4',
  thrust: 'M12 3l6 14-6-3-6 3zM9 20h6',
  combo: 'M4 20L10 4M14 20l6-16M3 12h18',
  crit: 'M12 2v6M12 16v6M2 12h6M16 12h6M12 9l3 3-3 3-3-3z',
  spread: 'M12 21V9M12 9L5 3M12 9l7-6M12 9V3',
  pierce: 'M2 12h20M16 7l5 5-5 5M7 8v8M11 8v8',
  homing: 'M4 20c2-10 8-14 16-15M15 3l5 2-2 5',
  drone: 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M12 2v4M12 18v4M2 12h4M18 12h4',
  chain: 'M4 4l6 6-3 3 7 7M14 4l2 4M18 14l2 2',
  pulse: 'M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M12 12m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0M12 1v3M12 20v3',
  life: 'M12 20l-8-8a5 5 0 0 1 8-6 5 5 0 0 1 8 6zM9 11h6',
  dash: 'M3 7h9M3 12h13M3 17h9M16 7l5 5-5 5',
  clock: 'M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0M12 7v5l3 3',
  cascade: 'M12 3l2 6h6l-5 4 2 7-5-4-5 4 2-7-5-4h6z',
  regen: 'M20 12a8 8 0 1 1-3-6.2M20 4v5h-5',
  glass: 'M7 3h10l-2 9 2 9H7l2-9z',
  berserk: 'M3 12l4-8 3 8 3-8 3 8 3-8 2 8',
  unstable: 'M12 2l3 7-3 3 4 3-4 7 1-6-4-3 3-4z',
  vamp: 'M6 4l2 7 4 9 4-9 2-7M9 11h6',
  swarm: 'M6 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M18 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M12 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M8 7l3 9M16 7l-3 9',
  addict: 'M5 19l14-14M8 5h11v11M4 12l3-3',
  feedback: 'M12 3v4M12 17v4M4 12a8 8 0 0 1 16 0M7 17l-3 3M17 17l3 3',
} as const;

export const UPGRADES: UpgradeDef[] = [
  // ------------------------------------------------------------ common
  { id: 'rate', name: 'OVERCLOCKED CYCLES', rarity: 'common', maxStacks: 3, desc: 'Fire rate +15% (additive).', icon: I.rate, apply: (s) => { s.rateAdd += 0.15; } },
  { id: 'dmg', name: 'HARDENED PACKETS', rarity: 'common', maxStacks: 3, desc: 'Bullet damage +18% (additive).', icon: I.dmg, apply: (s) => { s.dmgAdd += 0.18; } },
  { id: 'velocity', name: 'VELOCITY PATCH', rarity: 'common', maxStacks: 3, desc: 'Bullet speed +25%, accuracy up.', icon: I.speed, apply: (s) => { s.bulletSpeed *= 1.25; s.inaccuracy *= 0.6; } },
  { id: 'size', name: 'PAYLOAD EXPANSION', rarity: 'common', maxStacks: 3, desc: 'Bullets 35% larger (wider hitbox), damage +8%.', icon: I.size, apply: (s) => { s.bulletSize *= 1.35; s.dmgAdd += 0.08; } },
  { id: 'hp', name: 'INTEGRITY BUFFER', rarity: 'common', maxStacks: 3, desc: 'Max integrity +20. Restores 20.', icon: I.hp, apply: (s) => { s.maxHp += 20; } },
  { id: 'shield', name: 'SHIELD MATRIX', rarity: 'common', maxStacks: 3, desc: '+20 regenerating shield.', icon: I.shield, apply: (s) => { s.shieldMax += 20; s.shieldRegen += 4; } },
  { id: 'magnet', name: 'SIGNAL MAGNET', rarity: 'common', maxStacks: 3, desc: 'Pickup pull radius +90. Drops +15%.', icon: I.magnet, apply: (s) => { s.magnet += 90; s.dropRate *= 1.15; } },
  { id: 'thrust', name: 'VECTOR THRUSTERS', rarity: 'common', maxStacks: 3, desc: 'Move speed +16%.', icon: I.thrust, apply: (s) => { s.moveSpeed *= 1.16; } },
  { id: 'combo', name: 'CHAIN MEMORY', rarity: 'common', maxStacks: 3, desc: 'Combo multiplier cap +2, chain window +0.8 s.', icon: I.combo, apply: (s) => { s.comboCap += 2; s.comboTime += 0.8; } },
  { id: 'crit', name: 'CRIT HEURISTICS', rarity: 'common', maxStacks: 3, desc: 'Critical chance +10%.', icon: I.crit, apply: (s) => { s.crit += 0.1; } },
  // ------------------------------------------------------------ rare
  { id: 'spread', name: 'SPREAD PROTOCOL', rarity: 'rare', maxStacks: 3, unlock: 3, desc: '+2 bullets in a fan. Damage per bullet -10%.', icon: I.spread, apply: (s) => { s.spread += 2; s.dmgAdd -= 0.1; } },
  { id: 'pierce', name: 'PIERCING ROUNDS', rarity: 'rare', maxStacks: 3, unlock: 3, desc: 'Bullets pass through +1 target.', icon: I.pierce, apply: (s) => { s.pierce += 1; } },
  { id: 'homing', name: 'HOMING PACKETS', rarity: 'rare', maxStacks: 2, unlock: 2, desc: 'Bullets curve toward the nearest threat.', icon: I.homing, apply: (s) => { s.homing += 5; } },
  { id: 'drone', name: 'DEFENDER DRONES', rarity: 'rare', maxStacks: 3, unlock: 3, desc: '+1 orbiting drone that fires with you.', icon: I.drone, apply: (s) => { s.drones += 1; } },
  { id: 'chain', name: 'CHAIN LIGHTNING', rarity: 'rare', maxStacks: 3, unlock: 3, desc: 'Hits arc to +1 nearby enemy for 55% damage.', icon: I.chain, apply: (s) => { s.chain += 1; } },
  { id: 'pulse', name: 'EMP PULSE', rarity: 'rare', maxStacks: 3, unlock: 2, desc: 'EMP [E / right click]: stuns every enemy on screen ~2 s, strips shields, clears shots. Charges from kills. Stacks: +stun, faster charge.', icon: I.pulse, apply: (s) => { if (s.pulse) { s.pulseStun += 0.3; s.pulseRecharge += 0.3; } s.pulse = true; } },
  { id: 'lifesteal', name: 'LIFESTEAL DAEMON', rarity: 'rare', maxStacks: 3, desc: 'Each kill restores 0.7 integrity.', icon: I.life, apply: (s) => { s.lifesteal += 0.7; } },
  { id: 'dash', name: 'PHASE DASH', rarity: 'rare', maxStacks: 2, unlock: 1, desc: 'Dash with i-frames [SHIFT]. Shakes off leeches.', icon: I.dash, apply: (s) => { if (s.dash) s.dashCd *= 0.7; s.dash = true; } },
  { id: 'buff', name: 'OVERCLOCK EXTENDER', rarity: 'rare', maxStacks: 2, desc: 'Timed pickups last 50% longer, drop 30% more.', icon: I.clock, apply: (s) => { s.buffDur *= 1.5; s.dropRate *= 1.3; } },
  { id: 'cascade', name: 'KILL CASCADE', rarity: 'rare', maxStacks: 2, unlock: 4, desc: 'Destroyed enemies detonate, damaging neighbours.', icon: I.cascade, apply: (s) => { s.cascade += 1.6; } },
  { id: 'regen', name: 'ADAPTIVE SHIELD', rarity: 'rare', maxStacks: 2, desc: '+15 shield. Regen 2x faster, starts sooner.', icon: I.regen, apply: (s) => { s.shieldMax += 15; s.shieldRegen = (s.shieldRegen + 4) * 2; s.shieldDelay *= 0.55; } },
  // ------------------------------------------------------------ corrupted
  { id: 'glass', name: 'GLASS KERNEL', rarity: 'corrupted', maxStacks: 1, unlock: 4, desc: 'Damage +50% (additive).', drawback: 'Max integrity -35.', icon: I.glass, apply: (s) => { s.dmgAdd += 0.5; s.maxHp -= 35; } },
  { id: 'berserk', name: 'BERSERK LOOP', rarity: 'corrupted', maxStacks: 1, unlock: 4, desc: 'Fire rate +45% (additive).', drawback: 'Aim scatters wildly.', icon: I.berserk, apply: (s) => { s.rateAdd += 0.45; s.inaccuracy += 0.14; } },
  { id: 'unstable', name: 'UNSTABLE CORE', rarity: 'corrupted', maxStacks: 1, unlock: 4, desc: 'Crit chance +25%, crits deal 3x.', drawback: 'You take 35% more damage.', icon: I.unstable, apply: (s) => { s.crit += 0.25; s.critMult = 3; s.dmgTaken *= 1.35; } },
  { id: 'vamp', name: 'VAMPIRIC THREAD', rarity: 'corrupted', maxStacks: 1, unlock: 4, desc: 'Kills restore 2.2 integrity.', drawback: 'Integrity decays 0.5/s in combat.', icon: I.vamp, apply: (s) => { s.lifesteal += 2.2; s.hpDecay += 0.5; } },
  { id: 'overmind', name: 'SWARM OVERMIND', rarity: 'corrupted', maxStacks: 1, unlock: 4, desc: '+2 drones that fire 40% faster.', drawback: 'Main gun fire rate -30%.', icon: I.swarm, apply: (s) => { s.drones += 2; s.droneRate *= 1.4; s.rateAdd -= 0.3; } },
  { id: 'addict', name: 'OVERCLOCK ADDICTION', rarity: 'corrupted', maxStacks: 1, unlock: 4, desc: 'Permanent overclock: +25% fire rate and damage, +15% speed.', drawback: 'Shields disabled; no shield pickups.', icon: I.addict, apply: (s) => { s.permOverclock = true; s.rateAdd += 0.25; s.dmgAdd += 0.25; s.moveSpeed *= 1.15; } },
  { id: 'feedback', name: 'OVERCHARGED EMP', rarity: 'corrupted', maxStacks: 1, unlock: 4, desc: 'Grants the EMP; charges 60% faster and stuns 0.6 s longer.', drawback: 'Each EMP costs 8 integrity.', icon: I.feedback, apply: (s) => { s.pulse = true; s.pulseRecharge += 0.6; s.pulseStun += 0.6; s.pulseSelfDmg += 8; } },
];

export const UPGRADE_BY_ID: Record<string, UpgradeDef> = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

export interface SynergyDef {
  id: string;
  name: string;
  requires: string[][]; // all groups must be satisfied; any id within a group
  desc: string;
}

export const SYNERGIES: SynergyDef[] = [
  { id: 'arcPierce', name: 'ARC CASCADE', requires: [['pierce'], ['chain']], desc: 'Every pierced enemy emits its own arc; arcs jump +1.' },
  { id: 'seekerSwarm', name: 'SEEKER SWARM', requires: [['homing'], ['spread']], desc: 'Spread fans wider, +1 bullet, and hunts harder.' },
  { id: 'droneCrit', name: 'TARGETING LINK', requires: [['drone', 'overmind'], ['crit', 'unstable']], desc: 'Drones can crit; drone crits arc lightning.' },
  { id: 'pulseLeech', name: 'STATIC SIPHON', requires: [['pulse', 'feedback'], ['lifesteal', 'vamp']], desc: 'Each EMP restores 1 integrity per enemy stunned (max 6).' },
  { id: 'cascadeArc', name: 'STORM CORE', requires: [['cascade'], ['chain']], desc: 'Kill detonations throw lightning arcs.' },
  { id: 'dashShield', name: 'PHASE BARRIER', requires: [['dash'], ['shield', 'regen']], desc: 'Dashing restores 15 shield and leaves a damaging wake.' },
];

export const computeSynergies = (owned: ReadonlyMap<string, number>): Set<string> => {
  const out = new Set<string>();
  for (const s of SYNERGIES) {
    if (s.requires.every((group) => group.some((id) => (owned.get(id) ?? 0) > 0))) out.add(s.id);
  }
  return out;
};

export const computeStats = (owned: ReadonlyMap<string, number>, syn: ReadonlySet<string>): Stats => {
  const s = baseStats();
  // apply in definition order so multiplicative/additive mixes are stable
  for (const def of UPGRADES) {
    const n = owned.get(def.id) ?? 0;
    for (let i = 0; i < n; i++) def.apply(s);
  }
  if (syn.has('seekerSwarm')) {
    s.spread += 1;
    s.spreadAngle *= 1.6;
    s.homing *= 1.6;
  }
  if (syn.has('arcPierce')) s.chain += 1;
  // late-game power comes from synergies (additive like everything else)
  s.dmgAdd += 0.08 * syn.size;
  const base = baseStats();
  // same-category bonuses add; fire rate is capped at 2x the starting kit
  s.dmg = base.dmg * Math.max(0.3, 1 + s.dmgAdd);
  s.fireRate = clampN(base.fireRate * Math.max(0.4, 1 + s.rateAdd), base.fireRate * 0.4, base.fireRate * 2);
  // diminishing returns on the whole build: estimate DPS vs the starting kit,
  // soft-cap it and fold the difference back into per-hit damage
  s.rawPower = estimatePower(s) / estimatePower(base);
  s.power = softCap(s.rawPower);
  s.dmg *= s.power / s.rawPower;
  if (s.permOverclock) {
    s.shieldMax = 0;
    s.shieldRegen = 0;
  }
  s.maxHp = Math.max(30, s.maxHp);
  return s;
};

const clampN = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/**
 * Rough single-target DPS factor of a build. The soft cap works on this, so
 * crowd tools (pierce, chain, cascade, wide fans) stay strong against waves
 * without inflating boss damage.
 */
export const estimatePower = (s: Stats): number =>
  s.dmg *
  s.fireRate *
  (1 + 0.3 * s.spread) *
  (1 + (0.6 * s.drones * s.droneRate) / Math.max(1, s.fireRate)) *
  (1 + s.crit * (s.critMult - 1)) *
  (s.homing > 0 ? 1.05 : 1);

/** Linear up to 1.5x, then flattens toward ~4.7x the starting kit. */
export const softCap = (p: number): number => (p <= 1.5 ? p : 1.5 + 3.2 * (1 - Math.exp(-(p - 1.5) / 5)));

/** Expected (budget) power at the end of each sector, for tuning reports. */
export const POWER_BUDGET = [1.7, 2.8, 3.8];

export const RARITY_WEIGHT: Record<Rarity, number> = { common: 62, rare: 30, corrupted: 8 };
export const RARITY_LABEL: Record<Rarity, string> = { common: 'COMMON', rare: 'RARE', corrupted: 'CORRUPTED' };
