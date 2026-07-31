/** Deterministic PRNG (mulberry32) so the generated catalog is stable across app runs. */
export function mulberry32(seed: number) {
  let a = seed;
  return function random(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** djb2 string hash — used to derive a stable per-entity seed (e.g. per product id). */
export function hashStringToSeed(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return hash >>> 0;
}

export class SeededRng {
  private random: () => number;

  constructor(seed: number) {
    this.random = mulberry32(seed);
  }

  next(): number {
    return this.random();
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  float(min: number, max: number, decimals = 2): number {
    const value = this.next() * (max - min) + min;
    return Number(value.toFixed(decimals));
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  pickMany<T>(arr: readonly T[], count: number): T[] {
    const pool = [...arr];
    const result: T[] = [];
    for (let i = 0; i < count && pool.length > 0; i++) {
      const idx = Math.floor(this.next() * pool.length);
      result.push(pool[idx]);
      pool.splice(idx, 1);
    }
    return result;
  }

  bool(probability = 0.5): boolean {
    return this.next() < probability;
  }
}
