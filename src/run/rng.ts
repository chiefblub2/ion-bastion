import { fnv, stable } from "../core/hash";
/** A seeded stream of numbers in [0, 1) (mulberry32); the same seed always yields the same run. */
export type Rng = () => number;
export function rng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** An independent stream per purpose, so drawing more offers in one place never shifts the waves of another. */
export const streamOf = (seed: number, ...key: unknown[]) => rng(fnv(stable([seed, ...key])));
export const pick = <T>(r: Rng, items: readonly T[]): T => items[Math.floor(r() * items.length)];
/** Up to `count` distinct items, drawn by weight without replacement. */
export function draw<T>(r: Rng, items: readonly T[], count: number, weight: (item: T) => number = () => 1): T[] {
  const left = [...items],
    out: T[] = [];
  while (out.length < count && left.length) {
    const total = left.reduce((sum, item) => sum + weight(item), 0);
    let roll = r() * total,
      at = 0;
    while (at < left.length - 1 && (roll -= weight(left[at])) >= 0) at++;
    out.push(...left.splice(at, 1));
  }
  return out;
}
/** A fresh run seed: six base-36 digits a player can read out and type in. */
export const seedText = (seed: number) => (seed >>> 0).toString(36).toUpperCase().padStart(6, "0").slice(-6);
export function parseSeed(text: string) {
  const clean = text.trim().toLowerCase();
  if (!/^[0-9a-z]{1,6}$/.test(clean)) return undefined;
  return parseInt(clean, 36);
}
