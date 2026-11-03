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

  overclock: {
    costs: [330, 440, 660],
    paths: [
      {
        slug: "afterburn", name: "Afterburn", role: "Sustain",
        tiers: fixed([1, 1.5, 2] as const, (duration) => ({
          specialization: { kind: "afterburn", boost: 0.4, duration },
          description: `After each burst, a 40% faster fire rate fades out over ${duration} s.`,
        })),
      },
      {
        slug: "opening-salvo", name: "Opening Salvo", role: "Wave start",
        tiers: fixed([2, 3, 4] as const, (duration) => ({
          specialization: { kind: "opening-salvo", duration },
          description: `Once per wave, the first enemy entering its radius opens an extra ${duration} s burst.`,
        })),
      },
      {
        slug: "charged-rounds", name: "Charged Rounds", role: "Burst damage",
        tiers: fixed([0.08, 0.12, 0.16] as const, (bonus) => ({
          specialization: { kind: "charged-rounds", bonus },
          description: `Shots fired during the burst deal +${pct(bonus)} damage.`,
        })),
      },
    ],
  },
  firectl: {
    costs: [300, 400, 600],
    paths: [
      {
        slug: "penetrator", name: "Penetrator", role: "Armor",
        tiers: fixed([0.3, 0.5, 0.7] as const, (fraction) => ({
          specialization: { kind: "penetrator", fraction },
          description: `Crits ignore ${pct(fraction)} of the target's armor reduction.`,
        })),
      },
      {
        slug: "stagger", name: "Stagger", role: "Slow",
        tiers: fixed([0.2, 0.25, 0.3] as const, (slow) => ({
          specialization: { kind: "stagger", slow, duration: 1 },
          description: `Crits slow the target by ${pct(slow)} for 1 s.`,
        })),
      },
      {
        slug: "spotting", name: "Spotting", role: "Focus fire",
        tiers: fixed([0.1, 0.15, 0.2] as const, (bonus) => ({
          specialization: { kind: "spotting", bonus },
          description: `A crit marks its target: the next hit on it by another tower deals +${pct(bonus)} damage.`,
        })),
      },
    ],
  },
  skylink: {
    costs: [350, 460, 690],
    paths: [
      {
        slug: "downlink", name: "Downlink", role: "Air slow",
        tiers: fixed([0.1, 0.15, 0.2] as const, (slow) => ({
          specialization: { kind: "downlink", slow },
          description: `Flyers it holds are ${pct(slow)} slower.`,
        })),
      },
      {
        slug: "flak-relay", name: "Flak Relay", role: "Anti-air",
        tiers: fixed([0.05, 0.08, 0.1] as const, (bonus) => ({
          specialization: { kind: "flak-relay", bonus },
          description: `Anti-air towers in its radius deal +${pct(bonus)} damage to flyers.`,
        })),
      },
      {
        slug: "wing-tag", name: "Wing Tag", role: "Air mark",
        tiers: fixed([0.05, 0.08, 0.1] as const, (bonus) => ({
          specialization: { kind: "wing-tag", bonus },
          description: `Flyers it holds take +${pct(bonus)} damage from every source.`,
        })),
      },
    ],
  },
  nexus: {
    costs: [320, 420, 630],
    paths: [
      {
        slug: "resonance", name: "Resonance", role: "Range",
        tiers: fixed([0.01, 0.015, 0.02] as const, (bonus) => ({
          specialization: { kind: "nexus-resonance", bonus },
          description: `Attack towers in its radius also get +${pct(bonus)} range per tower type around it.`,
        })),
      },
      {
        slug: "harmony", name: "Harmony", role: "Fire rate",
        tiers: fixed([0.01, 0.015, 0.02] as const, (bonus) => ({
          specialization: { kind: "harmony", bonus },
          description: `Attack towers in its radius also fire ${pct(bonus)} faster per tower type around it.`,
        })),
      },
      {
        slug: "diversity", name: "Diversity", role: "Mixed block",
        tiers: fixed([0.05, 0.08, 0.1] as const, (bonus) => ({
          specialization: { kind: "diversity", bonus, min: 5 },
          description: `With 5+ tower types in its radius, enemies in its radius take +${pct(bonus)} damage.`,
        })),
      },
    ],
  },
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
