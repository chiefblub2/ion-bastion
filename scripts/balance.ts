/**
 * Balancing report for one sector, with the same checks as `core/missions.test.ts`.
 * Usage: npx vite-node scripts/balance.ts -- <sector module> <strategies module>
 * e.g.   npx vite-node scripts/balance.ts -- src/content/sectors/frost.ts src/core/strategies/frost.ts
 * or     npx vite-node scripts/balance.ts -- src/content/missions.ts src/core/strategies/index.ts 0
 * Prints reactor energy after every wave for defenses A and B (on a ring: peak enemies per wave),
 * difficulty-band WARNs, a map check and (with --why, or on failure) a leak/kill diagnosis.
 * Options: --mission <id> checks one mission, --why always prints the diagnosis,
 * --curve credits=680-780,waves=17-20[,growth=1.1-1.2] WARNs about values outside the range (growth as factor, 1.1 = 110 %).
 * --tune scales the HP of every wave by a factor f and bisects the window in which A and B still win
 * and the thin, Nova-only and empty defenses still lose (about 40 runs per mission; best with --mission).
 */
import { resolve } from "node:path";
import { Game } from "../src/core/game";
import { play } from "../src/core/play";
import { duplicateIds, hasAir, isTutorial, novaOnly, thinBuilds, unbuildable } from "../src/core/mission-checks";
import type { Enemy, MissionDefinition, MissionSector } from "../src/core/types";
import { waveHpScale } from "../src/systems/spawn";
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

/** The mission with every wave's HP factor multiplied by `f` (simulation untouched). */
const scaled = (m: MissionDefinition, f: number): MissionDefinition => ({
  ...m,
  waves: m.waves.map((w, i) => ({ ...w, hpMultiplier: f * waveHpScale(m, i + 1) })),
});
const TUNE_STEPS = 7,
  TUNE_MIN = 0.25,
  TUNE_MAX = 3;
/**
 * Largest f at which `ok` holds (wins: searching up) or smallest f (losses: searching down), by
 * bisection from f = 1. Assumes the outcome is monotonic in f; `undefined` if it fails at f = 1.
 */
function edge(ok: (f: number) => boolean, up: boolean): number | undefined {
  if (!ok(1)) return undefined;
  const far = up ? TUNE_MAX : TUNE_MIN;
  if (ok(far)) return far;
  let good = 1,
    bad = far;
  for (let i = 0; i < TUNE_STEPS; i++) {
    const mid = (good + bad) / 2;
    if (ok(mid)) good = mid;
    else bad = mid;
  }
  return good;
}
/** HP window as text lines: how far f may rise before A/B lose and fall before a weak defense wins. */
function tune(m: MissionDefinition, s: { A: Strategy; B: Strategy }): string[] {
  const status = (f: number, strategy?: Strategy) => run(scaled(m, f), strategy).game.state.status;
  const wins: [string, Strategy][] = [["A", s.A], ["B", s.B]];
  const losses: [string, Strategy | undefined][] = [["leer", undefined]];
  if (!isTutorial(m)) losses.push([m.circle ? "1 Turm" : "3 Türme", { builds: thinBuilds(m, s.A) }]);
  if (hasAir(m)) losses.push(["nur Nova", { builds: novaOnly(s.A) }]);
  const fmt = (f: number | undefined, bound: number) => (f === undefined ? "–" : f === bound ? `${bound === TUNE_MAX ? ">" : "<"}${f.toFixed(2)}` : f.toFixed(2));
  const top = wins.map(([k, st]) => [k, edge((f) => status(f, st) === "won", true)] as const);
  const bottom = losses.map(([k, st]) => [k, edge((f) => status(f, st) === "lost", false)] as const);
  const lines = [
    `TUNE HP-Faktor f: gewinnt bis ${top.map(([k, f]) => `${k} ${fmt(f, TUNE_MAX)}`).join(" · ")}; verliert ab ${bottom.map(([k, f]) => `${k} ${fmt(f, TUNE_MIN)}`).join(" · ")}`,
  ];
  if ([...top, ...bottom].some(([, f]) => f === undefined)) {
    lines.push("TUNE kein Fenster: bei f = 1 schlägt eine Prüfung schon fehl (–)");
    return lines;
  }
  const hi = Math.min(...top.map(([, f]) => f!)),
    lo = Math.max(...bottom.map(([, f]) => f!)),
    mid = (lo + hi) / 2;
  lines.push(
    `TUNE Fenster f ${fmt(lo, TUNE_MIN)}–${fmt(hi, TUNE_MAX)} (aktuell 1.00, Spielraum −${Math.round((1 - lo) * 100)} % / +${Math.round((hi - 1) * 100)} %)`,
  );
  // With linear growth only, the same final-wave HP as a growth value.
  const n = m.waves.length;
  if (n > 1 && m.waves.every((w) => w.hpMultiplier === undefined)) {
    const growth = (f: number) => ((f * waveHpScale(m, n) - 1) / (n - 1)).toFixed(3);
    lines.push(`TUNE als hpGrowth (gleiche HP in Welle ${n}): ${growth(lo)}–${growth(hi)} (aktuell ${m.hpGrowth ?? 0.14})`);
  }
  // Cliffs (hpMultiplier waves, splash thresholds) break monotonicity: check one point inside once.
  const midWins = wins.every(([, st]) => status(mid, st) === "won"),
    midLoses = losses.every(([, st]) => status(mid, st) === "lost");
  if (!midWins || !midLoses) lines.push(`WARN f ${mid.toFixed(2)} im Fenster hält nicht alle Prüfungen (nicht monoton, Klippe) – Wellen einzeln prüfen`);
  return lines;
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
  curveArg = argv.includes("--curve") ? argv[argv.indexOf("--curve") + 1] : undefined,
  positional = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--mission" && argv[i - 1] !== "--curve"),
  curve = Object.fromEntries(
    (curveArg?.split(",") ?? []).map((part) => {
      const [key, range = ""] = part.split("="),
        [lo, hi = lo] = range.split("-").map(Number);
      return [key, { lo, hi }];
    }),
  ) as Record<string, { lo: number; hi: number }>;
const [sectorPath, strategiesPath, sectorIndex = "0"] = positional;
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
for (const id of duplicateIds(sector)) console.log(verdict(false, `id bereits vergeben: ${id}`));
const pct = (v: number, of: number) => Math.round((v / of) * 100);
for (const m of sector.missions) {
  if (only && m.id !== only) continue;
  const s = strategies[m.id];
  console.log(
    `\n== ${m.id} (${m.name}) · ${m.waves.length} Wellen · ◇${m.startingCredits} · ${m.circle ? `⟳ max. ${m.circle.limit}` : `⚡${m.reactorEnergy}`}`,
  );
  const outside = (label: string, value: number, key: string) => {
    const r = curve[key];
    if (r && (value < r.lo || value > r.hi)) console.log(`WARN Kurve außerhalb: ${label} ${value} (Soll ${r.lo}-${r.hi})`);
  };
  outside("Credits", m.startingCredits, "credits");
  outside("Wellen", m.waves.length, "waves");
  outside("hpGrowth", m.hpGrowth ?? 0.14, "growth");
  if (m.waves.length && m.waves.every((w) => w.hpMultiplier !== undefined)) console.log("WARN hpGrowth wird ignoriert: jede Welle hat hpMultiplier");
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
  if (flag("--tune")) lines.push(...tune(m, s));
  console.log(lines.join("\n"));
}
console.log(failures ? `\n${failures} Prüfung(en) fehlgeschlagen.` : "\nAlle Prüfungen bestanden.");
process.exit(failures ? 1 : 0);
