// Seeded mulberry32 RNG. Each run derives independent streams from its seed
// so map layout, upgrade offers and anomalies stay reproducible regardless of
// what happens in combat.

export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed | 0;
  }

  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }

  int(a: number, b: number): number {
    return a + Math.floor(this.next() * (b - a + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length) % arr.length];
  }

  weighted<T>(items: readonly T[], weight: (t: T) => number): T | null {
    let total = 0;
    for (const it of items) total += Math.max(0, weight(it));
    if (total <= 0) return null;
    let r = this.next() * total;
    for (const it of items) {
      r -= Math.max(0, weight(it));
      if (r <= 0) return it;
    }
    return items[items.length - 1];
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }
}

/** Mix a run seed with a stream id into a new 32-bit seed. */
export const deriveSeed = (seed: number, stream: number): number => {
  let h = (seed ^ Math.imul(stream + 0x9e3779b9, 0x85ebca6b)) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) | 0;
};

export const randomSeed = (): number => (Math.random() * 0xffffffff) >>> 0;

export const seedToString = (seed: number): string => {
  const h = (seed >>> 0).toString(16).toUpperCase().padStart(8, '0');
  return `${h.slice(0, 4)}-${h.slice(4)}`;
};

export const parseSeed = (s: string): number | null => {
  const clean = s.replace(/[^0-9a-fA-F]/g, '');
  if (clean.length === 0 || clean.length > 8) return null;
  const v = parseInt(clean, 16);
  return Number.isFinite(v) ? v >>> 0 : null;
};
