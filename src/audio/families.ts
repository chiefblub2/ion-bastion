import type { AttackSpec, ContentPack, GameEvent, TowerDefinition } from "../core/types";
// Tower families: each plays one instrument part of the music; shots raise the family's activity instead of playing notes.

export const FAMILIES = ["rapid", "heavy", "electric", "control", "fire", "traps"] as const;
export type Family = (typeof FAMILIES)[number];
/** Support kinds never fire, so they play no part. */
const BY_KIND: Record<AttackSpec["kind"], Family | null> = {
  direct: "rapid", volley: "rapid", pierce: "rapid",
  splash: "heavy", mortar: "heavy", quake: "heavy", execute: "heavy",
  chain: "electric", stun: "electric", disrupt: "electric", focus: "electric",
  slow: "control", net: "control", pull: "control",
  burn: "fire", corrode: "fire", decay: "fire",
  bleed: "traps", charge: "traps", pit: "traps", alarm: "traps",
  aura: null, income: null, detect: null, bounty: null, repair: null, mark: null,
};
export const familyOf = (d: TowerDefinition): Family | null => (d.placement === "path" ? "traps" : BY_KIND[d.attack.kind]);
/** Shots per family in a batch of drained events. */
export function shotsByFamily(events: readonly GameEvent[], content: ContentPack) {
  const out: Partial<Record<Family, number>> = {};
  for (const e of events) {
    if (e.type !== "shot") continue;
    const f = familyOf(content.towers[e.tower]);
    if (f) out[f] = (out[f] ?? 0) + 1;
  }
  return out;
}
