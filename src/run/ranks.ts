import type { TowerId } from "../core/types";
import { isSpecialization } from "../core/upgrades";
import { compose, only, scaleStat, upgradePrice, type PackFn } from "./transform";
import { RANK_XP } from "./tuning";
/**
 * Tower ranks: every tower type the player fields earns XP across the run (kills, and a bonus for being built), and
 * its rank makes that type stronger for the rest of the run. What you build early compounds.
 */
export const MAX_RANK = RANK_XP.length;
export const rankOf = (xp = 0) => RANK_XP.filter((t) => xp >= t).length;
/** XP still missing to the next rank, or undefined at the top. */
export const nextRankAt = (xp = 0) => RANK_XP.find((t) => xp < t);
export const RANK_TEXT: readonly string[] = [
  "No bonus yet.",
  "+5% damage.",
  "+5% damage, +5% range.",
  "+5% damage, +5% range, levels 2–3 cost 30% less.",
  "+15% damage, +5% range, levels 2–3 and its first Doctrine tier cost 30% less.",
];
/** The pack transform for one tower type at a rank; traps and support towers profit through the range and price steps. */
export function rankTransform(id: TowerId, rank: number): PackFn {
  const which = only([id]),
    steps: PackFn[] = [];
  if (rank >= 1) steps.push(scaleStat("damage", rank >= 4 ? 1.15 : 1.05, which));
  if (rank >= 2) steps.push(scaleStat("range", 1.05, which));
  if (rank >= 3) steps.push(upgradePrice(0.7, which, (u) => u.id === "level-2" || u.id === "level-3"));
  if (rank >= 4) steps.push(upgradePrice(0.7, which, (u) => isSpecialization(u) && u.requires.includes("level-5")));
  return compose(steps);
}
