import { credit } from "../core/economy";
import { resolveUpgrades } from "../core/upgrades";
import type { DamageSource, Enemy, Point, Sim, Tower } from "../core/types";
import type { SupportSpecialization } from "../core/specialization-types";
import { plain, type DamageOutcome, type Hit } from "./damage";
import { dist } from "./path";
import { applyStatus, BURN_TICK } from "./status";
import { strongestSpecial, withSpecial } from "./support";
import { hasTrait, inCloakField } from "./traits";
import { jumpOverkill, type Recycler } from "./recycler";
/**
 * Support combat paths, part A: Tracker (Weak Point, Hunter's Mark, Lingering Tag), Detector (Exposure Scan,
 * Static Pulse, Afterimage), Recycler (Cascade, Meltdown, Scrap Yard) and Armory (Shred, Hollow Points,
 * Shieldbreaker). Every effect is derived from the towers per query, except the few per-enemy expiries
 * (`Enemy.tag`, `Enemy.revealUntil`) and the Scrap Yard counter (`Tower.scrapYard`), which stay absent until used.
 * Overlap: per path only the strongest tower in reach counts.
 */
type Of<K extends SupportSpecialization["kind"]> = Extract<SupportSpecialization, { kind: K }>;

/** The strongest living enemy within `range` of `at`: highest max HP, then most path progress, then lowest id. */
export function strongestEnemy(sim: Sim, at: Point, range: number, accept: (e: Enemy) => boolean = () => true) {
  let best: Enemy | undefined;
  for (const e of sim.state.enemies) {
    if (e.hp <= 0 || dist(e, at) > range || !accept(e)) continue;
    if (!best || e.maxHp > best.maxHp || (e.maxHp === best.maxHp && (e.distance > best.distance || (e.distance === best.distance && e.id < best.id)))) best = e;
  }
  return best;
}
/** The firing tower of a hit (it may be sold: then no Armory path applies, like `armoryPierce`). */
const firingTower = (sim: Sim, hit?: Hit) => (hit?.tower === undefined ? undefined : sim.state.towers.find((t) => t.id === hit.tower));

// ── Tracker ──
/** Weak Point: share of the armor reduction a marked enemy loses; 0 outside every Weak Point Tracker. */
export const weakPointPierce = (sim: Sim, e: Enemy) => strongestSpecial(sim, "weak-point", "fraction", e);
/**
 * The mark an enemy carries: the strongest Tracker's `base` amount or a running Lingering Tag, whichever is higher,
 * plus Hunter's Mark when it is the strongest enemy in a Hunter's Mark Tracker's radius. Without paths: `base`.
 */
export function trackerMark(sim: Sim, e: Enemy, base: number) {
  const tag = e.tag && sim.state.time < e.tag.until ? e.tag.amount : 0;
  let hunters = 0;
  withSpecial(sim, "hunters-mark", e, (special, t, range) => {
    if (special.bonus > hunters && strongestEnemy(sim, t, range) === e) hunters = special.bonus;
  });
  return Math.max(base, tag) + hunters;
}
/** Lingering Tag: enemies in reach carry the Tracker's mark for `duration` seconds after they leave. */
function tickLingeringTags(sim: Sim) {
  const time = sim.state.time;
  for (const e of sim.state.enemies) if (e.tag && time >= e.tag.until) delete e.tag;
  withSpecial(sim, "lingering-tag", undefined, (special, t, range) => {
    const attack = resolveUpgrades(t, sim.content).attack;
    if (attack.kind !== "mark") return;
    const amount = attack.amount,
      until = time + special.duration;
    for (const e of sim.state.enemies) {
      if (e.hp <= 0 || dist(e, t) > range) continue;
      if (!e.tag || amount > e.tag.amount) e.tag = { amount, until };
      else if (amount === e.tag.amount) e.tag.until = Math.max(e.tag.until, until);
    }
  });
}

