import type { DamagePredicate } from "../core/specialization-types";
import type { PathVisual, SpecializationSpec, TowerStats, UpgradeDefinition } from "../core/types";

/**
 * Specializations: after level 5 every attack tower built with `attackTower` and every trap built with `trapTower`
 * picks one of three paths (A, B, C) with three tiers each (levels 6 to 8). Tier values are final values of that
 * tier, never stacked on the previous tier. Support towers branch after level 3 (`support-specializations.ts`).
 */
export interface Tier {
  description: string;
  stats?: Partial<TowerStats>;
  attack?: Readonly<Record<string, number>>;
  specialization?: SpecializationSpec;
}
export interface PathData {
  slug: string;
  name: string;
  /** Tactical role shown on the path card. */
  role: string;
  /** The three tiers, derived from the tower's own level-5 stats. */
  tiers: (l5: TowerStats) => readonly [Tier, Tier, Tier];
}

/** Cost per tier as a multiple of the build cost. */
export const SPECIALIZATION_COSTS = [2.5, 4, 6] as const;
/** Default look per path slot A, B, C. */
const PATH_LOOKS: readonly Omit<PathVisual, "name" | "role">[] = [
  { color: 0xff765c, motif: "blades" },
  { color: 0x66b6ff, motif: "vortex" },
  { color: 0x79e3a1, motif: "rings" },
];
const NUMERALS = ["I", "II", "III"] as const;

export const pct = (value: number) => `${Math.round(value * 1000) / 10}%`;
export const num = (value: number) => `${Math.round(value * 100) / 100}`;
const ordinal = (n: number) => (n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`);
/** Three tiers from three value sets. */
export const tiers = <T,>(values: readonly [T, T, T], tier: (value: T) => Tier) =>
  values.map(tier) as unknown as readonly [Tier, Tier, Tier];
export const fixed = <T,>(values: readonly [T, T, T], tier: (value: T) => Tier) => () => tiers(values, tier);

/** Shorter time between attacks, computed from the level-5 interval. */
const faster = (cuts: readonly [number, number, number]) => (l5: TowerStats) =>
  tiers(cuts, (cut) => ({
    stats: { interval: l5.interval * (1 - cut) },
    description: `${pct(cut)} less time between attacks: ${num(l5.interval * (1 - cut))} s.`,
  }));
const conditional = (predicate: DamagePredicate, bonuses: readonly [number, number, number], against: string) =>
  fixed(bonuses, (bonus) => ({ specialization: { kind: "conditional-damage", predicate, bonus }, description: `+${pct(bonus)} damage ${against}.` }));
const vulnerability = (kind: "brittle-ice" | "weak-signal" | "exposed-target", bonuses: readonly [number, number, number], while_: string) =>
  fixed(bonuses, (bonus) => ({ specialization: { kind, bonus }, description: `${while_} take +${pct(bonus)} damage from every source.` }));
const pierce = fixed([0.2, 0.4, 0.6] as const, (fraction) => ({
  specialization: { kind: "armor-pierce", fraction },
  description: `Ignores ${pct(fraction)} of the target's armor reduction.`,
}));

