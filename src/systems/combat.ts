import { resolveUpgrades } from "../core/upgrades";
import type { Enemy, Point, Sim, TargetPriority } from "../core/types";
import { attackModule, canAcquire, isSupport } from "./attacks";
import { effectiveTowerStats, isAuraSource } from "./auras";
import { dist } from "./path";
/** Homing projectiles whose target died look for a new one within this radius. */
export const RETARGET_RADIUS = 1.5;
/** Every target priority in menu order; the first is the default. */
export const TARGET_PRIORITIES: readonly TargetPriority[] = ["first", "last", "strong", "weak", "close"];
const PRIORITY_KEYS: Record<TargetPriority, (e: Enemy, from: Point) => number> = {
  first: (e) => -e.distance,
  last: (e) => e.distance,
  strong: (e) => -e.hp,
  weak: (e) => e.hp,
  close: (e, from) => dist(e, from),
};
/** Orders candidates best first; ties fall back to path progress, then the stable id. */
export function compareTargets(priority: TargetPriority = "first", from: Point) {
  const key = PRIORITY_KEYS[priority];
  return (a: Enemy, b: Enemy) => key(a, from) - key(b, from) || b.distance - a.distance || a.id - b.id;
}
export function attackEnemies(sim: Sim, dt: number) {
  const s = sim.state,
    { towers } = sim.content,
    // Aura sources once per tick instead of once per tower.
    sources = s.towers.filter((t) => isAuraSource(t, sim.content));
  for (const t of s.towers) {
    const d = towers[t.type];
    if (isSupport(d.attack)) continue;
    const stats = effectiveTowerStats(t, sources, sim.content);
    // A rate change preserves progress instead of resetting or granting a free shot.
    t.cooldown = Math.max(0, t.cooldown - dt / stats.interval);
    if (t.cooldown > 0) continue;
    const candidates = s.enemies
      .filter((e) => e.hp > 0 && canAcquire(sim, t.type, e) && dist(e, t) <= stats.range)
      .sort(compareTargets(t.priority, t));
    if (!candidates.length) continue;
    const attack = resolveUpgrades(t, sim.content).attack,
      module = attackModule(attack)!,
      target = module.choose?.(sim, t.type, { x: t.x, y: t.y }, stats.range, candidates, attack) ?? candidates[0];
    t.angle = Math.atan2(target.y - t.y, target.x - t.x);
    t.cooldown = 1;
    s.events.push({
      type: "shot",
      tower: t.type,
      from: { x: t.x, y: t.y },
      to: { x: target.x, y: target.y },
      color: d.color,
    });
    if (!d.projectile) {
      module.apply(
        sim,
        { tower: t.id, type: t.type },
        { enemy: target, at: { x: target.x, y: target.y }, from: { x: t.x, y: t.y }, reach: stats.range },
        stats.damage,
        attack,
      );
      continue;
    }
    s.projectiles.push({
      id: s.nextId++,
      tower: t.id,
      type: t.type,
      target: module.aim === "point" ? null : target.id,
      x: t.x,
      y: t.y,
      tx: target.x,
      ty: target.y,
      damage: stats.damage,
      attack,
    });
  }
}
/** Advances projectiles; damage is applied only when one arrives. */
export function moveProjectiles(sim: Sim, dt: number) {
  const s = sim.state;
  s.projectiles = s.projectiles.filter((p) => {
    const d = sim.content.towers[p.type];
    let target: Enemy | undefined;
    if (p.target !== null) {
      target = s.enemies.find((e) => e.id === p.target && e.hp > 0);
      if (!target) {
        target = s.enemies
          .filter((e) => e.hp > 0 && canAcquire(sim, p.type, e) && dist(e, p) <= RETARGET_RADIUS)
          .sort((a, b) => dist(a, p) - dist(b, p) || a.id - b.id)[0];
        if (!target) return false;
        p.target = target.id;
      }
      p.tx = target.x;
      p.ty = target.y;
    }
    const step = d.projectile!.speed * dt,
      remaining = Math.hypot(p.tx - p.x, p.ty - p.y);
    if (remaining > step) {
      p.x += ((p.tx - p.x) / remaining) * step;
      p.y += ((p.ty - p.y) / remaining) * step;
      return true;
    }
    p.x = p.tx;
    p.y = p.ty;
    const at = { x: p.x, y: p.y };
    attackModule(p.attack)!.apply(sim, { tower: p.tower, type: p.type }, { enemy: target, at }, p.damage, p.attack);
    s.events.push({ type: "impact", tower: p.type, at, color: d.color });
    return false;
  });
}
