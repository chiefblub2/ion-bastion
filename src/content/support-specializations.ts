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
  beacon: {
    costs: [230, 300, 450],
    paths: [
      {
        slug: "big-game", name: "Big Game", role: "Boss bounty",
        tiers: fixed([[10, 20], [15, 30], [20, 40]] as const, ([amount, cap]) => ({
          specialization: { kind: "big-game", amount, cap },
          description: `Heavy enemies (1,000+ max HP) and bosses killed in its radius pay +${amount} credits, up to ${cap} per wave.`,
        })),
      },
      {
        slug: "lure", name: "Lure", role: "Kill zone",
        tiers: fixed([0.1, 0.15, 0.2] as const, (slow) => ({
          specialization: { kind: "lure", slow },
          description: `Enemies in its radius are slowed by ${pct(slow)}, so they stay longer in the kill zone.`,
        })),
      },
      {
        slug: "field-rations", name: "Field Rations", role: "Repair",
        tiers: fixed([25, 20, 15] as const, (every) => ({
          specialization: { kind: "field-rations", every },
          description: `Every ${every} kills in its radius restore 1 reactor energy, up to 1 per wave (never above the start value; not in the Circuit).`,
        })),
      },
    ],
  },
  refinery: {
    costs: [240, 320, 480],
    paths: [
      {
        slug: "advance", name: "Advance", role: "Early credits",
        tiers: fixed([15, 30, 60] as const, (amount) => ({
          specialization: { kind: "advance", amount },
          description: amount >= 60
            ? "Pays all 60 credits of its income when a wave starts instead of after it."
            : `Pays ${amount} of its 60 credits when a wave starts, the rest after the wave as before.`,
        })),
      },
      {
        slug: "compounding", name: "Compounding", role: "Long game",
        tiers: fixed([12, 18, 24] as const, (cap) => ({
          specialization: { kind: "compounding", amount: 3, cap },
          description: `Pays +3 credits more for every wave completed since this path was taken, up to +${cap} per wave.`,
        })),
      },
      {
        slug: "fuel-line", name: "Fuel Line", role: "Fire rate",
        tiers: fixed([0.05, 0.08, 0.1] as const, (bonus) => ({
          specialization: { kind: "fuel-line", bonus, radius: 2 },
          description: `Attack towers within 2 cells fire ${pct(bonus)} faster.`,
        })),
      },
    ],
  },
  vault: {
    costs: [300, 400, 600],
    paths: [
      {
        slug: "clean-sheet", name: "Clean Sheet", role: "Perfect waves",
        tiers: fixed([10, 15, 20] as const, (amount) => ({
          specialization: { kind: "clean-sheet", amount },
          description: `A wave without reactor damage pays its owner +${amount} credits.`,
        })),
      },
      {
        slug: "investment", name: "Investment Account", role: "Spend freely",
        tiers: fixed([0.5, 0.75, 1] as const, (share) => ({
          specialization: { kind: "investment", share },
          description: `${pct(share)} of the credits its owner spends on builds and upgrades during a wave count as unspent for the interest (the cap still applies).`,
        })),
      },
      {
        slug: "reserve-cells", name: "Reserve Cells", role: "Repair",
        tiers: fixed([40, 30, 20] as const, (every) => ({
          specialization: { kind: "reserve-cells", every },
          description: `Every ${every} interest credits it pays restore 1 reactor energy, up to 1 per wave (never above the start value; not in the Circuit).`,
        })),
      },
    ],
  },
  workshop: {
    costs: [270, 360, 540],
    paths: [
      {
        slug: "prefab", name: "Prefab", role: "Build discount",
        tiers: fixed([0.1, 0.15, 0.2] as const, (share) => ({
          specialization: { kind: "prefab", share },
          description: `New towers built in its radius cost ${pct(share)} less (never another Workshop).`,
        })),
      },
      {
        slug: "refit", name: "Refit", role: "Resale",
        tiers: fixed([0.8, 0.85, 0.9] as const, (share) => ({
          specialization: { kind: "refit", share },
          description: `Towers in its radius sell for ${pct(share)} of what was spent on them instead of 70%.`,
        })),
      },
      {
        slug: "calibration", name: "Calibration", role: "Damage",
        tiers: fixed([0.04, 0.06, 0.08] as const, (bonus) => ({
          specialization: { kind: "calibration", bonus },
          description: `Towers in its radius at their max level deal ${pct(bonus)} more damage.`,
        })),
      },
    ],
  },
  dock: {
    costs: [390, 520, 780],
    paths: [
      {
        slug: "triage", name: "Triage", role: "Leak refund",
        tiers: fixed([1, 2, 3] as const, (amount) => ({
          specialization: { kind: "triage", amount },
          description: `The first reactor damage of every wave is refunded right away, up to ${amount} energy.`,
        })),
      },
      {
        slug: "salvage", name: "Salvage", role: "Credits",
        tiers: fixed([6, 8, 10] as const, (amount) => ({
          specialization: { kind: "salvage", amount },
          description: `Each repair point it cannot use at full energy pays ${amount} credits, up to ${amount * 3} per wave.`,
        })),
      },
      {
        slug: "damage-control", name: "Damage Control", role: "Last stand",
        tiers: fixed([0.1, 0.15, 0.2] as const, (bonus) => ({
          specialization: { kind: "damage-control", bonus, radius: 3 },
          description: `While the reactor is below 50%, attack towers within 3 cells fire ${pct(bonus)} faster.`,
        })),
      },
    ],
  },
  shieldgen: {
    costs: [360, 480, 720],
    paths: [
      {
        slug: "recharge", name: "Recharge", role: "Sustain",
        tiers: fixed([2, 3, 4] as const, (amount) => ({
          specialization: { kind: "recharge", amount, every: 20 },
          description: `Refills ${amount} absorb points every 20 s of a wave, never above its 8.`,
        })),
      },
      {
        slug: "shockwave", name: "Shockwave", role: "Stun",
        tiers: fixed([0.4, 0.6, 0.8] as const, (duration) => ({
          specialization: { kind: "shockwave", duration, radius: 1.5 },
          description: `Each absorbed hit stuns ground enemies within 1.5 cells of the reactor for ${duration} s.`,
        })),
      },
      {
        slug: "overflow", name: "Overflow", role: "Credits",
        tiers: fixed([3, 4, 5] as const, (amount) => ({
          specialization: { kind: "overflow", amount },
          description: `Each absorb point left unused at the end of a wave pays ${amount} credits, up to ${amount * 8}.`,
        })),
      },
    ],
  },
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
