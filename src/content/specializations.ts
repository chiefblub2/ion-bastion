import type { DamagePredicate } from "../core/specialization-types";
import type { PathVisual, SpecializationSpec, TowerStats, UpgradeDefinition } from "../core/types";

/**
 * Specializations: after level 5 every attack tower built with `attackTower` picks one of three
 * paths (A, B, C) with three tiers each (levels 6 to 8). Tier values are final values of that
 * tier, never stacked on the previous tier.
 */
interface Tier {
  description: string;
  stats?: Partial<TowerStats>;
  attack?: Readonly<Record<string, number>>;
  specialization?: SpecializationSpec;
}
interface PathData {
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

const pct = (value: number) => `${Math.round(value * 1000) / 10}%`;
const num = (value: number) => `${Math.round(value * 100) / 100}`;
const ordinal = (n: number) => (n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`);
/** Three tiers from three value sets. */
const tiers = <T,>(values: readonly [T, T, T], tier: (value: T) => Tier) =>
  values.map(tier) as unknown as readonly [Tier, Tier, Tier];
const fixed = <T,>(values: readonly [T, T, T], tier: (value: T) => Tier) => () => tiers(values, tier);

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
};

/** The nine specialization upgrades of a tower, or none if it has no paths. */
export function specializationUpgrades(id: string, buildCost: number, l5: TowerStats): readonly UpgradeDefinition[] {
  return (SPECIALIZATIONS[id] ?? []).flatMap(({ slug, name, tiers: make }) =>
    make(l5).map(({ description, stats, attack, specialization }, index) => ({
      id: `${slug}-${index + 1}`,
      label: `${name} ${NUMERALS[index]}`,
      description: index === 0 ? `${description} Locks the other two paths.` : description,
      cost: Math.round(buildCost * SPECIALIZATION_COSTS[index]),
      requires: [index === 0 ? "level-5" : `${slug}-${index}`],
      path: slug,
      effects: {
        level: 6 + index,
        ...(stats ? { stats } : {}),
        ...(attack ? { attack } : {}),
        ...(specialization ? { specialization } : {}),
      },
    })),
  );
}

/** Path looks with name and role, or undefined if the tower has no paths. */
export function specializationVisuals(id: string): Readonly<Record<string, PathVisual>> | undefined {
  const paths = SPECIALIZATIONS[id];
  return paths && Object.fromEntries(paths.map(({ slug, name, role }, index) => [slug, { ...PATH_LOOKS[index], name, role }]));
}
