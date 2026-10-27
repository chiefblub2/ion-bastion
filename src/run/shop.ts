import type { ContentPack, TowerId } from "../core/types";
import { threatRules } from "./ascension";
import { hasFlag } from "./relics";
import { draw, streamOf } from "./rng";
import { addTower, changeReactor, doctrinePaths, gainRelic, priceOf, randomTower, relicOffers, type RunState, type ShopItem, type ShopKind } from "./state";
import { FUNDS, PATCH, PRICES, XP_BOUGHT } from "./tuning";
/**
 * Camp stock: a Shop sells repairs, funds, upgrades, a relic and a tower; a Forge sells Doctrines, drills, rank XP and
 * discounts. Stock is drawn from the seed and the node; prices rise with the threat level.
 */
export const SHOP_TEXT: Record<ShopKind, string> = {
  patch: `Reactor patch: +${PATCH} reactor energy.`,
  funds: `Field funds: +${FUNDS} starting credits in the next mission.`,
  drill: "Drill: a roster tower's level 2 costs 1 credit for the rest of the run.",
  discount: "Prototype discount: a roster tower costs 25% less for the rest of the run.",
  relic: "A relic.",
  tower: "A tower for your roster.",
  doctrine: "A Doctrine: unlock one specialization path (levels 6–8) of a roster tower.",
  xp: `Field drills: +${XP_BOUGHT} rank XP for a roster tower.`,
};
/** Items that need a roster tower as their target. */
export const TARGETED: ReadonlySet<ShopKind> = new Set(["drill", "discount", "doctrine", "xp"]);
export function shopStock(run: RunState, content: ContentPack, forge: boolean): ShopItem[] {
  const r = streamOf(run.seed, forge ? "forge" : "shop", run.act, run.column),
    item = (kind: ShopKind, base: number, extra: Partial<ShopItem> = {}): ShopItem => ({ kind, price: priceOf(run, base), ...extra });
  if (forge)
    return [item("doctrine", PRICES.doctrine), item("drill", PRICES.forgeDrill), item("xp", PRICES.xp), item("discount", PRICES.discount)];
  const stock: ShopItem[] = [item("funds", PRICES.funds)];
  if (!hasFlag(run.relics, "zealot")) stock.unshift(item("patch", PRICES.patch));
  const relic = relicOffers({ ...run, step: run.step + 1000 + run.column }, 1, content)[0],
    tower = randomTower(run, content, r() < 0.5 ? "rare" : "epic", ["shop", run.act, run.column]),
    extras: ShopItem[] = [item("drill", PRICES.drill)];
  if (relic) extras.push(item("relic", PRICES.relic, { relic }));
  if (tower) extras.push(item("tower", PRICES.tower, { tower }));
  return [...stock, ...draw(r, extras, 2)];
}
export interface Purchase {
  /** The roster tower a targeted item applies to, or the tower a bought tower replaces at the cap. */
  tower?: TowerId;
  /** Doctrine: the path. */
  path?: string;
}
/** Buys an item of the camp's stock; refuses (returns the run unchanged) when it is sold, too dear or lacks a target. */
export function buy(run: RunState, index: number, content: ContentPack, p: Purchase = {}): RunState {
  const stock = run.offers.shop,
    item = stock?.[index];
  if (run.phase !== "camp" || !stock || !item || item.sold || run.scrap < item.price) return run;
  if (TARGETED.has(item.kind) && (!p.tower || !run.roster.includes(p.tower))) return run;
  let next: RunState = run;
  switch (item.kind) {
    case "patch":
      if (run.reactor >= run.reactorMax) return run;
      next = changeReactor(run, Math.round(PATCH * threatRules(run.threat).repair));
      break;
    case "funds":
      next = { ...run, funds: (run.funds ?? 0) + FUNDS };
      break;
    case "drill":
    case "discount":
      if (run.mods.some((m) => m.tower === p.tower && m.kind === item.kind)) return run;
      next = { ...run, mods: [...run.mods, { tower: p.tower!, kind: item.kind }] };
      break;
    case "xp":
      next = { ...run, ranks: { ...run.ranks, [p.tower!]: (run.ranks[p.tower!] ?? 0) + XP_BOUGHT } };
      break;
    case "doctrine":
      if (!p.path || !doctrinePaths(run, p.tower!, content).includes(p.path)) return run;
      next = { ...run, doctrines: [...run.doctrines, `${p.tower}:${p.path}`] };
      break;
    case "relic":
      next = gainRelic(run, item.relic!);
      break;
    case "tower":
      next = addTower(run, item.tower!, p.tower);
      if (next === run) return run;
      break;
  }
  return { ...next, scrap: next.scrap - item.price, offers: { ...next.offers, shop: stock.map((s, i) => (i === index ? { ...s, sold: true } : s)) } };
}
