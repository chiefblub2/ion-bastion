/**
 * Balancing report for one sector, with the same checks as `core/missions.test.ts`.
 * Usage: npx vite-node scripts/balance.ts -- <sector module> <strategies module>
 * e.g.   npx vite-node scripts/balance.ts -- src/content/sectors/frost.ts src/core/strategies/frost.ts
 * or     npx vite-node scripts/balance.ts -- src/content/missions.ts src/core/strategies/index.ts 0
 * Prints reactor energy after every wave for defenses A and B (on a ring: peak enemies per wave),
 * difficulty-band WARNs, a map check and (with --why, or on failure) a leak/kill diagnosis.
 * Options: --mission <id> checks one mission, --why always prints the diagnosis.
 */
import { resolve } from "node:path";
import { Game } from "../src/core/game";
import { play } from "../src/core/play";
import { hasAir, isTutorial, novaOnly, thinBuilds, unbuildable } from "../src/core/mission-checks";
import type { Enemy, MissionDefinition, MissionSector } from "../src/core/types";
import type { Strategy } from "../src/core/play";
import type { Strategies } from "../src/core/strategies/build";

/** `play` plus per-wave series (energy, or peak enemies on a ring) and a leak/kill diagnosis. */
function run(mission: MissionDefinition, strategy?: Strategy) {
  const series: number[] = [],
    leaks: Record<string, Record<number, number>> = {};
  let peak = 0,
    prev: Enemy[] = [];
  const { game } = play(
    mission,
    strategy,
    (g) => {
      if (mission.circle) {
        series.push(peak);
        peak = 0;
      } else series.push(g.state.lives);
    },
    (g, events) => {
      peak = Math.max(peak, g.state.enemies.length);
      // A leaving enemy vanishes from the state: match each leak event to the nearest vanished one.
      const gone = prev.filter((e) => !g.state.enemies.some((n) => n.id === e.id));
      for (const ev of events) {
        if (ev.type !== "leak") continue;
        const i = gone.reduce((best, e, k) => (Math.hypot(e.x - ev.at.x, e.y - ev.at.y) < Math.hypot(gone[best].x - ev.at.x, gone[best].y - ev.at.y) ? k : best), 0);
        const type = gone.splice(i, 1)[0]?.type ?? "?";
        (leaks[type] ??= {})[g.state.wave] = (leaks[type][g.state.wave] ?? 0) + ev.amount;
      }
      prev = g.state.enemies.map((e) => ({ ...e }));
    },
  );
  return { game, series, leaks };
}

/** Path length, buildable cells and cells that cover two distant path sections. */
function mapCheck(m: MissionDefinition) {
  const { path, blocked, columns, rows, loop } = m.map,
    key = (x: number, y: number) => `${x},${y}`,
    taken = new Set([...path, ...blocked].map((p) => key(p.x, p.y)));
  let buildable = 0,
    double = 0;
  for (let x = 0; x < columns; x++)
    for (let y = 0; y < rows; y++) {
      if (taken.has(key(x, y))) continue;
      buildable++;
      const near = path.flatMap((p, i) => (Math.hypot(p.x - x, p.y - y) <= 2.5 ? [i] : []));
      const apart = near.some((i) => near.some((j) => (loop ? Math.min(Math.abs(i - j), path.length - Math.abs(i - j)) : Math.abs(i - j)) > 6));
      if (apart) double++;
    }
  return { length: path.length, buildable, double };
}

const argv = process.argv.slice(2).filter((a) => a !== "--"),
  flag = (name: string) => argv.includes(name),
  only = argv.includes("--mission") ? argv[argv.indexOf("--mission") + 1] : undefined,
  positional = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--mission"),
  [sectorPath, strategiesPath, sectorIndex = "0"] = positional;
const sectorModule = await import(resolve(sectorPath));
const strategies: Strategies = Object.values(await import(resolve(strategiesPath))).find(
  (v) => v && typeof v === "object",
) as Strategies;
// A sector module exports one sector; `content/missions.ts` exports all, picked by index.
const sector = (Object.values(sectorModule).find((v: any) => v?.missions) ??
  sectorModule.SECTORS[Number(sectorIndex)]) as MissionSector;
