import type { TowerDefinition } from "../core/types";
import { pathUpgrades, pathVisuals, type Branch, type PathData } from "./specializations";

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
