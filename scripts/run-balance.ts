// Plays many Runs with a greedy bot and prints how deep they get, to tune `DEPTH_HP` and the rewards in `src/run/`.
// npx vite-node scripts/run-balance.ts [-- --seeds 40] [--verbose]
import { DEFAULT_CONTENT } from "../src/content";
import { Game } from "../src/core/game";
import { isSpecialization, upgradeOptions } from "../src/core/upgrades";
import { isSupport } from "../src/systems/attacks";
import type { ContentPack, MissionDefinition, TowerId } from "../src/core/types";
import { runMission } from "../src/run/generate";
import { chooseRoute, chooseStarter, finishMission, newRun, pickRelic, pickTower, RUN_LENGTH, type RunState } from "../src/run/run";
import { rng } from "../src/run/rng";
const args = process.argv.slice(2),
  flag = (name: string) => args.includes(`--${name}`),
  value = (name: string, fallback: number) => {
    const at = args.indexOf(`--${name}`);
    return at >= 0 ? Number(args[at + 1]) : fallback;
  };
const SEEDS = value("seeds", 40),
  verbose = flag("verbose"),
  /** Plays the source campaign mission (its own waves) with the run's roster instead: how strong is the bot? */
  baseline = flag("baseline");
/** Path cells within `range` of a cell centre: the bot builds where a tower sees most of the path. */
function coverage(m: MissionDefinition, x: number, y: number, range: number) {
  return m.map.path.filter((p) => (p.x - x) ** 2 + (p.y - y) ** 2 <= range * range).length;
}
/** Greedy player: before each wave it builds the roster round-robin on the best free cell, else buys the cheapest upgrade. */
function playMission(mission: MissionDefinition, content: ContentPack) {
  const g = new Game(mission, content),
    roster = g.availableTowers().filter((id) => !isSupport(content.towers[id].attack) || content.towers[id].attack.kind === "detect");
  let turn = 0;
  const build = () => {
    for (let k = 0; k < roster.length; k++) {
      const id: TowerId = roster[(turn + k) % roster.length],
        d = content.towers[id];
      if (d.attack.kind === "detect" && g.state.towers.some((t) => t.type === id)) continue;
      if (d.cost > g.state.wallets[0]) continue;
      let best: { x: number; y: number; score: number } | undefined;
      const trap = d.placement === "path",
        cells = trap ? mission.map.path.slice(Math.floor(mission.map.path.length * 0.3)) : undefined;
      for (let x = 0; x < mission.map.columns; x++)
        for (let y = 0; y < mission.map.rows; y++) {
          if (!g.canBuild(x, y, id)) continue;
          if (trap && !cells!.some((p) => p.x === x && p.y === y)) continue;
          const score = trap ? -cells!.findIndex((p) => p.x === x && p.y === y) : coverage(mission, x, y, d.range || 3);
          if (!best || score > best.score) best = { x, y, score };
        }
      if (best && g.command({ type: "build", tower: id, x: best.x, y: best.y }).ok) {
        turn = (turn + k + 1) % roster.length;
        return true;
      }
    }
    return false;
  };
  const upgrade = () => {
    const options = g.state.towers
      .flatMap((t) =>
        upgradeOptions(t, g.state.wallets[0], content)
          .filter((o) => o.status === "available" && !isSpecialization(o.definition!))
          .map((o) => ({ id: t.id, upgrade: o.definition!.id, cost: o.definition!.cost })),
      )
      .sort((a, b) => a.cost - b.cost);
    return !!options.length && g.command({ type: "upgrade", id: options[0].id, upgrade: options[0].upgrade }).ok;
  };
  // Towers first while there are few, then upgrades first: roughly what the campaign strategies do.
  const spend = () => {
    while (g.state.towers.length < 6 ? build() || upgrade() : upgrade() || build());
  };
  while (g.state.status === "ready") {
    spend();
    g.command({ type: "start" });
    let steps = 0;
    while (g.state.status === "wave" && steps++ < 40000) {
      g.tick();
      g.drainEvents();
    }
  }
  return { won: g.state.status === "won", lives: g.state.lives, wave: g.state.wave, energy: mission.reactorEnergy };
}
// `--mission <id> --roster a,b,c`: one source mission with its own waves, to check the bot itself.
const only = args.includes("--mission") ? args[args.indexOf("--mission") + 1] : undefined;
if (only) {
  const source = DEFAULT_CONTENT.missions.find((m) => m.id === only)!,
    roster = args[args.indexOf("--roster") + 1].split(",") as TowerId[];
  console.log(playMission({ ...source, availableTowers: roster }, DEFAULT_CONTENT));
  process.exit(0);
}
const depths = Array(RUN_LENGTH + 1).fill(0),
  stepWins = Array(RUN_LENGTH).fill(0),
  stepPlays = Array(RUN_LENGTH).fill(0),
  stepLives = Array(RUN_LENGTH).fill(0);
for (let seed = 1; seed <= SEEDS; seed++) {
  const choice = rng(seed * 7919);
  let run: RunState = chooseStarter(newRun(seed), Math.floor(choice() * 3), DEFAULT_CONTENT);
  // `--roster a,b,c`: the same starting roster in every run, to compare generated and source waves.
  if (args.includes("--roster")) run = { ...run, roster: args[args.indexOf("--roster") + 1].split(",") as TowerId[] };
  while (run.phase === "route") {
    run = chooseRoute(run, Math.floor(choice() * 2));
    const generated = runMission(run, run.node!, DEFAULT_CONTENT),
      source = DEFAULT_CONTENT.missions.find((m) => m.id === run.node!.mission)!,
      { mission, content } = baseline ? { mission: { ...source, availableTowers: run.roster }, content: DEFAULT_CONTENT } : generated,
      result = playMission(mission, content);
    stepPlays[run.step]++;
    if (result.won) {
      stepWins[run.step]++;
      stepLives[run.step] += result.lives / result.energy;
    }
    if (verbose)
      console.log(`seed ${seed} step ${run.step + 1} ${run.node!.kind.padEnd(6)} ${mission.name.padEnd(24)} [${run.roster.join(",")}] ${result.won ? `won ${result.lives}/${result.energy}` : `lost at wave ${result.wave}`}`);
    run = finishMission(run, result.won, DEFAULT_CONTENT);
    if (run.phase === "reward") {
      const towers = run.offers.towers!,
        armed = towers.find((id) => !isSupport(DEFAULT_CONTENT.towers[id].attack) && DEFAULT_CONTENT.towers[id].placement !== "path");
      run = pickTower(run, armed ?? towers[0], DEFAULT_CONTENT);
      if (run.offers.relics) run = pickRelic(run, run.offers.relics[0], DEFAULT_CONTENT);
    }
  }
  depths[run.history.filter((h) => h.won).length]++;
}
console.log(`${SEEDS} runs, greedy bot`);
for (let s = 0; s < RUN_LENGTH; s++)
  console.log(`mission ${s + 1}: won ${stepWins[s]}/${stepPlays[s]}${stepWins[s] ? `, reactor left ${Math.round((100 * stepLives[s]) / stepWins[s])}%` : ""}`);
console.log(`missions won per run: ${depths.map((n, d) => `${d}: ${n}`).join("  ")}`);
