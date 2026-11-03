/**
 * Strength check for the support and Aura paths: does a path tier III beat the same tower at its last plain level by
 * more than it should? For every mission of a sector, strategy A plays once with one extra support tower at level 3
 * (Aura: track tier III) and once per path with that path's tiers. After wave 1 both runs get the same grant (tower,
 * levels and tiers), so both spend the same: the path run on the tiers, the level-3 run on the strategy's towers.
 * Usage: npx vite-node scripts/support-check.ts -- <sector module> <strategies module> [sector index] [--tower id,…] [--mission id] [--band 0.25]
 * e.g.   npx vite-node scripts/support-check.ts -- src/content/sectors/frost.ts src/core/strategies/frost.ts --tower beacon,vault
 * WARN: an economy path ends with more credits (earned in total) than level 3 plus 5 % while both runs win, or a path
 * does better than spending its price elsewhere: a loss turns into a win, or reactor energy left (on a ring: the peak
 * crowd) improves by more than `band` of the start. The same changes for the worse print as "weak". Missions whose
 * strategy A loses on its own are skipped.
 */
import { resolve } from "node:path";
import { play, type Build, type Strategy } from "../src/core/play";
import { DEFAULT_CONTENT } from "../src/content";
import { isSpecialization } from "../src/core/upgrades";
import { isSupport } from "../src/systems/attacks";
import { dist } from "../src/systems/path";
import type { MissionDefinition, MissionSector, TowerId } from "../src/core/types";
import type { Strategies } from "../src/core/strategies/build";

const ECONOMY: ReadonlySet<string> = new Set(["beacon", "refinery", "vault", "workshop", "dock", "shieldgen"]);
const towers = DEFAULT_CONTENT.towers;
const supportIds = (Object.keys(towers) as TowerId[]).filter((id) => isSupport(towers[id].attack) && towers[id].upgrades.some(isSpecialization));
const pathsOf = (id: TowerId) => [...new Set(towers[id].upgrades.filter(isSpecialization).map((u) => u.path!))];
const tierCost = (id: TowerId, path: string) => towers[id].upgrades.filter((u) => u.path === path && isSpecialization(u)).reduce((sum, u) => sum + u.cost, 0);

/** The free cell beside the most strategy towers within 3 cells, then beside the most path cells within 3 (a support tower's natural spot). */
function bestCell(m: MissionDefinition, builds: readonly Build[]): { x: number; y: number } | undefined {
  const taken = new Set([...m.map.path, ...m.map.blocked, ...builds].map((p) => `${p.x},${p.y}`));
  let best: { x: number; y: number; score: number } | undefined;
  for (let y = 0; y < m.map.rows; y++)
    for (let x = 0; x < m.map.columns; x++) {
      if (taken.has(`${x},${y}`)) continue;
      const score = builds.filter((b) => dist(b, { x, y }) <= 3).length * 100 + m.map.path.filter((p) => dist(p, { x, y }) <= 3).length;
      if (!best || score > best.score) best = { x, y, score };
    }
  return best;
}

/**
 * Plays `strategy`; after wave 1 both runs get the same grant (the support tower, its levels and the path's three
 * tiers) and build the tower at `cell`. With `path` the tower buys the path's tiers; without, it stops at its last
 * plain level (Aura: its first track's tier III) and the strategy spends the rest.
 */
