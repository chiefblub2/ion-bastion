import type { AttackSpec, ContentPack, TowerDefinition, TowerId, TowerStats, UpgradeDefinition } from "../core/types";
import { isSpecialization } from "../core/upgrades";
import { pageOf } from "../ui/tower-pages";
/**
 * Pure content transforms for the Run: relics, doctrines, ranks and shop mods all change a run's pack through these,
 * never the simulation. Each returns a fresh pack, so the per-pack caches (`resolveUpgrades`) never serve stale values.
 * Upgrades hold absolute values, so a stat or attack value is scaled on the definition and on every upgrade that sets it.
 */
export type TowerFilter = (t: Readonly<TowerDefinition>) => boolean;
export const ATTACK: TowerFilter = (t) => pageOf(t) === 0,
  CONTROL: TowerFilter = (t) => pageOf(t) === 1,
  TRAP: TowerFilter = (t) => pageOf(t) === 2,
  SUPPORT: TowerFilter = (t) => pageOf(t) === 3,
  ARMED: TowerFilter = (t) => pageOf(t) < 2,
  ANY: TowerFilter = () => true;
export const only = (ids: readonly TowerId[]): TowerFilter => (t) => ids.includes(t.id as TowerId);
/** Prices stay positive integers, as validation requires. */
export const price = (cost: number, factor: number) => Math.max(1, Math.round(cost * factor));
export type PackFn = (pack: ContentPack) => ContentPack;
export function mapTowers(pack: ContentPack, which: TowerFilter, fn: (t: Readonly<TowerDefinition>) => TowerDefinition): ContentPack {
  const towers = Object.fromEntries(Object.entries(pack.towers).map(([id, t]) => [id, which(t) ? fn(t) : t])) as Record<TowerId, TowerDefinition>;
  return { ...pack, towers };
}
/** Damage stays whole, so tooltips keep their numbers short. */
const STEP: Record<keyof TowerStats, number> = { damage: 1, range: 0.01, interval: 0.001 };
export function scaleStat(stat: keyof TowerStats, factor: number, which: TowerFilter): PackFn {
  const scale = (v: number) => Math.max(STEP[stat], Math.round((v * factor) / STEP[stat]) * STEP[stat]);
  return (pack) =>
    mapTowers(pack, (t) => which(t) && t[stat] > 0 && !(stat === "range" && t.placement === "path"), (t) => ({
      ...t,
      [stat]: scale(t[stat]),
      upgrades: t.upgrades.map((u): UpgradeDefinition => {
        const value = u.effects.stats?.[stat];
        return value === undefined ? u : { ...u, effects: { ...u.effects, stats: { ...u.effects.stats, [stat]: scale(value) } } };
      }),
    }));
}
/** Changes one attack value of every tower of an attack kind, on the definition and on every upgrade that sets it. */
export function mapParam(kind: AttackSpec["kind"], key: string, fn: (v: number) => number, which: TowerFilter = ANY): PackFn {
  return (pack) =>
    mapTowers(pack, (t) => which(t) && t.attack.kind === kind && typeof (t.attack as unknown as Record<string, unknown>)[key] === "number", (t) => ({
      ...t,
      attack: { ...t.attack, [key]: fn((t.attack as unknown as Record<string, number>)[key]) } as AttackSpec,
      upgrades: t.upgrades.map((u): UpgradeDefinition => {
        const attack = u.effects.attack as Record<string, number> | undefined,
          value = attack?.[key];
        return typeof value !== "number" ? u : { ...u, effects: { ...u.effects, attack: { ...attack, [key]: fn(value) } } };
      }),
    }));
}
export const discount = (factor: number, which: TowerFilter): PackFn => (pack) => mapTowers(pack, which, (t) => ({ ...t, cost: price(t.cost, factor) }));
/** Upgrade prices of the matching upgrades (all when `ids` is absent). */
export const upgradePrice = (factor: number, which: TowerFilter, pick: (u: UpgradeDefinition) => boolean = () => true): PackFn => (pack) =>
  mapTowers(pack, which, (t) => ({ ...t, upgrades: t.upgrades.map((u) => (pick(u) ? { ...u, cost: price(u.cost, factor) } : u)) }));
/** Every enemy at once. */
export const mapEnemies = (fn: (e: ContentPack["enemies"][keyof ContentPack["enemies"]]) => ContentPack["enemies"][keyof ContentPack["enemies"]]): PackFn => (pack) => ({
  ...pack,
  enemies: Object.fromEntries(Object.entries(pack.enemies).map(([id, e]) => [id, fn(e)])) as ContentPack["enemies"],
});
/** The specialization paths of a tower, from its upgrades. */
export const pathsOf = (t: Readonly<TowerDefinition>) => [...new Set(t.upgrades.filter(isSpecialization).map((u) => u.path!))];
/**
 * Levels 6–8 in a run: every specialization tier is removed except the paths the run's doctrines name
 * (`<tower>:<path>`). Without a doctrine a tower tops out at level 5.
 */
export function lockSpecializations(doctrines: readonly string[]): PackFn {
  const held = new Set(doctrines);
  return (pack) =>
    mapTowers(pack, (t) => t.upgrades.some(isSpecialization), (t) => {
      const upgrades = t.upgrades.filter((u) => !isSpecialization(u) || held.has(`${t.id}:${u.path}`)),
        kept = new Set(pathsOf({ ...t, upgrades }));
      const paths = t.visual.paths && Object.fromEntries(Object.entries(t.visual.paths).filter(([p]) => kept.has(p)));
      return { ...t, upgrades, visual: { ...t.visual, paths: paths && Object.keys(paths).length ? paths : undefined } };
    });
}
export const compose = (fns: readonly PackFn[]): PackFn => (pack) => fns.reduce((p, f) => f(p), pack);
