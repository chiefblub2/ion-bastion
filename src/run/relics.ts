import type { ContentPack, MissionDefinition } from "../core/types";
import { ANY, ARMED, ATTACK, CONTROL, compose, discount, mapEnemies, mapParam, scaleStat, SUPPORT, TRAP, upgradePrice, type PackFn, type TowerFilter } from "./transform";
import { isSpecialization } from "../core/upgrades";
/**
 * Passive run bonuses. Content and mission effects are pure transforms, so the simulation never learns about relics:
 * a Run mission is plain data and stays deterministic. The run-side fields (`reactor`, `cap`, `xp`, `repair`, `flag`)
 * are read by `run/run.ts` and never reach a mission.
 */
export type Rarity = "common" | "rare" | "legendary" | "cursed";
export interface Relic {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: Rarity;
  content?: PackFn;
  mission?: (m: MissionDefinition) => MissionDefinition;
  /** Applied once when the relic is taken: added to the reactor's maximum (and current), or the maximum scaled. */
  reactor?: { add?: number; factor?: number };
  /** Roster cap bonus. */
  cap?: number;
  /** Rank XP factor. */
  xp?: number;
  /** Field repair bonus after every won mission. */
  repair?: number;
  flag?: "zealot" | "second" | "master" | "veteran";
  /**
   * Design role: `foundation` helps any build, `synergy` pays off through one family of towers (`wants`), `build`
   * reshapes the run itself (Doctrines, ranks, act rewards). Absent: foundation.
   */
  category?: "synergy" | "build";
  /** The towers it works through; absent: every build profits. The draft and its fit hint read it. */
  wants?: TowerFilter;
  /** Player-facing name of `wants`, e.g. "Control towers". */
  wantsText?: string;
  /** When it can still pay off: missions left after it is taken, act transitions still ahead. */
  needs?: { missions?: number; transitions?: number };
  /** Cursed relics: the price, shown apart from the upside. */
  downside?: string;
}
const kindIs = (...kinds: string[]) => (t: { attack: { kind: string } }) => kinds.includes(t.attack.kind);
export const RELICS = [
  // Common: plain numbers.
  { id: "salvage", icon: "◇", rarity: "common", name: "Salvage Rights", description: "All towers cost 15% less.", content: discount(0.85, ANY) },
  { id: "toolkit", icon: "▲", rarity: "common", name: "Field Toolkit", description: "All upgrades cost 20% less.", content: upgradePrice(0.8, ANY) },
  { id: "capacitor", wants: ATTACK, wantsText: "Attack towers", icon: "✦", rarity: "common", name: "Hot Capacitors", description: "Attack towers deal 12% more damage.", content: scaleStat("damage", 1.12, ATTACK) },
  { id: "amplifier", category: "synergy", wants: CONTROL, wantsText: "Control towers", icon: "◎", rarity: "common", name: "Field Amplifier", description: "Control towers deal 25% more damage.", content: scaleStat("damage", 1.25, CONTROL) },
  { id: "optics", wants: ARMED, wantsText: "Attack and Control towers", icon: "◌", rarity: "common", name: "Long Optics", description: "Attack and Control towers reach 10% farther.", content: scaleStat("range", 1.1, ARMED) },
  { id: "servos", wants: ARMED, wantsText: "Attack and Control towers", icon: "↻", rarity: "common", name: "Fast Servos", description: "Attack and Control towers fire 10% faster.", content: scaleStat("interval", 0.9, ARMED) },
  { id: "sappers", category: "synergy", wants: TRAP, wantsText: "traps", needs: { missions: 2 }, icon: "✕", rarity: "common", name: "Sapper Crew", description: "Traps cost 30% less and hit 20% harder.", content: compose([discount(0.7, TRAP), scaleStat("damage", 1.2, TRAP)]) },
  { id: "logistics", category: "synergy", wants: SUPPORT, wantsText: "Support towers", needs: { missions: 2 }, icon: "▣", rarity: "common", name: "Logistics Hub", description: "Support towers cost 30% less.", content: discount(0.7, SUPPORT) },
  {
    id: "bounty",
    icon: "◆",
    rarity: "common",
    name: "Bounty Contract",
    description: "Every enemy pays 1 more credit.",
    content: mapEnemies((e) => ({ ...e, reward: e.reward + 1 })),
  },
  { id: "plating", icon: "⬢", rarity: "common", name: "Reactor Plating", description: "+5 reactor energy, and 5 more at most.", reactor: { add: 5 } },
  { id: "reserve", icon: "▤", rarity: "common", name: "War Chest", description: "+80 starting credits in every mission.", mission: (m) => ({ ...m, startingCredits: m.startingCredits + 80 }) },
  {
    id: "dividend", needs: { missions: 1 },
    icon: "≋",
    rarity: "common",
    name: "Supply Line",
    description: "+8 credits after every wave.",
    mission: (m) => ({ ...m, waves: m.waves.map((w) => ({ ...w, bonus: w.bonus + 8 })) }),
  },
  // Rare: rules for one family of towers, or the run itself.
  {
    id: "wildfire", category: "synergy", wants: kindIs("burn", "pool", "oil"), wantsText: "burn and Plasma towers",
    icon: "♨",
    rarity: "rare",
    name: "Wildfire Doctrine",
    description: "Burns and Plasma pools last 50% longer.",
    content: compose([mapParam("burn", "duration", (v) => Math.round(v * 15) / 10), mapParam("pool", "duration", (v) => Math.round(v * 15) / 10)]),
  },
  {
    id: "arc", category: "synergy", wants: kindIs("chain"), wantsText: "chain towers",
    icon: "ϟ",
    rarity: "rare",
    name: "Arc Lattice",
    description: "Chain attacks jump to one more enemy, at 10% less damage.",
    content: compose([mapParam("chain", "jumps", (v) => v + 1), scaleStat("damage", 0.9, kindIs("chain"))]),
  },
  {
    id: "cryo", category: "synergy", wants: kindIs("slow"), wantsText: "slowing towers",
    icon: "❄",
    rarity: "rare",
    name: "Cryo Lattice",
    description: "Slows are 15% stronger and last 30% longer.",
    content: compose([mapParam("slow", "factor", (v) => Math.round(Math.max(0.05, 1 - (1 - v) * 1.15) * 100) / 100), mapParam("slow", "duration", (v) => Math.round(v * 13) / 10)]),
  },
  {
    id: "siege", category: "synergy", wants: kindIs("splash", "mortar"), wantsText: "Splash and Mortar towers",
    icon: "⊕",
    rarity: "rare",
    name: "Siege Doctrine",
    description: "Splash and Mortar towers reach 20% farther but fire 10% slower.",
    content: compose([scaleStat("range", 1.2, kindIs("splash", "mortar")), scaleStat("interval", 1.1, kindIs("splash", "mortar"))]),
  },
  { id: "minefield", category: "synergy", wants: TRAP, wantsText: "traps", needs: { missions: 2 }, icon: "⁂", rarity: "rare", name: "Minefield", description: "Traps cost 40% less but deal 10% less damage.", content: compose([discount(0.6, TRAP), scaleStat("damage", 0.9, TRAP)]) },
  { id: "rack", category: "build", needs: { missions: 2 }, icon: "▥", rarity: "rare", name: "Field Rack", description: "Your roster holds one more tower.", cap: 1 },
  { id: "sergeant", category: "build", needs: { missions: 3 }, icon: "✪", rarity: "rare", name: "Drill Sergeant", description: "Towers earn 50% more rank XP.", xp: 1.5 },
  { id: "medic", needs: { missions: 2 }, icon: "✚", rarity: "rare", name: "Field Medic", description: "+3 reactor repair after every won mission.", repair: 3 },
  // Cursed: strong, with a price.
  { id: "glass", wants: ANY, downside: "The reactor holds 40% less.", icon: "◈", rarity: "cursed", name: "Glass Reactor", description: "All towers deal 18% more damage; the reactor holds 40% less.", content: scaleStat("damage", 1.18, ANY), reactor: { factor: 0.6 } },
  {
    id: "austerity", downside: "Waves pay no bonus.",
    icon: "⊘",
    rarity: "cursed",
    name: "Austerity",
    description: "+250 starting credits, but waves pay no bonus.",
    mission: (m) => ({ ...m, startingCredits: m.startingCredits + 250, waves: m.waves.map((w) => ({ ...w, bonus: 0 })) }),
  },
  {
    id: "overclock", wants: ATTACK, wantsText: "Attack towers", downside: "Every upgrade costs 25% more.",
    icon: "⚡",
    rarity: "cursed",
    name: "Overclocked Grid",
    description: "Attack towers fire 20% faster; every upgrade costs 25% more.",
    content: compose([scaleStat("interval", 0.83, ATTACK), upgradePrice(1.25, ANY)]),
  },
  {
    id: "market", downside: "30% fewer starting credits.",
    icon: "¤",
    rarity: "cursed",
    name: "Bounty Market",
    description: "Every enemy pays 2 more credits; 30% fewer starting credits.",
    content: mapEnemies((e) => ({ ...e, reward: e.reward + 2 })),
    mission: (m) => ({ ...m, startingCredits: Math.max(1, Math.round(m.startingCredits * 0.7)) }),
  },
  {
    id: "zealot", category: "build", needs: { missions: 3 }, downside: "Camp nodes no longer repair the reactor.",
    icon: "☩",
    rarity: "cursed",
    name: "Zealot",
    description: "Doctrine tiers cost 30% less; camp nodes no longer repair the reactor.",
    content: upgradePrice(0.7, ANY, isSpecialization),
    flag: "zealot",
  },
  // Legendary: act rewards, elite prizes and events only.
  {
    id: "sabotage",
    icon: "☠",
    rarity: "legendary",
    name: "Sabotage Cell",
    description: "Enemies have 8% less HP in every mission.",
    mission: (m) => ({ ...m, waves: m.waves.map((w) => ({ ...w, hpMultiplier: Math.round((w.hpMultiplier ?? 1) * 920) / 1000 })) }),
  },
  { id: "veteran", category: "build", icon: "✠", rarity: "legendary", name: "Veteran Corps", description: "Every roster tower counts at least rank 1.", flag: "veteran" },
  { id: "pockets", icon: "◉", rarity: "legendary", name: "Deep Pockets", description: "+150 starting credits in every mission.", mission: (m) => ({ ...m, startingCredits: m.startingCredits + 150 }) },
  { id: "second", category: "build", needs: { missions: 3 }, icon: "⚔", rarity: "legendary", name: "Second Doctrine", description: "A tower type may hold two Doctrines.", flag: "second" },
  { id: "core", icon: "⬣", rarity: "legendary", name: "Reinforced Core", description: "+8 reactor energy, and 8 more at most.", reactor: { add: 8 } },
  { id: "master", category: "build", needs: { transitions: 1 }, icon: "♛", rarity: "legendary", name: "Master License", description: "Act transitions grant a Doctrine as well as the relic.", flag: "master" },
] as const satisfies readonly Relic[];
export type RelicId = (typeof RELICS)[number]["id"];
export const RELIC_IDS: readonly RelicId[] = RELICS.map((r) => r.id);
export const relicOf = (id: RelicId): Relic => RELICS.find((r) => r.id === id)!;
export const isRelic = (id: unknown): id is RelicId => RELIC_IDS.includes(id as RelicId);
export const relicsOf = (rarity: Rarity) => RELIC_IDS.filter((id) => relicOf(id).rarity === rarity);
export const hasFlag = (relics: readonly RelicId[], flag: NonNullable<Relic["flag"]>) => relics.some((id) => relicOf(id).flag === flag);
/** The pack and mission a set of relics produces, applied in the order they were taken. */
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
