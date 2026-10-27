// Plays many Runs with a bot (scripts/bot.ts) and prints how far they get, to tune `src/run/tuning.ts`.
// npx vite-node scripts/run-balance.ts [-- --seeds 30] [--length full|short] [--threat n] [--act n] [--until n] [--relic id]
//                                      [--no-ranks] [--no-doctrines] [--verbose] [--baseline] [--bot greedy] [--habits a,b]
//                                      [--mission <id> --roster a,b,c] [--benchmark]
import { DEFAULT_CONTENT } from "../src/content";
import { isSupport } from "../src/systems/attacks";
import { pageOf } from "../src/ui/tower-pages";
import type { TowerId } from "../src/core/types";
import { GREEDY, playBot, STEADY, type Habits } from "./bot";
import { STRATEGIES } from "../src/core/strategies";
import { play } from "../src/core/play";
import { actTiers } from "../src/run/acts";
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
import { relicOf, type RelicId } from "../src/run/relics";
import { relicFit } from "../src/run/relic-fit";
import { rankOf } from "../src/run/ranks";
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
  baseline = flag("baseline"),
  /** `--relic-pick fit`: the bot takes the offered relic that fits its roster best instead of the first card. */
  fitPick = value("relic-pick") === "fit";
/** Relic statistics: offered cards, how many fit the roster, which were taken. */
const relicStats = { cards: 0, fitting: 0, synergy: 0, draftsWithSynergy: 0, drafts: 0, taken: new Map<string, number>() };
function chooseRelic(run: RunState, offers: readonly RelicId[]): RelicId {
  relicStats.drafts++;
  const fits = offers.map((id) => relicFit(run, id, content));
  relicStats.cards += offers.length;
  relicStats.fitting += fits.filter((f) => f.fits).length;
  relicStats.synergy += fits.filter((f) => f.synergy).length;
  if (fits.some((f) => f.synergy)) relicStats.draftsWithSynergy++;
  const id = fitPick ? (offers[fits.findIndex((f) => f.synergy)] ?? offers[fits.findIndex((f) => f.fits)] ?? offers[0]) : offers[0];
  relicStats.taken.set(id, (relicStats.taken.get(id) ?? 0) + 1);
  return id;
}
const content = DEFAULT_CONTENT;
/**
 * The bot's habits (scripts/bot.ts): the measured default `STEADY`; `--bot greedy` plays the old bot (fixed build order,
 * cheapest upgrade first) to see how much careful choices matter; `--habits a,b` turns on only those.
 */
const habits: Habits = value("habits")
    ? { ...GREEDY, ...Object.fromEntries(value("habits")!.split(",").map((h) => [h, true])) }
    : value("bot") === "greedy"
      ? GREEDY
      : STEADY,
  playMission = (mission: Parameters<typeof playBot>[0], pack: Parameters<typeof playBot>[1]) => playBot(mission, pack, habits);
