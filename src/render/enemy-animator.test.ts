import { describe, expect, it } from "vitest";
import { Game } from "../core/game";
import { makeEnemy } from "../core/test-helpers";
import type { GameEvent } from "../core/types";
import { applyDamage } from "../systems/damage";
import { animationsFor, clipDuration, type AnimationClip } from "./enemy-animations";
import { animate, ANIMATION_TIMING, freshTrack, killedEnemies } from "./enemy-animator";

const set = animationsFor("tank")!,
  all = () => true;
/** One frame at `now` with the unit at `distance`, hit last at `struck`. */
const step = (track: ReturnType<typeof freshTrack>, now: number, distance: number, struck = -Infinity, visible = true, usable: (c: AnimationClip) => boolean = all) =>
  animate(track, set, usable, { now, distance, struck, visible });

describe("animation state", () => {
  it("idles while standing, moves while travelling, and only idles again after a short still spell", () => {
    const t = freshTrack(3, 0);
    expect(step(t, 0.1, 3)?.clip).toBe(set.idle);
    expect(step(t, 0.2, 3.1)?.clip).toBe(set.move);
    // Render frames between simulation ticks see no movement: still moving.
    expect(step(t, 0.21, 3.1)?.clip).toBe(set.move);
    expect(step(t, 0.2 + ANIMATION_TIMING.still - 0.01, 3.1)?.clip).toBe(set.move);
    expect(step(t, 0.2 + ANIMATION_TIMING.still + 0.01, 3.1)?.clip).toBe(set.idle);
  });

  it("freezes clip and frame while the effect clock stands (pause)", () => {
    const t = freshTrack(0, 0),
      moving = step(t, 0.5, 1)!;
    for (let i = 0; i < 5; i++) expect(step(t, 0.5, 1)).toEqual(moving);
  });

  it("starts one hurt clip per fresh hit, coalesces hits, never restarts it, and returns to the loop", () => {
    const t = freshTrack(0, 0),
      hurt = clipDuration(set.hurt!);
    expect(step(t, 1, 0, 1)).toMatchObject({ clip: set.hurt, frame: 0, hurt: true });
    // More hits during the clip (same frame or later) neither restart nor extend it.
    expect(step(t, 1 + hurt / 2, 0, 1 + hurt / 2)).toMatchObject({ clip: set.hurt, frame: Math.floor((hurt / 2) * set.hurt!.fps) });
    expect(step(t, 1 + hurt + 0.01, 0, 1 + hurt)?.clip).toBe(set.idle);
    // Within the gap after a clip, sustained fire plays no new one.
    expect(step(t, 1 + hurt + 0.2, 0, 1 + hurt + 0.2)?.clip).toBe(set.idle);
    const later = 1 + hurt + ANIMATION_TIMING.hurtGap + 0.05;
    expect(step(t, later, 0, later)?.clip).toBe(set.hurt);
  });

  it("starts no hurt clip for a hidden unit or for a stale hit seen on reappearing", () => {
    const t = freshTrack(0, 0);
    expect(step(t, 1, 0, 1, false)?.clip).toBe(set.idle);
    expect(step(t, 1.2, 0, 1)?.clip).toBe(set.idle);
    const u = freshTrack(0, 0);
    expect(step(u, 2, 0, 1.5)?.clip).toBe(set.idle);
  });

  it("falls back: move ↔ idle, no hurt without its clip, nothing without a loop", () => {
    const noMove = (c: AnimationClip) => c !== set.move,
      noIdle = (c: AnimationClip) => c !== set.idle;
    expect(step(freshTrack(0, 0), 0.1, 1, -Infinity, true, noMove)?.clip).toBe(set.idle);
    expect(step(freshTrack(0, 0), 0.1, 0, -Infinity, true, noIdle)?.clip).toBe(set.move);
    expect(step(freshTrack(0, 0), 0.1, 0, 0.1, true, (c) => c !== set.hurt)?.clip).toBe(set.idle);
    expect(step(freshTrack(0, 0), 0.1, 0, -Infinity, true, (c) => c === set.hurt || c === set.death)).toBeUndefined();
  });

  it("loops on the global clock plus the unit's phase", () => {
    const a = step(freshTrack(0, 0, 0), 0.3, 0)!,
      b = step(freshTrack(0, 0, 0.25), 0.3, 0)!;
    expect(a.frame).toBe(Math.floor(0.3 * set.idle!.fps) % set.idle!.frames);
    expect(b.frame).toBe(Math.floor(0.55 * set.idle!.fps) % set.idle!.frames);
  });
});

describe("death attribution", () => {
  const damage = (enemy: number, x: number, amount = 5): GameEvent => ({ type: "damage", enemy, amount, at: { x, y: 1 } }),
    kill = (x: number): GameEvent => ({ type: "kill", at: { x, y: 1 }, color: 0xff0000, reward: 3 });

  it("takes only a kill directly after its victim's damage at the same spot", () => {
    const killed = killedEnemies([damage(1, 2), damage(2, 4), kill(4), damage(3, 6), { type: "evade", at: { x: 6, y: 1 } }, kill(6), damage(4, 8), kill(9)]);
    expect([...killed.keys()]).toEqual([2]);
    expect(killedEnemies([kill(1), damage(1, 1, 0), kill(1)]).size).toBe(0);
  });

  it("matches the simulation: a lethal hit is attributed, a leak is not", () => {
    const g = new Game();
    g.command({ type: "start" });
    const path = g.map.path,
      dying = makeEnemy(9001, "drone", 3, 3),
      leaking = { ...makeEnemy(9002, "tank", path.at(-1)!.x, path.at(-1)!.y, path.length - 1.01) };
    g.state.enemies = [dying, leaking, makeEnemy(9003, "drone", 3, 3)];
    g.drainEvents();
    applyDamage(g, { tower: 0, type: "pulse" }, dying, 5000);
    g.tick();
    const events = g.drainEvents();
    expect(events.some((e) => e.type === "leak")).toBe(true);
    expect([...killedEnemies(events).keys()]).toEqual([9001]);
    expect(g.state.enemies.some((e) => e.id === 9001 || e.id === 9002)).toBe(false);
  });
});
