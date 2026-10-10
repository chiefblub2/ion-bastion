import type { ContentPack, Enemy, EnemyId, Point, Sim, StatusKind, Trait, TraitKind, UnitLayer } from "../core/types";
import { isSupport } from "./attacks";
import type { Hit } from "./damage";
import { dist } from "./path";
import { createEnemy } from "./spawn";
import { hasStatus } from "./status";
/** Spacing in cells between enemies released by `splitOnDeath`. */
const SPLIT_SPACING = 0.15;
interface TraitModule<T extends Trait> {
  /** Error message when the trait is malformed. */
  validate(trait: T, content: ContentPack): string | undefined;
  /** Returns the damage that actually lands. `dot`: a burn step, not a hit. */
  onDamage?(trait: T, amount: number, enemy: Enemy, sim: Sim, dot: boolean, hit?: Hit): number;
  /** After a hit changed HP. */
  onHit?(trait: T, enemy: Enemy, sim: Sim, dot: boolean, hit?: Hit): void;
  onSpawn?(trait: T, enemy: Enemy): void;
  onTick?(trait: T, enemy: Enemy, dt: number, sim: Sim): void;
  onDeath?(trait: T, enemy: Enemy, sim: Sim): void;
  /** Own immunity only; area immunity (dampen) lives in `resists`. */
  resists?(trait: T, status: StatusKind): boolean;
  /** Max HP factor at spawn. */
  hpFactor?(trait: T): number;
  /** Movement factor; 1 means unchanged. */
  speed?(trait: T, enemy: Enemy, time: number, sim: Sim): number;
}
type Registry = { [K in TraitKind]: TraitModule<Extract<Trait, { kind: K }>> };
const share = (name: string, v: number) => (v > 0 && v < 1 ? undefined : `${name} muss in (0, 1) liegen.`);
const positive = (name: string, v: number) => (v > 0 ? undefined : `${name} muss > 0 sein.`);
const between = (name: string, v: number, lo: number, hi: number) => (v >= lo && v <= hi ? undefined : `${name} muss in [${lo}, ${hi}] liegen.`);
const first = (...errors: (string | undefined)[]) => errors.find(Boolean);
/** Enemy abilities. A new ability is one entry here plus content. */
const TRAITS: Registry = {
  armor: {
    validate: (t) => (t.reduction >= 0 && t.reduction < 1 ? undefined : "reduction muss in [0, 1) liegen."),
    onDamage: (t, amount) => amount * (1 - t.reduction),
  },
  regen: {
    validate: (t) =>
      (t.perSecond === undefined) === (t.percent === undefined)
        ? "Genau eines von perSecond oder percent angeben."
        : t.perSecond !== undefined
          ? positive("perSecond", t.perSecond)
          : share("percent", t.percent!),
    onTick: (t, e, dt) => {
      e.hp = Math.min(e.maxHp, e.hp + ((t.perSecond ?? 0) + (t.percent ?? 0) * e.maxHp) * dt);
    },
  },
  splitOnDeath: {
    validate: (t, content) =>
      !Object.hasOwn(content.enemies, t.type)
        ? `Unbekannter Gegner '${t.type}'.`
        : Number.isInteger(t.count) && t.count >= 1
          ? undefined
          : "count muss eine ganze Zahl ≥ 1 sein.",
    onDeath: (t, e, sim) => {
      for (let i = 0; i < t.count; i++) {
        const child = createEnemy(sim, t.type as EnemyId, Math.max(0, e.distance - i * SPLIT_SPACING));
        // Fragments of a sent enemy count as sent, too.
        if (e.sentBy !== undefined) child.sentBy = e.sentBy;
      }
    },
  },
  slowImmune: {
    validate: () => undefined,
    resists: (_, status) => status === "slow",
  },
  shield: {
    validate: (t) => first(share("capacity", t.capacity), positive("delay", t.delay)),
    onSpawn: (t, e) => {
      e.shield = t.capacity * e.maxHp;
    },
    onDamage: (_, amount, e, sim) => {
      e.lastHit = sim.state.time;
      const absorbed = Math.min(e.shield ?? 0, amount);
      e.shield = (e.shield ?? 0) - absorbed;
      return amount - absorbed;
    },
    onTick: (t, e, _, sim) => {
      if (sim.state.time - (e.lastHit ?? -Infinity) >= t.delay) e.shield = t.capacity * e.maxHp;
    },
  },
  sprint: {
    validate: (t) => first(share("threshold", t.threshold), t.factor > 1 ? undefined : "factor muss > 1 sein.", positive("duration", t.duration)),
    onHit: (t, e, sim) => {
      if (e.sprinted || e.hp <= 0 || e.hp >= t.threshold * e.maxHp) return;
      e.sprinted = true;
      e.sprintUntil = sim.state.time + t.duration;
    },
    speed: (t, e, time) => (time < (e.sprintUntil ?? -Infinity) ? t.factor : 1),
  },
  evade: {
    validate: (t) => (Number.isInteger(t.every) && t.every >= 2 ? undefined : "every muss eine ganze Zahl ≥ 2 sein."),
    onDamage: (t, amount, e, sim, dot) => {
      if (dot) return amount;
      e.hits = (e.hits ?? 0) + 1;
      if (e.hits % t.every) return amount;
      sim.state.events.push({ type: "evade", at: { x: e.x, y: e.y } });
      return 0;
    },
  },
  healer: {
    validate: (t) => first(positive("radius", t.radius), share("percent", t.percent)),
    onTick: (t, healer, dt, sim) => {
      for (const e of sim.state.enemies)
        if (e !== healer && e.hp > 0 && dist(e, healer) <= t.radius) e.hp = Math.min(e.maxHp, e.hp + t.percent * e.maxHp * dt);
    },
  },
  leader: {
    validate: (t) => first(positive("radius", t.radius), positive("speed", t.speed), share("resist", t.resist)),
  },
  stealth: { validate: () => undefined },
  unstoppable: {
    validate: () => undefined,
    resists: (_, status) => status === "slow" || status === "stun" || status === "pull",
  },
  swift: {
    validate: (t) => first(positive("speed", t.speed), share("hp", t.hp)),
    hpFactor: (t) => 1 - t.hp,
    speed: (t) => 1 + t.speed,
  },
  burrow: {
    validate: (t) => first(positive("every", t.every), positive("length", t.length), t.length < t.every ? undefined : "length muss kleiner als every sein."),
  },
  harden: {
    validate: (t) => share("max", t.max),
    onDamage: (t, amount, e) => amount * (1 - hardenShare(t.max, e)),
  },
  surge: {
    validate: (t) =>
      first(positive("every", t.every), positive("length", t.length), t.length < t.every ? undefined : "length muss kleiner als every sein.", t.factor > 1 ? undefined : "factor muss > 1 sein."),
    speed: (t, e) => (isSurging(t, e) ? t.factor : 1),
  },
  swarm: {
    validate: (t) => first(positive("radius", t.radius), share("per", t.per), share("max", t.max)),
    onDamage: (t, amount, e, sim) => amount * (1 - swarmShare(t, e, sim)),
  },
  rage: {
    validate: (t) => positive("max", t.max),
    speed: (t, e) => 1 + rageShare(t.max, e),
  },
  facet: {
    validate: (t) =>
      first(positive("every", t.every), positive("length", t.length), t.length < t.every ? undefined : "length muss kleiner als every sein.", share("reduction", t.reduction)),
    onDamage: (t, amount, _, sim, dot) => (!dot && isFaceted(t, sim.state.time) ? amount * (1 - t.reduction) : amount),
  },
  leap: {
    validate: (t) =>
      first(positive("every", t.every), positive("length", t.length), t.length < t.every ? undefined : "length muss kleiner als every sein."),
  },
  dampen: {
    validate: (t) => positive("radius", t.radius),
  },
  brood: {
    validate: (t, content) =>
      !Object.hasOwn(content.enemies, t.type)
        ? `Unbekannter Gegner '${t.type}'.`
        : first(positive("every", t.every), Number.isInteger(t.max) && t.max >= 1 ? undefined : "max muss eine ganze Zahl ≥ 1 sein."),
    onSpawn: (_, e) => {
      e.brood = 0;
    },
    // At most one egg per tick: after a disruption the backlog is laid over a few ticks, never all at once.
    onTick: (t, e, _, sim) => {
      if ((e.brood ?? 0) >= t.max || Math.floor(e.distance / t.every) <= (e.brood ?? 0)) return;
      const egg = createEnemy(sim, t.type as EnemyId, e.distance);
      if (e.sentBy !== undefined) egg.sentBy = e.sentBy;
      e.brood = (e.brood ?? 0) + 1;
    },
  },
  overload: {
    validate: (t) => first(positive("radius", t.radius), positive("cycles", t.cycles)),
    onDeath: (t, e, sim) => {
      for (const tower of sim.state.towers) {
        const d = sim.content.towers[tower.type];
        if (d.placement === "path" || isSupport(d.attack) || dist(tower, e) > t.radius) continue;
        tower.cooldown = Math.max(tower.cooldown, t.cycles);
      }
      sim.state.events.push({ type: "overload", at: { x: e.x, y: e.y }, radius: t.radius });
    },
  },
  molt: {
    validate: (t) => first(share("threshold", t.threshold), share("armor", t.armor), t.speed > 1 ? undefined : "speed muss > 1 sein."),
    onDamage: (t, amount, e) => (isPlated(t, e) ? amount * (1 - t.armor) : amount),
    speed: (t, e) => (isPlated(t, e) ? 1 : t.speed),
  },
  momentum: {
    validate: (t) => first(positive("per", t.per), positive("max", t.max)),
    speed: (t, e) => 1 + momentumShare(t, e),
  },
  lap: {
    validate: (t) => first(unitShare("per", t.per), unitShare("max", t.max)),
    onDamage: (t, amount, e, sim) => amount * (1 - lapShare(t, lapsOf(sim, e))),
  },
  refract: {
    validate: (t) => between("factor", t.factor, 0.4, 0.6),
    onDamage: (t, amount, _e, _sim, _dot, hit) => (hit?.instant ? amount * t.factor : amount),
  },
  blastproof: {
    validate: (t) => between("reduction", t.reduction, 0.4, 0.7),
    onDamage: (t, amount, _e, _sim, _dot, hit) => (hit?.area ? amount * (1 - t.reduction) : amount),
  },
  // Handled by the chain attack module (`hasTrait(sim, e, "insulated")`).
  insulated: { validate: () => undefined },
  heatshield: {
    validate: () => undefined,
    resists: (_, status) => status === "burn" || status === "bleeding",
  },
  mirror: {
    validate: (t) => between("cap", t.cap, 0.05, 0.12),
    // An infinite hit (pit) and a Henker execution ignore the cap.
    onDamage: (t, amount, e, _sim, _dot, hit) => (hit?.execution || !Number.isFinite(amount) ? amount : Math.min(amount, t.cap * e.maxHp)),
  },
  // Splitting lives in `linkedGroup` (called by `applyDamage`).
  link: { validate: (t) => between("radius", t.radius, 1.2, 2) },
  // Target override lives in `taunters` (called by `attackEnemies`).
  taunt: { validate: (t) => between("radius", t.radius, 2, 3) },
  martyr: {
    validate: (t) => first(between("radius", t.radius, 1.5, 2), between("heal", t.heal, 0.1, 0.3)),
    onDeath: (t, e, sim) => {
      for (const o of sim.state.enemies) if (o !== e && o.hp > 0 && dist(o, e) <= t.radius) o.hp = Math.min(o.maxHp, o.hp + t.heal * o.maxHp);
    },
  },
  // Hiding lives in `isCloaked`.
  cloakField: { validate: (t) => between("radius", t.radius, 1.2, 2) },
  pack: {
    validate: (t) => first(between("radius", t.radius, 1, 2), between("perAlly", t.perAlly, 0.06, 0.1), between("max", t.max, 0.3, 0.5)),
    speed: (t, e, _time, sim) => 1 + packShare(t, e, sim),
  },
  // The jump lives in `blinkJump` (called by `moveEnemies`).
  blink: { validate: (t) => first(between("every", t.every, 3, 5), between("jump", t.jump, 1.5, 3)) },
  tunnel: {
    validate: (t) =>
      first(positive("every", t.every), positive("length", t.length), t.length < t.every ? undefined : "length muss kleiner als every sein.", between("speed", t.speed, 1.8, 2.2)),
    speed: (t, e) => (inDistanceWindow(t, e) ? t.speed : 1),
  },
  // The layer lives in `layerOf`.
  phase: { validate: (t) => first(between("period", t.period, 3, 4), between("air", t.air, 1.2, 2)) },
  // Range, interval, trap and support effects live in `towerDebuffs`, `isDefused` and `isSuppressed`.
  blind: { validate: (t) => first(between("radius", t.radius, 2, 3), between("range", t.range, 0.2, 0.35)) },
  jam: { validate: (t) => first(between("radius", t.radius, 1.5, 2.5), between("slow", t.slow, 0.3, 0.5)) },
  defuse: { validate: (t) => between("radius", t.radius, 1, 2) },
  suppress: { validate: (t) => between("radius", t.radius, 2, 3) },
  retaliate: {
    validate: (t) => first(between("radius", t.radius, 1.5, 2), between("cycles", t.cycles, 0.3, 0.6)),
    onHit: (t, e, sim, dot, hit) => {
      if (dot || hit?.tower === undefined) return;
      const tower = sim.state.towers.find((o) => o.id === hit.tower),
        d = tower && sim.content.towers[tower.type];
      if (!tower || !d || d.placement === "path" || isSupport(d.attack) || dist(tower, e) > t.radius) return;
      tower.cooldown = Math.min(tower.cooldown + t.cycles, 1 + t.cycles);
    },
  },
};
/** Current speed bonus of a pack enemy: `perAlly` for every other living enemy of its type within the radius, capped at `max`. */
const packShare = (t: { radius: number; perAlly: number; max: number }, e: Enemy, sim: Sim) => {
  let n = 0;
  for (const o of withArea(sim, "pack")) if (o !== e && o.hp > 0 && o.type === e.type && dist(o, e) <= t.radius) n++;
  return Math.min(t.max, t.perAlly * n);
};
/** Time-based layer window of a phase enemy: in the air for the first `air` seconds of every `period`. */
const isPhasedAir = (t: { period: number; air: number }, time: number) => time % t.period < t.air;
const unitShare = (name: string, v: number) => (v > 0 && v <= 1 ? undefined : `${name} muss in (0, 1] liegen.`);
/** Current speed bonus share of a momentum enemy: grows with the path distance, 0 when pulled back before the start. */
const momentumShare = (t: { per: number; max: number }, e: Enemy) => Math.min(t.max, t.per * Math.max(0, e.distance));
/** Completed laps of a ring map; always 0 on reactor maps. Derived from the distance, so a pull-back loses laps correctly. */
const lapsOf = (sim: Sim, e: Enemy) => {
  const { loop, path } = sim.mission.map;
  return loop ? Math.floor(Math.max(0, e.distance) / path.length) : 0;
};
/** Damage reduction share of a lap enemy after `laps` laps. */
const lapShare = (t: { per: number; max: number }, laps: number) => Math.min(t.max, t.per * laps);
/** Plated: the shell of a molting enemy holds while its HP share is at or above the threshold. */
const isPlated = (t: { threshold: number }, e: Enemy) => e.hp / e.maxHp >= t.threshold;
/** In the last `length` cells of its `every` cycle: derived from the path distance, so a pull-back leaves it correctly. */
const inDistanceWindow = (t: { every: number; length: number }, e: Enemy) => e.distance % t.every >= t.every - t.length;
/** In the burst window of a surge. */
const isSurging = inDistanceWindow;
/** In the flipped window of a leap. */
const isLeaping = inDistanceWindow;
/** Current damage reduction of a swarming enemy: `per` for each other living enemy of its type in `radius`, capped at `max`. */
const swarmShare = (t: { radius: number; per: number; max: number }, e: Enemy, sim: Sim) => {
  let n = 0;
  for (const o of sim.state.enemies) if (o !== e && o.hp > 0 && o.type === e.type && dist(o, e) <= t.radius) n++;
  return Math.min(t.max, t.per * n);
};
/** Current speed bonus share of a raging enemy: 0 at full HP, `max` at 0 HP. */
const rageShare = (max: number, e: Enemy) => max * (1 - e.hp / e.maxHp);
/** In the hardened window of its time cycle: derived from the global clock, so it is stateless and synced. */
const isFaceted = (t: { every: number; length: number }, time: number) => time % t.every >= t.every - t.length;
/** Current damage reduction of a hardening enemy: 0 at full HP, `max` at 0 HP. */
const hardenShare = (max: number, e: Enemy) => max * (1 - e.hp / e.maxHp);
/** Damage hooks in order: a dodge first, then reductions, the shield takes what is left. */
const DAMAGE_STAGE: Partial<Record<TraitKind, number>> = { evade: -1, shield: 1, mirror: 2 };
const stage = (t: Trait) => DAMAGE_STAGE[t.kind] ?? 0;
const moduleOf = (t: Trait) => TRAITS[t.kind] as TraitModule<Trait> | undefined;
/** Abilities a Störsender switches off; physical properties such as armor stay. */
export const DISRUPTABLE: ReadonlySet<TraitKind> = new Set(["shield", "regen", "healer", "leader", "stealth", "evade", "dampen", "brood", "link", "taunt", "martyr", "cloakField", "retaliate", "blink", "blind", "jam", "defuse", "suppress"]);
const NO_TRAITS: readonly Trait[] = [];
const traitsOf = (sim: Sim, e: Enemy): readonly Trait[] => {
  const traits = sim.content.enemies[e.type].traits ?? NO_TRAITS;
  return e.status.length && hasStatus(e, "disrupted", sim.state.time) ? traits.filter((t) => !DISRUPTABLE.has(t.kind)) : traits;
};
export const hasTrait = (sim: Sim, e: Enemy, kind: TraitKind) => traitsOf(sim, e).some((t) => t.kind === kind);
/**
 * Enemies of a type with an area trait (leader, dampen, link, taunt, cloakField, pack, blind, jam, defuse, suppress), in list order. `state.enemies` only grows
 * (spawns are pushed) until pruning replaces the array, so the lists are extended incrementally.
 */
