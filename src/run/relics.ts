import type { ContentPack, MissionDefinition, TowerDefinition, TowerId, TowerStats, UpgradeDefinition } from "../core/types";
import { pageOf } from "../ui/tower-pages";
/**
 * Passive run bonuses. Each one is a pure transform of the content pack or the generated mission, so the simulation
 * never learns about relics: a Run mission is plain data and stays deterministic.
 */
export interface Relic {
  id: string;
  name: string;
  description: string;
  icon: string;
  content?: (pack: ContentPack) => ContentPack;
  mission?: (m: MissionDefinition) => MissionDefinition;
}
type TowerFilter = (t: Readonly<TowerDefinition>) => boolean;
const ATTACK: TowerFilter = (t) => pageOf(t) === 0,
  CONTROL: TowerFilter = (t) => pageOf(t) === 1,
  TRAP: TowerFilter = (t) => pageOf(t) === 2,
  SUPPORT: TowerFilter = (t) => pageOf(t) === 3,
  ARMED: TowerFilter = (t) => pageOf(t) < 2,
  ANY: TowerFilter = () => true;
/** Prices stay positive integers, as validation requires. */
const price = (cost: number, factor: number) => Math.max(1, Math.round(cost * factor));
function mapTowers(pack: ContentPack, which: TowerFilter, fn: (t: Readonly<TowerDefinition>) => TowerDefinition): ContentPack {
  const towers = Object.fromEntries(
    Object.entries(pack.towers).map(([id, t]) => [id, which(t) ? fn(t) : t]),
  ) as Record<TowerId, TowerDefinition>;
  return { ...pack, towers };
}
/** Damage stays whole, so tooltips keep their numbers short. */
const STEP: Record<keyof TowerStats, number> = { damage: 1, range: 0.01, interval: 0.001 };
/** Scales a stat on the definition and on every upgrade that sets it: upgrades hold absolute values, not deltas. */
function scaleStat(stat: keyof TowerStats, factor: number, which: TowerFilter) {
  const scale = (v: number) => Math.max(STEP[stat], Math.round((v * factor) / STEP[stat]) * STEP[stat]);
  return (pack: ContentPack) =>
    mapTowers(pack, (t) => which(t) && t[stat] > 0, (t) => ({
      ...t,
      [stat]: scale(t[stat]),
      upgrades: t.upgrades.map((u): UpgradeDefinition => {
        const value = u.effects.stats?.[stat];
        return value === undefined ? u : { ...u, effects: { ...u.effects, stats: { ...u.effects.stats, [stat]: scale(value) } } };
      }),
    }));
}
const discount = (factor: number, which: TowerFilter) => (pack: ContentPack) =>
  mapTowers(pack, which, (t) => ({ ...t, cost: price(t.cost, factor) }));
const cheaperUpgrades = (factor: number) => (pack: ContentPack) =>
  mapTowers(pack, ANY, (t) => ({ ...t, upgrades: t.upgrades.map((u) => ({ ...u, cost: price(u.cost, factor) })) }));
export const RELICS = [
  { id: "salvage", icon: "◇", name: "Salvage Rights", description: "All towers cost 15% less.", content: discount(0.85, ANY) },
  { id: "toolkit", icon: "▲", name: "Field Toolkit", description: "All upgrades cost 20% less.", content: cheaperUpgrades(0.8) },
  { id: "capacitor", icon: "✦", name: "Hot Capacitors", description: "Attack towers deal 12% more damage.", content: scaleStat("damage", 1.12, ATTACK) },
  { id: "amplifier", icon: "◎", name: "Field Amplifier", description: "Control towers deal 25% more damage.", content: scaleStat("damage", 1.25, CONTROL) },
  { id: "optics", icon: "◌", name: "Long Optics", description: "Attack and Control towers reach 10% farther.", content: scaleStat("range", 1.1, ARMED) },
  { id: "servos", icon: "↻", name: "Fast Servos", description: "Attack and Control towers fire 10% faster.", content: scaleStat("interval", 0.9, ARMED) },
  { id: "sappers", icon: "✕", name: "Sapper Crew", description: "Traps cost 30% less and hit 20% harder.", content: (p) => scaleStat("damage", 1.2, TRAP)(discount(0.7, TRAP)(p)) },
  { id: "logistics", icon: "▣", name: "Logistics Hub", description: "Support towers cost 30% less.", content: discount(0.7, SUPPORT) },
  {
    id: "bounty",
    icon: "◆",
    name: "Bounty Contract",
    description: "Every enemy pays 1 more credit.",
    content: (p) => ({
      ...p,
      enemies: Object.fromEntries(Object.entries(p.enemies).map(([id, e]) => [id, { ...e, reward: e.reward + 1 }])) as ContentPack["enemies"],
    }),
  },
  { id: "plating", icon: "⬢", name: "Reactor Plating", description: "+5 reactor energy in every mission.", mission: (m) => ({ ...m, reactorEnergy: m.reactorEnergy + 5 }) },
  { id: "reserve", icon: "▤", name: "War Chest", description: "+80 starting credits in every mission.", mission: (m) => ({ ...m, startingCredits: m.startingCredits + 80 }) },
  {
    id: "dividend",
    icon: "≋",
    name: "Supply Line",
    description: "+8 credits after every wave.",
    mission: (m) => ({ ...m, waves: m.waves.map((w) => ({ ...w, bonus: w.bonus + 8 })) }),
  },
] as const satisfies readonly Relic[];
export type RelicId = (typeof RELICS)[number]["id"];
export const RELIC_IDS: readonly RelicId[] = RELICS.map((r) => r.id);
export const relicOf = (id: RelicId): Relic => RELICS.find((r) => r.id === id)!;
export const isRelic = (id: unknown): id is RelicId => RELIC_IDS.includes(id as RelicId);
/** The pack and mission a set of relics produces; a fresh pack object, so per-pack caches never serve stale values. */
export function applyRelics(base: ContentPack, mission: MissionDefinition, relics: readonly RelicId[]) {
  let content: ContentPack = { ...base },
    m = mission;
  for (const id of relics) {
    const r = relicOf(id);
    if (r.content) content = r.content(content);
    if (r.mission) m = r.mission(m);
  }
  return { content, mission: m };
}
