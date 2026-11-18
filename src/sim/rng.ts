/** Seeded pseudo-random generator (mulberry32). Same seed, same sequence. */
export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max], inclusive. */
  int(min: number, max: number): number;
  /** True with probability p. */
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** Picks a key with probability proportional to its weight. Zero-weight keys are never picked. */
  weighted<K extends string>(weights: Record<K, number>): K;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number): number => min + Math.floor(next() * (max - min + 1));

  return {
    next,
    int,
    chance: (p) => next() < p,
    pick: <T>(items: readonly T[]): T => {
      if (items.length === 0) throw new Error('pick() from an empty list');
      return items[int(0, items.length - 1)] as T;
    },
    weighted: <K extends string>(weights: Record<K, number>): K => {
      const entries = (Object.entries(weights) as [K, number][]).filter(([, w]) => w > 0);
      const total = entries.reduce((s, [, w]) => s + w, 0);
      if (total <= 0) throw new Error('weighted() needs at least one positive weight');
      let roll = next() * total;
      for (const [key, w] of entries) {
        roll -= w;
        if (roll < 0) return key;
      }
      return entries[entries.length - 1]![0];
    },
  };
}
