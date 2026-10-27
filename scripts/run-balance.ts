// Plays many Runs with a greedy bot and prints how far they get, to tune `src/run/tuning.ts`.
// npx vite-node scripts/run-balance.ts [-- --seeds 30] [--length full|short] [--threat n] [--act n] [--until n] [--relic id]
//                                      [--no-ranks] [--no-doctrines] [--verbose] [--baseline] [--mission <id> --roster a,b,c]
import { DEFAULT_CONTENT } from "../src/content";
import { Game } from "../src/core/game";
import { upgradeOptions } from "../src/core/upgrades";
import { isSupport } from "../src/systems/attacks";
import { pageOf } from "../src/ui/tower-pages";
import type { ContentPack, MissionDefinition, TowerId } from "../src/core/types";
import { runMission } from "../src/run/generate";
import { isMissionKind, missionsOf, type RunNode } from "../src/run/map";
import { isRelic } from "../src/run/relics";
import { rng } from "../src/run/rng";
import {
  chooseNode,
  chooseStarter,
  continueRun,
  doctrineCandidates,
  doctrinePaths,
  eventChoice,
  finishMission,
  gainRelic,
  mapChoices,
  newRun,
  pickDoctrine,
  pickRelic,
  pickTower,
  repairChoice,
  rosterCap,
  runDepth,
  type MissionResult,
  type RunState,
} from "../src/run/run";
import { buy } from "../src/run/shop";
import { eventOf } from "../src/run/events";
import { relicOf } from "../src/run/relics";
import { missionStars } from "../src/app/rating";
const args = process.argv.slice(2),
  flag = (name: string) => args.includes(`--${name}`),
  value = (name: string) => {
    const at = args.indexOf(`--${name}`);
    return at >= 0 ? args[at + 1] : undefined;
  };
const SEEDS = Number(value("seeds") ?? 30),
  LENGTH = value("length") === "short" ? "short" : "full",
  THREAT = Number(value("threat") ?? 0),
  ACT = Number(value("act") ?? -1),
  /** `--until n`: stop each run after act n (1-based), for quick act-by-act tuning. */
  UNTIL = Number(value("until") ?? 99),
  RELIC = value("relic"),
  verbose = flag("verbose"),
  noRanks = flag("no-ranks"),
  noDoctrines = flag("no-doctrines"),
  /** Plays the source campaign mission (its own waves) with the run's roster instead: how strong is the bot? */
  baseline = flag("baseline");