type AreaKind = "leader" | "dampen" | "link" | "taunt" | "cloakField" | "pack" | "blind" | "jam" | "defuse" | "suppress";
const areaCache = new WeakMap<readonly Enemy[], Partial<Record<AreaKind, { scanned: number; found: Enemy[] }>>>();
function withArea(sim: Sim, kind: AreaKind): readonly Enemy[] {
  const all = sim.state.enemies;
  let byKind = areaCache.get(all);
  if (!byKind) areaCache.set(all, (byKind = {}));
  const entry = (byKind[kind] ??= { scanned: 0, found: [] });
  for (; entry.scanned < all.length; entry.scanned++) {
    const e = all[entry.scanned];
    if (sim.content.enemies[e.type].traits?.some((t) => t.kind === kind)) entry.found.push(e);
  }
  return entry.found;
}
/** Carriers of a disruptable area trait that are alive and not disrupted, with the trait. */
function* activeCarriers<K extends AreaKind>(sim: Sim, kind: K): Generator<[Enemy, Extract<Trait, { kind: K }>]> {
  for (const c of withArea(sim, kind)) {
    if (c.hp <= 0) continue;
    for (const t of traitsOf(sim, c)) if (t.kind === kind) yield [c, t as Extract<Trait, { kind: K }>];
  }
}

