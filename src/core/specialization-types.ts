/**
 * Specialization abilities of attack towers (levels 6 to 8). Each tier carries the complete
 * values of its ability; a later tier of the same path replaces the earlier one.
 */
export type DamagePredicate = "heavy" | "heavy-air" | "armored" | "isolated" | "burning";

export type AttackSpecialization =
  /** Hits deal `1 + bonus` times their damage to enemies matching the predicate. */
  | { kind: "conditional-damage"; predicate: DamagePredicate; bonus: number }
  /** Ignores this share of the `armor` trait's reduction. */
  | { kind: "armor-pierce"; fraction: number }
  /** Every `every`th shot also hits a second enemy within `radius` of the target for `factor` of its damage. */
  | { kind: "ricochet"; every: number; radius: number; factor: number }
  /** Each salvo also fires at `count` further air targets for `factor` of the damage. */
  | { kind: "extra-air-targets"; count: number; factor: number }
  /** Hit flyers lose `slow` of their speed for `duration` seconds. */
  | { kind: "wingclip"; slow: number; duration: number }
  /** Every `every`th salvo starts a second chain at `factor` of the damage. */
  | { kind: "twin-arc"; every: number; factor: number }
  /** Kills of the blast explode once more: `factor` of the damage within `radius`, at most `maxPerSalvo`. */
  | { kind: "chain-reaction"; factor: number; radius: number; maxPerSalvo: number }
  /** A dying burning enemy passes `remainingFactor` of its remaining burn to `count` enemies within `radius`. */
  | { kind: "wildfire"; remainingFactor: number; radius: number; count: number }
  /** Below `threshold` of their HP, enemies take `extraPercent` more of their max HP. */
  | { kind: "max-hp-execute"; threshold: number; extraPercent: number }
  /** `count` enemies within `radius` take min(`maxHpPercent` of their max HP, `hitCapFactor` of the hit). */
  | { kind: "contagion"; count: number; radius: number; maxHpPercent: number; hitCapFactor: number }
  /** On a target switch, `carry` of the stacks (rounded down) is kept. */
  | { kind: "focus-carry"; carry: number }
  /** The first enemy behind the target within `width` of the beam takes `factor` of the hit. */
  | { kind: "prism-beam"; width: number; factor: number }
  /** Enemies hit by the wave take `bonus` more damage for `duration` seconds afterwards. */
  | { kind: "fracture"; bonus: number; duration: number }
  /** A second wave `delay` seconds later with `factor` of the damage. */
  | { kind: "aftershock"; delay: number; factor: number }
  /** A killing hit passes `factor` of its overkill to the nearest enemy within `radius`. */
  | { kind: "overkill-transfer"; factor: number; radius: number }
  /** The main target takes `bonusPerUnused` of the damage per unused base shard. */
  | { kind: "unused-volley"; bonusPerUnused: number }
  /** Enemies slowed by this tower take `bonus` more damage while slowed. */
  | { kind: "brittle-ice"; bonus: number }
  /** Hits also slow enemies within `radius` to `factor` of their speed for `duration` seconds. */
  | { kind: "frostburst"; radius: number; factor: number; duration: number }
  /** After a successful stun, the enemy takes `bonus` more damage for `duration` seconds. */
  | { kind: "temporal-exposure"; bonus: number; duration: number }
  /** Corroded enemies lose `fraction` of their armor reduction. */
  | { kind: "armor-dissolver"; fraction: number }
  /** After a successful pull, the enemy takes `bonus` more damage for `duration` seconds. */
  | { kind: "compression"; bonus: number; duration: number }
  /** Disrupted enemies take `bonus` more damage while disrupted. */
  | { kind: "weak-signal"; bonus: number }
  /** The net also catches `count` other flyers within `radius`. */
  | { kind: "net-cloud"; radius: number; count: number }
  /** Netted flyers take `bonus` more damage while netted. */
  | { kind: "exposed-target"; bonus: number }
  /** Flyers hit by the burst are netted: `factor` of their speed for `duration` seconds, counting as ground targets. */
  | { kind: "downdraft"; factor: number; duration: number }
  /** Hits on a target with at least `min` status effects splash `factor` of the hit on other enemies within `radius`. */
  | { kind: "reaction-splash"; min: number; factor: number; radius: number }
  /** Hits extend the target's running slow, burn, vulnerable, disrupted, netted, bleeding and armor dissolve by `extend` s, to at most `max` s from now. */
  | { kind: "prolong"; extend: number; max: number }
  /** Enemies in the pool lose `fraction` of their armor reduction for `duration` seconds. */
  | { kind: "pool-dissolve"; fraction: number; duration: number }
  /** Enemies in the pool are slowed to `factor` of their speed for `duration` seconds. */
  | { kind: "pool-slow"; factor: number; duration: number }
  // ── new towers: g1 (Attack+Control A) ──
  /** Each strike also drops `count` bomblets on the nearest enemies within `radius` outside its blast, each `factor` of the damage. */
  | { kind: "cluster"; count: number; radius: number; factor: number }
  /** The trance also takes `count` other enemies within `radius` of the target. */
  | { kind: "mass-trance"; count: number; radius: number }
  /** Hypnotised enemies take `bonus` more damage while the trance lasts. */
  | { kind: "mind-break"; bonus: number }
  /** A shatter also hits every other enemy within `radius` for `factor` of its damage. */
  | { kind: "shatter-splash"; factor: number; radius: number }
  /** Enemies caught in the pulse are slowed to `factor` of their speed for `duration` seconds. */
  | { kind: "lodestone"; factor: number; duration: number }
  // ── end g1 ──
  // ── new towers: g2 (Control B) ──
  /** Tether: damage that reaches a linked enemy's HP is dealt `share` again to each of its partners (never passed on twice). */
  | { kind: "tether-share"; share: number }
  /** Tether: when a linked enemy dies, its partners are stunned for `duration` seconds. */
  | { kind: "whiplash"; duration: number }
  /** Shrink Ray: every beam knocks a shrunk target `cells` back along the path (not unstoppable enemies). */
  | { kind: "shrink-knock"; cells: number }
  /** Shrink Ray: shrunk enemies take `bonus` more damage while shrunk. */
  | { kind: "brittle-frame"; bonus: number }
  /** Hex: when a curse goes off or its carrier dies, it jumps to `count` uncursed enemies within `radius` (jumped curses never jump again). */
  | { kind: "hex-spread"; radius: number; count: number }
  /** Hex: an echo that leaves the enemy below `threshold` of its max HP kills it. */
  | { kind: "doom"; threshold: number }
  /** Siphon: the beam forks to `count` more enemies within `radius` of the target, slowing them too. */
  | { kind: "siphon-fork"; radius: number; count: number }
  /** Siphon: each counted slowed enemy also gives the towers around it `bonus` more damage. */
  | { kind: "power-tap"; bonus: number }
  // ── end g2 ──
  // ── trap paths ──
  /** Caltrops: bleeding enemies are slowed to `1 - slow` of their speed while they bleed. */
  | { kind: "hamstring"; slow: number }
  /** Caltrops: bleeding enemies take `bonus` more damage from every source while they bleed. */
  | { kind: "open-wounds"; bonus: number }
  /** Tar Pit: tarred enemies are also oiled (`boost` times burns) for `duration` seconds. */
  | { kind: "tar-oil"; boost: number; duration: number }
  /** Spring: thrown enemies take `bonus` more damage for `duration` seconds. */
  | { kind: "concussion"; bonus: number; duration: number }
  /** Tripwire: the next shot of each alerted tower deals `bonus` more damage. */
  | { kind: "alarm-volley"; bonus: number }
  /** Tripwire: reveals stealthed enemies within its alarm radius for `duration` seconds. */
  | { kind: "flare"; duration: number }
  /** Barricade: enemies held at the wall take `bonus` more damage from every source. */
  | { kind: "held-exposure"; bonus: number }
  /** Warp Pad: warped enemies are confused for `duration` seconds. */
  | { kind: "warp-daze"; duration: number }
  // ── end trap paths ──
  /** An expiring pool erupts once: `factor` of its total burn as an area hit over its radius. */
  | { kind: "eruption"; factor: number };