const content = DEFAULT_CONTENT;
/** Path cells within `range` of a cell centre: the bot builds where a tower sees most of the path. */
function coverage(m: MissionDefinition, x: number, y: number, range: number) {
  return m.map.path.filter((p) => (p.x - x) ** 2 + (p.y - y) ** 2 <= range * range).length;
}
/** Greedy player: before each wave it builds the roster round-robin on the best free cell, else buys the cheapest upgrade (Doctrine tiers included). */
function playMission(mission: MissionDefinition, pack: ContentPack) {
  const g = new Game(mission, pack),
    // Damage dealers twice in the rotation: a player builds more of what kills than of what slows.
    roster = g
      .availableTowers()
      .filter((id) => !isSupport(pack.towers[id].attack) || pack.towers[id].attack.kind === "detect")
      .flatMap((id) => (pageOf(pack.towers[id]) === 0 ? [id, id] : [id]));
  let turn = 0;
  const build = () => {
    for (let k = 0; k < roster.length; k++) {
      const id: TowerId = roster[(turn + k) % roster.length],
        d = pack.towers[id];
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
        upgradeOptions(t, g.state.wallets[0], pack)
          .filter((o) => o.status === "available")
          .map((o) => ({ id: t.id, upgrade: o.definition!.id, cost: o.definition!.cost })),
      )
      .sort((a, b) => a.cost - b.cost);
    return !!options.length && g.command({ type: "upgrade", id: options[0].id, upgrade: options[0].upgrade }).ok;
  };
  // Towers first while there are few, then upgrades first: roughly what the campaign strategies do.
  const spend = () => {
    while (g.state.towers.length < 6 ? build() || upgrade() : upgrade() || build());
  };
  const waveTimes: number[] = [];
  while (g.state.status === "ready") {
    spend();
    g.command({ type: "start" });
    const t0 = g.state.time;
    let steps = 0;
    while (g.state.status === "wave" && steps++ < 60000) {
      g.tick();
      g.drainEvents();
    }
    waveTimes.push(g.state.time - t0);
  }
  const kills: Partial<Record<TowerId, number>> = {};
  for (const t of g.state.towers) kills[t.type] = (kills[t.type] ?? 0) + t.kills;
  const won = g.state.status === "won";
  const result: MissionResult = {
    won,
    lives: g.state.lives,
    kills,
    built: [...new Set(g.state.towers.map((t) => t.type))],
    stars: won ? missionStars(mission, g.state) : undefined,
    wave: g.state.wave,
  };
  // What the mission paid in all (invested in towers plus left over) and what was still unspent at the end.
  const left = g.state.wallets[0];
  return { result, waveTimes, left, earned: left + g.state.towers.reduce((n, t) => n + t.spent, 0) };
}
// `--mission <id> --roster a,b,c`: one source mission with its own waves, to check the bot itself.
const only = value("mission");
if (only) {
  const source = content.missions.find((m) => m.id === only)!,
    roster = value("roster")!.split(",") as TowerId[];
  console.log(playMission({ ...source, availableTowers: roster }, content).result);
  process.exit(0);
}
const armed = (id: TowerId) => !isSupport(content.towers[id].attack) && content.towers[id].placement !== "path";
/** The bot's choices between missions: repairs when hurt, shops with Scrap, Doctrines for its best tower. */
function decide(run: RunState, pick: () => number): RunState {
  if (run.offers.towers) {
    const id = run.offers.towers.find(armed) ?? run.offers.towers[0],
      worst = [...run.roster].sort((a, b) => (run.ranks[a] ?? 0) - (run.ranks[b] ?? 0))[0];
    run = pickTower(run, id, run.roster.length >= rosterCap(run) ? worst : undefined);
  }
  if (run.offers.relics) run = pickRelic(run, "relics", run.offers.relics[0]);
  if (run.offers.prize) run = pickRelic(run, "prize", run.offers.prize.find((id) => relicOf(id).rarity !== "cursed") ?? null);
  if (run.offers.legendary) run = pickRelic(run, "legendary", noDoctrines || !run.offers.doctrine ? run.offers.legendary[0] : null);
  if (run.offers.doctrine) {
    const best = [...doctrineCandidates(run, content)].sort((a, b) => (run.ranks[b] ?? 0) - (run.ranks[a] ?? 0))[0];
    run = pickDoctrine(run, noDoctrines ? null : (best ?? null), best && doctrinePaths(run, best, content)[0], content);
    if (run.offers.legendary) run = pickRelic(run, "legendary", run.offers.legendary[0]);
  }
  if (run.offers.repair) run = repairChoice(run, run.reactor < run.reactorMax ? "heal" : "reinforce");
  if (run.offers.event) {
    const choices = eventOf(run.offers.event)!.choices(run, content),
      i = choices.findIndex((c) => c.ok);
    run = eventChoice(run, Math.max(0, i), content);
  }
  if (run.offers.shop) {
    const best = [...run.roster].sort((a, b) => (run.ranks[b] ?? 0) - (run.ranks[a] ?? 0))[0];
    for (let guard = 0; guard < 6; guard++) {
      const stock = run.offers.shop!,
        order = ["patch", "doctrine", "funds", "drill", "xp"],
        i = order
          .map((kind) => stock.findIndex((s) => s.kind === kind && !s.sold && s.price <= run.scrap && !(kind === "patch" && run.reactor > run.reactorMax * 0.7)))
          .find((x) => x >= 0);
      if (i === undefined) break;
      const item = stock[i],
        path = item.kind === "doctrine" ? doctrinePaths(run, best, content)[0] : undefined;
      if (item.kind === "doctrine" && (noDoctrines || !path)) break;
      const next = buy(run, i, content, { tower: best, path });
      if (next === run) break;
      run = next;
    }
  }
  if (run.offers.towers) run = decide(run, pick);
  void pick;
  return continueRun(run, content);
}
/** Map choice: repair when hurt, a shop with Scrap, otherwise standard missions before elites. */
function chooseLane(run: RunState, pick: () => number): number {
  const choices = mapChoices(run, content),
    score = (n: RunNode) =>
      n.kind === "repair" ? (run.reactor < run.reactorMax * 0.5 ? 5 : 1) : n.kind === "shop" ? (run.scrap >= 30 ? 4 : 1) : n.kind === "forge" ? (run.scrap >= 55 ? 3 : 1) : n.kind === "elite" ? 0 : 2,
    best = Math.max(...choices.map(score)),
    top = choices.filter((n) => score(n) === best);
  return top[Math.floor(pick() * top.length)].lane;
}
const total = missionsOf(LENGTH),
  plays = new Map<string, { won: number; played: number; reactor: number; leak: number; left: number[]; earned: number[]; waves: number }>(),
  depths = Array(total + 1).fill(0),
  waveTimes: number[] = [];
