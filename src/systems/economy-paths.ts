import { credit } from "../core/economy";
import { maxTowerLevel, resolveUpgrades, type UpgradeProgress } from "../core/upgrades";
import type { SupportSpecialization } from "../core/specialization-types";
import type { ContentPack, Enemy, GameEvent, Point, Sim, Tower, TowerEconomy, TowerId, WaveEconomy } from "../core/types";
import { isSupport } from "./attacks";
import { HEAVY_HP, isHeavy } from "./damage";
import { dist } from "./path";
import { applyStatus } from "./status";
import { isSuppressed, layerOf, resists } from "./traits";
/**
 * Paths of the economy support towers (levels 4 to 6): Bounty Beacon, Refinery, Vault, Workshop, Repair Dock and
 * Shield Generator. Every effect is derived from the towers on each query; overlapping towers on one path count only
 * the strongest (first built on a tie). Credits go to the paying tower's owner through `credit`, always flat and
 * capped per wave; reactor energy never rises above the mission's start value and is never restored on a ring.
 * Counters live in `Tower.economy` and `GameState.economy` and stay absent until a path uses them.
 */
type Kind = SupportSpecialization["kind"];
type Spec<K extends Kind> = Extract<SupportSpecialization, { kind: K }>;
/** Shockwave: seconds after its stun in which an enemy cannot be stunned again (the Stasis tower's recovery). */
const SHOCK_RECOVERY = 1.5;
/** Damage Control: share of the reactor's start value below which it boosts. */
const DAMAGE_CONTROL_BELOW = 0.5;
/** Salvage: repair points paid per wave at most. */
const SALVAGE_POINTS = 3;

const specOf = <K extends Kind>(t: UpgradeProgress, kind: K, content: ContentPack) => {
  const special = resolveUpgrades(t, content).specialization;
  return special?.kind === kind ? (special as Spec<K>) : undefined;
};
const color = (sim: Sim, t: Tower) => sim.content.towers[t.type].color;
const towerEconomy = (t: Tower): TowerEconomy => (t.economy ??= {});
const waveEconomy = (sim: Sim): WaveEconomy => (sim.state.economy ??= {});
const reactorRoom = (sim: Sim) => (sim.mission.circle ? 0 : Math.max(0, sim.mission.reactorEnergy - sim.state.lives));
/**
 * The tower holding `kind` with the largest `value` (first built on a tie); with `at` only unsuppressed towers whose
 * radius reaches it. A `value` of 0 or less never leads.
 */
function lead<K extends Kind>(sim: Sim, kind: K, value: (spec: Spec<K>, t: Tower) => number, at?: Point) {
  let best: { tower: Tower; spec: Spec<K>; value: number } | undefined;
  for (const t of sim.state.towers) {
    const resolved = resolveUpgrades(t, sim.content);
    if (resolved.specialization?.kind !== kind) continue;
    if (at && (dist(at, t) > resolved.stats.range || isSuppressed(sim, t))) continue;
    const spec = resolved.specialization as Spec<K>,
      v = value(spec, t);
    if (v > 0 && (!best || v > best.value)) best = { tower: t, spec, value: v };
  }
  return best;
}
function pay(sim: Sim, t: Tower, amount: number) {
  if (amount <= 0) return;
  credit(sim.state, t.owner, amount);
  sim.state.events.push({ type: "income", at: { x: t.x, y: t.y }, amount, color: color(sim, t) });
}
function restore(sim: Sim, t: Tower, amount: number) {
  const s = sim.state;
  s.lives += amount;
  s.events.push({ type: "repair", at: { x: t.x, y: t.y }, amount, color: color(sim, t) });
}

