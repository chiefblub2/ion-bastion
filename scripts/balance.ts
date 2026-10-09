/**
 * Balancing report for one sector, with the same checks as `core/missions.test.ts`.
 * Usage: npx vite-node scripts/balance.ts -- <sector module> <strategies module>
 * e.g.   npx vite-node scripts/balance.ts -- src/content/sectors/frost.ts src/core/strategies/frost.ts
 * or     npx vite-node scripts/balance.ts -- src/content/missions.ts src/core/strategies/index.ts 0
 * Prints reactor energy after every wave for defenses A and B.
 */
import { resolve } from "node:path";
import { Game } from "../src/core/game";
import { upgradeOptions } from "../src/core/upgrades";
import type { MissionDefinition, MissionSector } from "../src/core/types";
import type { Strategy } from "../src/core/test-helpers";
import type { Strategies } from "../src/core/strategies/build";

function play(mission: MissionDefinition, strategy?: Strategy) {
  const g = new Game(mission),
    lives: number[] = [];
  const build = () => {
    const next = strategy!.builds.find((b) => !g.state.towers.some((t) => t.x === b.x && t.y === b.y));
    return !!next && g.command({ type: "build", ...next }).ok;
  };
  const upgrade = () => {
    const options = g.state.towers
      .flatMap((t) =>
        upgradeOptions(t, g.state.wallets[0])
          .filter((o) => o.status === "available")
          .map((o) => ({ id: t.id, upgrade: o.definition!.id, cost: o.definition!.cost })),
      )
      .sort((a, b) => a.cost - b.cost);
    return !!options.length && g.command({ type: "upgrade", id: options[0].id, upgrade: options[0].upgrade }).ok;
  };
  while (g.state.status === "ready") {
    if (strategy) while (strategy.upgradeFirst ? upgrade() || build() : build() || upgrade());
    g.command({ type: "start" });
    let steps = 0;
    while (g.state.status === "wave" && steps++ < 30000) {
      g.tick();
      g.drainEvents();
    }
    lives.push(g.state.lives);
  }
  return { game: g, lives };
}

const [sectorPath, strategiesPath, sectorIndex = "0"] = process.argv.slice(2).filter((a) => a !== "--");
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
for (const m of sector.missions) {
  const s = strategies[m.id];
  console.log(`\n== ${m.id} (${m.name}) · ${m.waves.length} Wellen · ◇${m.startingCredits} · ⚡${m.reactorEnergy}`);
  if (!s) {
    console.log(verdict(false, "Strategien A/B fehlen"));
    continue;
  }
  const lines: string[] = [];
  lines.push(verdict(play(m).game.state.status === "lost", "ohne Verteidigung verloren"));
  lines.push(verdict(play(m, { builds: s.A.builds.slice(0, 3) }).game.state.status === "lost", "3 Türme verloren"));
  if (m.waves.some((w) => w.groups.some((g) => g.type === "glider"))) {
    const builds = s.A.builds.map((x) => ({ ...x, tower: "blast" as const }));
    lines.push(verdict(play(m, { builds }).game.state.status === "lost", "nur Nova verloren"));
  }
  for (const key of ["A", "B"] as const) {
    const probe = new Game(m),
      bad = s[key].builds.filter((b) => !probe.canBuild(b.x, b.y) || !probe.availableTowers().includes(b.tower));
    if (bad.length) lines.push(verdict(false, `${key}: nicht baubar ${bad.map((b) => `${b.tower}@${b.x},${b.y}`).join(" ")}`));
    const { game, lives } = play(m, s[key]);
    lines.push(
      verdict(game.state.status === "won", `${key} gewinnt`) +
        `  Energie/Welle: ${lives.join(" ")}  Türme: ${game.state.towers.length}/${s[key].builds.length}`,
    );
  }
  console.log(lines.join("\n"));
}
console.log(failures ? `\n${failures} Prüfung(en) fehlgeschlagen.` : "\nAlle Prüfungen bestanden.");
process.exit(failures ? 1 : 0);
