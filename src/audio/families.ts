import type { AttackSpec, TowerDefinition } from "../core/types";
// Tower families: each has its own quiet shot transient (`shots.ts`). Towers play no part in the music.

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