/**
 * Specialization abilities of support towers (levels 4 to 6) and Aura (levels 5 to 7). They never travel on a damage
 * source: the support systems read them from the tower. Each adds one new effect next to the tower's own effect.
 */
export type SupportSpecialization =
  // ── support economy ──
  /** Beacon: heavy enemies and bosses killed in radius pay `amount` credits, at most `cap` per wave. */
  | { kind: "big-game"; amount: number; cap: number }
  /** Beacon: enemies in radius lose `slow` of their speed. */
  | { kind: "lure"; slow: number }
  /** Beacon: every `every` kills in radius restore 1 reactor energy, at most 1 per wave. */
  | { kind: "field-rations"; every: number }
  /** Refinery: `amount` of the income is paid at wave start instead of wave end. */
  | { kind: "advance"; amount: number }
  /** Refinery: +`amount` credits per wave it has stood, at most +`cap`. */
  | { kind: "compounding"; amount: number; cap: number }
  /** Refinery: attack towers within `radius` fire `bonus` faster. */
  | { kind: "fuel-line"; bonus: number; radius: number }
  /** Vault: a wave without a leak pays `amount` credits. */
  | { kind: "clean-sheet"; amount: number }
  /** Vault: `share` of the credits spent during the wave count as unspent for the interest. */
  | { kind: "investment"; share: number }
  /** Vault: every `every` interest credits paid restore 1 reactor energy, at most 1 per wave. */
  | { kind: "reserve-cells"; every: number }
  /** Workshop: builds in radius cost `share` less. */
  | { kind: "prefab"; share: number }
  /** Workshop: towers in radius sell for `share` of what was spent. */
  | { kind: "refit"; share: number }
  /** Workshop: towers in radius at their max level deal `bonus` more damage. */
  | { kind: "calibration"; bonus: number }
  /** Repair Dock: the first leaks of each wave are refunded right away, up to `amount` energy. */
  | { kind: "triage"; amount: number }
  /** Repair Dock: each repair point it cannot use pays `amount` credits. */
  | { kind: "salvage"; amount: number }
  /** Repair Dock: below half reactor energy, attack towers within `radius` fire `bonus` faster. */
  | { kind: "damage-control"; bonus: number; radius: number }
  /** Shield Generator: refills `amount` absorb points every `every` seconds of a wave. */
  | { kind: "recharge"; amount: number; every: number }
  /** Shield Generator: an absorbed hit stuns ground enemies within `radius` of the reactor for `duration` seconds. */
  | { kind: "shockwave"; duration: number; radius: number }
  /** Shield Generator: each absorb point left unused at wave end pays `amount` credits. */
  | { kind: "overflow"; amount: number }
  // ── end support economy ──
  // ── support combat ──
  /** Tracker: marked enemies lose `fraction` of their armor reduction. */
  | { kind: "weak-point"; fraction: number }
  /** Tracker: the strongest enemy in radius takes another `bonus` more damage. */
  | { kind: "hunters-mark"; bonus: number }
  /** Tracker: the mark stays `duration` seconds after an enemy leaves the radius. */
  | { kind: "lingering-tag"; duration: number }
  /** Overclock: after the window, a `boost` fire-rate bonus fades out over `duration` seconds. */
  | { kind: "afterburn"; boost: number; duration: number }
  /** Overclock: the window also opens for `duration` seconds when a wave's first enemy enters the radius. */
  | { kind: "opening-salvo"; duration: number }
  /** Overclock: shots fired during the window deal `bonus` more damage. */
  | { kind: "charged-rounds"; bonus: number }
  /** Fire Control: crits ignore `fraction` of armor. */
  | { kind: "penetrator"; fraction: number }
  /** Fire Control: crits slow the target by `slow` for `duration` seconds. */
  | { kind: "stagger"; slow: number; duration: number }
  /** Fire Control: a crit marks the target; the next hit by another tower deals `bonus` more. */
  | { kind: "spotting"; bonus: number }
  /** Armory: hits strip `fraction` of the target's armor for `duration` seconds. */
  | { kind: "shred"; fraction: number; duration: number }
  /** Armory: unarmored targets take `bonus` more damage. */
  | { kind: "hollow-points"; bonus: number }
  /** Armory: hits deal `bonus` more damage to shields. */
  | { kind: "shieldbreaker"; bonus: number }
  /** Skylink: held flyers lose `slow` of their speed. */
  | { kind: "downlink"; slow: number }
  /** Skylink: anti-air towers in radius deal `bonus` more damage to flyers. */
  | { kind: "flak-relay"; bonus: number }
  /** Skylink: held flyers take `bonus` more damage from every source. */
  | { kind: "wing-tag"; bonus: number }
  /** Nexus: also `bonus` more range per tower type. */
  | { kind: "nexus-resonance"; bonus: number }
  /** Nexus: also `bonus` faster fire per tower type. */
  | { kind: "harmony"; bonus: number }
  /** Nexus: with at least `min` types in radius, enemies in radius take `bonus` more damage. */
  | { kind: "diversity"; bonus: number; min: number }
  /** Detector: revealed stealth enemies take `bonus` more damage. */
  | { kind: "exposure-scan"; bonus: number }
  /** Detector: every `every` seconds it disrupts the strongest enemy in radius for `duration` seconds. */
  | { kind: "static-pulse"; every: number; duration: number }
  /** Detector: revealed enemies stay revealed `duration` seconds after leaving the radius. */
  | { kind: "afterimage"; duration: number }
  /** Recycler: the jump's own overkill jumps once more at `factor`. */
  | { kind: "cascade"; factor: number }
  /** Recycler: the jump's target also burns for `factor` of the jump over `duration` seconds. */
  | { kind: "meltdown"; factor: number; duration: number }
  /** Recycler: every `every` overkill in radius pays 1 credit, at most `cap` per wave. */
  | { kind: "scrap-yard"; every: number; cap: number }
  // ── end support combat ──
  // ── aura paths ──
  /** Aura: supported hits ignore `fraction` of armor. */
  | { kind: "piercing-field"; fraction: number }
  /** Aura: supported towers deal `bonus` more damage to enemies below `threshold` of their HP. */
  | { kind: "execution-field"; bonus: number; threshold: number }
  /** Aura: supported towers also get the two stats of the tracks not taken, `bonus` each. */
  | { kind: "harmonics"; bonus: number };
  // ── end aura paths ──

