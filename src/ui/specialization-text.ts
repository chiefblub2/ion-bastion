import type { SpecializationSpec } from "../core/types";

/** One displayable value of a specialization, like the rows of `describeAttack`. */
export interface SpecializationValue {
  key: string;
  label: string;
  value: number;
  unit: string;
}

const SHARE = { unit: "%", scale: 100 };
const CELLS = { unit: " cells", scale: 1 };
const SECONDS = { unit: " s", scale: 1 };
const PLAIN = { unit: "", scale: 1 };
const FIELDS: Record<string, { label: string; unit: string; scale: number }> = {
  bonus: { label: "Bonus damage", ...SHARE },
  fraction: { label: "Armor ignored", ...SHARE },
  every: { label: "Every nth shot", ...PLAIN },
  radius: { label: "Radius", ...CELLS },
  factor: { label: "Damage share", ...SHARE },
  count: { label: "Extra targets", ...PLAIN },
  slow: { label: "Slow", ...SHARE },
  duration: { label: "Duration", ...SECONDS },
  maxPerSalvo: { label: "Max per shot", ...PLAIN },
  remainingFactor: { label: "Burn passed on", ...SHARE },
  threshold: { label: "Below HP", ...SHARE },
  extraPercent: { label: "Extra max HP damage", ...SHARE },
  maxHpPercent: { label: "Max HP damage", ...SHARE },
  hitCapFactor: { label: "Cap (share of hit)", ...SHARE },
  carry: { label: "Stacks kept", ...SHARE },
  width: { label: "Half-width", ...CELLS },
  delay: { label: "Delay", ...SECONDS },
  bonusPerUnused: { label: "Bonus per unused shard", ...SHARE },
  min: { label: "Min. effects", ...PLAIN },
  extend: { label: "Extension per hit", ...SECONDS },
  max: { label: "Longest effect", ...SECONDS },
  // ── new towers: g1 (Attack+Control A) ──
  // ── end g1 ──
  // ── new towers: g2 (Control B) ──
  share: { label: "Damage shared", ...SHARE },
  cells: { label: "Knockback", ...CELLS },
  // ── end g2 ──
};
/** Labels that read differently for one kind. */
const OVERRIDES: Partial<Record<SpecializationSpec["kind"], Record<string, string>>> = {
  frostburst: { factor: "Slowed speed" },
  "brittle-ice": { bonus: "Damage taken" },
  "weak-signal": { bonus: "Damage taken" },
  "exposed-target": { bonus: "Damage taken" },
  fracture: { bonus: "Damage taken" },
  compression: { bonus: "Damage taken" },
  "temporal-exposure": { bonus: "Damage taken" },
  "armor-dissolver": { fraction: "Armor removed" },
  "pool-dissolve": { fraction: "Armor removed" },
  "pool-slow": { factor: "Slowed speed" },
  eruption: { factor: "Eruption (share of burn)" },
  // ── new towers: g1 (Attack+Control A) ──
  cluster: { count: "Bomblets", radius: "Bomblet reach", factor: "Bomblet damage" },
  "mass-trance": { count: "Extra enemies" },
  "mind-break": { bonus: "Damage taken" },
  "shatter-splash": { factor: "Shard damage (share)" },
  lodestone: { factor: "Slowed speed" },
  // ── end g1 ──
  // ── new towers: g2 (Control B) ──
  whiplash: { duration: "Stun" },
  "brittle-frame": { bonus: "Damage taken" },
  "hex-spread": { count: "Curses passed on" },
  doom: { threshold: "Kills below HP" },
  "siphon-fork": { count: "Extra beams" },
  "power-tap": { bonus: "Damage per enemy" },
  // ── end g2 ──
};
const PREDICATES = { heavy: "heavy targets", "heavy-air": "heavy flyers", armored: "armored enemies", isolated: "a lone target", burning: "burning enemies" };

/** Display rows of a specialization's numeric values. */
export function specializationValues(spec: SpecializationSpec | undefined): SpecializationValue[] {
  if (!spec) return [];
  return Object.entries(spec)
    .filter(([key]) => key !== "kind" && key !== "predicate")
    .map(([key, value]) => {
      const field = FIELDS[key] ?? { label: key, ...PLAIN };
      const label = OVERRIDES[spec.kind]?.[key] ?? (key === "bonus" && spec.kind === "conditional-damage" ? `Bonus vs. ${PREDICATES[spec.predicate]}` : field.label);
      return { key, label, value: (value as number) * field.scale, unit: field.unit };
    });
}