// ── Bounty Beacon ──
/** Lure: speed factor of an enemy inside the strongest luring Beacon; 1 without one or for slow-immune enemies. */
export function lureFactor(sim: Sim, e: Enemy) {
  const best = lead(sim, "lure", (spec) => spec.slow, e);
  return best && !resists(sim, e, "slow") ? 1 - best.spec.slow : 1;
}
/** After a kill: Big Game pays for heavy enemies and bosses, Field Rations counts the kill toward energy. */
export function economyKill(sim: Sim, e: Enemy) {
  const s = sim.state;
  const heavy = isHeavy(e) || sim.content.enemies[e.type].hp >= HEAVY_HP; // a type of heavy base HP is a boss
  // Enemies sent by an opponent in versus pay nothing, as their kill reward.
  const hunter = heavy && e.sentBy === undefined ? lead(sim, "big-game", (spec) => spec.amount, e) : undefined;
  if (hunter) {
    const paid = hunter.tower.economy?.bounty ?? 0,
      amount = Math.min(hunter.spec.amount, hunter.spec.cap - paid);
    if (amount > 0) {
      towerEconomy(hunter.tower).bounty = paid + amount;
      pay(sim, hunter.tower, amount);
    }
  }
  if (sim.mission.circle) return;
  const ration = lead(sim, "field-rations", (spec) => 1 / spec.every, e);
  if (!ration) return;
  const every = ration.spec.every;
  let count = (ration.tower.economy?.count ?? 0) + 1;
  if (count >= every && !s.economy?.rations && reactorRoom(sim) >= 1) {
    count = 0;
    waveEconomy(sim).rations = true;
    restore(sim, ration.tower, 1);
  }
  // A full counter waits for a wave with room; it never banks more than one point.
  setCount(ration.tower, Math.min(count, every));
}
function setCount(t: Tower, count: number) {
  if (count > 0) towerEconomy(t).count = count;
  else if (t.economy) {
    delete t.economy.count;
    if (!Object.keys(t.economy).length) delete t.economy;
  }
}

// ── Refinery ──
/** Advance: at a wave's start every Refinery on the path pays its share of the coming income. */
export function payAdvance(sim: Sim) {
  for (const t of sim.state.towers) {
    const spec = specOf(t, "advance", sim.content),
      attack = resolveUpgrades(t, sim.content).attack;
    if (!spec || attack.kind !== "income") continue;
    const amount = Math.min(spec.amount, attack.amount);
    towerEconomy(t).advanced = amount;
    pay(sim, t, amount);
  }
}
/** The income a Refinery pays after a wave: its amount minus what Advance paid at the start; `amount` without the path. */
export function incomeOf(t: Tower, amount: number) {
  const advanced = t.economy?.advanced;
  if (advanced === undefined) return amount;
  delete t.economy!.advanced;
  if (!Object.keys(t.economy!).length) delete t.economy;
  return amount - Math.min(amount, advanced);
}
/** Compounding, after the Refineries paid: every compounding Refinery counts the wave, the strongest pays its bonus. */
export function payCompounding(sim: Sim) {
  for (const t of sim.state.towers) if (specOf(t, "compounding", sim.content)) towerEconomy(t).waves = (t.economy?.waves ?? 0) + 1;
  const best = lead(sim, "compounding", (spec, t) => Math.min(spec.cap, spec.amount * (t.economy?.waves ?? 0)));
  if (best) pay(sim, best.tower, best.value);
}

// ── Vault ──
/** The credits a Vault's interest is computed on: the owner's wallet plus Investment Account's share of the wave's spending. */
export function interestBase(sim: Sim, t: Tower) {
  const s = sim.state,
    wallet = s.wallets[t.owner] ?? 0,
    spec = specOf(t, "investment", sim.content);
  return spec ? wallet + spec.share * (s.economy?.spent?.[t.owner] ?? 0) : wallet;
}
/** Investment Account: records credits spent on a build or upgrade while a wave runs, only for owners holding the path. */
export function noteSpending(sim: Sim, owner: number, amount: number) {
  const s = sim.state;
  if (amount <= 0 || s.status !== "wave") return;
  if (!s.towers.some((t) => t.owner === owner && specOf(t, "investment", sim.content))) return;
  const spent = (waveEconomy(sim).spent ??= s.wallets.map(() => 0));
  spent[owner] = (spent[owner] ?? 0) + amount;
}
/** Reserve Cells: interest paid by a Vault on the path counts toward energy, at most one point per settlement. */
export function reserveCells(sim: Sim, t: Tower, interest: number, restored: { done: boolean }) {
  const spec = specOf(t, "reserve-cells", sim.content);
  if (!spec || sim.mission.circle || interest <= 0) return;
  let count = (t.economy?.count ?? 0) + interest;
  if (count >= spec.every && !restored.done && reactorRoom(sim) >= 1) {
    restored.done = true;
    restore(sim, t, 1);
    count -= spec.every;
  }
  // Never banks more than one point.
  setCount(t, Math.min(count, spec.every));
}
/** Clean Sheet: after a wave without reactor damage each owner's strongest Clean Sheet Vault pays. */
export function payCleanSheet(sim: Sim) {
  if (sim.state.economy?.leaked) return;
  const best = new Map<number, { tower: Tower; amount: number }>();
  for (const t of sim.state.towers) {
    const spec = specOf(t, "clean-sheet", sim.content);
    if (spec && spec.amount > (best.get(t.owner)?.amount ?? 0)) best.set(t.owner, { tower: t, amount: spec.amount });
  }
  for (const { tower, amount } of best.values()) pay(sim, tower, amount);
}

