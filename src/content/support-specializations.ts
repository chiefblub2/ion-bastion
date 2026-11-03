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
  tracker: {
    costs: [300, 400, 600],
    paths: [
      {
        slug: "weak-point", name: "Weak Point", role: "Armor",
        tiers: fixed([0.2, 0.3, 0.4] as const, (fraction) => ({
          specialization: { kind: "weak-point", fraction },
          description: `Enemies in its radius also lose ${pct(fraction)} of their armor reduction.`,
        })),
      },
      {
        slug: "hunters-mark", name: "Hunter's Mark", role: "Boss",
        tiers: fixed([0.1, 0.15, 0.2] as const, (bonus) => ({
          specialization: { kind: "hunters-mark", bonus },
          description: `The strongest enemy in its radius (highest max HP) takes another +${pct(bonus)} damage.`,
        })),
      },
      {
        slug: "lingering-tag", name: "Lingering Tag", role: "Kill zone",
        tiers: fixed([1, 1.5, 2] as const, (duration) => ({
          specialization: { kind: "lingering-tag", duration },
          description: `The mark stays on for ${duration} s after an enemy leaves its radius.`,
        })),
      },
    ],
  },
  detector: {
    costs: [180, 240, 360],
    paths: [
      {
        slug: "exposure-scan", name: "Exposure Scan", role: "Stealth hunt",
        tiers: fixed([0.1, 0.15, 0.2] as const, (bonus) => ({
          specialization: { kind: "exposure-scan", bonus },
          description: `Stealth enemies it reveals take +${pct(bonus)} damage from every source.`,
        })),
      },
      {
        slug: "static-pulse", name: "Static Pulse", role: "Disruption",
        tiers: fixed([6, 5, 4] as const, (every) => ({
          specialization: { kind: "static-pulse", every, duration: 1.5 },
          description: `Every ${every} s it disrupts the strongest enemy in its radius for 1.5 s, switching off its special abilities.`,
        })),
      },
      {
        slug: "afterimage", name: "Afterimage", role: "Tracking",
        tiers: fixed([1, 2, 3] as const, (duration) => ({
          specialization: { kind: "afterimage", duration },
          description: `Stealth enemies it reveals stay revealed for ${duration} s after leaving its radius.`,
        })),
      },
    ],
  },
  recycler: {
    costs: [300, 400, 600],
    paths: [
      {
        slug: "cascade", name: "Cascade", role: "Crowds",
        tiers: fixed([0.3, 0.4, 0.5] as const, (factor) => ({
          specialization: { kind: "cascade", factor },
          description: `When a jump kills, ${pct(factor)} of its own overkill jumps once more.`,
        })),
      },
      {
        slug: "meltdown", name: "Meltdown", role: "Burn",
        tiers: fixed([0.3, 0.45, 0.6] as const, (factor) => ({
          specialization: { kind: "meltdown", factor, duration: 3 },
          description: `The jump's target also burns for ${pct(factor)} of the jump over 3 s.`,
        })),
      },
      {
        slug: "scrap-yard", name: "Scrap Yard", role: "Economy",
        tiers: fixed([[60, 8], [50, 10], [40, 12]] as const, ([every, cap]) => ({
          specialization: { kind: "scrap-yard", every, cap },
          description: `Every ${every} overkill damage in its radius pays 1 credit, up to ${cap} per wave.`,
        })),
      },
    ],
  },
  armory: {
    costs: [270, 360, 540],
    paths: [
      {
        slug: "shred", name: "Shred", role: "Armor",
        tiers: fixed([0.1, 0.15, 0.2] as const, (fraction) => ({
          specialization: { kind: "shred", fraction, duration: 2 },
          description: `Hits of towers in its radius strip ${pct(fraction)} of an armored target's armor for 2 s, for every tower.`,
        })),
      },
      {
        slug: "hollow-points", name: "Hollow Points", role: "Raw damage",
        tiers: fixed([0.06, 0.09, 0.12] as const, (bonus) => ({
          specialization: { kind: "hollow-points", bonus },
          description: `Hits of towers in its radius deal +${pct(bonus)} damage to unarmored targets.`,
        })),
      },
      {
        slug: "shieldbreaker", name: "Shieldbreaker", role: "Shields",
        tiers: fixed([0.2, 0.35, 0.5] as const, (bonus) => ({
          specialization: { kind: "shieldbreaker", bonus },
          description: `Hits of towers in its radius deal +${pct(bonus)} damage to shields.`,
        })),
      },
    ],
  },

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
