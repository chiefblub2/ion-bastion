/**
 * Frame-time benchmark of a busy wave in the real app (dev build only: reads the scene's `window.__frameStats`).
 *
 *   npm run dev   # in the background, on :4173
 *   npx vite-node scripts/frame-bench.ts [-- <missionId>] [--wave <n>] [--seconds 10] [--url http://localhost:4173]
 *
 * Without a mission it takes the campaign mission whose last wave is the largest, at its last wave. Opens it via
 * `&wave=<n>&credits=<n>`, builds every strategy A tower and levels each to L5 (no specializations), starts the wave
 * at 2×, waits for the field to fill and samples simulation, scene drawing and Phaser's render pass (avg and p95, ms).
 * Headless SwiftShader WebGL: the numbers compare runs on one machine; they are not real-GPU frame rates.
 */
import { MISSIONS, missionById } from "../src/content/missions";
import { STRATEGIES } from "../src/core/strategies";
import { WEBGL_ARGS, buildAffordable, call, fail, launch, open, prepare } from "./browser";

const args = process.argv.slice(2).filter((a) => a !== "--");
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args.splice(i, 2)[1];
};
const base = flag("--url") ?? "http://localhost:4173";
const seconds = Number(flag("--seconds") ?? 10);
const waveFlag = flag("--wave");
const size = (m: (typeof MISSIONS)[number], w: number) => m.waves[w].groups.reduce((n, g) => n + g.count, 0);
const mission = args[0]
  ? (missionById(args[0]) ?? fail(`Unknown mission '${args[0]}'.`))
  : MISSIONS.filter((m) => !m.circle && STRATEGIES[m.id]).sort((a, b) => size(b, b.waves.length - 1) - size(a, a.waves.length - 1))[0];
const wave = Number(waveFlag ?? mission.waves.length);

type Tower = { id: number; nextUpgrades: { id: string }[] };
const browser = await launch(base, WEBGL_ARGS);
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors = await prepare(page);
  await open(page, base, { mission: mission.id, wave, credits: 1_000_000 });
  await buildAffordable(page, mission, { i: 0 });
  for (let round = 0; round < 4; round++) {
    const { towers } = await call<{ towers: Tower[] }>(page, "read_defense_state");
    for (const t of towers) {
      const next = t.nextUpgrades.find((u) => u.id.startsWith("level-"));
      if (next) await call(page, "upgrade_defense_tower", { id: t.id, upgrade: next.id });
    }
  }
  // A canvas that already holds a 2D context returns null for WebGL, and the other way round.
  const renderer = await page.evaluate(() => {
    const c = document.querySelector("#board-wrap canvas") as HTMLCanvasElement | null;
    return c && (c.getContext("webgl2") || c.getContext("webgl")) ? "webgl" : "canvas";
  });
  await page.click("#speed-btn");
  await call(page, "start_defense_wave");
  await page.waitForTimeout(6000);
  await page.evaluate(() => (window as unknown as { __frameStats: { reset(): void } }).__frameStats.reset());
  await page.waitForTimeout(seconds * 1000);
  const state = await call<{ towers: unknown[]; remainingEnemies: number; status: string }>(page, "read_defense_state");
  const summary = await page.evaluate(() => (window as unknown as { __frameStats: { summary(): object } }).__frameStats.summary());
  console.log(`${mission.id} wave ${wave}: ${state.towers.length} towers, ${state.remainingEnemies} enemies left, status ${state.status}, canvas ${renderer}`);
  console.log(JSON.stringify(summary, null, 2));
  for (const e of errors) console.log(`ERROR ${e}`);
} finally {
  await browser.close();
}
