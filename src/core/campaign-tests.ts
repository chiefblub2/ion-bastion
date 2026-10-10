import { afterAll, describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import { MISSIONS } from "../content/missions";
import { runKey, shardCache } from "./campaign-cache";
import { Game } from "./game";
import { fnv } from "./hash";
import { hasAir, isTutorial, novaOnly, PENDING_BALANCE, thinBuilds, unbuildable } from "./mission-checks";
import { play, type Build, type Strategy } from "./play";
import { STRATEGIES } from "./strategies";
import type { MissionDefinition } from "./types";
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
 * Results come from the input cache (`campaign-cache.ts`) when nothing a run depends on changed.
 */
export function campaignShard(shard: number) {
  const missions = MISSIONS.filter((m) => shardOf(m.id) === shard),
    cache = shardCache(shard);
  afterAll(() => cache.save());
  /** Final status of a run with these builds (none: no defense). */
  const outcome = (kind: string, m: MissionDefinition, builds: readonly Build[]) =>
    cache.get(runKey(kind, m, null, builds, DEFAULT_CONTENT), () => {
      const { game } = play(m, builds.length ? { builds } : undefined);
      const s = game.state;
      // A finished mission must reject further commands.
      const rejects = !game.command({ type: "build", tower: "pulse", x: 0, y: 0 }).ok;
      return { status: s.status, lives: s.lives, enemies: s.enemies.length, rejects };
    });
  const golden = (m: MissionDefinition, strategy: Strategy) =>
    cache.get(runKey("golden", m, strategy, strategy.builds, DEFAULT_CONTENT), () => {
      const waves: string[] = [];
      const { game } = play(m, strategy, (g) => waves.push(trace(g)));
      return { waves: waves.join("\n"), final: trace(game), status: game.state.status, lives: game.state.lives, unbuildable: unbuildable(m, strategy) };
    });
  describe("golden replays", () => {
    for (const m of missions)
      for (const key of ["A", "B"] as const)
        it(`${m.id} defense ${key}`, () => {
          const strategy = STRATEGIES[m.id]?.[key];
          expect(strategy).toBeDefined();
          const run = golden(m, strategy!);
          expect(run.waves).toMatchSnapshot();
          expect(run.final).toMatchSnapshot();
          if (PENDING_BALANCE.has(`${m.id}/${key}`)) return;
          expect(run.unbuildable).toEqual([]);
          expect(run.status).toBe("won");
          expect(run.lives).toBeGreaterThan(0);
        }, TIMEOUT);
  });
  describe("missions", () => {
    for (const m of missions)
      // Named by id too, so `vitest run src/core/replay -t <missionId>` selects both blocks.
      describe(`${m.id} (${m.name})`, () => {
        it("is lost without any defense", () => {
          const run = outcome("none", m, []);
          expect(run.status).toBe("lost");
          // A ring has no reactor: the enemy limit ends it instead.
          if (m.circle) expect(run.enemies).toBeGreaterThan(m.circle.limit);
          else expect(run.lives).toBe(0);
          expect(run.rejects).toBe(true);
        }, TIMEOUT);
        if (hasAir(m))
          it("is lost with a ground-only Nova defense", () => {
            expect(outcome("nova", m, novaOnly(STRATEGIES[m.id].A)).status).toBe("lost");
          }, TIMEOUT);
        // On a ring every shot eventually finds a target, so a few fully upgraded towers
        // are a legitimate tactic there; a single tower must still fall short.
        if (m.circle)
          it("is lost with a single tower", () => {
            expect(outcome("thin", m, thinBuilds(m, STRATEGIES[m.id].A)).status).toBe("lost");
          }, TIMEOUT);
        // Mission 01 is the tutorial: three upgraded towers are meant to suffice.
        else if (!isTutorial(m))
          it("is lost with a thin defense of three towers", () => {
            expect(outcome("thin", m, thinBuilds(m, STRATEGIES[m.id].A)).status).toBe("lost");
          }, TIMEOUT);
      });
  });
}