export function validateTrait(trait: Trait, content: ContentPack): string | undefined {
  const module = moduleOf(trait);
  return module ? module.validate(trait, content) : `Unbekannte Eigenschaft '${(trait as Trait).kind}'.`;
}
export function modifyDamage(sim: Sim, e: Enemy, amount: number, dot = false, hit?: Hit) {
  amount *= 1 - leaderBonus(sim, e).resist;
  for (const t of [...traitsOf(sim, e)].sort((a, b) => stage(a) - stage(b))) {
    if (amount <= 0) break;
    amount = moduleOf(t)!.onDamage?.(t, amount, e, sim, dot, hit) ?? amount;
  }
  return amount;
}
export function afterHit(sim: Sim, e: Enemy, dot: boolean, hit?: Hit) {
  for (const t of traitsOf(sim, e)) moduleOf(t)!.onHit?.(t, e, sim, dot, hit);
}
/** Link: the enemy and every living same-type enemy within its radius in id order; undefined without an active link or neighbours. */
export function linkedGroup(sim: Sim, e: Enemy): Enemy[] | undefined {
  const link = traitsOf(sim, e).find((t) => t.kind === "link");
  if (!link) return undefined;
  const group = withArea(sim, "link").filter((o) => o.hp > 0 && o.type === e.type && (o === e || dist(o, e) <= link.radius)).sort((a, b) => a.id - b.id);
  return group.length > 1 ? group : undefined;
}
/** Taunt: the candidates (in their order) a tower at `from` must pick among, or undefined when no active taunter in reach is among them. */
export function taunters(sim: Sim, from: Point, candidates: readonly Enemy[]): Enemy[] | undefined {
  let found: Set<Enemy> | undefined;
  for (const [c, t] of activeCarriers(sim, "taunt")) if (dist(c, from) <= t.radius && candidates.includes(c)) (found ??= new Set()).add(c);
  return found && candidates.filter((c) => found.has(c));
}
/** Blink: cells jumped ahead by a forward move from `from` to `e.distance` that crossed a multiple of `every`; 0 otherwise. At most one jump per call. */
export function blinkJump(sim: Sim, e: Enemy, from: number): number {
  if (e.distance <= from) return 0;
  for (const t of traitsOf(sim, e)) if (t.kind === "blink" && Math.floor(e.distance / t.every) > Math.floor(from / t.every)) return t.jump;
  return 0;
}
/** Strongest blind (range share lost) and jam (interval growth) of living undisrupted carriers around an attack tower's position. */
export function towerDebuffs(sim: Sim, at: Point) {
  let range = 0,
    interval = 0;
  for (const [c, t] of activeCarriers(sim, "blind")) if (dist(c, at) <= t.radius) range = Math.max(range, t.range);
  for (const [c, t] of activeCarriers(sim, "jam")) if (dist(c, at) <= t.radius) interval = Math.max(interval, t.slow);
  return { range, interval };
}
/** Whether a living undisrupted defuser is within its radius of a trap at `at`. */
export function isDefused(sim: Sim, at: Point) {
  for (const [c, t] of activeCarriers(sim, "defuse")) if (dist(c, at) <= t.radius) return true;
  return false;
}
/** Whether a living undisrupted suppressor is within its radius of a support tower at `at`. */
export function isSuppressed(sim: Sim, at: Point) {
  for (const [c, t] of activeCarriers(sim, "suppress")) if (dist(c, at) <= t.radius) return true;
  return false;
}
/** Max HP factor of a type at spawn, e.g. lower for swift enemies. */
export function traitHpFactor(content: ContentPack, type: EnemyId) {
  return (content.enemies[type].traits ?? []).reduce((f, t) => f * (moduleOf(t)!.hpFactor?.(t) ?? 1), 1);
}
export function initTraits(sim: Sim, e: Enemy) {
  for (const t of traitsOf(sim, e)) moduleOf(t)!.onSpawn?.(t, e);
}
/** Movement factor from the enemy's own traits and the strongest leader nearby. */
export function traitSpeedFactor(sim: Sim, e: Enemy) {
  const own = traitsOf(sim, e).reduce((f, t) => f * (moduleOf(t)!.speed?.(t, e, sim.state.time, sim) ?? 1), 1);
  return own * (1 + leaderBonus(sim, e).speed);
}
/** Strongest leader bonus per stat from other living leaders in range; leaders do not stack. */
export function leaderBonus(sim: Sim, e: Enemy) {
  const bonus = { speed: 0, resist: 0 };
  for (const l of withArea(sim, "leader")) {
    if (l === e || l.hp <= 0) continue;
    for (const t of traitsOf(sim, l))
      if (t.kind === "leader" && dist(l, e) <= t.radius) {
        bonus.speed = Math.max(bonus.speed, t.speed);
        bonus.resist = Math.max(bonus.resist, t.resist);
      }
  }
  return bonus;
}
/** Underground (burrow or tunnel): derived from the path distance, so a pull-back resurfaces it correctly. */
export const isBurrowed = (sim: Sim, e: Enemy) =>
  traitsOf(sim, e).some((t) => (t.kind === "burrow" || t.kind === "tunnel") && e.distance % t.every >= t.every - t.length);