// ── Workshop ──
type Placed = Point & UpgradeProgress;
/** Best Workshop value of `kind` reaching `at`; Workshops never count for one another. A pure query, like the upgrade discount. */
function workshopShare(kind: "prefab" | "refit", type: TowerId, at: Point, towers: readonly Placed[], content: ContentPack) {
  if (content.towers[type].attack.kind === "discount") return undefined;
  let best: { tower: Placed; share: number } | undefined;
  for (const t of towers) {
    const spec = specOf(t, kind, content);
    if (spec && dist(t, at) <= resolveUpgrades(t, content).stats.range && spec.share > (best?.share ?? 0)) best = { tower: t, share: spec.share };
  }
  return best;
}
/** Prefab: the price of building `type` at `at`, and the discount spark when a Workshop lowered it. */
export function buildPrice(type: TowerId, at: Point, towers: readonly Placed[], content: ContentPack): { price: number; event?: GameEvent } {
  const cost = content.towers[type].cost,
    best = workshopShare("prefab", type, at, towers, content);
  if (!best) return { price: cost };
  const price = Math.max(1, Math.round(cost * (1 - best.share)));
  if (price >= cost) return { price: cost };
  const from = { x: best.tower.x, y: best.tower.y };
  return { price, event: { type: "discount", from, at: { x: at.x, y: at.y }, amount: cost - price, color: content.towers[best.tower.type].color } };
}
/** Refit: the sale share a Workshop gives `tower`; 0 without one (the sale then keeps its normal share). */
export const refitShare = (tower: Placed, towers: readonly Placed[], content: ContentPack) =>
  workshopShare("refit", tower.type, tower, towers, content)?.share ?? 0;

// ── Combat boosts: Fuel Line, Damage Control, Calibration ──
const NO_BOOST = Object.freeze({ rate: 0, damage: 0 });
/**
 * Fire-rate and damage bonus of a tower from the economy paths: Fuel Line (Refinery) and Damage Control (Repair Dock)
 * speed up attack towers within their own radius, Calibration (Workshop) strengthens towers at their max level in its
 * radius. One pass over the towers; each path counts only its strongest tower, different paths multiply.
 */
export function economyBoost(sim: Sim, target: Placed): { rate: number; damage: number } {
  const d = sim.content.towers[target.type];
  if (isSupport(d.attack)) return NO_BOOST;
  let fuel = 0,
    control = 0,
    calibration = 0;
  for (const t of sim.state.towers) {
    const resolved = resolveUpgrades(t, sim.content),
      spec = resolved.specialization;
    if (!spec || (spec.kind !== "fuel-line" && spec.kind !== "damage-control" && spec.kind !== "calibration")) continue;
    if (isSuppressed(sim, t)) continue;
    if (spec.kind === "calibration") {
      if (dist(t, target) <= resolved.stats.range) calibration = Math.max(calibration, spec.bonus);
    } else if (d.placement !== "path" && dist(t, target) <= spec.radius) {
      if (spec.kind === "fuel-line") fuel = Math.max(fuel, spec.bonus);
      else if (!sim.mission.circle && sim.state.lives < sim.mission.reactorEnergy * DAMAGE_CONTROL_BELOW) control = Math.max(control, spec.bonus);
    }
  }
  if (calibration && resolveUpgrades(target, sim.content).level < maxTowerLevel(target.type, sim.content)) calibration = 0;
  if (!fuel && !control && !calibration) return NO_BOOST;
  return { rate: (1 + fuel) * (1 + control) - 1, damage: calibration };
}