// ── Detector ──
/** A stealth unit (stealthed, or inside another enemy's cloak field) that a detector has revealed. */
const revealedStealth = (sim: Sim, e: Enemy) => !!e.revealed && (hasTrait(sim, e, "stealth") || inCloakField(sim, e));
/** Exposure Scan: damage factor of a revealed stealth unit inside an Exposure Scan Detector's radius; 1 otherwise. */
const exposureFactor = (sim: Sim, e: Enemy) => (revealedStealth(sim, e) ? 1 + strongestSpecial(sim, "exposure-scan", "bonus", e) : 1);
/** Afterimage: whether a reveal still lingers on the enemy. */
export const afterimageHolds = (sim: Sim, e: Enemy) => e.revealUntil !== undefined && sim.state.time < e.revealUntil;
/** Afterimage: revealed stealth units inside an Afterimage Detector stay revealed `duration` seconds after leaving. */
function tickAfterimages(sim: Sim) {
  const time = sim.state.time;
  for (const e of sim.state.enemies) if (e.revealUntil !== undefined && time >= e.revealUntil) delete e.revealUntil;
  withSpecial(sim, "afterimage", undefined, (special, t, range) => {
    const until = time + special.duration;
    for (const e of sim.state.enemies)
      if (e.hp > 0 && dist(e, t) <= range && revealedStealth(sim, e)) e.revealUntil = Math.max(e.revealUntil ?? -Infinity, until);
  });
}
/** Static Pulse: the stronger of two pulses (shorter interval, then longer disruption, then the older tower). */
const strongerPulse = (a: { special: Of<"static-pulse">; tower: Tower }, b: { special: Of<"static-pulse">; tower: Tower }) =>
  a.special.every !== b.special.every ? a.special.every < b.special.every : a.special.duration !== b.special.duration ? a.special.duration > b.special.duration : a.tower.id < b.tower.id;
/**
 * Static Pulse: on the shared clock grid (every `every` seconds of `state.time`) each Static Pulse Detector disrupts
 * the strongest enemy in its radius for `duration` seconds. An enemy only answers to the strongest pulse reaching it,
 * so overlapping Detectors never stack their rhythms.
 */
function tickStaticPulses(sim: Sim, dt: number) {
  const time = sim.state.time,
    pulses: { special: Of<"static-pulse">; tower: Tower; range: number }[] = [];
  withSpecial(sim, "static-pulse", undefined, (special, tower, range) => pulses.push({ special, tower, range }));
  if (!pulses.length) return;
  const strongestAt = (e: Enemy) => {
    let best: (typeof pulses)[number] | undefined;
    for (const p of pulses) if (dist(e, p.tower) <= p.range && (!best || strongerPulse(p, best))) best = p;
    return best;
  };
  for (const p of pulses) {
    if (Math.floor(time / p.special.every) <= Math.floor((time - dt) / p.special.every)) continue;
    const target = strongestEnemy(sim, p.tower, p.range, (e) => strongestAt(e) === p);
    if (!target) continue;
    applyStatus(sim, target, { kind: "disrupted", until: time + p.special.duration });
    sim.state.events.push({ type: "pulse", at: { x: target.x, y: target.y }, radius: 0.5, color: sim.content.towers[p.tower.type].color });
  }
}

// ── Recycler ──
/**
 * After a Recycler jump from `victim`: Cascade passes the jump's own overkill on once more, Meltdown sets the jump's
 * target alight. Both read the strongest tower of their path whose radius covers the kill.
 */
