/**
 * Behaviour fingerprint of the simulation: plays strategies A and B on every campaign and circuit mission and prints
 * one state hash per mission and strategy (plus the lives after each wave). A refactor that must not change gameplay
 * has to leave the output identical:
 *   npx vite-node scripts/sim-golden.ts > before.txt   (refactor)   npx vite-node scripts/sim-golden.ts | diff before.txt -
 * Optional: --mission <id>.
 */
import { MISSIONS } from "../src/content/missions";
import { stateHash } from "../src/core/hash";
import { play } from "../src/core/play";
import { STRATEGIES } from "../src/core/strategies/index";

const only = process.argv.includes("--mission") ? process.argv[process.argv.indexOf("--mission") + 1] : undefined;
for (const mission of MISSIONS) {
  if (only && mission.id !== only) continue;
  for (const key of ["A", "B"] as const) {
    const strategy = STRATEGIES[mission.id]?.[key];
    if (!strategy) continue;
    let mix = 0;
    const { game, lives } = play(mission, strategy, undefined, (g) => {
      if (g.ticks % 150 === 0) mix = (Math.imul(mix, 31) + stateHash(g.state)) >>> 0;
    });
    console.log(`${mission.id} ${key} ${game.state.status} ${stateHash(game.state)} ${mix.toString(16)} ${lives.join(",")}`);
  }
}
