import { describe, expect, it } from "vitest";
import { MISSIONS } from "../content/missions";
import { Game } from "./game";
import { fnv } from "./hash";
import { hasAir, isTutorial, novaOnly, PENDING_BALANCE, thinBuilds, unbuildable } from "./mission-checks";
import { play } from "./play";
import { STRATEGIES } from "./strategies";
/** Number of `replay-N.test.ts` files; vitest runs files in parallel, tests within a file in sequence. */
export const SHARDS = 14;
/** Stable shard of a mission: by id, so inserting a sector never moves snapshots between files. */
const shardOf = (id: string) => fnv(id) % SHARDS;
/** A finale takes 2–3 s alone; parallel shards on a busy machine must not trip vitest's 5 s default. */
const TIMEOUT = 60_000;
export function trace(game: Game) {
  const s = game.state;
  return `w${s.wave} ${s.status} lives=${s.lives} gold=${s.wallets[0]} kills=${s.kills} towerKills=${s.towers.map((t) => t.kills).join("/")}`;
}
/**
 * Every campaign simulation of one shard. Golden replays: every mission and strategy must produce
 * exactly the same course of the game; a snapshot change means the simulation changed (update only
 * on purpose with `npx vitest run src/core/replay -u` and review the diff). The same run checks the
 * win, so each strategy is simulated once. The per-mission loss checks run alongside.
 */
export function campaignShard(shard: number) {
  const missions = MISSIONS.filter((m) => shardOf(m.id) === shard);
  describe("golden replays", () => {
    for (const m of missions)
      for (const key of ["A", "B"] as const)
        it(`${m.id} defense ${key}`, () => {
          const strategy = STRATEGIES[m.id]?.[key];
          expect(strategy).toBeDefined();
          const waves: string[] = [];
          const { game } = play(m, strategy, (g) => waves.push(trace(g)));
          expect(waves.join("\n")).toMatchSnapshot();
          expect(trace(game)).toMatchSnapshot();
          if (PENDING_BALANCE.has(`${m.id}/${key}`)) return;
          expect(unbuildable(m, strategy)).toEqual([]);
          expect(game.state.status).toBe("won");
          expect(game.state.lives).toBeGreaterThan(0);
        }, TIMEOUT);
  });
  describe("missions", () => {
    for (const m of missions)
      describe(m.name, () => {
        it("is lost without any defense", () => {
          const { game } = play(m);
          expect(game.state.status).toBe("lost");
          // A ring has no reactor: the enemy limit ends it instead.
          if (m.circle) expect(game.state.enemies.length).toBeGreaterThan(m.circle.limit);
          else expect(game.state.lives).toBe(0);
          expect(game.command({ type: "build", tower: "pulse", x: 0, y: 0 }).ok).toBe(false);
        }, TIMEOUT);
        if (hasAir(m))
          it("is lost with a ground-only Nova defense", () => {
            const { game } = play(m, { builds: novaOnly(STRATEGIES[m.id].A) });
            expect(game.state.status).toBe("lost");
          }, TIMEOUT);
        // On a ring every shot eventually finds a target, so a few fully upgraded towers
        // are a legitimate tactic there; a single tower must still fall short.
        if (m.circle)
          it("is lost with a single tower", () => {
            const { game } = play(m, { builds: thinBuilds(m, STRATEGIES[m.id].A) });
            expect(game.state.status).toBe("lost");
          }, TIMEOUT);
        // Mission 01 is the tutorial: three upgraded towers are meant to suffice.
        else if (!isTutorial(m))
          it("is lost with a thin defense of three towers", () => {
            const { game } = play(m, { builds: thinBuilds(m, STRATEGIES[m.id].A) });
            expect(game.state.status).toBe("lost");
          }, TIMEOUT);
      });
  });
}
