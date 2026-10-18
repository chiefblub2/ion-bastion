import type { AttackSpec, TowerDefinition } from "../core/types";
// Tower families: each has its own quiet shot transient (`shots.ts`). Towers play no part in the music.

export const FAMILIES = ["rapid", "heavy", "electric", "control", "fire", "traps"] as const;
export type Family = (typeof FAMILIES)[number];
/** Support kinds never fire, so they play no part. */
const BY_KIND: Record<AttackSpec["kind"], Family | null> = {
  direct: "rapid", volley: "rapid", pierce: "rapid",
  splash: "heavy", mortar: "heavy", airburst: "heavy", pool: "heavy", quake: "heavy", execute: "heavy",
  chain: "electric", stun: "electric", disrupt: "electric", focus: "electric",
  slow: "control", net: "control", pull: "control",
  burn: "fire", corrode: "fire", decay: "fire", catalyze: "fire",
  bleed: "traps", charge: "traps", pit: "traps", alarm: "traps",
  // ── new towers: g1 (Attack+Control A) ──
  strike: "heavy", confuse: "control", encase: "control", gather: "control",
  // ── end g1 ──
  // ── new towers: g2 (Control B) ──
  tether: "electric", shrink: "electric", echo: "electric", siphon: "control",
  // ── end g2 ──
  // ── new towers: g3 (Traps) ──
  block: "traps", warp: "traps", oil: "traps", grind: "traps", harpoon: "traps",
  // ── end g3 ──
  // ── new towers: g4 (Support A) ──
  overclock: null, crit: null, pierceaura: null, skylink: null, synergy: null,
  // ── end g4 ──
  // ── new towers: g5 (Support B) ──
  discount: null, interest: null, barrier: null, overkill: null,
  // ── end g5 ──
  aura: null, income: null, detect: null, bounty: null, repair: null, mark: null,
};
export const familyOf = (d: TowerDefinition): Family | null => (d.placement === "path" ? "traps" : BY_KIND[d.attack.kind]);
