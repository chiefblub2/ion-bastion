import { expect } from "vitest";
import { Game } from "./game";
import { DEFAULT_CONTENT } from "../content";
import { attackEnemies, moveProjectiles } from "../systems/combat";
import { positionOnPath } from "../systems/path";
import { tickStatus } from "../systems/status";
import { resolveUpgrades } from "./upgrades";
import type { ContentPack, Enemy, EnemyDefinition, EnemyId, Point, Sim, Tower, TowerId, Trait } from "./types";
export function finishWave(game: Game) {
  let steps = 0;
  while (game.state.status === "wave" && steps++ < 30000) {
    game.tick();
    game.drainEvents();
  }
  expect(steps).toBeLessThan(30000);
}
/** Flies all projectiles to their targets without moving enemies. */
export function landProjectiles(sim: Sim) {
  for (let i = 0; i < 600 && sim.state.projectiles.length; i++) moveProjectiles(sim, 1 / 30);
  expect(sim.state.projectiles).toHaveLength(0);
}
/** Enemy placed directly into a test state. */
export function makeEnemy(id: number, type: EnemyId, x: number, y: number, distance = 10): Enemy {
  return { id, type, hp: 1000, maxHp: 1000, x, y, distance, status: [] };
}
/** The plain levels 2–5 of an attack tower or trap. */
export const LEVELS = ["level-2", "level-3", "level-4", "level-5"];
/** The plain levels 2–3 of a support tower, which branches after level 3. */
export const L3 = LEVELS.slice(0, 2);
/** `base` (the plain levels by default) plus the tiers 1..`tier` of the path `slug`. */
export const tiers = (slug: string, tier: number, base: string[] = LEVELS) => [...base, ...Array.from({ length: tier }, (_, i) => `${slug}-${i + 1}`)];
/** HP an enemy has lost. */
export const lost = (e: Enemy) => e.maxHp - e.hp;
/** A tower that belongs to no state. */
export function towerAt(id: number, type: TowerId, x: number, y: number, upgrades: string[] = []): Tower {
  return { id, type, x, y, upgrades, cooldown: 0, spent: 0, angle: 0, kills: 0, owner: 0 };
}
/** Places a tower straight into the state, without build rules or costs. */
export function place(g: Game, type: TowerId, x: number, y: number, upgrades: string[] = [], o: { owner?: number; cooldown?: number } = {}): Tower {
  const t = { ...towerAt(g.state.nextId++, type, x, y, upgrades), cooldown: o.cooldown ?? 0, owner: o.owner ?? 0 };
  g.state.towers.push(t);
  return t;
}
/** An enemy with `hp` (max HP at least 1000 unless given); pushed into `o.into`'s state when a game is given. */
export function foe(id: number, type: EnemyId, x: number, y: number, o: { hp?: number; maxHp?: number; distance?: number; into?: Game } = {}): Enemy {
  const hp = o.hp ?? 1000,
    e = { ...makeEnemy(id, type, x, y, o.distance), hp, maxHp: o.maxHp ?? Math.max(hp, 1000) };
  o.into?.state.enemies.push(e);
  return e;
}
/** An enemy at path distance `distance` of `g`'s map. */
export function walker(g: Game, id: number, type: EnemyId, distance: number): Enemy {
  const p = positionOnPath(g.mission.map.path, distance);
  return makeEnemy(id, type, p.x, p.y, distance);
}
/** Content where enemy types carry the given traits (and other overrides). */
export function withTraits(
  traits: Partial<Record<EnemyId, Trait[]>>,
  over: Partial<Record<EnemyId, Partial<EnemyDefinition>>> = {},
  base: ContentPack = DEFAULT_CONTENT,
): ContentPack {
  const enemies = { ...base.enemies };
  for (const id of new Set([...Object.keys(traits), ...Object.keys(over)]) as Set<EnemyId>)
    enemies[id] = { ...enemies[id], ...(traits[id] ? { traits: traits[id] } : {}), ...over[id] };
  return { ...base, enemies };
}
/** One tower (id 1) at (7,5) and enemies placed directly into the state; no build rules, no wave. */
export function arena(type: TowerId, upgrades: string[], enemies: Enemy[], content: ContentPack = DEFAULT_CONTENT) {
  const g = new Game(undefined, content),
    tower = towerAt(1, type, 7, 5, upgrades);
  g.state.towers.push(tower);
  g.state.nextId = 1000;
  g.state.enemies = enemies;
  return { g, tower, damage: resolveUpgrades(tower, content).stats.damage };
}
/** Fires `tower` once (cooldown reset) and lands every projectile. */
export function fire(g: Game, tower: Tower) {
  tower.cooldown = 0;
  attackEnemies(g, 0);
  landProjectiles(g);
}
/** A Game on the default map with a trap built on path cell `cell`. */
export function buildTrap(type: TowerId, cell = 2): { g: Game; at: Point; cell: number; tower: Tower } {
  const g = new Game(),
    at = g.mission.map.path[cell];
  g.state.wallets[0] = 10000;
  expect(g.command({ type: "build", tower: type, ...at }).ok).toBe(true);
  return { g, at, cell, tower: g.state.towers[0] };
}
/** Starts a wave without enemies, so commands run while it is on. */
export function openWave(g: Game) {
  g.command({ type: "start" });
  g.state.queue = [];
  g.state.enemies = [];
}
/** Runs one empty wave to its end, so the after-wave payouts happen. */
export function emptyWave(g: Game) {
  openWave(g);
  finishWave(g);
}
/** Advances only the clock and status effects. */
export function wait(g: Game, until: number) {
  g.state.time = until;
  tickStatus(g, 0);
}
export { play } from "./play";
export type { Build, Strategy } from "./play";