function result(m: MissionDefinition, strategy: Strategy, tower: TowerId, cell: { x: number; y: number }, path: string, withPath: boolean) {
  const d = towers[tower],
    plain = d.upgrades.filter((u) => !u.path && (!u.track || u.track === d.upgrades.find((v) => v.track)?.track)),
    tiers = d.upgrades.filter((u) => u.path === path && isSpecialization(u)),
    grant = d.cost + [...plain, ...tiers].reduce((sum, u) => sum + u.cost, 0);
  let peak = 0,
    given = false;
  const { game } = play(
    m,
    strategy,
    (g) => {
      if (given) return;
      given = true;
      g.state.wallets[0] += grant;
      if (!g.command({ type: "build", tower, ...cell }).ok) return;
      const id = g.state.towers.at(-1)!.id;
      for (const u of [...plain, ...(withPath ? tiers : [])]) g.command({ type: "upgrade", id, upgrade: u.id });
    },
    (g) => (peak = Math.max(peak, g.state.enemies.length)),
  );
  const s = game.state,
    spent = s.towers.reduce((sum, t) => sum + t.spent, 0),
    support = s.towers.find((t) => t.x === cell.x && t.y === cell.y && t.type === tower);
  return {
    won: s.status === "won",
    lives: m.circle ? peak : s.lives,
    // Everything the run earned: what is left plus what it spent, without the grant.
    economy: s.wallets[0] + spent - grant - m.startingCredits,
    upgrades: support?.upgrades.length ?? 0,
  };
}

const argv = process.argv.slice(2).filter((a) => a !== "--"),
  value = (name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined),
  positional = argv.filter((a, i) => !a.startsWith("--") && !["--tower", "--mission", "--band"].includes(argv[i - 1])),
  only = value("--mission"),
  band = Number(value("--band") ?? 0.25),
  picked = (value("--tower")?.split(",") as TowerId[] | undefined) ?? supportIds;
const [sectorPath, strategiesPath, sectorIndex = "0"] = positional;
const sectorModule = await import(resolve(sectorPath));
const strategies = Object.values(await import(resolve(strategiesPath))).find((v) => v && typeof v === "object") as Strategies;
const sector = (Object.values(sectorModule).find((v: any) => v?.missions) ?? sectorModule.SECTORS[Number(sectorIndex)]) as MissionSector;
let warnings = 0;
for (const m of sector.missions) {
  if (only && m.id !== only) continue;
  const s = strategies[m.id];
  if (!s) continue;
  const cell = bestCell(m, s.A.builds);
  if (!cell) continue;
  // A strategy that already loses on its own says nothing about a support tower.
  if (play(m, s.A).game.state.status !== "won") {
    console.log(`\n== ${m.id} · skipped: strategy A loses without a support tower`);
    continue;
  }
  console.log(`\n== ${m.id} · support cell ${cell.x},${cell.y}`);
  const start = m.circle ? m.circle.limit : m.reactorEnergy;
  for (const id of picked) {
    const paths = pathsOf(id);
    const lines: string[] = [];
    for (const path of paths) {
      const cost = tierCost(id, path),
        base = result(m, s.A, id, cell, path, false),
        tiered = result(m, s.A, id, cell, path, true);
      // Stronger than spending the same credits elsewhere is a warning; weaker is only a note.
      const flags: string[] = [],
        weaker: string[] = [],
        better = m.circle ? base.lives - tiered.lives : tiered.lives - base.lives;
      if (ECONOMY.has(id) && base.won && tiered.won && tiered.economy > base.economy * 1.05)
        flags.push(`credits +${Math.round((tiered.economy / Math.max(1, base.economy) - 1) * 100)} %`);
      if (tiered.won !== base.won) (tiered.won ? flags : weaker).push(tiered.won ? "turns a loss into a win" : "turns a win into a loss");
      if (Math.abs(better) > start * band) (better > 0 ? flags : weaker).push(`${m.circle ? "peak" : "energy"} ${base.lives} → ${tiered.lives}`);
      if (flags.length) warnings++;
      const note = [...flags, ...weaker.map((w) => `weaker: ${w}`)];
      lines.push(
        `${flags.length ? "WARN" : weaker.length ? "weak" : "ok  "} ${id}:${path} (${tiered.upgrades} upgrades, ◇${cost})  ${m.circle ? "peak" : "energy"} ${base.lives} → ${tiered.lives}  credits ${base.economy} → ${tiered.economy}${base.won && tiered.won ? "" : `  won ${base.won} → ${tiered.won}`}${note.length ? `  (${note.join(", ")})` : ""}`,
      );
    }
    console.log(lines.join("\n"));
  }
}
console.log(warnings ? `\n${warnings} warning(s).` : "\nNo warnings.");
