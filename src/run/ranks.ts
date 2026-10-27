import type { MasteryEffect, TowerId } from "../core/types";
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
/**
 * Rank 4 mastery (a prototype for three tower types): beside the numbers, the type's hits gain a small effect that
 * none of its Doctrines grant, so a mastered tower plays a little differently and a Doctrine still decides its path.
 * These types take +10% damage at rank 4 instead of +15%, as the effect carries the rest.
 */
export const MASTERY: Partial<Record<TowerId, { name: string; text: string; effect: MasteryEffect }>> = {
  blast: { name: "Concussion", text: "Its blasts stun for 0.2 s (then 2 s immune).", effect: { kind: "stun", duration: 0.2, recovery: 2 } },
  tesla: { name: "Static Charge", text: "Its arcs slow enemies to 85% for 1 s.", effect: { kind: "slow", factor: 0.85, duration: 1 } },
  pulse: { name: "Tracer Rounds", text: "Its hits make the target take 6% more damage for 1.5 s.", effect: { kind: "vulnerable", amount: 0.06, duration: 1.5 } },
};
/** The rank text of a tower type, with its mastery at rank 4. */
export const rankText = (id: TowerId, rank: number) => {
  const m = MASTERY[id];
  return rank >= 4 && m ? `+10% damage, +5% range, cheaper levels 2–3 and first Doctrine tier; Mastery, ${m.name}: ${m.text}` : RANK_TEXT[rank];
};
/** The pack transform for one tower type at a rank; traps and support towers profit through the range and price steps. */
export function rankTransform(id: TowerId, rank: number): PackFn {
  const which = only([id]),
    steps: PackFn[] = [];
  if (rank >= 1) steps.push(scaleStat("damage", rank >= 4 ? (MASTERY[id] ? 1.1 : 1.15) : 1.05, which));
  if (rank >= 2) steps.push(scaleStat("range", 1.05, which));
  if (rank >= 3) steps.push(upgradePrice(0.7, which, (u) => u.id === "level-2" || u.id === "level-3"));
  if (rank >= 4) steps.push(upgradePrice(0.7, which, (u) => isSpecialization(u) && u.requires.includes("level-5")));
  return compose(steps);
}
