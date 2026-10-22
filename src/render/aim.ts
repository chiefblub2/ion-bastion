import type { Enemy, Sim, Tower } from "../core/types";
import { resolveUpgrades } from "../core/upgrades";
import { attackModule, canAcquire, isSupport } from "../systems/attacks";
import { effectiveTowerStats, isAuraSource } from "../systems/auras";
import { compareTargets } from "../systems/combat";
import { dist } from "../systems/path";
import { taunters } from "../systems/traits";
/** How fast a drawn turret turns, in radians per second: a half turn takes about 0.13 s. */
export const TURN_RATE = 24;
/** Frames between two target predictions of one tower (staggered by id), to bound the cost on a crowded board. */
const PREDICT_EVERY = 3;
/** Share of the cooldown left below which a turret turns toward its predicted next target. */
const PRE_AIM = 0.5;
/** `from` turned toward `to` by at most `step` radians, the short way round. */
export function turnToward(from: number, to: number, step: number) {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return Math.abs(delta) <= step ? to : from + Math.sign(delta) * step;
}
/**
 * The enemy the tower would fire at now: range, dead zone, acquisition,
 * priority, taunts and the module's `choose` as in `attackEnemies` (all read only; volleys and procs are left out).
 */
export function predictTarget(sim: Sim, t: Tower, sources: readonly Tower[]): Enemy | undefined {
  const d = sim.content.towers[t.type];
  if (d.placement === "path" || isSupport(d.attack)) return undefined;
  const range = effectiveTowerStats(t, sources, sim.content, sim).range,
    { attack } = resolveUpgrades(t, sim.content),
    module = attackModule(attack),
    min = module?.minRange?.(attack) ?? 0,
    candidates = sim.state.enemies
      .filter((e) => {
        if (e.hp <= 0) return false;
        const r = dist(e, t);
        return r <= range && r >= min && canAcquire(sim, t.type, e);
      })
      .sort(compareTargets(t.priority, t));
  if (!candidates.length) return undefined;
  const pool = taunters(sim, t, candidates) ?? candidates;
  return module?.choose?.(sim, t.type, { x: t.x, y: t.y }, range, pool, attack, t) ?? pool[0];
}
const bearing = (t: Tower, e: Enemy) => Math.atan2(e.y - t.y, e.x - t.x);
interface Aim {
  /** Angle the turret is drawn at. */
  angle: number;
  /** `Tower.angle` last seen: it changes only when the tower fires. */
  fired: number;
  /** Enemy the turret turns toward: the one the tower should pick next. */
  enemy?: number;
  frame: number;
}
/**
 * The turret angle each tower is drawn at (render only). The simulation turns a tower only in the tick it fires, so
 * the turret here turns ahead of time toward the enemy it will most likely shoot next, and snaps onto the real angle
 * whenever the tower fires: a shot never leaves a turret that is still turning. After a shot it holds still until the
 * last part of the cooldown, so a beam or flash still on screen keeps pointing out of the barrel.
 */
export class TurretAim {
  private shown = new Map<number, Aim>();
  private frame = 0;
  /** `dt` is the effects clock's step, so turrets hold still while paused. A tower seen for the first time starts on its angle. */
  sync(sim: Sim, dt: number) {
    const frame = ++this.frame,
      towers = sim.state.towers;
    let sources: Tower[] | undefined, enemies: Map<number, Enemy> | undefined;
    for (const t of towers) {
      let aim = this.shown.get(t.id);
      if (!aim) {
        this.shown.set(t.id, (aim = { angle: t.angle, fired: t.angle, frame }));
        continue;
      }
      aim.frame = frame;
      if (aim.fired !== t.angle) {
        aim.angle = aim.fired = t.angle;
        aim.enemy = undefined;
        continue;
      }
      if (t.cooldown >= PRE_AIM) continue;
      if (aim.enemy === undefined || (frame + t.id) % PREDICT_EVERY === 0) {
        sources ??= towers.filter((q) => isAuraSource(q, sim.content));
        aim.enemy = predictTarget(sim, t, sources)?.id;
      }
      if (aim.enemy === undefined) continue;
      enemies ??= new Map(sim.state.enemies.map((e) => [e.id, e]));
      const e = enemies.get(aim.enemy);
      if (!e || e.hp <= 0) aim.enemy = undefined;
      else aim.angle = turnToward(aim.angle, bearing(t, e), TURN_RATE * dt);
    }
    for (const [id, aim] of this.shown) if (aim.frame !== frame) this.shown.delete(id);
  }
  angle(t: Tower) {
    return this.shown.get(t.id)?.angle ?? t.angle;
  }
  reset() {
    this.shown.clear();
  }
}
