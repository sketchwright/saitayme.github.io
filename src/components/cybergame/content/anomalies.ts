// Anomaly node events: one risky option and a safe "decline". Effects run
// against a small interface the engine implements, so new events need no
// engine changes.
import type { Rarity } from './upgrades';

export interface AnomalyCtx {
  /** fraction of max integrity (never kills: leaves at least 1) */
  hurt: (frac: number) => void;
  heal: (frac: number) => void;
  /** opens an upgrade pick restricted to these rarities */
  offer: (rarities: Rarity[]) => void;
  addScore: (n: number) => void;
  /** removes a random owned upgrade; returns its name or null */
  loseUpgrade: () => string | null;
  /** permanently changes max integrity */
  maxHp: (delta: number) => void;
  /** next combat node becomes elite-strength */
  hardenNext: () => void;
  rng: () => number;
}

export interface AnomalyDef {
  id: string;
  title: string;
  text: string;
  accept: string;
  decline: string;
  /** returns a short result line for the log */
  run: (c: AnomalyCtx) => string;
}

export const ANOMALIES: AnomalyDef[] = [
  {
    id: 'bleed',
    title: 'CORRUPTED EXECUTABLE',
    text: 'An unsigned binary pulses with raw power. Running it will burn through your integrity.',
    accept: 'EXECUTE  [-20% INTEGRITY, RARE UPGRADE]',
    decline: 'QUARANTINE',
    run: (c) => {
      c.hurt(0.2);
      c.offer(['rare', 'corrupted']);
      return 'binary executed // integrity -20%';
    },
  },
  {
    id: 'gamble',
    title: 'MEMORY DICE',
    text: 'A looping fragment offers to rewrite itself. Half the time it heals, half the time it bites.',
    accept: 'ROLL  [50%: +35% INTEGRITY / 50%: -20%]',
    decline: 'WALK AWAY',
    run: (c) => {
      if (c.rng() < 0.5) {
        c.heal(0.35);
        return 'fragment benign // integrity restored';
      }
      c.hurt(0.2);
      return 'fragment hostile // integrity -20%';
    },
  },
  {
    id: 'trade',
    title: 'BLACK MARKET DAEMON',
    text: 'A daemon will trade one of your modules for a corrupted one of your choosing.',
    accept: 'TRADE  [LOSE RANDOM UPGRADE, PICK CORRUPTED]',
    decline: 'REFUSE',
    run: (c) => {
      const lost = c.loseUpgrade();
      c.offer(['corrupted']);
      return lost ? `traded ${lost.toLowerCase()}` : 'nothing to trade // gift accepted';
    },
  },
  {
    id: 'bait',
    title: 'HONEYPOT',
    text: 'Plant a decoy to draw a hardened intrusion. Survive it for a large data bounty.',
    accept: 'PLANT DECOY  [NEXT FIGHT IS ELITE, +2500 SCORE]',
    decline: 'IGNORE',
    run: (c) => {
      c.hardenNext();
      c.addScore(2500);
      return 'decoy planted // bounty credited';
    },
  },
  {
    id: 'graft',
    title: 'NEURAL GRAFT',
    text: 'Splice a foreign pathway into your mind. Stronger, but less of you remains.',
    accept: 'GRAFT  [-15 MAX INTEGRITY, RARE UPGRADE]',
    decline: 'REJECT',
    run: (c) => {
      c.maxHp(-15);
      c.offer(['rare']);
      return 'graft accepted // max integrity -15';
    },
  },
  {
    id: 'echo',
    title: 'ECHO OF A USER',
    text: 'A trace of the human operator lingers here. It could steady you.',
    accept: 'LISTEN  [+15 MAX INTEGRITY, +25% INTEGRITY]',
    decline: 'MOVE ON',
    run: (c) => {
      c.maxHp(15);
      c.heal(0.25);
      return 'operator echo // resolve hardened';
    },
  },
];