// `--mission <id> --roster a,b,c`: one source mission with its own waves, to check the bot itself.
const only = value("mission");
if (only) {
  const source = content.missions.find((m) => m.id === only)!,
    roster = value("roster")!.split(",") as TowerId[];
  console.log(playMission({ ...source, availableTowers: roster }, content).result);
  process.exit(0);
}
// `--benchmark`: the bot on the acts' source missions with the towers of strategy A, next to strategy A itself.
if (flag("benchmark")) {
  let bot = 0,
    hand = 0,
    n = 0;
  for (const source of actTiers(content).slice(0, 3).flatMap((t) => t.missions)) {
    const strategy = STRATEGIES[source.id]?.A;
    if (!strategy) continue;
    const towers = [...new Set(strategy.builds.map((b) => b.tower))],
      mine = playMission({ ...source, availableTowers: towers }, content).result,
      theirs = play(source, strategy).game.state;
    n++;
    if (mine.won) bot++;
    if (theirs.status === "won") hand++;
    console.log(
      `${source.id.padEnd(22)} [${towers.join(",")}]  bot ${mine.won ? `won ${mine.lives}/${source.reactorEnergy}` : `lost at wave ${mine.wave}`}  ·  strategy A ${theirs.status === "won" ? `won ${theirs.lives}/${source.reactorEnergy}` : `lost at wave ${theirs.wave}`}`,
    );
  }
  console.log(`bot won ${bot}/${n}, strategy A won ${hand}/${n}`);
  process.exit(0);
}
const armed = (id: TowerId) => !isSupport(content.towers[id].attack) && content.towers[id].placement !== "path";
/** The bot's choices between missions: repairs when hurt, shops with Scrap, Doctrines for its best tower. */
function decide(run: RunState, pick: () => number): RunState {
  if (run.offers.towers) {
    // An anti-air attack tower while fewer than two guard the sky, else an attack tower, else the first offer.
    const antiAir = (id: TowerId) => armed(id) && pageOf(content.towers[id]) === 0 && content.towers[id].targets.includes("air"),
      skyGuards = run.roster.filter(antiAir).length,
      id = (skyGuards < 2 ? run.offers.towers.find(antiAir) : undefined) ?? run.offers.towers.find(armed) ?? run.offers.towers[0],
      worst = [...run.roster].sort((a, b) => (run.ranks[a] ?? 0) - (run.ranks[b] ?? 0))[0];
    run = pickTower(run, id, run.roster.length >= rosterCap(run) ? worst : undefined);
  }
  if (run.offers.relics) run = pickRelic(run, "relics", chooseRelic(run, run.offers.relics));
  if (run.offers.prize) run = pickRelic(run, "prize", run.offers.prize.find((id) => relicOf(id).rarity !== "cursed") ?? null);
  if (run.offers.legendary) run = pickRelic(run, "legendary", noDoctrines || !run.offers.doctrine ? chooseRelic(run, run.offers.legendary) : null);
  if (run.offers.doctrine) {
    const best = [...doctrineCandidates(run, content)].sort((a, b) => (run.ranks[b] ?? 0) - (run.ranks[a] ?? 0))[0];
    run = pickDoctrine(run, noDoctrines ? null : (best ?? null), best && doctrinePaths(run, best, content)[0], content);
    if (run.offers.legendary) run = pickRelic(run, "legendary", chooseRelic(run, run.offers.legendary));
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
  waveTimes: number[] = [],
  protocols = new Map<string, number>(),
  ends: { scrap: number; reactor: number; roster: number; ranks: number[]; relics: number; doctrines: number }[] = [],
  types = new Set<string>();
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
      for (const [k, n] of Object.entries(played.protocols)) protocols.set(k, (protocols.get(k) ?? 0) + n);
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
  ends.push({
    scrap: run.scrap,
    reactor: run.reactor / run.reactorMax,
    roster: run.roster.length,
    ranks: run.roster.map((id) => rankOf(run.ranks[id])),
    relics: run.relics.length,
    doctrines: run.doctrines.length,
  });
  for (const id of run.roster) types.add(id);
}
const median = (v: number[]) => (v.length ? [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)] : 0);
const sorted = [...waveTimes].sort((a, b) => a - b),
  pct = (p: number) => (sorted.length ? sorted[Math.floor(sorted.length * p)].toFixed(1) : "-");
console.log(`${SEEDS} ${LENGTH} runs at threat ${THREAT}, ${value("bot") === "greedy" ? "greedy" : "steady"} bot${value("habits") ? ` (${value("habits")})` : ""}${noRanks ? ", no ranks" : ""}${noDoctrines ? ", no doctrines" : ""}${RELIC ? `, relic ${RELIC}` : ""}`);
for (const [key, e] of [...plays].sort(([a], [b]) => a.localeCompare(b)))
  console.log(
    `${key.padEnd(16)} won ${String(e.won).padStart(3)}/${String(e.played).padEnd(3)} ${((100 * e.won) / e.played).toFixed(0).padStart(3)}%  ${(e.waves / e.played).toFixed(0).padStart(2)} waves${e.won ? `  reactor left ${Math.round((100 * e.reactor) / e.won)}%, lost ${Math.round((100 * e.leak) / e.won)}% per win; credits per win: earned ${median(e.earned)}, left ${median(e.left)} (median)` : ""}`,
  );
console.log(`missions won per run: ${depths.map((n, d) => `${d}: ${n}`).join("  ")}`);
console.log(`completed: ${depths[total]}/${SEEDS} (${Math.round((100 * depths[total]) / SEEDS)}%)`);
const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0),
  rankCounts = [0, 0, 0, 0, 0];
for (const e of ends) for (const r of e.ranks) rankCounts[r]++;
console.log(
  `at the end (mean): scrap ${mean(ends.map((e) => e.scrap)).toFixed(0)}, reactor ${Math.round(100 * mean(ends.map((e) => e.reactor)))}%, roster ${mean(ends.map((e) => e.roster)).toFixed(1)}, relics ${mean(ends.map((e) => e.relics)).toFixed(1)}, doctrines ${mean(ends.map((e) => e.doctrines)).toFixed(1)}; ${types.size} tower types fielded`,
);
console.log(`roster ranks at the end: ${rankCounts.map((n, r) => `r${r} ${n}`).join("  ")}`);
console.log(
  `relic drafts ${relicStats.drafts}: ${relicStats.cards} cards, ${Math.round((100 * relicStats.fitting) / Math.max(1, relicStats.cards))}% fit the roster, ${Math.round((100 * relicStats.draftsWithSynergy) / Math.max(1, relicStats.drafts))}% of drafts offer a fitting synergy relic; taken: ${[...relicStats.taken].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ")}`,
);
if (protocols.size) console.log(`protocol activations per run: ${[...protocols].map(([k, n]) => `${k} ${(n / SEEDS).toFixed(0)}`).join(", ")}`);
console.log(`wave game time: median ${pct(0.5)} s, p10 ${pct(0.1)} s, p90 ${pct(0.9)} s; game minutes per run ${(simSeconds / 60 / SEEDS).toFixed(0)}`);
