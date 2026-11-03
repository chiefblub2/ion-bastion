import type { TowerDefinition } from "../core/types";
import { fixed, pathUpgrades, pathVisuals, pct, type Branch, type PathData } from "./specializations";

/**
 * Specializations of support towers: three paths × three tiers that branch off their last plain level (level 3, so
 * levels 4 to 6; Aura after any track's tier III, levels 5 to 7). Every path adds one new effect next to the
 * tower's own effect and grows that new effect; it never raises the level-3 values and never takes anything away.
 */
export interface SupportPaths {
  /** Price of tier 1, 2, 3. */
  costs: readonly [number, number, number];
  paths: readonly [PathData, PathData, PathData];
  /** What tier I needs; by default the tower's last plain level. Aura: `{ minLevel: 4 }`. */
  after?: Branch["after"];
}

/** Path data per support tower id, in the order A, B, C. */
export const SUPPORT_SPECIALIZATIONS: Readonly<Record<string, SupportPaths>> = {
  // ── support economy ──
  // ── end support economy ──
  // ── support combat ──
  // ── end support combat ──
  // ── aura paths ──
  // Track tier III costs 280–320, so the paths cost about 1.5× / 2× / 3× of 300.
  aura: {
    costs: [450, 600, 900],
    after: { minLevel: 4 },
    paths: [
      {
        slug: "piercing-field",
        name: "Piercing Field",
        role: "ARMOR BREAK",
        tiers: fixed([0.1, 0.15, 0.2] as const, (fraction) => ({
          specialization: { kind: "piercing-field", fraction },
          description: `Hits of supported towers ignore ${pct(fraction)} of armor; with an Armory in reach the higher pierce counts.`,
        })),
      },
      {
        slug: "execution-field",
        name: "Execution Field",
        role: "FINISHER",
        tiers: fixed([0.1, 0.15, 0.2] as const, (bonus) => ({
          specialization: { kind: "execution-field", bonus, threshold: 0.3 },
          description: `Supported towers deal +${pct(bonus)} damage to enemies below 30% HP.`,
        })),
      },
      {
        slug: "harmonics",
        name: "Harmonics",
        role: "ALL-ROUND",
        tiers: fixed([0.05, 0.08, 0.1] as const, (bonus) => ({
          specialization: { kind: "harmonics", bonus },
          description: `Supported towers also get +${pct(bonus)} of the two stats of the tracks not taken (damage, attack speed or range), never more than the track's own bonus.`,
        })),
      },
    ],
  },
  // ── end aura paths ──
};

/** Appends the tower's support paths (if it has any) and their looks. */
export function supportTower<T extends TowerDefinition>(definition: T): T {
  const data = SUPPORT_SPECIALIZATIONS[definition.id];
  if (!data) return definition;
  const from = Math.max(1, ...definition.upgrades.map((u) => u.effects.level ?? 1));
  const upgrades = pathUpgrades(data.paths, definition, { from, after: data.after ?? `level-${from}`, costs: data.costs });
  return { ...definition, visual: { ...definition.visual, paths: pathVisuals(data.paths) }, upgrades: [...definition.upgrades, ...upgrades] };
}