export type SpecializationSpec = AttackSpecialization | SupportSpecialization;

export type SpecializationKind = SpecializationSpec["kind"];
type Field<K extends SpecializationKind> = Exclude<keyof Extract<SpecializationSpec, { kind: K }>, "kind" | "predicate">;

/** Numeric fields per kind; the mapped type makes a missing kind or field a compile error. */
const FIELDS: { [K in SpecializationKind]: readonly Field<K>[] } = {
  "conditional-damage": ["bonus"],
  "armor-pierce": ["fraction"],
  ricochet: ["every", "radius", "factor"],
  "extra-air-targets": ["count", "factor"],
  wingclip: ["slow", "duration"],
  "twin-arc": ["every", "factor"],
  "chain-reaction": ["factor", "radius", "maxPerSalvo"],
  wildfire: ["remainingFactor", "radius", "count"],
  "max-hp-execute": ["threshold", "extraPercent"],
  contagion: ["count", "radius", "maxHpPercent", "hitCapFactor"],
  "focus-carry": ["carry"],
  "prism-beam": ["width", "factor"],
  fracture: ["bonus", "duration"],
  aftershock: ["delay", "factor"],
  "overkill-transfer": ["factor", "radius"],
  "unused-volley": ["bonusPerUnused"],
  "brittle-ice": ["bonus"],
  frostburst: ["radius", "factor", "duration"],
  "temporal-exposure": ["bonus", "duration"],
  "armor-dissolver": ["fraction"],
  compression: ["bonus", "duration"],
  "weak-signal": ["bonus"],
  "net-cloud": ["radius", "count"],
  "exposed-target": ["bonus"],
  downdraft: ["factor", "duration"],
  "reaction-splash": ["min", "factor", "radius"],
  prolong: ["extend", "max"],
  "pool-dissolve": ["fraction", "duration"],
  "pool-slow": ["factor", "duration"],
  eruption: ["factor"],
  // ── new towers: g1 (Attack+Control A) ──
  cluster: ["count", "radius", "factor"],
  "mass-trance": ["count", "radius"],
  "mind-break": ["bonus"],
  "shatter-splash": ["factor", "radius"],
  lodestone: ["factor", "duration"],
  // ── end g1 ──
  // ── new towers: g2 (Control B) ──
  "tether-share": ["share"],
  whiplash: ["duration"],
  "shrink-knock": ["cells"],
  "brittle-frame": ["bonus"],
  "hex-spread": ["radius", "count"],
  doom: ["threshold"],
  "siphon-fork": ["radius", "count"],
  "power-tap": ["bonus"],
  // ── end g2 ──
  // ── trap paths ──
  hamstring: ["slow"],
  "open-wounds": ["bonus"],
  "tar-oil": ["boost", "duration"],
  concussion: ["bonus", "duration"],
  "alarm-volley": ["bonus"],
  flare: ["duration"],
  "held-exposure": ["bonus"],
  "warp-daze": ["duration"],
  // ── end trap paths ──
  // ── support economy ──
  "big-game": ["amount", "cap"],
  lure: ["slow"],
  "field-rations": ["every"],
  advance: ["amount"],
  compounding: ["amount", "cap"],
  "fuel-line": ["bonus", "radius"],
  "clean-sheet": ["amount"],
  investment: ["share"],
  "reserve-cells": ["every"],
  prefab: ["share"],
  refit: ["share"],
  calibration: ["bonus"],
  triage: ["amount"],
  salvage: ["amount"],
  "damage-control": ["bonus", "radius"],
  recharge: ["amount", "every"],
  shockwave: ["duration", "radius"],
  overflow: ["amount"],
  // ── end support economy ──
  // ── support combat ──
  "weak-point": ["fraction"],
  "hunters-mark": ["bonus"],
  "lingering-tag": ["duration"],
  afterburn: ["boost", "duration"],
  "opening-salvo": ["duration"],
  "charged-rounds": ["bonus"],
  penetrator: ["fraction"],
  stagger: ["slow", "duration"],
  spotting: ["bonus"],
  shred: ["fraction", "duration"],
  "hollow-points": ["bonus"],
  shieldbreaker: ["bonus"],
  downlink: ["slow"],
  "flak-relay": ["bonus"],
  "wing-tag": ["bonus"],
  "nexus-resonance": ["bonus"],
  harmony: ["bonus"],
  diversity: ["bonus", "min"],
  "exposure-scan": ["bonus"],
  "static-pulse": ["every", "duration"],
  afterimage: ["duration"],
  cascade: ["factor"],
  meltdown: ["factor", "duration"],
  "scrap-yard": ["every", "cap"],
  // ── end support combat ──
  // ── aura paths ──
  "piercing-field": ["fraction"],
  "execution-field": ["bonus", "threshold"],
  harmonics: ["bonus"],
  // ── end aura paths ──
};