/** Path data per tower id, in the order A, B, C. */
export const SPECIALIZATIONS: Readonly<Record<string, readonly [PathData, PathData, PathData]>> = {
  pulse: [
    { slug: "sharpshooter", name: "Sharpshooter", role: "Boss", tiers: conditional("heavy", [0.25, 0.45, 0.7], "against heavy targets (1,000+ max HP)") },
    { slug: "overclock", name: "Overclock", role: "Sustained fire", tiers: faster([0.15, 0.25, 0.35]) },
    {
      slug: "ricochet", name: "Ricochet", role: "Target switch",
      tiers: fixed([[4, 0.35, 1.3], [3, 0.5, 1.5], [2, 0.65, 1.7]] as const, ([every, factor, radius]) => ({
        specialization: { kind: "ricochet", every, factor, radius },
        description: `Every ${ordinal(every)} hit bounces to a second enemy within ${radius} cells for ${pct(factor)} damage.`,
      })),
    },
  ],
  blast: [
    { slug: "supernova", name: "Supernova", role: "Crowds", tiers: fixed([1.5, 1.75, 2] as const, (radius) => ({ attack: { radius }, description: `Blast radius ${radius} cells.` })) },
    { slug: "siegebreaker", name: "Siegebreaker", role: "Armor", tiers: conditional("armored", [0.2, 0.4, 0.6], "against armored enemies") },
    {
      slug: "chain-reaction", name: "Chain Reaction", role: "Kill chains",
      tiers: fixed([[0.25, 0.75, 1], [0.4, 0.9, 2], [0.55, 1.1, 3]] as const, ([factor, radius, maxPerSalvo]) => ({
        specialization: { kind: "chain-reaction", factor, radius, maxPerSalvo },
        description: `Kills by the blast explode again: ${pct(factor)} damage within ${radius} cells, up to ${maxPerSalvo} per shot.`,
      })),
    },
  ],
  flak: [
    { slug: "skyhunter", name: "Skyhunter", role: "Heavy flyers", tiers: conditional("heavy-air", [0.25, 0.45, 0.7], "against flyers with 1,000+ max HP") },
    {
      slug: "flak-curtain", name: "Flak Curtain", role: "Swarms",
      tiers: fixed([1, 2, 3] as const, (count) => ({
        specialization: { kind: "extra-air-targets", count, factor: 0.45 },
        description: `Each salvo also fires at ${count} more flyer${count > 1 ? "s" : ""} in range for 45% damage.`,
      })),
    },
    {
      slug: "wingclip", name: "Wingclip", role: "Intercept",
      tiers: fixed([[0.15, 1.5], [0.22, 2], [0.3, 2.5]] as const, ([slow, duration]) => ({
        specialization: { kind: "wingclip", slow, duration },
        description: `Hit flyers are ${pct(slow)} slower for ${duration} s.`,
      })),
    },
  ],
  skyburst: [
    {
      slug: "cluster-warhead", name: "Cluster Warhead", role: "Swarm cascade",
      tiers: fixed([[0.3, 0.8, 2], [0.45, 0.95, 3], [0.6, 1.1, 4]] as const, ([factor, radius, maxPerSalvo]) => ({
        specialization: { kind: "chain-reaction", factor, radius, maxPerSalvo },
        description: `Flyers killed by the burst explode again: ${pct(factor)} damage within ${radius} cells, up to ${maxPerSalvo} per shot.`,
      })),
    },
    {
      slug: "shear-front", name: "Shear Front", role: "Air control",
      tiers: fixed([[0.15, 1.5], [0.22, 2], [0.3, 2.5]] as const, ([slow, duration]) => ({
        specialization: { kind: "wingclip", slow, duration },
        description: `Every flyer in the burst is ${pct(slow)} slower for ${duration} s.`,
      })),
    },
    {
      slug: "downdraft", name: "Downdraft", role: "Ground combo",
      tiers: fixed([[0.85, 1], [0.8, 1.4], [0.75, 1.8]] as const, ([factor, duration]) => ({
        specialization: { kind: "downdraft", factor, duration },
        description: `Flyers in the burst are forced down for ${duration} s: ${pct(1 - factor)} slower and open to ground-only towers.`,
      })),
    },
  ],
  catalyst: [
    {
      slug: "volatile-mix", name: "Volatile Mix", role: "Group reaction",
      tiers: fixed([[0.35, 0.8], [0.5, 1], [0.65, 1.2]] as const, ([factor, radius]) => ({
        specialization: { kind: "reaction-splash", min: 2, factor, radius },
        description: `Hits on an enemy under 2+ effects splash ${pct(factor)} of the hit on every other enemy within ${radius} cells.`,
      })),
    },
    {
      slug: "stabilizer", name: "Stabilizer", role: "Effect support",
      tiers: fixed([[0.3, 3], [0.45, 4], [0.6, 5]] as const, ([extend, max]) => ({
        specialization: { kind: "prolong", extend, max },
        description: `Each hit makes slow, burn, weakening, disruption, nets, bleeding and armor dissolve last ${extend} s longer (up to ${max} s). Never stuns or pulls.`,
      })),
    },
    {
      slug: "catalytic-core", name: "Catalytic Core", role: "Raw reaction",
      tiers: fixed([[0.9, 5], [1.05, 6], [1.2, 6]] as const, ([bonus, cap]) => ({
        attack: { bonus, cap },
        description: `+${pct(bonus)} damage per effect on the target, counting up to ${cap} effects.`,
      })),
    },
  ],
  plasma: [
    {
      slug: "searing-ground", name: "Searing Ground", role: "Armor",
      tiers: fixed([[0.3, 1], [0.45, 1.2], [0.6, 1.5]] as const, ([fraction, duration]) => ({
        specialization: { kind: "pool-dissolve", fraction, duration },
        description: `Enemies in the pool lose ${pct(fraction)} of their armor reduction against every tower, for ${duration} s after leaving it.`,
      })),
    },
    {
      slug: "quagmire", name: "Quagmire", role: "Hold in the fire",
      tiers: fixed([0.8, 0.7, 0.6] as const, (factor) => ({
        specialization: { kind: "pool-slow", factor, duration: 0.6 },
        description: `Enemies in the pool move at ${pct(factor)} speed.`,
      })),
    },
    {
      slug: "eruption", name: "Eruption", role: "Burst",
      tiers: fixed([0.5, 0.75, 1] as const, (factor) => ({
        specialization: { kind: "eruption", factor },
        description: `An expiring pool erupts: ${pct(factor)} of its whole burn at once on every ground enemy in it.`,
      })),
    },
  ],
  tesla: [
    {
      slug: "storm-network", name: "Storm Network", role: "Swarm chain",
      tiers: fixed([[6, 2.2], [7, 2.4], [8, 2.6]] as const, ([jumps, range]) => ({
        attack: { jumps, range },
        description: `The chain jumps to ${jumps} more enemies within ${range} cells.`,
      })),
    },
    { slug: "overload", name: "Overload", role: "Isolated targets", tiers: conditional("isolated", [0.3, 0.55, 0.85], "when only one enemy is in range") },
    {
      slug: "twin-arc", name: "Twin Arc", role: "Split groups",
      tiers: fixed([[4, 0.45], [3, 0.55], [2, 0.65]] as const, ([every, factor]) => ({
        specialization: { kind: "twin-arc", every, factor },
        description: `Every ${ordinal(every)} salvo starts a second chain at another enemy for ${pct(factor)} damage.`,
      })),
    },
  ],
  lance: [
    {
      slug: "longshot", name: "Longshot", role: "Distance",
      tiers: (l5) => tiers([0.8, 1.5, 2.3] as const, (extra) => ({ stats: { range: l5.range + extra }, description: `+${extra} cells range: ${num(l5.range + extra)} cells.` })),
    },
    { slug: "broadbeam", name: "Broadbeam", role: "Rows", tiers: fixed([0.65, 0.8, 0.95] as const, (width) => ({ attack: { width }, description: `Beam half-width ${width} cells.` })) },
    { slug: "rail-penetrator", name: "Rail Penetrator", role: "Armor", tiers: pierce },
  ],
  inferno: [
    {
      slug: "incinerator", name: "Incinerator", role: "Burn",
      tiers: fixed([[4.25, 3.5], [5, 3.5], [6, 4]] as const, ([ratio, duration]) => ({
        attack: { ratio, duration },
        description: `The burn deals ${ratio}× the hit over ${duration} s.`,
      })),
    },
    {
      slug: "wildfire", name: "Wildfire", role: "Spread",
      tiers: fixed([[0.4, 1, 1], [0.55, 1.2, 2], [0.7, 1.4, 3]] as const, ([remainingFactor, radius, count]) => ({
        specialization: { kind: "wildfire", remainingFactor, radius, count },
        description: `A burning enemy that dies passes ${pct(remainingFactor)} of its remaining burn to ${count} enem${count > 1 ? "ies" : "y"} within ${radius} cells.`,
      })),
    },
    { slug: "searing-heat", name: "Searing Heat", role: "Synergy", tiers: conditional("burning", [0.15, 0.25, 0.4], "against enemies that already burn") },
  ],
  decay: [
    { slug: "entropy-beam", name: "Entropy Beam", role: "Boss", tiers: fixed([0.065, 0.07, 0.075] as const, (percent) => ({ attack: { percent }, description: `Each hit adds ${pct(percent)} of the target's max HP.` })) },
    {
      slug: "final-decay", name: "Final Decay", role: "Finisher",
      tiers: fixed([[0.35, 0.01], [0.45, 0.015], [0.55, 0.02]] as const, ([threshold, extraPercent]) => ({
        specialization: { kind: "max-hp-execute", threshold, extraPercent },
        description: `Below ${pct(threshold)} HP, hits add another ${pct(extraPercent)} of the target's max HP.`,
      })),
    },
    {
      slug: "contagion", name: "Contagion", role: "Groups",
      tiers: fixed([[1, 1, 0.01, 0.4], [2, 1.2, 0.0125, 0.5], [3, 1.4, 0.015, 0.6]] as const, ([count, radius, maxHpPercent, hitCapFactor]) => ({
        specialization: { kind: "contagion", count, radius, maxHpPercent, hitCapFactor },
        description: `Each hit also strikes ${count} enem${count > 1 ? "ies" : "y"} within ${radius} cells for ${pct(maxHpPercent)} of their max HP, at most ${pct(hitCapFactor)} of the hit.`,
      })),
    },
  ],
  focus: [
    { slug: "deep-focus", name: "Deep Focus", role: "Boss", tiers: fixed([0.35, 0.4, 0.45] as const, (ramp) => ({ attack: { ramp }, description: `+${pct(ramp)} damage per stack, up to 12 stacks.` })) },
    {
      slug: "adaptive-lens", name: "Adaptive Lens", role: "Target switch",
      tiers: fixed([0.25, 0.5, 0.75] as const, (carry) => ({ specialization: { kind: "focus-carry", carry }, description: `Keeps ${pct(carry)} of its stacks when it switches targets.` })),
    },
    {
      slug: "prism-beam", name: "Prism Beam", role: "Lines",
      tiers: fixed([[0.3, 0.3], [0.4, 0.45], [0.5, 0.6]] as const, ([width, factor]) => ({
        specialization: { kind: "prism-beam", width, factor },
        description: `The beam also hits the first enemy behind the target (half-width ${width} cells) for ${pct(factor)} damage.`,
      })),
    },
  ],
  mortar: [
    { slug: "saturation", name: "Saturation", role: "Wide fields", tiers: fixed([1.9, 2.1, 2.3] as const, (radius) => ({ attack: { radius }, description: `Blast radius ${radius} cells.` })) },
    { slug: "bunker-buster", name: "Bunker Buster", role: "Armor", tiers: conditional("armored", [0.25, 0.5, 0.75], "against armored ground enemies") },
    {
      slug: "mobile-artillery", name: "Mobile Artillery", role: "Dead zone",
      tiers: (l5) => tiers([[0.9, 0.1], [0.6, 0.2], [0, 0.3]] as const, ([minRange, cut]) => ({
        attack: { minRange },
        stats: { interval: l5.interval * (1 - cut) },
        description: `Dead zone ${minRange} cells and ${pct(cut)} less time between shots: ${num(l5.interval * (1 - cut))} s.`,
      })),
    },
  ],
  quake: [
    {
      slug: "fracture", name: "Fracture", role: "Synergy",
      tiers: fixed([[0.1, 2], [0.15, 2.5], [0.2, 3]] as const, ([bonus, duration]) => ({
        specialization: { kind: "fracture", bonus, duration },
        description: `Enemies hit by the wave take +${pct(bonus)} damage for ${duration} s.`,
      })),
    },
    { slug: "resonance", name: "Resonance", role: "Close DPS", tiers: faster([0.15, 0.25, 0.35]) },
    {
      slug: "aftershock", name: "Aftershock", role: "Double wave",
      tiers: fixed([0.25, 0.4, 0.55] as const, (factor) => ({
        specialization: { kind: "aftershock", delay: 0.35, factor },
        description: `A second wave 0.35 s later deals ${pct(factor)} of the damage.`,
      })),
    },
  ],
  executioner: [
    { slug: "hunters-mark", name: "Hunter's Mark", role: "Early execution", tiers: fixed([0.4, 0.45, 0.5] as const, (threshold) => ({ attack: { threshold }, description: `The 5× execution applies below ${pct(threshold)} HP.` })) },
    { slug: "guillotine", name: "Guillotine", role: "Finisher", tiers: fixed([6, 7, 8] as const, (multiplier) => ({ attack: { multiplier }, description: `Executions deal ${multiplier}× damage below 35% HP.` })) },
    {
      slug: "blood-transfer", name: "Blood Transfer", role: "Swarm cleanup",
      tiers: fixed([[0.25, 1.5], [0.4, 1.75], [0.6, 2]] as const, ([factor, radius]) => ({
        specialization: { kind: "overkill-transfer", factor, radius },
        description: `A killing hit passes ${pct(factor)} of its overkill to the nearest enemy within ${radius} cells.`,
      })),
    },
  ],
  shrapnel: [
    { slug: "scatterstorm", name: "Scatterstorm", role: "Swarms", tiers: fixed([6, 7, 8] as const, (targets) => ({ attack: { targets }, description: `Fires at ${targets} different targets per salvo.` })) },
    { slug: "tungsten-shards", name: "Tungsten Shards", role: "Armor", tiers: pierce },
    {
      slug: "concentrated-volley", name: "Concentrated Volley", role: "Few targets",
      tiers: fixed([0.2, 0.35, 0.5] as const, (bonusPerUnused) => ({
        specialization: { kind: "unused-volley", bonusPerUnused },
        description: `The main target takes +${pct(bonusPerUnused)} damage per unused shard of the five.`,
      })),
    },
  ],
  frost: [
    { slug: "permafrost", name: "Permafrost", role: "Strong slow", tiers: fixed([0.3, 0.25, 0.2] as const, (factor) => ({ attack: { factor }, description: `Slowed enemies move at ${pct(factor)} speed for 2.8 s.` })) },
    { slug: "brittle-ice", name: "Brittle Ice", role: "Weaken", tiers: vulnerability("brittle-ice", [0.08, 0.12, 0.16], "Enemies slowed by this Cryo") },
    {
      slug: "frostburst", name: "Frostburst", role: "Groups",
      tiers: fixed([[0.7, 0.5, 1.5], [1, 0.45, 1.8], [1.3, 0.4, 2]] as const, ([radius, factor, duration]) => ({
        specialization: { kind: "frostburst", radius, factor, duration },
        description: `Hits also slow enemies within ${radius} cells to ${pct(factor)} speed for ${duration} s.`,
      })),
    },
  ],
  stasis: [
    { slug: "deep-stasis", name: "Deep Stasis", role: "Single control", tiers: fixed([1.4, 1.6, 1.8] as const, (duration) => ({ attack: { duration }, description: `Stuns for ${duration} s; recovery stays 1.5 s.` })) },
    { slug: "time-field", name: "Time Field", role: "Wide field", tiers: fixed([1.5, 1.7, 1.9] as const, (radius) => ({ attack: { radius }, description: `Pulse radius ${radius} cells.` })) },
    {
      slug: "temporal-exposure", name: "Temporal Exposure", role: "Damage window",
      tiers: fixed([[0.1, 1.5], [0.15, 2], [0.2, 2.5]] as const, ([bonus, duration]) => ({
        specialization: { kind: "temporal-exposure", bonus, duration },
        description: `After a stun ends, the enemy takes +${pct(bonus)} damage for ${duration} s.`,
      })),
    },
  ],
  acid: [
    { slug: "superacid", name: "Superacid", role: "Vulnerability", tiers: fixed([0.45, 0.5, 0.55] as const, (amount) => ({ attack: { amount }, description: `Corroded enemies take +${pct(amount)} damage for 3 s.` })) },
    { slug: "acid-fog", name: "Acid Fog", role: "Wide area", tiers: fixed([1.2, 1.4, 1.6] as const, (radius) => ({ attack: { radius }, description: `Acid radius ${radius} cells.` })) },
    {
      slug: "armor-dissolver", name: "Armor Dissolver", role: "Armor",
      tiers: fixed([0.1, 0.2, 0.3] as const, (fraction) => ({
        specialization: { kind: "armor-dissolver", fraction },
        description: `Corroded enemies also lose ${pct(fraction)} of their armor reduction against every tower.`,
      })),
    },
  ],
  gravity: [
    { slug: "reverse-drive", name: "Reverse Drive", role: "Push back", tiers: fixed([2.6, 3, 3.4] as const, (strength) => ({ attack: { strength }, description: `Pulls enemies back at ${strength}× their speed.` })) },
    { slug: "gravity-well", name: "Gravity Well", role: "Bigger group", tiers: fixed([1.6, 1.8, 2] as const, (radius) => ({ attack: { radius }, description: `Pulse radius ${radius} cells.` })) },
    {
      slug: "compression", name: "Compression", role: "Damage window",
      tiers: fixed([[0.1, 2], [0.15, 2.5], [0.2, 3]] as const, ([bonus, duration]) => ({
        specialization: { kind: "compression", bonus, duration },
        description: `Pulled enemies take +${pct(bonus)} damage for ${duration} s.`,
      })),
    },
  ],
  jammer: [
    { slug: "wideband", name: "Wideband", role: "Many enemies", tiers: fixed([1.7, 1.9, 2.1] as const, (radius) => ({ attack: { radius }, description: `Pulse radius ${radius} cells.` })) },
    { slug: "blackout", name: "Blackout", role: "Long shutdown", tiers: fixed([5.2, 6, 7] as const, (duration) => ({ attack: { duration }, description: `Disrupts for ${duration} s.` })) },
    { slug: "weak-signal", name: "Weak Signal", role: "Team damage", tiers: vulnerability("weak-signal", [0.08, 0.12, 0.16], "Disrupted enemies") },
  ],
  net: [
    { slug: "anchor-net", name: "Anchor Net", role: "Very slow", tiers: fixed([0.5, 0.4, 0.3] as const, (factor) => ({ attack: { factor }, description: `Netted flyers move at ${pct(factor)} speed for 4.5 s.` })) },
    {
      slug: "net-cloud", name: "Net Cloud", role: "Several flyers",
      tiers: fixed([[1, 0.7], [2, 0.9], [3, 1.1]] as const, ([count, radius]) => ({
        specialization: { kind: "net-cloud", count, radius },
        description: `The net also catches ${count} other flyer${count > 1 ? "s" : ""} within ${radius} cells.`,
      })),
    },
    { slug: "exposed-target", name: "Exposed Target", role: "Anti-air synergy", tiers: vulnerability("exposed-target", [0.1, 0.15, 0.2], "Netted flyers") },
  ],
  // ── new towers: g1 (Attack+Control A) ──
  orbital: [
    { slug: "kill-sat", name: "Kill Sat", role: "Boss", tiers: conditional("heavy", [0.3, 0.55, 0.8], "against heavy targets (1,000+ max HP)") },
    {
      slug: "cluster-payload", name: "Cluster Payload", role: "Swarm",
      tiers: fixed([[2, 1.8, 0.35], [3, 2.1, 0.45], [4, 2.4, 0.55]] as const, ([count, radius, factor]) => ({
        specialization: { kind: "cluster", count, radius, factor },
        description: `Each strike also drops ${count} bomblets on the nearest enemies within ${radius} cells outside its blast, each dealing ${pct(factor)} of the damage around its target.`,
      })),
    },
    {
      slug: "rapid-lock", name: "Rapid Lock", role: "Fast targets",
      tiers: (l5) =>
        tiers([[0.8, 0.1], [0.5, 0.2], [0.25, 0.3]] as const, ([delay, cut]) => ({
          attack: { delay },
          stats: { interval: l5.interval * (1 - cut) },
          description: `The strike lands ${delay} s after the beacon, and ${pct(cut)} less time between strikes: ${num(l5.interval * (1 - cut))} s.`,
        })),
    },
  ],
  mesmer: [
    {
      slug: "mass-hypnosis", name: "Mass Hypnosis", role: "Crowd",
      tiers: fixed([[1, 1.2], [2, 1.4], [3, 1.6]] as const, ([count, radius]) => ({
        specialization: { kind: "mass-trance", count, radius },
        description: `The trance also takes ${count} other enem${count > 1 ? "ies" : "y"} within ${radius} cells of the target.`,
      })),
    },
    { slug: "deep-trance", name: "Deep Trance", role: "Long trance", tiers: fixed([2.3, 2.7, 3.1] as const, (duration) => ({ attack: { duration }, description: `Hypnotised enemies walk backwards for ${duration} s.` })) },
    {
      slug: "mind-break", name: "Mind Break", role: "Damage window",
      tiers: fixed([0.15, 0.22, 0.3] as const, (bonus) => ({
        specialization: { kind: "mind-break", bonus },
        description: `Hypnotised enemies take +${pct(bonus)} damage from every source while the trance lasts.`,
      })),
    },
  ],
  amber: [
    { slug: "fossilize", name: "Fossilize", role: "Long hold", tiers: fixed([2.4, 2.8, 3.2] as const, (duration) => ({ attack: { duration }, description: `Enemies stay encased for ${duration} s.` })) },
    { slug: "fault-line", name: "Fault Line", role: "Shatter burst", tiers: fixed([1.1, 1.4, 1.8] as const, (bonus) => ({ attack: { bonus }, description: `The shatter deals the stored damage +${pct(bonus)}.` })) },
    {
      slug: "resin-burst", name: "Resin Burst", role: "Group shatter",
      tiers: fixed([[0.35, 1], [0.5, 1.2], [0.65, 1.4]] as const, ([factor, radius]) => ({
        specialization: { kind: "shatter-splash", factor, radius },
        description: `Shards of the shatter hit every other enemy within ${radius} cells for ${pct(factor)} of its damage.`,
      })),
    },
  ],
  magnetar: [
    { slug: "event-field", name: "Event Field", role: "Bigger crowd", tiers: fixed([2.5, 2.8, 3.1] as const, (radius) => ({ attack: { radius }, description: `Pulse radius ${radius} cells.` })) },
    {
      slug: "crush-point", name: "Crush Point", role: "Damage window",
      tiers: fixed([[0.1, 2], [0.15, 2.5], [0.2, 3]] as const, ([bonus, duration]) => ({
        specialization: { kind: "compression", bonus, duration },
        description: `Enemies caught in the pulse take +${pct(bonus)} damage for ${duration} s.`,
      })),
    },
    {
      slug: "lodestone", name: "Lodestone", role: "Hold the clump",
      tiers: fixed([[0.7, 1], [0.6, 1.3], [0.5, 1.6]] as const, ([factor, duration]) => ({
        specialization: { kind: "lodestone", factor, duration },
        description: `Enemies caught in the pulse move at ${pct(factor)} speed for ${duration} s, so the clump holds together.`,
      })),
    },
  ],
  cyclone: [
    { slug: "tempest", name: "Tempest", role: "Bigger gust", tiers: fixed([1.8, 2.1, 2.4] as const, (radius) => ({ attack: { radius }, description: `Gust radius ${radius} cells.` })) },
    {
      slug: "downburst", name: "Downburst", role: "Ground the flyers",
      tiers: fixed([[0.8, 1.5], [0.7, 2], [0.6, 2.5]] as const, ([factor, duration]) => ({
        specialization: { kind: "downdraft", factor, duration },
        description: `Gusted flyers are forced down: ${pct(factor)} speed for ${duration} s, and ground towers can hit them.`,
      })),
    },
    {
      slug: "shear-wind", name: "Shear Wind", role: "Damage window",
      tiers: fixed([[0.1, 2], [0.15, 2.5], [0.2, 3]] as const, ([bonus, duration]) => ({
        specialization: { kind: "compression", bonus, duration },
        description: `Gusted flyers take +${pct(bonus)} damage for ${duration} s.`,
      })),
    },
  ],
  // ── end g1 ──
  // ── new towers: g2 (Control B) ──
  tether: [
    {
      slug: "chain-gang", name: "Chain Gang", role: "Big groups",
      tiers: fixed([[5, 1.9], [6, 2.1], [7, 2.3]] as const, ([links, radius]) => ({
        attack: { links, radius },
        description: `Links ${links} enemies within ${radius} cells.`,
      })),
    },
    {
      slug: "shared-pain", name: "Shared Pain", role: "Damage share",
      tiers: fixed([0.2, 0.3, 0.4] as const, (share) => ({
        specialization: { kind: "tether-share", share },
        description: `Damage a linked enemy takes hits every other linked enemy for ${pct(share)} of it.`,
      })),
    },
    {
      slug: "whiplash", name: "Whiplash", role: "Kill stun",
      tiers: fixed([0.5, 0.75, 1] as const, (duration) => ({
        specialization: { kind: "whiplash", duration },
        description: `When a linked enemy dies, the chain snaps: the others are stunned for ${duration} s.`,
      })),
    },
  ],
  shrink: [
    {
      slug: "compactor", name: "Compactor", role: "Deep shrink",
      tiers: fixed([[0.45, 0.3], [0.4, 0.2], [0.35, 0.1]] as const, ([factor, armor]) => ({
        attack: { factor, armor },
        description: `Shrinks to ${pct(factor)} size; ${pct(armor)} of the armor is left.`,
      })),
    },
    {
      slug: "featherweight", name: "Featherweight", role: "Knockback",
      tiers: fixed([0.25, 0.4, 0.55] as const, (cells) => ({
        specialization: { kind: "shrink-knock", cells },
        description: `Every beam knocks the shrunk target ${cells} cells back along the path. Unstoppable enemies stand firm.`,
      })),
    },
    {
      slug: "brittle-frame", name: "Brittle Frame", role: "Team damage",
      tiers: fixed([0.12, 0.18, 0.25] as const, (bonus) => ({
        specialization: { kind: "brittle-frame", bonus },
        description: `Shrunk enemies take +${pct(bonus)} damage from every source.`,
      })),
    },
  ],
  hex: [
    {
      slug: "resonance", name: "Resonance", role: "Bigger echo",
      tiers: fixed([0.65, 0.8, 1] as const, (share) => ({
        attack: { share },
        description: `The curse echoes ${pct(share)} of the damage.`,
      })),
    },
    {
      slug: "plague-hex", name: "Plague Hex", role: "Spreading curse",
      tiers: fixed([[1, 1.5], [2, 1.8], [3, 2.1]] as const, ([count, radius]) => ({
        specialization: { kind: "hex-spread", count, radius },
        description: `When a curse goes off or its carrier dies, it jumps to ${count} uncursed enem${count > 1 ? "ies" : "y"} within ${radius} cells.`,
      })),
    },
    {
      slug: "doom", name: "Doom", role: "Execution",
      tiers: fixed([0.1, 0.15, 0.2] as const, (threshold) => ({
        specialization: { kind: "doom", threshold },
        description: `An echo that leaves the enemy below ${pct(threshold)} of its max HP kills it, shields or not.`,
      })),
    },
  ],
  siphon: [
    {
      slug: "overdrive", name: "Overdrive", role: "Fire rate",
      tiers: fixed([[0.09, 6], [0.1, 7], [0.11, 8]] as const, ([bonus, cap]) => ({
        attack: { bonus, cap },
        description: `+${pct(bonus)} fire rate per enemy, counting up to ${cap}.`,
      })),
    },
    {
      slug: "leech-field", name: "Leech Field", role: "More slowed",
      tiers: fixed([[1, 1.4], [2, 1.6], [3, 1.8]] as const, ([count, radius]) => ({
        specialization: { kind: "siphon-fork", count, radius },
        description: `The beam forks to ${count} more enem${count > 1 ? "ies" : "y"} within ${radius} cells and slows them too.`,
      })),
    },
    {
      slug: "power-tap", name: "Power Tap", role: "Damage",
      tiers: fixed([0.03, 0.04, 0.05] as const, (bonus) => ({
        specialization: { kind: "power-tap", bonus },
        description: `Fed towers also deal +${pct(bonus)} damage per counted enemy.`,
      })),
    },
  ],
  // ── end g2 ──
  // ── trap paths ──
  mine: [
    { slug: "shaped-charge", name: "Shaped Charge", role: "Armor", tiers: conditional("armored", [0.25, 0.5, 0.75], "against armored enemies") },
    {
      slug: "chain-reaction", name: "Chain Reaction", role: "Kill chains",
      tiers: fixed([[0.25, 0.75, 1], [0.4, 0.9, 2], [0.55, 1.1, 3]] as const, ([factor, radius, maxPerSalvo]) => ({
        specialization: { kind: "chain-reaction", factor, radius, maxPerSalvo },
        description: `Kills by the mine explode again: ${pct(factor)} damage within ${radius} cells, up to ${maxPerSalvo} per blast.`,
      })),
    },
    { slug: "quick-rearm", name: "Quick Rearm", role: "Steady traffic", tiers: faster([0.15, 0.25, 0.35]) },
  ],
  spikes: [
    { slug: "serrated", name: "Serrated", role: "Bleed", tiers: fixed([22, 26, 30] as const, (perCell) => ({ attack: { perCell }, description: `Bleeding enemies lose ${perCell} HP for every cell they walk.` })) },
    {
      slug: "hamstring", name: "Hamstring", role: "Slow",
      tiers: fixed([0.15, 0.22, 0.3] as const, (slow) => ({
        specialization: { kind: "hamstring", slow },
        description: `Bleeding enemies are ${pct(slow)} slower while they bleed.`,
      })),
    },
    {
      slug: "open-wounds", name: "Open Wounds", role: "Team damage",
      tiers: fixed([0.08, 0.12, 0.16] as const, (bonus) => ({
        specialization: { kind: "open-wounds", bonus },
        description: `Bleeding enemies take +${pct(bonus)} damage from every source while they bleed.`,
      })),
    },
  ],
  tar: [
    { slug: "brittle-tar", name: "Brittle Tar", role: "Weaken", tiers: vulnerability("brittle-ice", [0.08, 0.12, 0.16], "Enemies slowed by this Tar Pit") },
    {
      slug: "spreading-bog", name: "Spreading Bog", role: "Groups",
      tiers: fixed([[0.7, 0.6, 1.5], [1, 0.5, 1.8], [1.3, 0.45, 2]] as const, ([radius, factor, duration]) => ({
        specialization: { kind: "frostburst", radius, factor, duration },
        description: `The tar also slows enemies within ${radius} cells of its victim to ${pct(factor)} speed for ${duration} s.`,
      })),
    },
    {
      slug: "flammable-tar", name: "Flammable Tar", role: "Fire combo",
      tiers: fixed([[1.4, 2.5], [1.7, 3], [2, 3.5]] as const, ([boost, duration]) => ({
        specialization: { kind: "tar-oil", boost, duration },
        description: `Tarred enemies count as oiled for ${duration} s: burns on them deal ${boost}× and leap to oiled enemies within 1 cell.`,
      })),
    },
  ],
  snare: [
    {
      slug: "exposure", name: "Exposure", role: "Damage window",
      tiers: fixed([[0.1, 1.5], [0.15, 2], [0.2, 2.5]] as const, ([bonus, duration]) => ({
        specialization: { kind: "temporal-exposure", bonus, duration },
        description: `After the trap lets go, the enemy takes +${pct(bonus)} damage for ${duration} s.`,
      })),
    },
    {
      slug: "double-jaw", name: "Double Jaw", role: "Long hold",
      tiers: fixed([[0.85, 2.4], [1, 2.6], [1.15, 2.8]] as const, ([radius, duration]) => ({
        attack: { radius, duration },
        description: `Grabs every ground enemy within ${radius} cells and holds it for ${duration} s.`,
      })),
    },
    { slug: "hair-trigger", name: "Hair Trigger", role: "Quick reset", tiers: faster([0.15, 0.25, 0.35]) },
  ],
  grill: [
    {
      slug: "wildfire", name: "Wildfire", role: "Spread",
      tiers: fixed([[0.4, 1, 1], [0.55, 1.2, 2], [0.7, 1.4, 3]] as const, ([remainingFactor, radius, count]) => ({
        specialization: { kind: "wildfire", remainingFactor, radius, count },
        description: `A burning enemy that dies passes ${pct(remainingFactor)} of its remaining burn to ${count} enem${count > 1 ? "ies" : "y"} within ${radius} cells.`,
      })),
    },
    { slug: "scorch", name: "Scorch", role: "Synergy", tiers: conditional("burning", [0.15, 0.25, 0.4], "against enemies that already burn") },
    {
      slug: "blast-furnace", name: "Blast Furnace", role: "Burn",
      tiers: fixed([[4.5, 4], [5, 4.5], [6, 5]] as const, ([ratio, duration]) => ({
        attack: { ratio, duration },
        description: `The burn deals ${ratio}× the hit over ${duration} s.`,
      })),
    },
  ],
  spring: [
    {
      slug: "compression", name: "Compression", role: "Damage window",
      tiers: fixed([[0.1, 2], [0.15, 2.5], [0.2, 3]] as const, ([bonus, duration]) => ({
        specialization: { kind: "compression", bonus, duration },
        description: `Thrown enemies take +${pct(bonus)} damage for ${duration} s.`,
      })),
    },
    { slug: "catapult", name: "Catapult", role: "Push back", tiers: fixed([4, 4.5, 5] as const, (strength) => ({ attack: { strength }, description: `Throws enemies back at ${strength}× their speed.` })) },
    {
      slug: "concussion", name: "Concussion", role: "Landing window",
      tiers: fixed([[0.1, 1.5], [0.15, 2], [0.2, 2.5]] as const, ([bonus, duration]) => ({
        specialization: { kind: "concussion", bonus, duration },
        description: `Thrown enemies take +${pct(bonus)} damage from every source in the air and for ${duration} s after they land.`,
      })),
    },
  ],
  limpet: [
    {
      slug: "chain-reaction", name: "Chain Reaction", role: "Kill chains",
      tiers: fixed([[0.25, 0.75, 1], [0.4, 0.9, 2], [0.55, 1.1, 3]] as const, ([factor, radius, maxPerSalvo]) => ({
        specialization: { kind: "chain-reaction", factor, radius, maxPerSalvo },
        description: `Kills by the bomb explode again: ${pct(factor)} damage within ${radius} cells, up to ${maxPerSalvo} per bomb.`,
      })),
    },
    { slug: "breaching-charge", name: "Breaching Charge", role: "Armor", tiers: conditional("armored", [0.25, 0.5, 0.75], "against armored enemies") },
    {
      slug: "contact-fuse", name: "Contact Fuse", role: "Quick blast",
      tiers: fixed([[1.2, 1.75], [0.9, 1.9], [0.6, 2.1]] as const, ([fuse, radius]) => ({
        attack: { fuse, radius },
        description: `The bomb goes off after ${fuse} s, blast radius ${radius} cells.`,
      })),
    },
  ],
  pit: [
    {
      slug: "abyss", name: "Abyss", role: "Swallow more",
      tiers: fixed([[0.29, "Thornbacks, Crystal Wardens and Decoys"], [0.3, "Bulwarks, Commanders, Hydras and Piston Tanks"], [0.31, "Nautili and Pressure Bunkers"]] as const, ([size, more]) => ({
        attack: { size },
        description: `Also swallows ${more}. Berserkers and Titans never fall in.`,
      })),
    },
    {
      slug: "spike-bed", name: "Spike Bed", role: "Big enemies",
      tiers: fixed([[0.75, 0.05], [0.9, 0.075], [1, 0.1]] as const, ([threshold, extraPercent]) => ({
        specialization: { kind: "max-hp-execute", threshold, extraPercent },
        description: `Enemies too big to fall in take another ${pct(extraPercent)} of their max HP while below ${pct(threshold)} HP.`,
      })),
    },
    { slug: "quick-cover", name: "Quick Cover", role: "Swarms", tiers: faster([0.15, 0.25, 0.35]) },
  ],
  tripwire: [
    { slug: "full-alert", name: "Full Alert", role: "Wide alarm", tiers: fixed([4, 4.5, 5] as const, (radius) => ({ attack: { radius }, description: `Alerts towers in radius ${radius}.` })) },
    {
      slug: "volley-signal", name: "Volley Signal", role: "Alpha strike",
      tiers: fixed([0.5, 0.75, 1] as const, (bonus) => ({
        specialization: { kind: "alarm-volley", bonus },
        description: `The next shot of every alerted tower deals +${pct(bonus)} damage.`,
      })),
    },
    {
      slug: "flare", name: "Flare", role: "Stealth",
      tiers: fixed([1.5, 2.5, 3.5] as const, (duration) => ({
        specialization: { kind: "flare", duration },
        description: `A tripped wire reveals stealthed enemies in its alarm radius for ${duration} s.`,
      })),
    },
  ],
  barricade: [
    { slug: "bulwark", name: "Bulwark", role: "Long hold", tiers: fixed([1200, 1500, 1850] as const, (hp) => ({ attack: { hp }, description: `${hp} wall HP.` })) },
    {
      slug: "thorn-wall", name: "Thorn Wall", role: "Spikes",
      tiers: (l5) => tiers([1.6, 2.2, 3] as const, (factor) => ({ stats: { damage: Math.round(l5.damage * factor) }, description: `Much stronger spikes: ${Math.round(l5.damage * factor)} damage per hit.` })),
    },
    {
      slug: "choke-point", name: "Choke Point", role: "Team damage",
      tiers: fixed([0.1, 0.15, 0.2] as const, (bonus) => ({
        specialization: { kind: "held-exposure", bonus },
        description: `Enemies held at the wall take +${pct(bonus)} damage from every source.`,
      })),
    },
  ],
  warp: [
    { slug: "long-fold", name: "Long Fold", role: "Rewind", tiers: fixed([7, 8, 9] as const, (cells) => ({ attack: { cells }, description: `Sends enemies ${cells} tiles back.` })) },
    {
      slug: "disorient", name: "Disorient", role: "Confuse",
      tiers: fixed([1, 1.5, 2] as const, (duration) => ({
        specialization: { kind: "warp-daze", duration },
        description: `Warped enemies are confused and walk backwards for ${duration} s. Berserkers keep their heading.`,
      })),
    },
    {
      slug: "mass-warp", name: "Mass Warp", role: "Big enemies",
      tiers: (l5) =>
        tiers([[0.33, 0.1], [0.34, 0.2], [0.36, 0.3]] as const, ([size, cut]) => ({
          attack: { size },
          stats: { interval: l5.interval * (1 - cut) },
          description: `Fits enemies up to size ${Math.round(size * 100)}, and ${pct(cut)} less time to recharge: ${num(l5.interval * (1 - cut))} s.`,
        })),
    },
  ],
  arc: [
    {
      slug: "storm-floor", name: "Storm Floor", role: "Swarm chain",
      tiers: fixed([[6, 0.87], [7, 0.9], [8, 0.92]] as const, ([jumps, falloff]) => ({
        attack: { jumps, falloff },
        description: `The lightning jumps to ${jumps} more enemies and keeps ${pct(falloff)} of its damage per jump.`,
      })),
    },
    {
      slug: "twin-arc", name: "Twin Arc", role: "Split groups",
      tiers: fixed([[4, 0.45], [3, 0.55], [2, 0.65]] as const, ([every, factor]) => ({
        specialization: { kind: "twin-arc", every, factor },
        description: `Every ${ordinal(every)} strike starts a second chain at another enemy on the plate for ${pct(factor)} damage.`,
      })),
    },
    { slug: "overcharge", name: "Overcharge", role: "Boss", tiers: conditional("heavy", [0.25, 0.45, 0.7], "against heavy targets (1,000+ max HP)") },
  ],
  oil: [
    { slug: "naphtha", name: "Naphtha", role: "Fire combo", tiers: fixed([2.9, 3.2, 3.5] as const, (boost) => ({ attack: { boost }, description: `Burns on oiled enemies deal ${boost} times.` })) },
    {
      slug: "wide-spill", name: "Wide Spill", role: "Spread",
      tiers: fixed([[1.8, 5.5], [2, 6], [2.2, 7]] as const, ([radius, duration]) => ({
        attack: { radius, duration },
        description: `Burns leap ${radius} tiles between oiled enemies; the coat lasts ${duration} s.`,
      })),
    },
    {
      slug: "slick", name: "Slick", role: "Slow",
      tiers: fixed([[0.8, 0.7, 1], [1, 0.6, 1.2], [1.2, 0.5, 1.5]] as const, ([radius, factor, duration]) => ({
        specialization: { kind: "frostburst", radius, factor, duration },
        description: `Enemies within ${radius} cells of the slick, the coated ones included, move at ${pct(factor)} speed for ${duration} s.`,
      })),
    },
  ],
  grinder: [
    { slug: "meat-mill", name: "Meat Mill", role: "Held enemies", tiers: fixed([4.5, 5, 6] as const, (bonus) => ({ attack: { bonus }, description: `Up to ${bonus + 1} times the damage on held enemies.` })) },
    { slug: "shredder", name: "Shredder", role: "Armor", tiers: pierce },
    {
      slug: "bonesaw", name: "Bonesaw", role: "Boss",
      tiers: fixed([[0.35, 0.002], [0.45, 0.003], [0.55, 0.004]] as const, ([threshold, extraPercent]) => ({
        specialization: { kind: "max-hp-execute", threshold, extraPercent },
        description: `Below ${pct(threshold)} HP, every turn of the blades adds ${pct(extraPercent)} of the target's max HP.`,
      })),
    },
  ],
  harpoon: [
    {
      slug: "whaler", name: "Whaler", role: "Long hold",
      tiers: fixed([[1.8, 4.5], [2, 5], [2.3, 5.5]] as const, ([pin, duration]) => ({
        attack: { pin, duration },
        description: `Pins for ${pin} s and keeps the flyer netted for ${duration} s.`,
      })),
    },
    { slug: "exposed-target", name: "Exposed Target", role: "Anti-air synergy", tiers: vulnerability("exposed-target", [0.1, 0.15, 0.2], "Harpooned flyers") },
    {
      slug: "net-cloud", name: "Net Cloud", role: "Several flyers",
      tiers: fixed([[1, 0.9], [2, 1.1], [3, 1.3]] as const, ([count, radius]) => ({
        specialization: { kind: "net-cloud", count, radius },
        description: `The net also catches ${count} other flyer${count > 1 ? "s" : ""} within ${radius} cells.`,
      })),
    },
  ],
  // ── end trap paths ──
};

