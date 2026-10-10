/**
 * The README images: one icon per tower and enemy, plus screenshots of running missions.
 *
 *   npm run dev   # in the background, on :4173
 *   npx vite-node scripts/readme-images.ts [-- --only towers|enemies|screens] [--url http://localhost:4173]
 *
 * Icons are clipped from the dev-only gallery page (`/gallery.html`, `src/gallery.ts`) into
 * docs/images/towers/<id>.png and docs/images/enemies/<id>.png. Screenshots open each mission directly at a busy wave
 * (`&wave=<n>`, never played through) with enough credits (`&credits=<n>`) for the whole strategy A defense, start
 * the wave at 2× and save docs/images/screens/<id>.png.
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { Browser } from "playwright-core";
import { missionById } from "../src/content/missions";
import { DEFAULT_CONTENT } from "../src/content";
import { STRATEGIES } from "../src/core/strategies";
import type { GalleryCell } from "../src/gallery";
import { buildAffordable, call, fail, launch, open, prepare } from "./browser";

/**
 * Missions shown in the README: different terrains and both modes. Board shots skip to `wave` with credits for
 * the whole strategy; the `full` page shot shows the HUD, so it keeps the real first wave and starting credits.
 */
const SCREENS: readonly { id: string; wave?: number; seconds: number; full?: boolean }[] = [
  { id: "glutkammer", seconds: 12, full: true },
  { id: "kernfestung", wave: 9, seconds: 9 },
  { id: "polarnacht", wave: 9, seconds: 9 },
  { id: "korallengraben", wave: 9, seconds: 9 },
  { id: "glasebene", wave: 12, seconds: 13 },
  { id: "kristallherz", wave: 9, seconds: 14 },
  { id: "doppelschleife", wave: 5, seconds: 14 },
];

const args = process.argv.slice(2).filter((a) => a !== "--");
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args.splice(i, 2)[1];
};
const base = flag("--url") ?? "http://localhost:4173";
const only = flag("--only");
if (only && !["towers", "enemies", "screens"].includes(only)) fail("--only expects towers, enemies or screens.");
const out = resolve("docs/images");

async function icons(browser: Browser) {
  const page = await browser.newPage({ viewport: { width: 1800, height: 1800 } }),
    errors = await prepare(page);
  await page.goto(`${base}/gallery.html`);
  // Transparent page behind the tiles, so their rounded corners stay clear in the PNGs.
  await page.addStyleTag({ content: "body { background: transparent !important; }" });
  const cells = (await page.waitForFunction(() => (window as unknown as { __gallery?: { cells: GalleryCell[] } }).__gallery?.cells)
    .then((h) => h.jsonValue())) as GalleryCell[];
  const canvas = (await page.locator("#gallery canvas").boundingBox())!;
  let count = 0;
  for (const c of cells) {
    const kind = c.kind === "tower" ? "towers" : "enemies";
    if (only && only !== kind) continue;
    mkdirSync(`${out}/${kind}`, { recursive: true });
    await page.screenshot({ path: `${out}/${kind}/${c.id}.png`, omitBackground: true, clip: { x: canvas.x + c.x, y: canvas.y + c.y, width: c.w, height: c.h } });
    count++;
  }
  console.log(`${count} Icons`);
  return errors;
}

async function screen(browser: Browser, shot: (typeof SCREENS)[number]) {
  const mission = missionById(shot.id) ?? fail(`Unknown mission '${shot.id}'.`),
    builds = STRATEGIES[mission.id]?.A.builds ?? [],
    credits = mission.startingCredits + builds.reduce((sum, b) => sum + DEFAULT_CONTENT.towers[b.tower].cost, 0),
    page = await browser.newPage({ viewport: shot.full ? { width: 1600, height: 1000 } : { width: 1440, height: 900 } }),
    errors = await prepare(page);
  await open(page, base, shot.wave ? { mission: mission.id, wave: shot.wave, credits } : { mission: mission.id });
  const next = { i: 0 };
  await buildAffordable(page, mission, next);
  await page.click("#speed-btn");
  await call(page, "start_defense_wave");
  await page.waitForTimeout(shot.seconds * 1000);
  mkdirSync(`${out}/screens`, { recursive: true });
  const path = `${out}/screens/${mission.id}.png`;
  if (shot.full) await page.screenshot({ path });
  else await page.locator("#board-wrap").screenshot({ path });
  console.log(`${mission.id}: wave ${shot.wave ?? 1}, ${next.i} of ${builds.length} towers`);
  return errors;
}

const browser = await launch(base);
try {
  const errors = (
    await Promise.all([
      only === "screens" ? [] : icons(browser),
      ...(only && only !== "screens" ? [] : SCREENS.map((s) => screen(browser, s))),
    ])
  ).flat();
  for (const e of errors) console.log(`FEHLER ${e}`);
} finally {
  await browser.close();
}