let simSeconds = 0;
for (let seed = 1; seed <= SEEDS; seed++) {
  const pick = rng(seed * 7919);
  let run: RunState = chooseStarter(newRun(seed, { length: LENGTH, threat: THREAT }, content), Math.floor(pick() * 3));
  if (RELIC && isRelic(RELIC)) run = gainRelic(run, RELIC);
  if (args.includes("--roster")) run = { ...run, roster: value("roster")!.split(",") as TowerId[] };
  while (run.phase !== "won" && run.phase !== "lost") {
    if (run.phase === "map") run = chooseNode(run, chooseLane(run, pick), content);
    else if (run.phase === "mission") {
      const node = run.node!;
      if (node.act + 1 > UNTIL) break;
      if (noRanks) run = { ...run, ranks: {} };
      // `--act n`: earlier acts are won on paper (2 energy lost per mission) to reach act n with a plausible roster.
      if (node.act + 1 < ACT) {
        run = finishMission(run, { won: true, lives: Math.max(1, run.reactor - 2), kills: Object.fromEntries(run.roster.map((id) => [id, 30])), built: run.roster, stars: 2 }, content);
        continue;
      }
      const generated = runMission(run, node, content),
        source = content.missions.find((m) => m.id === node.mission)!,
        { mission, content: pack } = baseline ? { mission: { ...source, availableTowers: run.roster }, content } : generated,
        played = playMission(mission, pack),
        key = `act ${Math.min(node.act, 3) + 1} ${node.kind}`,
        entry = plays.get(key) ?? { won: 0, played: 0, reactor: 0, leak: 0, left: [], earned: [], waves: 0 };
      entry.played++;
      entry.waves += mission.waves.length;
      if (played.result.won) {
        entry.won++;
        entry.reactor += played.result.lives / run.reactorMax;
        entry.leak += (mission.reactorEnergy - played.result.lives) / run.reactorMax;
        entry.left.push(played.left);
        entry.earned.push(played.earned);
      }
      plays.set(key, entry);
      waveTimes.push(...played.waveTimes);
      simSeconds += played.waveTimes.reduce((a, b) => a + b, 0);
      if (verbose)
        console.log(
          `seed ${seed} m${runDepth(run) + 1} ${key.padEnd(15)} ${mission.name.padEnd(24)} [${run.roster.join(",")}] ${played.result.won ? `won ${played.result.lives}/${mission.reactorEnergy}` : `lost at wave ${played.result.wave}`} scrap ${run.scrap} relics ${run.relics.length} doctrines ${run.doctrines.length}`,
        );
      run = finishMission(run, played.result, content);
    } else run = decide(run, pick);
    if (!isMissionKind(run.node?.kind ?? "shop") && run.phase === "mission") break;
  }
  depths[runDepth(run)]++;
}
const median = (v: number[]) => (v.length ? [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)] : 0);
const sorted = [...waveTimes].sort((a, b) => a - b),
  pct = (p: number) => (sorted.length ? sorted[Math.floor(sorted.length * p)].toFixed(1) : "-");
console.log(`${SEEDS} ${LENGTH} runs at threat ${THREAT}, greedy bot${noRanks ? ", no ranks" : ""}${noDoctrines ? ", no doctrines" : ""}${RELIC ? `, relic ${RELIC}` : ""}`);
for (const [key, e] of [...plays].sort(([a], [b]) => a.localeCompare(b)))
  console.log(
    `${key.padEnd(16)} won ${String(e.won).padStart(3)}/${String(e.played).padEnd(3)} ${((100 * e.won) / e.played).toFixed(0).padStart(3)}%  ${(e.waves / e.played).toFixed(0).padStart(2)} waves${e.won ? `  reactor left ${Math.round((100 * e.reactor) / e.won)}%, lost ${Math.round((100 * e.leak) / e.won)}% per win; credits per win: earned ${median(e.earned)}, left ${median(e.left)} (median)` : ""}`,
  );
console.log(`missions won per run: ${depths.map((n, d) => `${d}: ${n}`).join("  ")}`);
console.log(`completed: ${depths[total]}/${SEEDS} (${Math.round((100 * depths[total]) / SEEDS)}%)`);
console.log(`wave game time: median ${pct(0.5)} s, p10 ${pct(0.1)} s, p90 ${pct(0.9)} s; game minutes per run ${(simSeconds / 60 / SEEDS).toFixed(0)}`);