/** Where a tower's paths branch off, and what each tier costs. */
export interface Branch {
  /** Level the paths branch from; tier I is level `from + 1`. */
  from: number;
  /** Tier I needs this upgrade, or (Aura, whose tracks end in different ids) only the level `from`. */
  after: string | { minLevel: number };
  /** Price of tier 1, 2, 3. */
  costs: readonly [number, number, number];
}

/** The nine path upgrades of three paths after `branch`. */
export function pathUpgrades(paths: readonly PathData[], base: TowerStats, branch: Branch): readonly UpgradeDefinition[] {
  return paths.flatMap(({ slug, name, tiers: make }) =>
    make(base).map(({ description, stats, attack, specialization }, index) => ({
      id: `${slug}-${index + 1}`,
      label: `${name} ${NUMERALS[index]}`,
      description: index === 0 ? `${description} Locks the other two paths.` : description,
      cost: branch.costs[index],
      requires: index > 0 ? [`${slug}-${index}`] : typeof branch.after === "string" ? [branch.after] : [],
      ...(index === 0 && typeof branch.after !== "string" ? { minLevel: branch.after.minLevel } : {}),
      path: slug,
      effects: {
        level: branch.from + 1 + index,
        ...(stats ? { stats } : {}),
        ...(attack ? { attack } : {}),
        ...(specialization ? { specialization } : {}),
      },
    })),
  );
}

/** The nine specialization upgrades of an attack tower or trap (levels 6 to 8), or none if it has no paths. */
export function specializationUpgrades(id: string, buildCost: number, l5: TowerStats): readonly UpgradeDefinition[] {
  const costs = SPECIALIZATION_COSTS.map((factor) => Math.round(buildCost * factor)) as unknown as Branch["costs"];
  return pathUpgrades(SPECIALIZATIONS[id] ?? [], l5, { from: 5, after: "level-5", costs });
}

/** Path looks with name and role. */
export const pathVisuals = (paths: readonly PathData[]): Readonly<Record<string, PathVisual>> =>
  Object.fromEntries(paths.map(({ slug, name, role }, index) => [slug, { ...PATH_LOOKS[index], name, role }]));

/** Path looks with name and role, or undefined if the tower has no paths. */
export function specializationVisuals(id: string): Readonly<Record<string, PathVisual>> | undefined {
  const paths = SPECIALIZATIONS[id];
  return paths && pathVisuals(paths);
}