/** Within the radius of another living undisrupted cloak field carrier and not revealed by a detector. */
const isCloaked = (sim: Sim, e: Enemy) => {
  if (e.revealed) return false;
  for (const [c, t] of activeCarriers(sim, "cloakField")) if (c !== e && dist(c, e) <= t.radius) return true;
  return false;
};
/** Whether any enemy carries a cloak field (detectors then also reveal cloaked neighbours). */
export const hasCloakField = (sim: Sim) => withArea(sim, "cloakField").length > 0;
/** Stealthed or cloaked and not revealed by a detector, or burrowed: towers cannot pick it as a target. */
export const isHidden = (sim: Sim, e: Enemy) => (hasTrait(sim, e, "stealth") && !e.revealed) || isCloaked(sim, e) || isBurrowed(sim, e);
/** Current layer: the definition's (or the phase window of the global clock), flipped (ground and air) in the window of a leap. */
export function layerOf(sim: Sim, e: Enemy): UnitLayer {
  const traits = traitsOf(sim, e),
    phase = traits.find((t) => t.kind === "phase"),
    base: UnitLayer = phase ? (isPhasedAir(phase, sim.state.time) ? "air" : "ground") : sim.content.enemies[e.type].layer;
  return traits.some((t) => t.kind === "leap" && isLeaping(t, e)) ? (base === "air" ? "ground" : "air") : base;
}
/** Iterates a snapshot: eggs laid by a brood enemy this tick are first ticked in the next one (deterministic, no double steps). */
export function tickTraits(sim: Sim, dt: number) {
  for (const e of [...sim.state.enemies])
    if (e.hp > 0) for (const t of traitsOf(sim, e)) moduleOf(t)!.onTick?.(t, e, dt, sim);
}
export function onDeath(sim: Sim, e: Enemy) {
  for (const t of traitsOf(sim, e)) moduleOf(t)!.onDeath?.(t, e, sim);
}
const DAMPENED: readonly StatusKind[] = ["slow", "stun", "pull"];
/** Own immunities, or a living undisrupted dampener (possibly itself) within its radius. */
export function resists(sim: Sim, e: Enemy, status: StatusKind) {
  if (traitsOf(sim, e).some((t) => moduleOf(t)!.resists?.(t, status))) return true;
  if (!DAMPENED.includes(status)) return false;
  for (const d of withArea(sim, "dampen")) {
    if (d.hp <= 0) continue;
    for (const t of traitsOf(sim, d)) if (t.kind === "dampen" && dist(d, e) <= t.radius) return true;
  }
  return false;
}
export interface TraitFlags {
  /** Remaining shield as a share of its capacity; 0 without a shield. */
  shield: number;
  leader: number;
  healer: number;
  stealth: boolean;
  revealed: boolean;
  unstoppable: boolean;
  sprinting: boolean;
  swift: boolean;
  evade: boolean;
  regen: boolean;
  armor: boolean;
  split: boolean;
  slowImmune: boolean;
  burrowed: boolean;
  /** Current damage reduction share of a hardening enemy, 0..max; 0 without the trait. */
  harden: number;
  /** Currently in the burst window of a surge. */
  surging: boolean;
  /** Current damage reduction share of a swarming enemy, 0..max; 0 without the trait. */
  swarm: number;
  /** Current speed bonus share of a raging enemy, 0..max; 0 without the trait. */
  rage: number;
  /** Currently in the hardened window of a facet. */
  faceted: boolean;
  /** Currently in the flipped window of a leap (drawn on the other layer). */
  leaping: boolean;
  /** Dampen radius in cells; 0 without the trait. */
  dampen: number;
  /** Progress to the next egg, 0..1; 0 without the trait or when `max` is reached. */
  brood: number;
  /** Death shock marker. */
  overload: boolean;
  /** Molt state: "plated" while the shell holds, "shed" below the threshold, undefined without the trait. */
  molt: "plated" | "shed" | undefined;
  /** Current speed bonus of a momentum enemy, 0..max; 0 without the trait. */
  momentum: number;
  /** Completed laps of a lap enemy on a ring map; 0 without the trait or on reactor maps. */
  laps: number;
  /** Radii in cells of the area traits; 0 without the trait. */
  link: number;
  taunt: number;
  cloak: number;
  blind: number;
  jam: number;
  defuse: number;
  suppress: number;
  /** Plain markers of traits without a changing state. */
  refract: boolean;
  blastproof: boolean;
  insulated: boolean;
  heatshield: boolean;
  mirror: boolean;
  martyr: boolean;
  retaliate: boolean;
  tunnel: boolean;
  /** Current speed bonus share of a pack enemy, 0..max; 0 without the trait. */
  pack: number;
  /** Progress to the next jump, 0..1; 0 without the trait. */
  blink: number;
  /** Current layer of a phase enemy; undefined without the trait. */
  phase: UnitLayer | undefined;
}
/** Visible traits for drawing; `leader` and `healer` are their radii in cells (0 if absent). */
export function traitFlags(sim: Sim, e: Enemy): TraitFlags {
  const flags: TraitFlags = {
    shield: 0,
    leader: 0,
    healer: 0,
    stealth: false,
    revealed: !!e.revealed,
    unstoppable: false,
    sprinting: sim.state.time < (e.sprintUntil ?? -Infinity),
    swift: false,
    evade: false,
    regen: false,
    armor: false,
    split: false,
    slowImmune: false,
    burrowed: isBurrowed(sim, e),
    harden: 0,
    surging: false,
    swarm: 0,
    rage: 0,
    faceted: false,
    leaping: false,
    dampen: 0,
    brood: 0,
    overload: false,
    molt: undefined,
    momentum: 0,
    laps: 0,
    link: 0,
    taunt: 0,
    cloak: 0,
    blind: 0,
    jam: 0,
    defuse: 0,
    suppress: 0,
    refract: false,
    blastproof: false,
    insulated: false,
    heatshield: false,
    mirror: false,
    martyr: false,
    retaliate: false,
    tunnel: false,
    pack: 0,
    blink: 0,
    phase: undefined,
  };
  for (const t of traitsOf(sim, e)) {
    if (t.kind === "shield") flags.shield = (e.shield ?? 0) / (t.capacity * e.maxHp);
    else if (t.kind === "leader" || t.kind === "healer") flags[t.kind] = t.radius;
    else if (t.kind === "armor" || t.kind === "slowImmune") flags[t.kind] = true;
    else if (t.kind === "splitOnDeath") flags.split = true;
    else if (t.kind === "harden") flags.harden = hardenShare(t.max, e);
    else if (t.kind === "surge") flags.surging = isSurging(t, e);
    else if (t.kind === "swarm") flags.swarm = swarmShare(t, e, sim);
    else if (t.kind === "rage") flags.rage = rageShare(t.max, e);
    else if (t.kind === "facet") flags.faceted = isFaceted(t, sim.state.time);
    else if (t.kind === "leap") flags.leaping = isLeaping(t, e);
    else if (t.kind === "dampen") flags.dampen = t.radius;
    else if (t.kind === "brood") flags.brood = (e.brood ?? 0) >= t.max ? 0 : (e.distance / t.every) % 1;
    else if (t.kind === "overload") flags.overload = true;
    else if (t.kind === "molt") flags.molt = isPlated(t, e) ? "plated" : "shed";
    else if (t.kind === "momentum") flags.momentum = momentumShare(t, e);
    else if (t.kind === "lap") flags.laps = lapsOf(sim, e);
    else if (t.kind === "link" || t.kind === "taunt" || t.kind === "blind" || t.kind === "jam" || t.kind === "defuse" || t.kind === "suppress") flags[t.kind] = t.radius;
    else if (t.kind === "cloakField") flags.cloak = t.radius;
    else if (t.kind === "refract" || t.kind === "blastproof" || t.kind === "insulated" || t.kind === "heatshield" || t.kind === "mirror" || t.kind === "martyr" || t.kind === "retaliate" || t.kind === "tunnel") flags[t.kind] = true;
    else if (t.kind === "pack") flags.pack = packShare(t, e, sim);
    else if (t.kind === "blink") flags.blink = (Math.max(0, e.distance) / t.every) % 1;
    else if (t.kind === "phase") flags.phase = layerOf(sim, e);
    else if (t.kind === "stealth" || t.kind === "unstoppable" || t.kind === "swift" || t.kind === "evade" || t.kind === "regen") flags[t.kind] = true;
  }
  return flags;
}
