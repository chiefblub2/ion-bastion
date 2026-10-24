import type { ContentPack, EnemyDefinition, EnemyId, MissionDefinition, TowerId, TraitKind } from "../core/types";
import { isSupport } from "../systems/attacks";
import { HAZARD } from "./tuning";
/**
 * What a run mission throws at the player, and what the roster can answer. Three needs decide whether an enemy type
 * may appear at all: flyers need an anti-air tower, stealth a Detector, buried units traps or area damage.
 */
export type Need = "air" | "detect" | "under";
/** Attack kinds that hit buried units: area damage, besides the traps. */
const AREA_KINDS: ReadonlySet<string> = new Set(["splash", "mortar", "quake", "pool", "strike"]);
export function needsOf(e: Readonly<EnemyDefinition>): Need[] {
  const kinds = new Set((e.traits ?? []).map((t) => t.kind)),
    needs: Need[] = [];
  if (e.layer === "air" || kinds.has("leap") || kinds.has("phase")) needs.push("air");
  if (kinds.has("stealth") || kinds.has("cloakField")) needs.push("detect");
  if (kinds.has("burrow") || kinds.has("tunnel")) needs.push("under");
  return needs;
}
/** The roster towers that answer each need. */
export function answers(roster: readonly TowerId[], content: ContentPack): Record<Need, TowerId[]> {
  const of = (ok: (id: TowerId) => boolean) => roster.filter(ok),
    t = (id: TowerId) => content.towers[id];
  return {
    air: of((id) => !isSupport(t(id).attack) && t(id).targets.includes("air")),
    detect: of((id) => t(id).attack.kind === "detect"),
    under: of((id) => t(id).placement === "path" || AREA_KINDS.has(t(id).attack.kind)),
  };
}
export function rosterCovers(roster: readonly TowerId[], content: ContentPack): Record<Need, boolean> {
  const a = answers(roster, content);
  return { air: a.air.length > 0, detect: a.detect.length > 0, under: a.under.length > 0 };
}
export type ThreatId = "air" | "stealth" | "burrow" | "titans" | "fast" | "armor" | "shield" | "regen" | "split";
export interface Threat {
  id: ThreatId;
  label: string;
  /** Share of the mission's budget (count × HP × √speed × wave HP). */
  share: number;
  /** Roster towers that answer it; empty for threats without a hard counter. */
  answeredBy: TowerId[];
  /** The source had it, but the roster cannot answer it, so the generator left it out. */
  suppressed?: true;
}
const LABEL: Record<ThreatId, string> = {
  air: "Air",
  stealth: "Stealth",
  burrow: "Burrowers",
  titans: "Titans",
  fast: "Fast",
  armor: "Armor",
  shield: "Shields",
  regen: "Regeneration",
  split: "Splitters",
};
const TRAIT_THREAT: Partial<Record<TraitKind, ThreatId>> = {
  armor: "armor",
  shield: "shield",
  regen: "regen",
  splitOnDeath: "split",
  stealth: "stealth",
  cloakField: "stealth",
  burrow: "burrow",
  tunnel: "burrow",
};
const NEED_THREAT: Record<Need, ThreatId> = { air: "air", detect: "stealth", under: "burrow" };
/** Budget shares from which a threat is worth a chip. */
const SHOWN: Partial<Record<ThreatId, number>> = { air: 0.15, armor: 0.2, shield: 0.2, regen: 0.2, split: 0.2, fast: 0.15 };
/**
 * The threats of a generated mission. `suppressed` lists needs the source mission had that the roster cannot answer
 * (the generator swapped those types out); they show struck through, and they pay no hazard.
 */
export function threatsOf(mission: MissionDefinition, content: ContentPack, roster: readonly TowerId[], suppressed: readonly Need[] = []): Threat[] {
  const budget = new Map<ThreatId, number>(),
    add = (id: ThreatId, v: number) => budget.set(id, (budget.get(id) ?? 0) + v),
    speeds = Object.values(content.enemies).map((e) => e.speed).sort((a, b) => a - b),
    fast = speeds[Math.floor(speeds.length / 2)] * 1.4;
  let total = 0;
  for (const w of mission.waves)
    for (const g of w.groups) {
      const e = content.enemies[g.type],
        v = g.count * e.hp * Math.sqrt(e.speed) * (w.hpMultiplier ?? 1);
      total += v;
      if (g.type === "boss") add("titans", v);
      if (e.layer === "air" || needsOf(e).includes("air")) add("air", v);
      if (e.speed >= fast) add("fast", v);
      const seen = new Set<ThreatId>();
      for (const t of e.traits ?? []) {
        const id = TRAIT_THREAT[t.kind];
        if (id && !seen.has(id)) {
          seen.add(id);
          add(id, v);
        }
      }
    }
  const a = answers(roster, content),
    counter: Partial<Record<ThreatId, TowerId[]>> = { air: a.air, stealth: a.detect, burrow: a.under },
    out: Threat[] = [];
  for (const [id, v] of budget) {
    const share = total ? v / total : 0;
    if (share < (SHOWN[id] ?? 0)) continue;
    out.push({ id, label: LABEL[id], share, answeredBy: counter[id] ?? [] });
  }
  for (const n of suppressed) {
    const id = NEED_THREAT[n];
    if (!out.some((t) => t.id === id)) out.push({ id, label: LABEL[id], share: 0, answeredBy: [], suppressed: true });
  }
  const order: ThreatId[] = ["titans", "stealth", "burrow", "air", "fast", "armor", "shield", "regen", "split"];
  return out.sort((x, y) => order.indexOf(x.id) - order.indexOf(y.id));
}
/** Scrap paid on a win for the hard threats the mission carried: stealth, burrowers and heavy air. */
export const hazardPay = (threats: readonly Threat[]) =>
  threats.filter((t) => !t.suppressed && (t.id === "stealth" || t.id === "burrow" || (t.id === "air" && t.share >= 0.3))).length * HAZARD;
/** Enemy types a split or a brood adds; they must be answerable too. */
export function offspring(e: Readonly<EnemyDefinition>): EnemyId[] {
  return (e.traits ?? []).flatMap((t) => ("type" in t && typeof t.type === "string" ? [t.type as EnemyId] : []));
}
