/**
 * Campaign Arsenal economy report (read-only: base content, strategies A/B, the pure campaign functions; never storage).
 * Plays strategies A and B on every campaign mission, then walks one career in campaign order (each mission once, with
 * the better result) and prints Salvage income, tower XP and ranks, and loadout slots against the provisional knobs.
 * Usage: npx vite-node scripts/arsenal-economy.ts [-- --sector <n>] [--verbose]
 */
import { CATALOGUE, GEAR_PRICE, LOADOUT, TIER_PRICE, VETERANCY_XP } from "../src/content/arsenal";
import { SECTORS, isCircleSector } from "../src/content/missions";
import { DEFAULT_CONTENT } from "../src/content/index";
import { type Arsenal, EMPTY_ARSENAL, veterancy, xpOf } from "../src/campaign/arsenal";
import { isFinale } from "../src/campaign/finale";
import { slotsOf } from "../src/campaign/loadout";
import { type PayKind, payOf, rankGains } from "../src/campaign/pay";
import { type Stars, missionStars } from "../src/campaign/rating";
import type { CampaignRecord } from "../src/campaign/record";
import { hasStealth } from "../src/core/mission-checks";
import { play } from "../src/core/play";
import { pageOf } from "../src/core/tower-pages";
import type { MissionDefinition, TowerId } from "../src/core/types";
import { STRATEGIES } from "../src/strategies/index";

const argv = process.argv.slice(2).filter((a) => a !== "--"),
  verbose = argv.includes("--verbose"),
  onlySector = argv.includes("--sector") ? Number(argv[argv.indexOf("--sector") + 1]) : undefined;
const TABS = ["Attack", "Control", "Traps", "Support"];
const content = DEFAULT_CONTENT;

interface Result {
  key: "A" | "B";
  won: boolean;
  waves: number;
  stars: Stars | 0;
  xp: Partial<Record<TowerId, number>>;
  types: number;
}
interface Entry {
  mission: MissionDefinition;
  sector: number; // 1-based
  number: number; // 1-based among campaign missions
  finale: boolean;
  A?: Result;
  B?: Result;
}

const entries: Entry[] = [];
let number = 0;
SECTORS.forEach((sector, i) => {
  if (isCircleSector(sector)) return;
  for (const mission of sector.missions) {
    number++;
    if (onlySector && onlySector !== i + 1) continue;
    const e: Entry = { mission, sector: i + 1, number, finale: isFinale(mission, SECTORS) };
    for (const key of ["A", "B"] as const) {
      const strategy = STRATEGIES[mission.id]?.[key];
      if (!strategy) continue;
      const { game } = play(mission, strategy),
        won = game.state.status === "won",
        stealth = hasStealth(mission, content),
        types = new Set(strategy.builds.map((b) => b.tower).filter((t) => !(stealth && t === "detector")));
      e[key] = {
        key,
        won,
        // A loss clears the waves before the one lost on (`state.wave` counts the wave in progress).
        waves: won ? game.waves.length : Math.max(0, game.state.wave - 1),
        stars: won ? missionStars(mission, game.state) : 0,
        xp: xpOf(game.state, mission, content),
        types: types.size,
      };
    }
    entries.push(e);
    process.stderr.write(`\r${mission.id}                    `);
  }
});
process.stderr.write("\r" + " ".repeat(40) + "\r");

/** Better result: a win beats a loss; among wins more stars, then A; among losses more waves, then A. */
function pick(e: Entry): Result | undefined {
  const rs = [e.A, e.B].filter((r): r is Result => !!r);
  return rs.sort((a, b) => Number(b.won) - Number(a.won) || (a.won ? b.stars - a.stars : b.waves - a.waves) || (a.key < b.key ? -1 : 1))[0];
}

const KINDS: PayKind[] = ["waves", "win", "firstWin", "stars", "cache"];
interface SectorRow {
  won: number;
  missions: number;
  stars: number;
  kinds: Record<string, number>;
  rank: number;
  cum: number;
  slots: number;
}
let arsenal: Arsenal = EMPTY_ARSENAL,
  record: CampaignRecord = {},
  career = 0,
  careerThree = 0;