/** Kinds that belong to support towers (and Aura); every other kind belongs to attack towers and traps. */
export const SUPPORT_KINDS: ReadonlySet<SpecializationKind> = new Set<SupportSpecialization["kind"]>([
  "big-game", "lure", "field-rations", "advance", "compounding", "fuel-line", "clean-sheet", "investment", "reserve-cells",
  "prefab", "refit", "calibration", "triage", "salvage", "damage-control", "recharge", "shockwave", "overflow",
  "weak-point", "hunters-mark", "lingering-tag", "afterburn", "opening-salvo", "charged-rounds", "penetrator", "stagger",
  "spotting", "shred", "hollow-points", "shieldbreaker", "downlink", "flak-relay", "wing-tag", "nexus-resonance", "harmony",
  "diversity", "exposure-scan", "static-pulse", "afterimage", "cascade", "meltdown", "scrap-yard",
  "piercing-field", "execution-field", "harmonics",
]);

const COUNT = new Set([
  "every", "count", "maxPerSalvo", "min", "amount", "cap",
  // ── new towers: g1 (Attack+Control A) ──
  // ── end g1 ──
  // ── new towers: g2 (Control B) ──
  // ── end g2 ──
]);
const POSITIVE = new Set([
  "radius", "delay", "duration", "width", "extend", "max",
  // ── new towers: g1 (Attack+Control A) ──
  // ── end g1 ──
  // ── new towers: g2 (Control B) ──
  "cells",
  // ── end g2 ──
]);
const NON_NEGATIVE = new Set([
  "bonus", "bonusPerUnused", "boost",
  // ── new towers: g1 (Attack+Control A) ──
  // ── end g1 ──
  // ── new towers: g2 (Control B) ──
  // ── end g2 ──
]);
const PREDICATES: readonly DamagePredicate[] = ["heavy", "heavy-air", "armored", "isolated", "burning"];

