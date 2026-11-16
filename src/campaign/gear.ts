import { GEAR_MARKS, MAX_MARK, type MarkEffect, RANK_PASSIVE, SIGNATURES } from "../content/arsenal";
import type { ContentPack, MasteryEffect, TowerDefinition, TowerId, UpgradeDefinition } from "../core/types";
import { isSpecialization } from "../core/upgrades";
import { kindModule } from "../systems/attacks";
import { compose, discount, mapParam, mapTowers, only, price, scaleStat, upgradePrice, type PackFn } from "../run/transform";
import { type Arsenal, gearClassOf, veterancy } from "./arsenal";
// Campaign gear as a content-pack transform: Mk I–IV from `GEAR_MARKS` by tower class, Mk V the tower's signature
// mod, plus the veterancy rank's build-price passive.

/** Counts stay whole numbers (stacks, cap, jumps, cells, hp); the rest rounds to two decimals. */
const WHOLE = new Set(["stacks", "cap", "jumps", "cells", "hp"]);
const paramValue = (key: string, v: number) => (WHOLE.has(key) ? Math.round(v) : Math.round(v * 100) / 100);
/** The plain levels 2 and 3 (Aura: the first two tiers of each track), addressed by level, not by id. */
const isEarly = (u: UpgradeDefinition) => !isSpecialization(u) && (u.effects.level === 2 || u.effects.level === 3);

/** Which mark table a tower uses (defined in `campaign/arsenal.ts`, which also keys `XP_FIELDED` on it). */
export { gearClassOf };
/** The effects of a tower's Mk I–IV, in mark order (Mk V is its signature, `SIGNATURES`). */
export const markEffects = (t: Readonly<TowerDefinition>): readonly MarkEffect[] => GEAR_MARKS[gearClassOf(t)];

const effectKey = (e: MarkEffect) => ("stat" in e ? `stat:${e.stat}` : Object.keys(e)[0]);
function markSteps(t: Readonly<TowerDefinition>, mark: number): PackFn[] {
  const id = t.id as TowerId,
    which = only([id]),
    // Factors are totals: the latest mark of a kind replaces the earlier one.
    totals = new Map<string, MarkEffect>();
  for (const e of markEffects(t).slice(0, Math.min(mark, MAX_MARK - 1))) totals.set(effectKey(e), e);
  const steps: PackFn[] = [...totals.values()].map((e) =>
    "stat" in e
      ? scaleStat(e.stat, e.total, which, e.stat === "damage" ? 1 : undefined)
      : "early" in e
        ? upgradePrice(e.early, which, isEarly)
        : "paths" in e
          ? upgradePrice(e.paths, which, isSpecialization)
          : discount(e.build, which),
  );
  if (mark >= MAX_MARK) {
    const sig = SIGNATURES[id];
    if (!sig) return steps;
    if ("hit" in sig) steps.push((pack) => mapTowers(pack, which, (d) => ({ ...d, signature: sig.hit })));
    else if ("stat" in sig) steps.push(scaleStat(sig.stat, sig.factor, which));
    else if ("bounty" in sig) steps.push((pack) => mapTowers(pack, which, (d) => ({ ...d, signatureBounty: sig.bounty })));
    else steps.push((pack) => mapParam(pack.towers[id].attack.kind, sig.param, (v) => paramValue(sig.param, v * sig.factor), which)(pack));
  }
  return steps;
}
/** Build price at a veterancy rank: `RANK_PASSIVE.build` off per rank, and at least one credit per rank. */
export const rankPrice = (cost: number, rank: number) => (rank > 0 ? Math.max(1, Math.min(price(cost, 1 - RANK_PASSIVE.build * rank), cost - rank)) : cost);
const rankStep = (id: TowerId, rank: number): PackFn => (pack) => mapTowers(pack, only([id]), (t) => ({ ...t, cost: rankPrice(t.cost, rank) }));

/**
 * The base pack with the arsenal's gear and the ranks' build-price passive applied (any tower with XP, geared or
 * not); the base pack itself when neither changes anything.
 */
export function gearPack(base: ContentPack, a: Pick<Arsenal, "gear"> & Partial<Pick<Arsenal, "xp">>): ContentPack {
  const ids = [...new Set([...Object.keys(a.gear), ...Object.keys(a.xp ?? {})])].filter((id): id is TowerId => id in base.towers),
    steps = ids.flatMap((id) => {
      const mark = a.gear[id] ?? 0,
        rank = veterancy(a.xp?.[id]);
      return [...(mark > 0 ? markSteps(base.towers[id], mark) : []), ...(rank > 0 ? [rankStep(id, rank)] : [])];
    });
  return steps.length ? compose(steps)(base) : base;
}

