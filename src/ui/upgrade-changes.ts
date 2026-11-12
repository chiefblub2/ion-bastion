import { DEFAULT_CONTENT } from "../content";
import type { ContentPack, Tower, UpgradeDefinition } from "../core/types";
import { AURA_STATS, auraBonuses, effectiveTowerStats } from "../systems/auras";
import { describeAttack } from "../systems/attacks";
import { previewUpgrade, resolveUpgrades } from "../core/upgrades";
import { specializationValues } from "./specialization-text";
import { number } from "./format";
// What a purchase changes: the before → after values the tower card shows under each upgrade.

/** One value an upgrade changes; `before` is absent for a value the tower did not have yet (a first specialization tier). */
export interface UpgradeChange {
  label: string;
  before?: number;
  after: number;
  unit: string;
}

/** Every value a purchase of `upgrade` changes, with active Aura bonuses included on both sides. */
export function upgradeChanges(tower: Tower, towers: readonly Tower[], upgrade: UpgradeDefinition, content: ContentPack = DEFAULT_CONTENT): UpgradeChange[] {
  const nextTower = previewUpgrade(tower, upgrade.id, content) ?? tower;
  // Substitute the projected source too, so previews never mutate live towers.
  const nextTowers = towers.map(candidate => candidate.id === tower.id ? nextTower : candidate);
  const current = effectiveTowerStats(tower, towers, content);
  const next = effectiveTowerStats(nextTower, nextTowers, content);
  const currentAura = auraBonuses(tower, content), nextAura = auraBonuses(nextTower, content);
  const changedAttack = Object.keys(upgrade.effects.attack ?? {});
  const attackBefore = describeAttack(resolveUpgrades(tower, content).attack, changedAttack);
  const attackAfter = describeAttack(resolveUpgrades(nextTower, content).attack, changedAttack);
  return [
    ...(["damage", "range", "interval"] as const).filter(key => upgrade.effects.stats?.[key] !== undefined).map(key =>
      ({ label: ({damage: "Damage", range: "Range", interval: "Fire interval"})[key], before: current[key], after: next[key], unit: key === "interval" ? " s" : "" })),
    ...attackBefore.map((before, i) => ({ label: before.label, before: before.value, after: attackAfter[i].value, unit: before.unit })),
    ...AURA_STATS.filter(key => upgrade.effects.aura?.[key] !== undefined).map(key =>
      ({ label: ({damage: "Damage", speed: "Attack speed", range: "Range"})[key], before: currentAura[key] * 100, after: nextAura[key] * 100, unit: "%" })),
    ...specializationChanges(resolveUpgrades(tower, content).specialization, upgrade.effects.specialization),
  ];
}

/** "Damage 18 → 24"; a value the tower did not have yet reads "– → 3". */
export const changeText = (c: UpgradeChange) => `${c.label} ${c.before === undefined ? "–" : `${number(c.before)}${c.unit}`} → ${number(c.after)}${c.unit}`;

/** Before → after values of a specialization; a first tier compares against nothing. */
function specializationChanges(current: Parameters<typeof specializationValues>[0], next: Parameters<typeof specializationValues>[0]): UpgradeChange[] {
  const before = current?.kind === next?.kind ? specializationValues(current) : [];
  return specializationValues(next).map(after => ({ label: after.label, before: before.find(value => value.key === after.key)?.value, after: after.value, unit: after.unit }));
}
