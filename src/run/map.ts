import type { ContentPack } from "../core/types";
import { actTiers, ACT_COUNT } from "./acts";
import { threatRules } from "./ascension";
import { BOSS_MOD_IDS, type BossModId } from "./boss";
import { draw, pick, streamOf, type Rng } from "./rng";
/**
 * The map of an act, derived from the seed alone (the run stores only where the player stands): five columns of up
 * to three lanes, missions on columns 0 and 2, camp nodes on 1 and 3, the act boss on 4. One lane of a mission column
 * may be an elite instead of a standard mission, so a run always plays the same number of missions. Edges join the
 * same or a neighbouring lane. After act III the Final Stand is a map of its own with a single node.
 */
export type MissionKind = "standard" | "elite" | "boss" | "final";
export type CampKind = "shop" | "forge" | "repair" | "event";
export type NodeKind = MissionKind | CampKind;
export interface RunNode {
  act: number;
  column: number;
  lane: number;
  kind: NodeKind;
  /** Mission nodes: the campaign mission whose map, economy and enemies the generated mission uses. */
  mission?: string;
  mods?: BossModId[];
}
export type RunLength = "full" | "short";
export const isMissionKind = (k: NodeKind): k is MissionKind => k === "standard" || k === "elite" || k === "boss" || k === "final";
export const LANES = 3;
const CAMPS: readonly CampKind[] = ["shop", "forge", "repair", "event"];
/** Acts a run of this length plays, the Final Stand included (a short run ends on act I's boss). */
export const actsOf = (length: RunLength) => (length === "short" ? 1 : ACT_COUNT + 1);
/** Missions a run of this length plays: 3 per act and the Final Stand. */
export const missionsOf = (length: RunLength) => (length === "short" ? 3 : ACT_COUNT * 3 + 1);
/** Sources for a column, from a window of the act's tier and never one used before in this run. */
function sources(r: Rng, list: readonly string[], [lo, hi]: readonly [number, number], used: Set<string>, count: number) {
  const window = list.slice(Math.floor(lo * list.length), Math.max(Math.ceil(hi * list.length), Math.floor(lo * list.length) + count)),
    fresh = window.filter((id) => !used.has(id)),
    picks = draw(r, fresh.length >= count ? fresh : window, count);
  for (const id of picks) used.add(id);
  return picks;
}
const WINDOWS: Record<number, readonly [number, number]> = { 0: [0, 0.6], 2: [0.3, 0.9], 4: [0.6, 1] };
/** The node columns of an act. The sources of earlier acts are drawn first, so no map repeats in a run. */
export function actMap(seed: number, act: number, content: ContentPack, threat = 0, length: RunLength = "full"): RunNode[][] {
  const tiers = actTiers(content),
    used = new Set<string>();
  let columns: RunNode[][] = [];
  for (let a = 0; a <= act; a++) columns = buildAct(seed, a, tiers[a].missions.map((m) => m.id), used, threat, length);
  return columns;
}
function buildAct(seed: number, act: number, missions: readonly string[], used: Set<string>, threat: number, length: RunLength): RunNode[][] {
  const r = streamOf(seed, "map", act),
    rules = threatRules(threat),
    lastAct = length === "short" ? 0 : ACT_COUNT - 1;
  if (act > lastAct) {
    const [mission] = sources(r, missions, [0, 1], used, 1);
    return [[{ act, column: 0, lane: 0, kind: "final", mission, mods: draw(r, BOSS_MOD_IDS, rules.finalMods) }]];
  }
  const columns: RunNode[][] = [];
  for (let column = 0; column < 5; column++) {
    if (column === 4) {
      const [mission] = sources(r, missions, WINDOWS[4], used, 1),
        mods = draw(r, BOSS_MOD_IDS, length === "short" ? rules.finalMods : 1);
      columns.push([{ act, column, lane: 1, kind: "boss", mission, mods }]);
      continue;
    }
    if (column % 2 === 0) {
      const picks = sources(r, missions, WINDOWS[column], used, LANES),
        elite = act === 0 && column === 0 ? -1 : r() < 2 / 3 ? Math.floor(r() * LANES) : -1;
      columns.push(
        picks.map((mission, lane) =>
          lane === elite ? { act, column, lane, kind: "elite", mission, mods: [pick(r, BOSS_MOD_IDS)] } : { act, column, lane, kind: "standard", mission },
        ),
      );
      continue;
    }
    // Camp columns: three different kinds; on the column before the boss the middle lane, which every lane reaches,
    // is a Shop or a Repair, so no path arrives at the boss without a chance to prepare.
    let kinds = draw(r, CAMPS, LANES);
    if (column === 3 && kinds[1] !== "shop" && kinds[1] !== "repair") {
      const at = kinds.findIndex((k) => k === "shop" || k === "repair");
      [kinds[1], kinds[at]] = [kinds[at], kinds[1]];
      kinds = [...kinds];
    }
    columns.push(kinds.map((kind, lane) => ({ act, column, lane, kind })));
  }
  return columns;
}
/** The nodes the player may choose next from a position (column -1: the start of the act). */
export function nextNodes(columns: readonly RunNode[][], column: number, lane: number): RunNode[] {
  const next = columns[column + 1];
  if (!next) return [];
  if (column < 0 || next.length === 1 || columns[column].length === 1) return [...next];
  return next.filter((n) => Math.abs(n.lane - lane) <= 1);
}
