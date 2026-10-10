import { DEFAULT_CONTENT } from "../content";
import { MISSIONS } from "../content/missions";
import type { ContentPack, MissionDefinition } from "./types";
import { Game } from "./game";
import type { Build, Strategy } from "./play";

const enemiesOf = (m: MissionDefinition, content: ContentPack) =>
  m.waves.flatMap((w) => w.groups.map((g) => content.enemies[g.type]));

/** Any flying enemy in the mission (by layer, not by id). */
export const hasAir = (m: MissionDefinition, content: ContentPack = DEFAULT_CONTENT) =>
  enemiesOf(m, content).some((e) => e.layer === "air");

export const hasStealth = (m: MissionDefinition, content: ContentPack = DEFAULT_CONTENT) =>
  enemiesOf(m, content).some((e) => e.traits?.some((t) => t.kind === "stealth"));

/** Builds that fail `canBuild` for their tower or are not offered by the mission. */
export function unbuildable(m: MissionDefinition, strategy: Pick<Strategy, "builds">): Build[] {
  const probe = new Game(m),
    offered = probe.availableTowers();
  return strategy.builds.filter((b) => !probe.canBuild(b.x, b.y, b.tower) || !offered.includes(b.tower));
}

/** Mission 01 is the tutorial: three upgraded towers are meant to suffice there. */
export const isTutorial = (m: MissionDefinition) => MISSIONS[0]?.id === m.id;

/** Thin defense that must still lose: three towers, a single one on a ring. */
export const thinBuilds = (m: MissionDefinition, strategy: Pick<Strategy, "builds">): Build[] =>
  strategy.builds.slice(0, m.circle ? 1 : 3);

/** Same positions, ground-only Nova everywhere. */
export const novaOnly = (strategy: Pick<Strategy, "builds">): Build[] =>
  strategy.builds.map((b) => ({ ...b, tower: "blast" as const }));
