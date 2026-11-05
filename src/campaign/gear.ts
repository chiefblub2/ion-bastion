import { SIGNATURES } from "../content/arsenal";
import { pageOf } from "../core/tower-pages";
import type { ContentPack, TowerId } from "../core/types";
import { compose, discount, mapParam, mapTowers, only, scaleStat, upgradePrice, type PackFn } from "../run/transform";
import type { Arsenal } from "./arsenal";
// Campaign gear as a content-pack transform: Mk I–IV per the plan's table, Mk V the tower's signature mod.
/** Counts stay whole numbers (stacks, cap, jumps, cells, hp); the rest rounds to two decimals. */
const WHOLE = new Set(["stacks", "cap", "jumps", "cells", "hp"]);
const paramValue = (key: string, v: number) => (WHOLE.has(key) ? Math.round(v) : Math.round(v * 100) / 100);
const EARLY = (u: { id: string }) => u.id === "level-2" || u.id === "level-3";

function markSteps(id: TowerId, mark: number, page: number): PackFn[] {
  const which = only([id]),
    steps: PackFn[] = [];
  const at = (m: number, step: PackFn) => mark >= m && steps.push(step);
  if (page <= 1) {
    at(1, scaleStat("damage", 1.04, which));
    at(2, scaleStat("range", 1.05, which));
    at(3, upgradePrice(0.8, which, EARLY));
    at(4, scaleStat("damage", 1.08 / 1.04, which));
  } else if (page === 2) {
    at(1, scaleStat("damage", 1.04, which));
    at(2, upgradePrice(0.8, which, EARLY));
    at(3, scaleStat("damage", 1.08 / 1.04, which));
    at(4, discount(0.9, which));
  } else {
    at(1, scaleStat("range", 1.05, which));
    at(2, upgradePrice(0.8, which, EARLY));
    at(3, scaleStat("range", 1.1 / 1.05, which));
    at(4, discount(0.9, which));
  }
  if (mark >= 5) {
    const sig = SIGNATURES[id];
    if (!sig) steps.push(scaleStat(page === 3 ? "range" : "damage", page === 3 ? 1.05 : 1.04, which));
    else if ("hit" in sig) steps.push((pack) => mapTowers(pack, which, (t) => ({ ...t, signature: sig.hit })));
    else if ("stat" in sig) steps.push(scaleStat(sig.stat, sig.factor, which));
    else if ("bounty" in sig) steps.push((pack) => mapTowers(pack, which, (t) => ({ ...t, signatureBounty: sig.bounty })));
    else steps.push((pack) => mapParam(pack.towers[id].attack.kind, sig.param, (v) => paramValue(sig.param, v * sig.factor), which)(pack));
  }
  return steps;
}
/** The base pack with the arsenal's gear applied; the base pack itself when nothing is forged. */
export function gearPack(base: ContentPack, a: Pick<Arsenal, "gear">): ContentPack {
  const steps = (Object.entries(a.gear) as [TowerId, number][])
    .filter(([id, mark]) => mark > 0 && id in base.towers)
    .flatMap(([id, mark]) => markSteps(id, mark, pageOf(base.towers[id])));
  return steps.length ? compose(steps)(base) : base;
}
