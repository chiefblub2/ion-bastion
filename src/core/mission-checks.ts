import { DEFAULT_CONTENT } from "../content";
import { MISSIONS, SECTORS } from "../content/missions";
import type { ContentPack, MissionDefinition, MissionSector } from "./types";
import { Game } from "./game";
import type { Build, Strategy } from "./play";

const enemiesOf = (m: MissionDefinition, content: ContentPack) =>
  m.waves.flatMap((w) => w.groups.map((g) => content.enemies[g.type]));

/** Any flying enemy in the mission (by layer, not by id). */
export const hasAir = (m: MissionDefinition, content: ContentPack = DEFAULT_CONTENT) =>
  enemiesOf(m, content).some((e) => e.layer === "air");

export const hasStealth = (m: MissionDefinition, content: ContentPack = DEFAULT_CONTENT) =>
  enemiesOf(m, content).some((e) => e.traits?.some((t) => t.kind === "stealth" || t.kind === "cloakField"));

/** Builds that fail `canBuild` for their tower or are not offered by the mission. */
export function unbuildable(m: MissionDefinition, strategy: Pick<Strategy, "builds">): Build[] {
  const probe = new Game(m),
    offered = probe.availableTowers();
  return strategy.builds.filter((b) => !probe.canBuild(b.x, b.y, b.tower) || !offered.includes(b.tower));
}

/** Mission 01 is the tutorial: three upgraded towers are meant to suffice there. */
/** Strategies that still lose; balancing is pending. Remove an entry once it wins. */
export const PENDING_BALANCE: ReadonlySet<string> = new Set(["frostwall/A", "frostwall/B"]);
/** Enemies that exist but no mission uses yet; remove an id once a mission places it. */
export const RESERVE_ENEMIES: ReadonlySet<string> = new Set([
  "leaper",
  "skimmer",
  "warden",
  "broodmother",
  "sparkworm",
  "molter",
  "wisp",
  "hydra",
  "hydraling",
  "stormcell",
]);

export const isTutorial = (m: MissionDefinition) => MISSIONS[0]?.id === m.id;

/** Thin defense that must still lose: three towers, a single one on a ring. */
export const thinBuilds = (m: MissionDefinition, strategy: Pick<Strategy, "builds">): Build[] =>
  strategy.builds.slice(0, m.circle ? 1 : 3);

/** Same positions, ground-only Nova everywhere. */
export const novaOnly = (strategy: Pick<Strategy, "builds">): Build[] =>
  strategy.builds.map((b) => ({ ...b, tower: "blast" as const }));

/**
 * Mission ids and map ids of `sector` that other registered missions already use. Missions of the
 * registered sector with the same id are skipped, so a registered sector checks clean against itself.
 */
export function duplicateIds(sector: MissionSector, missions: readonly MissionDefinition[] = MISSIONS): string[] {
  const same = new Set(SECTORS.find((s) => s.id === sector.id)?.missions ?? []),
    others = missions.filter((m) => !same.has(m));
  const bad: string[] = [];
  for (const m of sector.missions) {
    if (others.some((o) => o.id === m.id)) bad.push(`Mission ${m.id}`);
    if (others.some((o) => o.map.id === m.map.id)) bad.push(`Map ${m.map.id}`);
  }
  return bad;
}
