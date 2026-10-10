/**
 * Specialization abilities of attack towers (levels 6 to 8). Each tier carries the complete
 * values of its ability; a later tier of the same path replaces the earlier one.
 */
export type DamagePredicate = "heavy" | "heavy-air" | "armored" | "isolated" | "burning";

export type SpecializationSpec =
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
  | { kind: "exposed-target"; bonus: number };

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
};

const COUNT = new Set(["every", "count", "maxPerSalvo"]);
const POSITIVE = new Set(["radius", "delay", "duration", "width"]);
const NON_NEGATIVE = new Set(["bonus", "bonusPerUnused"]);
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