let failures = 0;
const verdict = (ok: boolean, label: string) => {
  if (!ok) failures++;
  return `${ok ? "ok  " : "FAIL"} ${label}`;
};
const pct = (v: number, of: number) => Math.round((v / of) * 100);
for (const m of sector.missions) {
  if (only && m.id !== only) continue;
  const s = strategies[m.id];
  console.log(
    `\n== ${m.id} (${m.name}) · ${m.waves.length} Wellen · ◇${m.startingCredits} · ${m.circle ? `⟳ max. ${m.circle.limit}` : `⚡${m.reactorEnergy}`}`,
  );
  const map = mapCheck(m);
  console.log(`Karte: Pfad ${map.length} · baubar ${map.buildable} · Doppelzellen ${map.double}${map.double < 6 ? "  WARN zu wenig Doppelzellen (<6)" : ""}`);
  if (!s) {
    console.log(verdict(false, "Strategien A/B fehlen"));
    continue;
  }
  const lines: string[] = [];
  lines.push(verdict(run(m).game.state.status === "lost", "ohne Verteidigung verloren"));
  // Same rules as core/missions.test.ts, via core/mission-checks.ts.
  const thin = m.circle ? 1 : 3;
  if (!isTutorial(m))
    lines.push(verdict(run(m, { builds: thinBuilds(m, s.A) }).game.state.status === "lost", thin === 1 ? "1 Turm verloren" : "3 Türme verloren"));
  if (hasAir(m)) lines.push(verdict(run(m, { builds: novaOnly(s.A) }).game.state.status === "lost", "nur Nova verloren"));
  const results: { key: string; won: boolean; series: number[] }[] = [];
  for (const key of ["A", "B"] as const) {
    const bad = unbuildable(m, s[key]);
    if (bad.length) lines.push(verdict(false, `${key}: nicht baubar ${bad.map((b) => `${b.tower}@${b.x},${b.y}`).join(" ")}`));
    const { game, series, leaks } = run(m, s[key]),
      won = game.state.status === "won";
    results.push({ key, won, series });
    lines.push(
      verdict(won, `${key} gewinnt`) +
        `  ${m.circle ? "Gegner/Welle" : "Energie/Welle"}: ${series.join(" ")}  Türme: ${game.state.towers.length}/${s[key].builds.length}`,
    );
    if (flag("--why") || !won) {
      const leakText = Object.entries(leaks).map(([t, w]) => `${t} ${Object.values(w).reduce((a, b) => a + b, 0)} (W${Object.keys(w).join(",")})`);
      const kills = game.state.towers.filter((t) => t.kills).map((t) => `${t.type}@${t.x},${t.y}: ${t.kills}`);
      lines.push(`     ${key} Lecks: ${leakText.join(" · ") || "keine"}`);
      lines.push(`     ${key} Kills/Turm: ${kills.join(" · ") || "keine"}`);
      lines.push(`     ${key} Credits übrig: ${game.state.wallets[0]}`);
    }
  }
  // Difficulty band: warnings only, they never change the exit code.
  const won = results.filter((r) => r.won);
  if (m.circle) {
    const limit = m.circle.limit;
    for (const r of won) {
      const peak = Math.max(...r.series);
      if (peak <= limit * 0.5) lines.push(`WARN ${r.key}: Spitze ${peak}/${limit} (${pct(peak, limit)} %) nie über 50 % - zu leicht`);
      else if (peak > limit * 0.9) lines.push(`WARN ${r.key}: Spitze ${peak}/${limit} (${pct(peak, limit)} %) - knapp`);
    }
  } else {
    const start = m.reactorEnergy;
    for (const r of won) {
      const end = r.series.at(-1)!;
      if (end >= start) lines.push(`WARN ${r.key}: endet mit 100 % Energie - trivial`);
      else if (end < start * 0.1) lines.push(`WARN ${r.key}: endet mit ${end}/${start} (${pct(end, start)} %) - knapp`);
    }
    if (results.length === 2 && won.length === 2 && won.every((r) => Math.min(...r.series) > start * 0.6))
      lines.push(`WARN beide Strategien über 60 % Minimum-Energie (${won.map((r) => Math.min(...r.series)).join("/")} von ${start}) - zu leicht`);
  }
  console.log(lines.join("\n"));
}
console.log(failures ? `\n${failures} Prüfung(en) fehlgeschlagen.` : "\nAlle Prüfungen bestanden.");
process.exit(failures ? 1 : 0);
