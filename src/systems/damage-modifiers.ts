import type { DamageSource, Enemy, Sim } from "../core/types";
import { isHeavy, type DamageOutcome, type Hit } from "./damage";
import type { DefenceBreakers } from "./traits";
import { hasTrait, layerOf } from "./traits";
import { damageTaken, hasStatus } from "./status";
import { armoryPierce, bountyBonus, markFactor, skylinkFactor } from "./support";
import { executionFactor, fieldPierce } from "./aura-paths";
import { protocolAfterHit, protocolFactor, protocolKill } from "./protocols";
import { critPierce, fireSupportAfterHit, fireSupportFactor } from "./fire-support-paths";
import { shieldbreakerBonus, targetPathsAfterHit, targetPathsFactor, weakPointPierce } from "./target-paths";
import { economyKill } from "./economy-paths";
import { recycleOverkill } from "./recycler";

/**
 * Everything that changes a hit besides the enemy's own traits: support effects, specializations, Aura paths and Run
 * protocols. `deal` (`damage.ts`) runs each hook over this list in order, so a new path or relic adds an entry here
 * instead of editing the pipeline. Hooks are optional; an entry that does not apply returns the neutral value (a
 * factor of 1, a share of 0) so boards without it play exactly as before.
 */
export interface DamageModifier {
  name: string;
  /** Factor on the incoming hit before an Amber shell stores it (Skylink). */
  incoming?(sim: Sim, src: DamageSource, e: Enemy, dot: boolean, hit?: Hit): number;
  /** Factor on the hit before armor; the factors multiply in list order. It may consume a one-shot mark. */
  factor?(sim: Sim, src: DamageSource, e: Enemy, dot: boolean, hit?: Hit): number;
  /** Share of the armor reduction the hit ignores; shares of different entries multiply with the hit's own Armor Pierce. */
  pierce?(sim: Sim, e: Enemy, hit?: Hit): number;
  /** Extra share a hit counts against shields. */
  shield?(sim: Sim, dot: boolean, hit?: Hit): number;
  /** After the hit changed HP and the enemy's traits answered it. */
  afterHit?(sim: Sim, src: DamageSource, e: Enemy, dot: boolean, hit?: Hit): void;
  /** Extra credits for a kill with base reward `reward` (not for sent enemies). */
  bounty?(sim: Sim, e: Enemy, reward: number): number;
  /** On a kill, after the reward, before the kill is counted. */
  onKill?(sim: Sim, e: Enemy): void;
  /** After the victim's own death effects (traits and statuses). */
  afterDeath?(sim: Sim, src: DamageSource, e: Enemy, outcome: DamageOutcome, hit?: Hit): void;
}

/** Conditional damage bonus of a specialization, judged on impact; `isolated` is judged at fire time instead. */
function conditionalFactor(sim: Sim, e: Enemy, hit?: Hit) {
  const special = hit?.special;
  if (special?.kind !== "conditional-damage") return 1;
  const applies = {
    heavy: () => isHeavy(e),
    "heavy-air": () => isHeavy(e) && layerOf(sim, e) === "air",
    armored: () => hasTrait(sim, e, "armor"),
    // Checked before the hit's own burn is applied, so only an earlier burn counts.
    burning: () => hasStatus(e, "burn", sim.state.time),
    isolated: () => false,
  }[special.predicate]();
  return applies ? 1 + special.bonus : 1;
}

/** The registry, in evaluation order. Wrappers keep the imports lazy: these modules import `damage.ts` in turn. */
export const DAMAGE_MODIFIERS: readonly DamageModifier[] = [
  { name: "skylink", incoming: (sim, src, e, dot, hit) => skylinkFactor(sim, src, e, dot, hit) },
  // Weakening and marking first, so armor absorbs a share of the amplified hit.
  { name: "status", factor: (sim, _src, e) => damageTaken(e, sim.state.time) },
  { name: "tracker", factor: (sim, _src, e) => markFactor(sim, e) },
  { name: "conditional-damage", factor: (sim, _src, e, _dot, hit) => conditionalFactor(sim, e, hit) },
  { name: "execution-field", factor: (sim, _src, e, dot, hit) => executionFactor(sim, e, dot, hit) },
  // An Armory and an Aura Piercing Field do not stack: the higher of the two counts.
  { name: "armory", pierce: (sim, _e, hit) => Math.max(armoryPierce(sim, hit?.tower), fieldPierce(sim, hit?.tower)) },
  {
    name: "protocols",
    factor: (sim, src, e, dot, hit) => protocolFactor(sim, src, e, dot, hit),
    afterHit: (sim, src, e, dot, hit) => protocolAfterHit(sim, src, e, dot, hit),
    afterDeath: (sim, _src, e) => protocolKill(sim, e),
  },
  {
    name: "fire-support-paths",
    factor: (sim, src, e, dot) => fireSupportFactor(sim, src, e, dot),
    pierce: (_sim, _e, hit) => critPierce(hit),
    afterHit: (sim, src, e, _dot, hit) => fireSupportAfterHit(sim, src, e, hit),
  },
  {
    name: "target-paths",
    factor: (sim, _src, e, dot, hit) => targetPathsFactor(sim, e, dot, hit),
    pierce: (sim, e) => weakPointPierce(sim, e),
    shield: (sim, dot, hit) => shieldbreakerBonus(sim, dot, hit),
    afterHit: (sim, _src, e, dot, hit) => targetPathsAfterHit(sim, e, dot, hit),
  },
  { name: "bounty-beacon", bounty: (sim, e, reward) => bountyBonus(sim, e, reward) },
  { name: "economy-paths", onKill: (sim, e) => economyKill(sim, e) },
  { name: "recycler", afterDeath: (sim, src, e, outcome, hit) => recycleOverkill(sim, src, e, outcome, hit) },
];

type Hook = keyof Omit<DamageModifier, "name">;
const having = <K extends Hook>(hook: K) => DAMAGE_MODIFIERS.filter((m) => m[hook]).map((m) => m[hook]!) as NonNullable<DamageModifier[K]>[];
/** Each hook's entries in order, so `deal` skips the entries without it. */
export const HOOKS = {
  incoming: having("incoming"),
  factor: having("factor"),
  pierce: having("pierce"),
  shield: having("shield"),
  afterHit: having("afterHit"),
  bounty: having("bounty"),
  onKill: having("onKill"),
  afterDeath: having("afterDeath"),
};

/** What the `armor` and `shield` traits read from the registry; passed in by `deal`, so traits import none of these modules. */
export const DEFENCE_BREAKERS: DefenceBreakers = {
  /**
   * The share of the armor reduction a hit ignores: the hit's own Armor Pierce combined with every registry share;
   * shares multiply, never add. Without a registry share the hit's own value stays exactly as it is.
   */
  pierce(sim, e, hit) {
    const special = hit?.special?.kind === "armor-pierce" ? hit.special.fraction : 0;
    let rest = 1 - special,
      any = false;
    for (const pierce of HOOKS.pierce) {
      const share = pierce(sim, e, hit);
      if (share) any = true;
      rest *= 1 - share;
    }
    return any ? 1 - rest : special;
  },
  /** How many times a hit counts against a shield: 1 plus every registry share. */
  shieldBoost(sim, dot, hit) {
    let extra = 0;
    for (const shield of HOOKS.shield) extra += shield(sim, dot, hit);
    return 1 + extra;
  },
};
