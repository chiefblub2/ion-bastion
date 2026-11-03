import { DEFAULT_CONTENT } from "../content";
import { resolveUpgrades, type UpgradeProgress } from "../core/upgrades";
import type { SupportSpecialization } from "../core/specialization-types";
import type { AuraBonuses, ContentPack, Enemy, Point, Sim, TowerId } from "../core/types";
import type { Hit } from "./damage";
import { isSupport } from "./attacks";
import { dist } from "./path";
import { isSuppressed } from "./traits";

/**
 * Aura paths (levels 5 to 7, after any track's tier III). Each reaches only the towers its Aura supports: attack
 * towers in its radius, never support towers or traps. Overlapping Auras count the strongest per path, and a
 * suppressed Aura gives nothing. Derived on every query, like the track bonuses.
 */
type Special<K extends SupportSpecialization["kind"]> = Extract<SupportSpecialization, { kind: K }>;

/** Whether `source` is an Aura whose radius holds the attack tower `target` (a trap or support tower never). */
function supports(source: Point & { type: TowerId }, target: Point & { type: TowerId }, content: ContentPack) {
  const s = content.towers[source.type], t = content.towers[target.type];
  return s.attack.kind === "aura" && t.placement !== "path" && !isSupport(t.attack) && dist(source, target) <= s.range;
}

/** Calls `fn` with every unsuppressed Aura path `kind` that supports the live tower `id` (none for a sold one). */
function eachField<K extends "piercing-field" | "execution-field">(sim: Sim, kind: K, id: number | undefined, fn: (special: Special<K>) => void) {
  const target = id === undefined ? undefined : sim.state.towers.find((t) => t.id === id);
  if (!target) return;
  for (const source of sim.state.towers) {
    const special = resolveUpgrades(source, sim.content).specialization;
    if (special?.kind === kind && supports(source, target, sim.content) && !isSuppressed(sim, source)) fn(special as Special<K>);
  }
}

const harmonized = new WeakMap<object, AuraBonuses>();
/**
 * Harmonics: the bonuses an Aura gives an attack tower. With the path, the two stats of the tracks it did not take
 * get `bonus` each, never more than its own track bonus; without it exactly its track bonuses.
 */
export function harmonicBonuses(source: UpgradeProgress, content: ContentPack = DEFAULT_CONTENT): AuraBonuses {
  const resolved = resolveUpgrades(source, content);
  if (resolved.specialization?.kind !== "harmonics") return resolved.aura;
  let bonuses = harmonized.get(resolved);
  if (!bonuses) {
    const own = Math.max(resolved.aura.damage, resolved.aura.speed, resolved.aura.range),
      extra = Math.min(resolved.specialization.bonus, own),
      fill = (value: number) => (value > 0 ? value : extra);
    bonuses = Object.freeze({ damage: fill(resolved.aura.damage), speed: fill(resolved.aura.speed), range: fill(resolved.aura.range) });
    harmonized.set(resolved, bonuses);
  }
  return bonuses;
}
/** The bonuses an Aura gives `target`: Harmonics for attack towers, the plain track bonuses for a trap. */
export const fieldBonuses = (source: UpgradeProgress, target: { type: TowerId }, content: ContentPack = DEFAULT_CONTENT) =>
  content.towers[target.type].placement === "path" ? resolveUpgrades(source, content).aura : harmonicBonuses(source, content);

/** Piercing Field: share of armor that hits of the tower `tower` ignore; 0 without a supporting Aura on the path. */
export function fieldPierce(sim: Sim, tower?: number) {
  let best = 0;
  eachField(sim, "piercing-field", tower, (special) => (best = Math.max(best, special.fraction)));
  return best;
}

/** Execution Field: damage factor of a hit on an enemy below the threshold share of its HP, judged on impact; 1 otherwise. */
export function executionFactor(sim: Sim, e: Enemy, dot: boolean, hit?: Hit) {
  if (dot || !hit) return 1;
  let bonus = 0;
  eachField(sim, "execution-field", hit.tower, (special) => {
    if (e.hp < e.maxHp * special.threshold) bonus = Math.max(bonus, special.bonus);
  });
  return 1 + bonus;
}
