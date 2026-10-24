import type { ContentPack, TowerDefinition, TowerId } from "../core/types";
import { isSupport } from "../systems/attacks";
import { pageOf } from "../ui/tower-pages";
/**
 * Build tags for the draft: towers that share tags with the roster are offered more often, so archetypes form
 * (burn, chill, chain, traps, ...) without being forced. Derived from the attack kind, the targets and the placement.
 */
export type Tag = "burn" | "chill" | "status" | "chain" | "area" | "antiair" | "trap" | "economy" | "support" | "single";
export const TAG_LABEL: Record<Tag, string> = {
  burn: "Burn",
  chill: "Chill",
  status: "Status",
  chain: "Chain",
  area: "Area",
  antiair: "Anti-air",
  trap: "Trap",
  economy: "Economy",
  support: "Support",
  single: "Single target",
};
const BY_KIND: Readonly<Record<string, Tag[]>> = {
  burn: ["burn"],
  pool: ["burn", "area"],
  oil: ["burn", "trap"],
  slow: ["chill"],
  encase: ["chill"],
  net: ["chill"],
  stun: ["chill", "status"],
  catalyze: ["status"],
  echo: ["status"],
  mark: ["status"],
  corrode: ["status"],
  disrupt: ["status"],
  confuse: ["status"],
  tether: ["status", "chill"],
  decay: ["status"],
  chain: ["chain"],
  pierce: ["chain"],
  volley: ["chain"],
  splash: ["area"],
  mortar: ["area"],
  quake: ["area"],
  strike: ["area"],
  airburst: ["area", "antiair"],
  income: ["economy"],
  interest: ["economy"],
  bounty: ["economy"],
  discount: ["economy"],
  siphon: ["economy"],
  direct: ["single"],
  focus: ["single"],
  execute: ["single"],
  crit: ["single"],
};
export function tagsOf(t: Readonly<TowerDefinition>): Tag[] {
  const tags = new Set<Tag>(BY_KIND[t.attack.kind] ?? []);
  if (t.placement === "path") tags.add("trap");
  else if (isSupport(t.attack)) tags.add("support");
  if (!isSupport(t.attack) && t.targets.includes("air") && t.placement !== "path") tags.add("antiair");
  if (!tags.size) tags.add(pageOf(t) === 1 ? "status" : "single");
  return [...tags];
}
/** Tags a candidate shares with the roster; "antiair" and "single" are too common to count as a synergy. */
export function sharedTags(id: TowerId, roster: readonly TowerId[], content: ContentPack): Tag[] {
  const held = new Set(roster.flatMap((r) => tagsOf(content.towers[r])));
  return tagsOf(content.towers[id]).filter((t) => t !== "antiair" && t !== "single" && held.has(t));
}
