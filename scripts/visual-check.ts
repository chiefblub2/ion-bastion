/**
 * Visual check in the real app: screenshots the terrain and the first wave of each target enemy.
 *
 *   npm run dev   # in the background, on :4173
 *   npx vite-node scripts/visual-check.ts -- <missionId>... [--out <dir>] [--enemies a,b] [--url http://localhost:4173]
 *
 * Targets default to the enemies that first appear in that mission across the campaign.
 * Drives headless system Chrome (playwright-core, channel "chrome") through the app's optional
 * WebMCP tools (`app/webmcp.ts`): opens each target wave directly (`?mission=<id>&wave=<n>`), builds the
 * strategy A towers the starting credits afford so enemies take damage, starts the wave and screenshots it.
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "playwright-core";
import { MISSIONS, missionById } from "../src/content/missions";
import type { EnemyId, MissionDefinition } from "../src/core/types";
import { buildAffordable, call, fail, launch, open as openApp, prepare } from "./browser";

const args = process.argv.slice(2).filter((a) => a !== "--");
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args.splice(i, 2)[1];
};
const out = resolve(flag("--out") ?? "visual-check");
const base = flag("--url") ?? "http://localhost:4173";
const only = flag("--enemies")?.split(",") as EnemyId[] | undefined;
const missions = args.map((id) => missionById(id) ?? fail(`Unknown mission '${id}'.`));
if (!missions.length) fail("Usage: npx vite-node scripts/visual-check.ts -- <missionId>... [--out <dir>] [--enemies a,b]");

/** Enemy types whose first campaign appearance is in `mission`. */
function introduced(mission: MissionDefinition) {
  const seen = new Set<EnemyId>();
  for (const m of MISSIONS) {
    const types = m.waves.flatMap((w) => w.groups.map((g) => g.type));
    if (m.id === mission.id) return [...new Set(types)].filter((t) => !seen.has(t));
    for (const t of types) seen.add(t);
  }
  return [];
}
/** Target waves (1-based) with the real seconds to wait at 2× until the target groups are on the field. */
function targets(mission: MissionDefinition) {
  const wanted = only ?? introduced(mission);
  const waves = new Map<number, { enemies: EnemyId[]; delay: number }>();
  for (const type of wanted) {
    const index = mission.waves.findIndex((w) => w.groups.some((g) => g.type === type));
    if (index < 0) {
      console.warn(`${mission.id}: '${type}' does not appear in any wave.`);
      continue;
    }
    const group = mission.waves[index].groups.find((g) => g.type === type)!;
    const t = waves.get(index + 1) ?? { enemies: [], delay: 0 };
    t.enemies.push(type);
    t.delay = Math.max(t.delay, group.delay);
    waves.set(index + 1, t);
  }
  return [...waves].sort((a, b) => a[0] - b[0]);
}

async function check(page: Page, mission: MissionDefinition) {
  const errors = await prepare(page);
  // `&wave=<n>` (src/main.ts) starts the mission at that wave with its real HP, so nothing is played through.
  const open = (wave: number) => openApp(page, base, wave > 1 ? { mission: mission.id, wave } : { mission: mission.id });
  await open(1);
  const files = [`${out}/${mission.id}-terrain.png`];
  await page.locator("#board-wrap").screenshot({ path: files[0] });
  for (const [wave, target] of targets(mission)) {
    await open(wave);
    await page.click("#speed-btn");
    const next = { i: 0 };
    await buildAffordable(page, mission, next);
    await call(page, "start_defense_wave");
    console.log(`${mission.id}: wave ${wave} started, ${next.i} towers`);
    // At 2× a group delay of d game seconds passes in d/2 real seconds; then let a few units enter.
    await page.waitForTimeout(target.delay * 500 + 3000);
    const file = `${out}/${mission.id}-w${wave}-${target.enemies.join("-")}.png`;
    // The whole field panel: toolbar with credits, reactor and wave forecast, plus the board.
    await page.locator(".field-panel").screenshot({ path: file });
    files.push(file);
  }
  return { files, errors };
}

const browser = await launch(base);
mkdirSync(out, { recursive: true });
try {
  const results = await Promise.all(
    missions.map(async (m) => {
      const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
      return { id: m.id, ...(await check(page, m)) };
    }),
  );
  for (const r of results) {
    console.log(`${r.id}:`);
    for (const f of r.files) console.log(`  ${f}`);
    for (const e of r.errors) console.log(`  FEHLER ${e}`);
  }
} finally {
  await browser.close();
}