// ── Repair Dock ──
/** Salvage: the strongest salvaging Dock pays for the repair points it could not use, at most `SALVAGE_POINTS`. */
export function salvage(sim: Sim, t: Tower, unused: number) {
  if (unused <= 0) return;
  const best = lead(sim, "salvage", (spec) => spec.amount);
  if (best?.tower === t) pay(sim, t, Math.min(SALVAGE_POINTS, unused) * best.spec.amount);
}
/** After reactor damage: Clean Sheet notes the leak, Triage refunds the wave's first damage at once. */
export function afterLeak(sim: Sim, leak: number) {
  const s = sim.state;
  if (s.towers.some((t) => specOf(t, "clean-sheet", sim.content))) waveEconomy(sim).leaked = true;
  const best = lead(sim, "triage", (spec) => spec.amount);
  if (!best) return;
  const used = s.economy?.triage ?? 0,
    refund = Math.min(leak, best.spec.amount - used, reactorRoom(sim));
  if (refund <= 0) return;
  waveEconomy(sim).triage = used + refund;
  restore(sim, best.tower, refund);
}

// ── Shield Generator ──
/** Shockwave: a hit absorbed by `takers` stuns ground enemies around the reactor (the longest stun among them). */
export function shockwave(sim: Sim, takers: readonly Tower[]) {
  let best: { tower: Tower; spec: Spec<"shockwave"> } | undefined;
  for (const t of takers) {
    const spec = specOf(t, "shockwave", sim.content);
    if (spec && spec.duration > (best?.spec.duration ?? 0)) best = { tower: t, spec };
  }
  const path = sim.mission.map.path;
  if (!best || sim.mission.map.loop || !path.length) return;
  const s = sim.state,
    reactor = path[path.length - 1],
    time = s.time;
  s.events.push({ type: "pulse", at: { x: reactor.x, y: reactor.y }, radius: best.spec.radius, color: color(sim, best.tower) });
  for (const e of [...s.enemies])
    if (e.hp > 0 && layerOf(sim, e) === "ground" && dist(e, reactor) <= best.spec.radius)
      applyStatus(sim, e, { kind: "stun", release: time + best.spec.duration, until: time + best.spec.duration + SHOCK_RECOVERY });
}
/** Overflow: the strongest overflowing generator pays for the absorb points it has left at the wave's end. */
export function payOverflow(sim: Sim, left: (t: Tower) => number) {
  const best = lead(sim, "overflow", (spec) => spec.amount);
  if (best) pay(sim, best.tower, left(best.tower) * best.spec.amount);
}
/** Recharge, every tick of a wave: the strongest recharging generator refills its charge on the `every` s wave-time grid. */
export function tickEconomy(sim: Sim, dt: number) {
  const s = sim.state;
  if (sim.mission.circle) return;
  const best = lead(sim, "recharge", (spec, t) => (t.barrier ? spec.amount : 0));
  if (!best) return;
  const step = (time: number) => Math.floor(time / best.spec.every + 1e-6);
  if (step(s.waveTime) <= step(s.waveTime - dt)) return;
  const t = best.tower,
    rest = Math.max(0, (t.barrier ?? 0) - best.spec.amount);
  if (rest > 0) t.barrier = rest;
  else delete t.barrier;
}

/** After a wave's settlement: the per-wave counters reset (Advance and the energy counters carry on). */
export function closeEconomyWave(sim: Sim) {
  delete sim.state.economy;
  for (const t of sim.state.towers) {
    if (t.economy?.bounty === undefined) continue;
    delete t.economy.bounty;
    if (!Object.keys(t.economy).length) delete t.economy;
  }
}
