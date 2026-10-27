import { hasFlag } from "./relics";
import type { RunOffers, RunState } from "./state";
/**
 * The reward screens show one decision at a time. Which one, and how far along, follows from the pending offers
 * alone: a tower draft, the regular relic, the elite prize, then the Doctrine. At an act transition the legendary
 * relic and the Doctrine exclude each other, so they are one decision ("act"), unless Master License grants both.
 */
export type RewardStep = "towers" | "relics" | "prize" | "act" | "legendary" | "doctrine";
export function rewardSteps(run: Pick<RunState, "offers" | "relics">): RewardStep[] {
  const o = run.offers,
    out: RewardStep[] = [];
  if (o.towers) out.push("towers");
  if (o.relics) out.push("relics");
  if (o.prize) out.push("prize");
  if (o.legendary && o.doctrine && !hasFlag(run.relics, "master")) out.push("act");
  else {
    if (o.legendary) out.push("legendary");
    if (o.doctrine) out.push("doctrine");
  }
  return out;
}
/** The decisions a fresh set of offers holds, stored with them so the screens can count "Reward 2 of 3". */
export const withSteps = (run: Pick<RunState, "relics">, offers: RunOffers): RunOffers => {
  const n = rewardSteps({ offers, relics: run.relics }).length;
  return n > 1 ? { ...offers, steps: n } : offers;
};
/** Where the player stands: the current decision's number and the total (older saves without `steps` count what is left). */
export function rewardProgress(run: Pick<RunState, "offers" | "relics">) {
  const left = rewardSteps(run).length,
    total = Math.max(run.offers.steps ?? left, left);
  return { index: Math.min(total, total - left + 1), total };
}
