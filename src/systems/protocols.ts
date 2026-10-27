import type { AttackKind, DamageSource, Enemy, Sim, Tower } from "../core/types";
import { isSupport } from "./attacks";
import type { Hit } from "./damage";
import { dist } from "./path";
import { applyStatus, hasStatus, speedFactor } from "./status";
import { hasTrait, isHidden, layerOf } from "./traits";
/**
 * Run protocols (`MissionDefinition.protocols`): combat rules a Run's relics add. Each is optional and bounded, reads
 * only the state and the mission, and changes nothing while the mission carries none, so every other mode plays as
 * before. Damage factors multiply into `deal` before armor; side effects (an ended slow, a net, broken armor) follow
 * the hit and never deal damage themselves, so nothing here can chain into itself.
 */
/** Max HP from which an enemy counts as heavy (Titan Reactor Core), as for specializations. */
const HEAVY = 1000;
/** Explosive attacks for Thermal Fracture. */
const EXPLOSIVE: ReadonlySet<AttackKind> = new Set(["splash", "mortar", "strike", "charge", "airburst"]);
/** Precision attacks for Singularity Protocol: one aimed shot or beam at one enemy. */
const PRECISION: ReadonlySet<AttackKind> = new Set(["direct", "pierce", "focus", "execute"]);
const towerOf = (sim: Sim, src: DamageSource) => sim.content.towers[src.type];
/** A tower that fires (not a trap, not a support tower). */
const armed = (sim: Sim, t: Pick<Tower, "type">) => {
  const d = sim.content.towers[t.type];
  return d.placement !== "path" && !isSupport(d.attack);
};
const slowOf = (e: Enemy, time: number) => {
  const s = e.status.find((x) => x.kind === "slow");
  return s && s.kind === "slow" && time < s.until ? s : undefined;
};
/** Damage factor of the protocols for one hit (`dot`: a burn step, no hit context). */
export function protocolFactor(sim: Sim, src: DamageSource, e: Enemy, dot: boolean, hit?: Hit): number {
  const p = sim.mission.protocols;
  if (!p) return 1;
  const s = sim.state;
  let f = 1;
  if (p.unstable) {
    const share = s.lives / p.unstable.reactorMax,
      t = Math.min(1, Math.max(0, (p.unstable.from - share) / (p.unstable.from - p.unstable.to)));
    f *= 1 + p.unstable.max * t;
  }
  if (dot || !hit) return f;
  const d = towerOf(sim, src);
  if (p.fracture && EXPLOSIVE.has(hit.kind)) {
    const slow = slowOf(e, s.time);
    if (slow && slow.factor <= p.fracture.slowAt) {
      // The frost shatters: one stronger hit, and the slow is gone until the next one lands.
      slow.until = s.time;
      f *= 1 + p.fracture.bonus;
      s.events.push({ type: "protocol", protocol: "fracture", at: { x: e.x, y: e.y } });
    }
  }
  if (p.singularity && PRECISION.has(d.attack.kind) && hasStatus(e, "singularity", s.time)) f *= 1 + p.singularity.bonus;
  if (p.killbox && d.placement === "path" && speedFactor(e, s.time) <= p.killbox.speedAt) f *= 1 + p.killbox.bonus;
  if (p.titan && e.maxHp >= HEAVY) f *= 1 + p.titan.bonus;
  if (p.scanner && e.revealed) f *= 1 + p.scanner.bonus;
  return f;
}
/** After a tower's hit landed on a living enemy: Armorbreaker Matrix, Skyhunter Array and Rank 4 mastery. */
export function protocolAfterHit(sim: Sim, src: DamageSource, e: Enemy, dot: boolean, hit?: Hit) {
  const p = sim.mission.protocols;
  if (!p || dot || !hit || e.hp <= 0) return;
  const s = sim.state,
    mastery = p.mastery?.[src.type];
  if (mastery) {
    const until = s.time + mastery.duration;
    applyStatus(
      sim,
      e,
      mastery.kind === "slow"
        ? { kind: "slow", factor: mastery.factor, until }
        : mastery.kind === "vulnerable"
          ? { kind: "vulnerable", amount: mastery.amount, until }
          : { kind: "stun", release: until, until: until + mastery.recovery },
    );
  }
  if (p.armorbreak && hit.area && hasTrait(sim, e, "armor") && !hasStatus(e, "armorDissolved", s.time))
    if (applyStatus(sim, e, { kind: "armorDissolved", fraction: p.armorbreak.fraction, until: s.time + p.armorbreak.duration }))
      s.events.push({ type: "protocol", protocol: "armorbreak", at: { x: e.x, y: e.y } });
  if (p.skyhunter && towerOf(sim, src).placement !== "path" && layerOf(sim, e) === "air" && e.hp < e.maxHp * p.skyhunter.below && !hasStatus(e, "netted", s.time))
    if (applyStatus(sim, e, { kind: "netted", factor: p.skyhunter.factor, until: s.time + p.skyhunter.duration }))
      s.events.push({ type: "protocol", protocol: "skyhunter", at: { x: e.x, y: e.y } });
}
/** Titan Reactor Core: a heavy enemy died, so the towers around it reload at once. */
export function protocolKill(sim: Sim, e: Enemy) {
  const titan = sim.mission.protocols?.titan;
  if (!titan || e.maxHp < HEAVY) return;
  for (const t of sim.state.towers) if (armed(sim, t) && dist(t, e) <= titan.reload) t.cooldown = 0;
  sim.state.events.push({ type: "protocol", protocol: "titan", at: { x: e.x, y: e.y }, radius: titan.reload });
}
/** Swarm Replicator: a tower's fire-rate factor from the enemies in its range. */
export function protocolRate(sim: Sim, t: Tower, range: number): number {
  const swarm = sim.mission.protocols?.swarm;
  if (!swarm || !armed(sim, t)) return 1;
  let n = 0;
  for (const e of sim.state.enemies) if (e.hp > 0 && dist(e, t) <= range) n++;
  return 1 + Math.min(swarm.max, swarm.per * n);
}
/** Spectral Scanner: whether a tower stands close enough to reveal this stealthed enemy. */
export function scannerReveals(sim: Sim, e: Enemy): boolean {
  const scanner = sim.mission.protocols?.scanner;
  return !!scanner && sim.state.towers.some((t) => armed(sim, t) && dist(e, t) <= scanner.radius);
}
/**
 * Singularity Protocol: on every `every` s of the shared clock, when no enemy carries the mark, the toughest visible
 * enemy (most HP, then path progress, then id) is marked.
 */
