import { availableTowers } from "../core/game";
import type { ContentPack, EnemyDefinition, EnemyId, MissionDefinition, TowerId, TraitKind } from "../core/types";
import { answers, type Need, needsOf } from "../run/threats";
import { type Arsenal, owns, researchPrice } from "./arsenal";
// The debrief's loss tip, from what leaked: a counter the player owns but left at home, else the cheapest one to
// research, else a hint on the enemy itself, else the credits left unspent.

export type TipKind = "counter" | "research" | "enemy" | "credits" | "general";
export interface Tip {
  kind: TipKind;
  /** The enemy type that leaked most. */
  enemy?: EnemyId;
  /** The tower suggested (`counter`, `research`). */
  tower?: TowerId;
  /** Its research price in Salvage (`research`). */
  price?: number;
  text: string;
}

const DOES: Record<Need, string> = { air: "it hits flyers", detect: "it reveals stealth units", under: "it hits burrowed units" };
/** Hints keyed on traits, in priority order; each true for any enemy that carries the trait. */
const TRAIT_HINT: readonly [TraitKind, string][] = [
  ["armor", "armour absorbs a share of every hit: upgrade damage early or bring armour-breaking towers"],
  ["shield", "a shield soaks hits before the HP and refills when left alone: keep steady fire on them"],
  ["regen", "they regenerate: concentrate damage so they die before they heal back"],
  ["healer", "they heal the enemies around them: kill them first"],
  ["splitOnDeath", "they split when killed: keep damage behind the point where they fall"],
  ["swarm", "they toughen in packs: area damage hits the whole pack at once"],
  ["evade", "they dodge every few hits: fast-firing towers waste less"],
  ["slowImmune", "slows do not work on them: spend on damage instead"],
  ["unstoppable", "nothing holds them back: spend on damage instead"],
  ["swift", "they are fast: slow them early so the towers get more shots"],
  ["sprint", "they sprint when hurt: finish them inside your strongest coverage"],
];
const fastCut = (content: ContentPack) => {
  const speeds = Object.values(content.enemies).map((e) => e.speed).sort((a, b) => a - b);
  return speeds[Math.floor(speeds.length / 2)] * 1.4;
};
function enemyHint(e: Readonly<EnemyDefinition>, content: ContentPack): string | undefined {
  const kinds = new Set((e.traits ?? []).map((t) => t.kind)),
    hint = TRAIT_HINT.find(([k]) => kinds.has(k))?.[1];
  if (hint) return hint;
  if (e.speed >= fastCut(content)) return "they are fast: slow them early so the towers get more shots";
  return undefined;
}
const leakText = (name: string, n: number) => `${name} leaked ${n}×.`;

/**
 * The loss tip. `leaks` counts leaked enemies per type (`MissionTally`), `fielded` the towers the mission offered,
 * `creditsLeft` the credits at the end, `built` the towers standing at the end (none: the credits hint asks for towers,
 * not upgrades). Ties between enemy types go to the one listed first in the content.
 */
export function lossTip(
  leaks: Readonly<Partial<Record<EnemyId, number>>>,
  mission: MissionDefinition,
  fielded: readonly TowerId[],
  arsenal: Arsenal,
  content: ContentPack,
  creditsLeft: number,
  built = 1,
): Tip {
  const order = Object.keys(content.enemies) as EnemyId[],
    enemy = order.filter((id) => (leaks[id] ?? 0) > 0).sort((a, b) => leaks[b]! - leaks[a]! || order.indexOf(a) - order.indexOf(b))[0];
  const credits = (): Tip | undefined =>
    creditsLeft > 0 ? { kind: "credits", ...(enemy && { enemy }), text: `${enemy ? leakText(content.enemies[enemy].name, leaks[enemy]!) + " " : ""}${built ? `◇${creditsLeft} unspent: upgrade earlier.` : `No towers were built, ◇${creditsLeft} unspent: build towers before calling the wave.`}` } : undefined;
  if (!enemy) return credits() ?? { kind: "general", text: "Cover the path with more towers and upgrade them before the late waves." };
  const def = content.enemies[enemy],
    head = leakText(def.name, leaks[enemy]!),
    allowed = availableTowers(mission, content),
    special = !!mission.availableTowers,
    covered = answers(fielded, content);
  for (const need of needsOf(def)) {
    if (covered[need].length) continue;
    const left = answers(allowed.filter((id) => !fielded.includes(id) && (special || owns(arsenal, id))), content)[need]
      .sort((a, b) => (arsenal.xp[b] ?? 0) - (arsenal.xp[a] ?? 0));
    if (left.length) {
      const tower = left[0];
      return { kind: "counter", enemy, tower, text: `${head} Field ${content.towers[tower].name} next time: ${DOES[need]}.` };
    }
    const research = answers(allowed.filter((id) => !owns(arsenal, id) && researchPrice(id) !== undefined), content)[need]
      .sort((a, b) => researchPrice(a)! - researchPrice(b)! || allowed.indexOf(a) - allowed.indexOf(b));
    if (research.length) {
      const tower = research[0],
        price = researchPrice(tower)!;
      return { kind: "research", enemy, tower, price, text: `${head} Research ${content.towers[tower].name} (${price} Salvage) in the Arsenal: ${DOES[need]}.` };
    }
  }
  const hint = enemyHint(def, content);
  if (hint) return { kind: "enemy", enemy, text: `${head} ${hint[0].toUpperCase()}${hint.slice(1)}.` };
  return credits() ?? { kind: "general", enemy, text: `${head} Add towers or upgrades where they walk.` };
}