function fieldError(field: string, value: unknown): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return `Specialization value '${field}' is missing or not finite.`;
  if (COUNT.has(field)) return Number.isInteger(value) && value >= 1 ? undefined : `Specialization value '${field}' must be a positive integer.`;
  if (POSITIVE.has(field)) return value > 0 ? undefined : `Specialization value '${field}' must be positive.`;
  if (NON_NEGATIVE.has(field)) return value >= 0 ? undefined : `Specialization value '${field}' must not be negative.`;
  // Every other field is a share: factor, fraction, carry, slow, threshold, percentages.
  return value > 0 && value <= 1 ? undefined : `Specialization value '${field}' must lie in (0, 1].`;
}

/** Problem description for a malformed specialization, or undefined. */
export function specializationError(spec: SpecializationSpec): string | undefined {
  const fields = FIELDS[spec.kind] as readonly string[] | undefined;
  if (!fields) return `Unknown specialization '${String(spec.kind)}'.`;
  if (spec.kind === "conditional-damage" && !PREDICATES.includes(spec.predicate))
    return `Unknown damage condition '${String(spec.predicate)}'.`;
  const values = spec as unknown as Record<string, unknown>;
  for (const key of Object.keys(values))
    if (key !== "kind" && key !== "predicate" && !fields.includes(key)) return `Unknown specialization value '${key}'.`;
  for (const field of fields) {
    const problem = fieldError(field, values[field]);
    if (problem) return problem;
  }
  return undefined;
}
