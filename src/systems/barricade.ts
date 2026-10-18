import { resolveUpgrades } from "../core/upgrades";
import type { ContentPack, Enemy, MapDefinition, Sim, Tower, TowerDefinition } from "../core/types";
import { canTarget } from "./attacks/targeting";
import { hasTrait, isBurrowed, isDefused, layerOf } from "./traits";
/** Enemies halt this far before a barricade's cell centre: on the edge of the cell, where a Grinder next to it reaches them. */
export const WALL_GAP = 0.5;
/** Wall damage per second of a pressing enemy, per unit of body size (a Drone about 23, a Titan about 46). */
export const CHEW = 120;
const INDEX = new WeakMap<MapDefinition, Map<string, number>>();
/** Path index of a cell, cached per map. */
function pathIndex(map: MapDefinition, x: number, y: number) {
  let index = INDEX.get(map);
  if (!index) {
    index = new Map(map.path.map((p, i) => [`${p.x},${p.y}`, i]));
    INDEX.set(map, index);
  }
  return index.get(`${x},${y}`);
}
const isBarricade = (sim: Sim, t: Tower) => sim.content.towers[t.type].attack.kind === "block";
/** The wall's full HP at the tower's current level. */
export function wallHp(t: Tower, content?: ContentPack) {
  const attack = resolveUpgrades(t, content).attack;
  return attack.kind === "block" ? attack.hp : 0;
}
/** Share of the wall left, 1 when whole and 0 when breached; render and UI read it. */
export const wallShare = (t: Tower, content?: ContentPack) => {
  const hp = wallHp(t, content);
  return hp > 0 ? Math.max(0, 1 - (t.wall ?? 0) / hp) : 0;
};
/** Standing barricades: whole enough to block and not defused, with the path distance enemies halt at. */
function standing(sim: Sim) {
  const walls: { tower: Tower; stop: number }[] = [];
  for (const t of sim.state.towers) {
    if (!isBarricade(sim, t) || wallShare(t, sim.content) <= 0 || isDefused(sim, t)) continue;
    const i = pathIndex(sim.mission.map, t.x, t.y);
    if (i !== undefined) walls.push({ tower: t, stop: i - WALL_GAP });
  }
  return walls;
}
/** The first halt point at or after `from` on the path (every lap on a ring). */
function nextStop(stop: number, from: number, length: number, loop?: boolean) {
  if (!loop) return from <= stop + 1e-9 ? stop : Infinity;
  return stop + Math.ceil((from - stop - 1e-9) / length) * length;
}
function breach(sim: Sim, t: Tower) {
  t.wall = wallHp(t, sim.content);
  sim.state.events.push({ type: "breach", at: { x: t.x, y: t.y }, color: sim.content.towers[t.type].color });
}
/** Only real walkers: a netted or Skylink-held flyer still flies over the wall. */
const blockable = (sim: Sim, t: Tower, e: Enemy) => layerOf(sim, e) === "ground" && canTarget(sim, t.type, e) && !isBurrowed(sim, e);
/**
 * Movement hook: a walker that would cross a standing barricade halts in front of it and chews on the wall for
 * `CHEW` × its size per second. Unstoppable units smash straight through; flyers and burrowed units pass.
 */
export function blockMove(sim: Sim, e: Enemy, from: number, dt: number) {
  if (e.distance <= from || !sim.state.towers.length) return;
  const { path, loop } = sim.mission.map;
  for (const { tower, stop } of standing(sim)) {
    const at = nextStop(stop, from, path.length, loop);
    if (at >= e.distance || !blockable(sim, tower, e)) continue;
    if (hasTrait(sim, e, "unstoppable")) {
      breach(sim, tower);
      continue;
    }
    e.distance = at;
    tower.wall = (tower.wall ?? 0) + CHEW * sim.content.enemies[e.type].size * dt;
    if (tower.wall >= wallHp(tower, sim.content)) breach(sim, tower);
  }
}
/** Forward moves outside `moveEnemies` (Magnetar's drag): halt at the first standing wall between `from` and the new distance, without chewing. */
export function clampToWall(sim: Sim, e: Enemy, from: number) {
  if (e.distance <= from || !sim.state.towers.length || hasTrait(sim, e, "unstoppable")) return;
  const { path, loop } = sim.mission.map;
  for (const { tower, stop } of standing(sim)) {
    const at = nextStop(stop, from, path.length, loop);
    if (at < e.distance && blockable(sim, tower, e)) e.distance = at;
  }
}
/** Whether a standing barricade holds the enemy right now (Grinder counts it as standing still). */
export function isBlocked(sim: Sim, e: Enemy) {
  const { path, loop } = sim.mission.map;
  for (const { tower, stop } of standing(sim)) {
    const d = loop ? ((e.distance - stop) % path.length + path.length) % path.length : e.distance - stop;
    if ((Math.abs(d) < 1e-6 || (loop && Math.abs(d - path.length) < 1e-6)) && blockable(sim, tower, e)) return true;
  }
  return false;
}
/** Render side: the wall's share from the definition alone (the upgrade table's latest `hp`), without a content pack. */
export function wallShareOf(t: Tower, d: Readonly<TowerDefinition>) {
  if (d.attack.kind !== "block") return 0;
  let hp = d.attack.hp;
  for (const u of d.upgrades) if (t.upgrades.includes(u.id) && u.effects.attack?.hp !== undefined) hp = u.effects.attack.hp;
  return Math.max(0, 1 - (t.wall ?? 0) / hp);
}
/** After every wave: barricades stand whole again. */
export function restoreBarricades(sim: Sim) {
  for (const t of sim.state.towers) delete t.wall;
}
