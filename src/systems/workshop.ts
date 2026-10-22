import { dist } from "./path";
import { DEFAULT_CONTENT } from "../content";
import { resolveUpgrades } from "../core/upgrades";
import type { ContentPack, GameEvent, Point, Tower } from "../core/types";
type Placed = Point & { id: number; type: Tower["type"] };
/**
 * Workshop: the strongest discount (0 to 1) on upgrades of `tower`, from Workshops whose range covers it.
 * Workshops never discount themselves or each other. A pure query over the tower list, so purchases, buttons
 * and tooltips agree; like the other support effects it is derived on every call.
 */
export function upgradeDiscount(tower: Placed, towers: readonly Tower[], content: ContentPack = DEFAULT_CONTENT): number {
  if (content.towers[tower.type].attack.kind === "discount") return 0;
  let best = 0;
  for (const t of towers) {
    const r = resolveUpgrades(t, content);
    if (r.attack.kind !== "discount" || dist(t, tower) > r.stats.range) continue;
    best = Math.max(best, r.attack.amount);
  }
  return best;
}
/** Upgrade price after a discount: whole credits, at least 1. */
export const discountedCost = (cost: number, discount: number) => (discount > 0 ? Math.max(1, Math.round(cost * (1 - discount))) : cost);
/** The Workshop that gives `tower` its discount, for the spark from it to the upgraded tower; undefined without one. */
export function discountEvent(tower: Placed, towers: readonly Tower[], saved: number, content: ContentPack = DEFAULT_CONTENT): GameEvent | undefined {
  const discount = upgradeDiscount(tower, towers, content);
  if (saved <= 0 || discount <= 0) return undefined;
  const source = towers.find((t) => {
    const r = resolveUpgrades(t, content);
    return r.attack.kind === "discount" && r.attack.amount === discount && dist(t, tower) <= r.stats.range;
  })!;
  return { type: "discount", from: { x: source.x, y: source.y }, at: { x: tower.x, y: tower.y }, amount: saved, color: content.towers[source.type].color };
}