export function tickProtocols(sim: Sim, dt: number) {
  const singularity = sim.mission.protocols?.singularity;
  if (!singularity) return;
  const s = sim.state;
  if (Math.floor(s.time / singularity.every) === Math.floor((s.time - dt) / singularity.every)) return;
  if (s.enemies.some((e) => e.hp > 0 && hasStatus(e, "singularity", s.time))) return;
  const target = s.enemies
    .filter((e) => e.hp > 0 && !isHidden(sim, e))
    .sort((a, b) => b.hp - a.hp || b.distance - a.distance || a.id - b.id)[0];
  if (!target) return;
  applyStatus(sim, target, { kind: "singularity", until: s.time + singularity.duration });
  s.events.push({ type: "protocol", protocol: "singularity", at: { x: target.x, y: target.y } });
}
/** Singularity Protocol: a precision tower that can reach the marked enemy aims at it first. */
export function markedFirst(sim: Sim, t: Tower, candidates: Enemy[]): Enemy[] | undefined {
  if (!sim.mission.protocols?.singularity || !PRECISION.has(sim.content.towers[t.type].attack.kind) || !armed(sim, t)) return undefined;
  const marked = candidates.find((e) => hasStatus(e, "singularity", sim.state.time));
  return marked ? [marked] : undefined;
}