/** One value a mark changes, before and after forging it; `unit` is appended to the number (" cells", " %", …). */
export interface MarkChange {
  label: string;
  before: number;
  after: number;
  unit: string;
}
const STAT_LABEL = { damage: ["Damage", ""], range: ["Range", " cells"], interval: ["Fire interval", " s"] } as const;
const CREDITS = " credits";
function hitChange(e: MasteryEffect): MarkChange {
  if (e.kind === "slow") return { label: "Hits slow", before: 0, after: Math.round((1 - e.factor) * 100), unit: " %" };
  if (e.kind === "stun") return { label: "Hits stun", before: 0, after: e.duration, unit: " s" };
  return { label: "Hits expose", before: 0, after: Math.round(e.amount * 100), unit: " % damage taken" };
}
/**
 * The real values forging Mk `mark` changes on tower `id` against Mk `mark - 1` (gear only, no rank passive): the
 * level-1 values first (build price, stats, attack values, signature); when none of those change, the first affected
 * upgrade prices, else the first affected upgrade values. Never empty for a real mark (`gear.test.ts`).
 */
export function markDelta(base: ContentPack, id: TowerId, mark: number): MarkChange[] {
  // Values as shown: rounding noise (2.7800000000000002) cut off.
  const clean = (c: MarkChange): MarkChange => ({ ...c, before: Math.round(c.before * 1e4) / 1e4, after: Math.round(c.after * 1e4) / 1e4 });
  return rawDelta(base, id, mark).map(clean);
}
function rawDelta(base: ContentPack, id: TowerId, mark: number): MarkChange[] {
  const of = (m: number) => (m > 0 ? gearPack(base, { gear: { [id]: m } }) : base).towers[id],
    b = of(mark - 1),
    a = of(mark),
    out: MarkChange[] = [];
  if (a.cost !== b.cost) out.push({ label: "Build price", before: b.cost, after: a.cost, unit: CREDITS });
  for (const stat of ["damage", "range", "interval"] as const)
    if (a[stat] !== b[stat]) out.push({ label: STAT_LABEL[stat][0], before: b[stat], after: a[stat], unit: STAT_LABEL[stat][1] });
  const params = kindModule(a.attack.kind).params as Record<string, { label: string; unit?: string; show?: (v: number) => number } | undefined>,
    av = a.attack as unknown as Record<string, unknown>,
    bv = b.attack as unknown as Record<string, unknown>;
  for (const key of Object.keys(av)) {
    const rule = params[key];
    if (!rule || typeof av[key] !== "number" || av[key] === bv[key]) continue;
    const show = rule.show ?? ((v: number) => v);
    out.push({ label: rule.label, before: show(bv[key] as number), after: show(av[key] as number), unit: rule.unit ?? "" });
  }
  if (a.signature && !b.signature) out.push(hitChange(a.signature));
  if (a.signatureBounty && !b.signatureBounty) out.push({ label: "Credits per kill", before: 0, after: a.signatureBounty, unit: "" });
  if (out.length) return out;
  const changed = a.upgrades.filter((u, i) => u.cost !== b.upgrades[i].cost);
  for (const u of changed.slice(0, 3)) out.push({ label: `${u.label} price`, before: b.upgrades[a.upgrades.indexOf(u)].cost, after: u.cost, unit: CREDITS });
  if (out.length) return out;
  a.upgrades.some((u, i) => {
    const was = b.upgrades[i];
    for (const stat of ["damage", "range", "interval"] as const) {
      const x = u.effects.stats?.[stat],
        y = was.effects.stats?.[stat];
      if (x !== undefined && y !== undefined && x !== y) out.push({ label: `${u.label}: ${STAT_LABEL[stat][0]}`, before: y, after: x, unit: STAT_LABEL[stat][1] });
    }
    const ua = u.effects.attack as Record<string, unknown> | undefined,
      ub = was.effects.attack as Record<string, unknown> | undefined;
    for (const key of Object.keys(ua ?? {})) {
      const rule = params[key];
      if (!rule || typeof ua![key] !== "number" || ua![key] === ub?.[key]) continue;
      const show = rule.show ?? ((v: number) => v);
      out.push({ label: `${u.label}: ${rule.label}`, before: show(ub?.[key] as number), after: show(ua![key] as number), unit: rule.unit ?? "" });
    }
    return out.length > 0;
  });
  return out;
}