const sectorRows = new Map<number, SectorRow>(),
  lost: string[] = [],
  tabXp: number[][] = [[], [], [], []],
  fielded = new Map<TowerId, number>(),
  rankAt = new Map<TowerId, (number | undefined)[]>(),
  verboseLines: string[] = [];
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
for (const e of entries) {
  const row = sectorRows.get(e.sector) ?? { won: 0, missions: 0, stars: 0, kinds: {}, rank: 0, cum: 0, slots: 0 },
    r = pick(e);
  sectorRows.set(e.sector, row);
  row.missions++;
  if (!e.A?.won && !e.B?.won) lost.push(e.mission.id);
  if (!r) continue;
  const slotsNow = slotsOf(record);
  const lines = payOf({ won: r.won, waves: r.waves, sector: e.sector, firstWin: true, bounty: false, stars: r.won ? r.stars || 1 : undefined, best: 0, finale: e.finale }),
    pay = sum(lines.map((l) => l.amount));
  careerThree += sum(payOf({ won: r.won, waves: r.waves, sector: e.sector, firstWin: true, bounty: false, stars: r.won ? 3 : undefined, best: 0, finale: e.finale }).map((l) => l.amount));
  for (const l of lines) row.kinds[l.kind] = (row.kinds[l.kind] ?? 0) + l.amount;
  const gains = rankGains(arsenal, r.xp),
    bonus = sum(gains.map((g) => g.bonus));
  row.rank += bonus;
  // Rank bonuses count toward the 3-star career too (same XP).
  careerThree += bonus;
  career += pay + bonus;
  row.cum = career;
  const xp = { ...arsenal.xp };
  for (const [id, v] of Object.entries(r.xp) as [TowerId, number][]) {
    xp[id] = (xp[id] ?? 0) + v;
    tabXp[pageOf(content.towers[id])].push(v);
    fielded.set(id, (fielded.get(id) ?? 0) + 1);
    const at = rankAt.get(id) ?? [];
    for (let k = veterancy(arsenal.xp[id]); k < veterancy(xp[id]); k++) at[k] = e.number;
    rankAt.set(id, at);
  }
  arsenal = { ...arsenal, salvage: arsenal.salvage + pay + bonus, xp };
  if (r.won) {
    record = { ...record, [e.mission.id]: r.stars as Stars };
    row.won++;
    row.stars += r.stars;
  }
  row.slots = slotsOf(record);
  const top = Object.entries(r.xp).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, v]) => `${id} ${v}`).join(", "),
    out = (x?: Result) => (x ? (x.won ? `W${x.stars}` : `L${x.waves}`) : "-"),
    nt = Math.max(e.A?.types ?? 0, e.B?.types ?? 0),
    lo = Math.min(e.A?.types ?? 99, e.B?.types ?? 99),
    flag = lo > slotsNow ? " OVER" : nt > slotsNow ? " over(max)" : "";
  verboseLines.push(
    `${String(e.number).padStart(2)} ${e.mission.id.padEnd(16)} A ${out(e.A).padEnd(3)} B ${out(e.B).padEnd(3)} types ${e.A?.types ?? "-"}/${e.B?.types ?? "-"} slots ${slotsNow}${flag}  salvage ${pay}+${bonus}  top: ${top}`,
  );
}

const pad = (v: string | number, n: number) => String(v).padStart(n);
const out: string[] = [];
if (verbose) out.push("Per mission (A/B: W<stars> or L<waves cleared>; types = distinct tower types built by A/B)", ...verboseLines, "");
out.push("Per sector", "sector  won  stars   waves    win  first  stars  cache  ranks  | cumulative  slots");
for (const [s, r] of sectorRows)
  out.push(`${pad(s, 6)}  ${pad(r.won + "/" + r.missions, 4)} ${pad(r.stars + "/" + 3 * r.missions, 6)} ${KINDS.map((k, i) => pad(r.kinds[k] ?? 0, [7, 6, 7, 7, 7][i])).join("")}  ${pad(r.rank, 5)}  | ${pad(r.cum, 10)}  ${pad(r.slots, 5)}`);
out.push("");

const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0;
};
out.push(`XP per fielded type per mission (rank thresholds ${VETERANCY_XP.join("/")})`, "tab        samples  median  p90");
TABS.forEach((t, i) => out.push(`${t.padEnd(10)} ${pad(tabXp[i].length, 7)} ${pad(pct(tabXp[i], 0.5), 7)} ${pad(pct(tabXp[i], 0.9), 5)}`));
out.push("", "Most-used towers: campaign mission number at which each rank is reached ('-' = not reached)", "tower        tab      fielded  total XP   r1    r2    r3    r4    r5");
for (const [id, n] of [...fielded].sort((a, b) => b[1] - a[1]).slice(0, 3)) {
  const at = rankAt.get(id) ?? [];
  out.push(`${id.padEnd(12)} ${TABS[pageOf(content.towers[id])].padEnd(8)} ${pad(n, 7)} ${pad(arsenal.xp[id] ?? 0, 9)} ${VETERANCY_XP.map((_, k) => pad(at[k] ?? "-", 5)).join(" ")}`);
}
// Also the best per tab, for the traps/support comparison.
out.push("", "Best-ranked tower per tab (final XP, rank)");
TABS.forEach((t, i) => {
  const best = [...fielded.keys()].filter((id) => pageOf(content.towers[id]) === i).sort((a, b) => (arsenal.xp[b] ?? 0) - (arsenal.xp[a] ?? 0))[0];
  out.push(`${t.padEnd(10)} ${best ? `${best} ${arsenal.xp[best]} (rank ${veterancy(arsenal.xp[best])})` : "-"}`);
});
const catalogue = Object.values(CATALOGUE).reduce((n, tier) => n + TIER_PRICE[tier!], 0),
  gear = sum([...GEAR_PRICE]);
out.push(
  "",
  "Totals",
  `career Salvage (better of A/B once per mission, as played): ${career}`,
  `same career with three stars on every win:             ${careerThree}`,
  `research the whole catalogue (${Object.keys(CATALOGUE).length} towers):           ${catalogue}`,
  `gear one tower to Mk V:                                ${gear}`,
  `slots at career end: ${slotsOf(record)} (base ${LOADOUT.base}, max ${LOADOUT.max})`,
  `missions lost by both strategies (${lost.length}): ${lost.join(", ") || "none"}`,
);
console.log(out.join("\n"));