export function recyclerPaths(sim: Sim, src: DamageSource, victim: Enemy, jump: { target: Enemy; amount: number; outcome?: DamageOutcome }, recycler: Recycler) {
  const { target, amount, outcome } = jump;
  if (outcome?.killed && outcome.overkill > 0 && Number.isFinite(outcome.overkill)) {
    const factor = strongestSpecial(sim, "cascade", "factor", victim);
    // The second jump is of kind `overkill` too, so it never cascades again.
    if (factor > 0) jumpOverkill(sim, src, target, outcome.overkill * factor, recycler.reach, recycler.color);
  }
  if (target.hp <= 0) return;
  let melt: Of<"meltdown"> | undefined;
  withSpecial(sim, "meltdown", victim, (special) => {
    if (!melt || special.factor > melt.factor || (special.factor === melt.factor && special.duration > melt.duration)) melt = special;
  });
  if (!melt) return;
  const time = sim.state.time;
  applyStatus(sim, target, { kind: "burn", dps: (amount * melt.factor) / melt.duration, next: time + BURN_TICK, until: time + melt.duration, source: plain(src) });
}
/** Scrap Yard: every kill in its radius adds its overkill; each `every` of it pays the owner 1 credit, up to `cap` per wave. */
export function scrapYard(sim: Sim, victim: Enemy, outcome: DamageOutcome) {
  const overkill = outcome.overkill;
  if (!(overkill > 0) || !Number.isFinite(overkill)) return;
  let best: { special: Of<"scrap-yard">; tower: Tower } | undefined;
  withSpecial(sim, "scrap-yard", victim, (special, tower) => {
    if (!best || special.every < best.special.every || (special.every === best.special.every && special.cap > best.special.cap)) best = { special, tower };
  });
  if (!best) return;
  const { special, tower } = best,
    yard = (tower.scrapYard ??= { overkill: 0, paid: 0 });
  if (yard.paid >= special.cap) return;
  yard.overkill += overkill;
  const pay = Math.min(special.cap - yard.paid, Math.floor(yard.overkill / special.every));
  if (pay <= 0) return;
  yard.overkill -= pay * special.every;
  yard.paid += pay;
  credit(sim.state, tower.owner, pay);
  sim.state.events.push({ type: "income", at: { x: tower.x, y: tower.y }, amount: pay, color: sim.content.towers[tower.type].color });
}
/** At wave end: the Scrap Yard counters start over. */
export function resetScrapYards(sim: Sim) {
  for (const t of sim.state.towers) delete t.scrapYard;
}

// ── Armory ──
/** Shieldbreaker: extra damage share a hit deals to shields; 0 for dots and towers outside every Shieldbreaker Armory. */
export function shieldbreakerBonus(sim: Sim, dot: boolean, hit?: Hit) {
  const t = dot ? undefined : firingTower(sim, hit);
  return t ? strongestSpecial(sim, "shieldbreaker", "bonus", t) : 0;
}
/** Hollow Points: damage factor of a hit on an unarmored enemy by a tower in a Hollow Points Armory's radius. */
function hollowFactor(sim: Sim, e: Enemy, dot: boolean, hit?: Hit) {
  const t = dot ? undefined : firingTower(sim, hit);
  return t && !hasTrait(sim, e, "armor") ? 1 + strongestSpecial(sim, "hollow-points", "bonus", t) : 1;
}
/** Shred: a hit by a tower in a Shred Armory's radius strips part of the armor of a surviving armored target. */
function shred(sim: Sim, e: Enemy, dot: boolean, hit?: Hit) {
  if (dot || e.hp <= 0) return;
  const t = firingTower(sim, hit);
  if (!t) return;
  let best: Of<"shred"> | undefined;
  withSpecial(sim, "shred", t, (special) => {
    if (!best || special.fraction > best.fraction || (special.fraction === best.fraction && special.duration > best.duration)) best = special;
  });
  if (best && hasTrait(sim, e, "armor")) applyStatus(sim, e, { kind: "armorDissolved", fraction: best.fraction, until: sim.state.time + best.duration });
}

// ── hooks ──
/** Damage factor of these paths in `deal` (Exposure Scan, Hollow Points); exactly 1 on a board without them. */
export const combatPathsFactor = (sim: Sim, e: Enemy, dot: boolean, hit?: Hit) => exposureFactor(sim, e) * hollowFactor(sim, e, dot, hit);
/** After a hit changed HP (Shred). */
export const combatPathsAfterHit = (sim: Sim, e: Enemy, dot: boolean, hit?: Hit) => shred(sim, e, dot, hit);
/** Once per tick right after detection: lingering marks and reveals, Static Pulse. */
export function tickCombatPathsA(sim: Sim, dt: number) {
  tickLingeringTags(sim);
  tickAfterimages(sim);
  tickStaticPulses(sim, dt);
}
