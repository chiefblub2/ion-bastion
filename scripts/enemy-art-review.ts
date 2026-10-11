/**
 * Enemy art QA: screenshots of the dev-only review page (`/gallery.html?art`, `src/art-review.ts`), which draws every
 * painted enemy through the battlefield's own sprite path.
 *
 *   npm run dev   # in the background, on :4173
 *   npx vite-node scripts/enemy-art-review.ts [-- --out visual-check/art-review] [--canvas] [--stress 400,1000] [--url …]
 *   npx vite-node scripts/enemy-art-review.ts -- --ids tank,boss [--tiles 0,4,7] [--zoom 4]
 *                                       # one close-up sheet of these enemies (and sheet columns, see art-review.ts)
 *   npx vite-node scripts/enemy-art-review.ts -- --batch 6 [--tiles …] [--zoom 2.5]
 *                                       # the whole roster in close-ups of 6 enemies each (batch-<n>.png)
 *
 * Saves sheet-<n>.png (headings, terrains, overlays, hidden, burrowed, fallback per enemy), lineup.png (by body
 * size) and prints the page errors. WebGL by default (SwiftShader), so tints and mipmapped filtering show as in a
 * browser with a GPU; `--canvas` uses Phaser's canvas renderer instead. `--stress <counts>` times dense frames of
 * that many units (software rendering: compare runs with each other, not with a real GPU).
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "playwright-core";
import { DEFAULT_CONTENT } from "../src/content";
import type { EnemyId } from "../src/core/types";
import { artFor } from "../src/render/enemy-art";
import { launch, prepare, WEBGL_ARGS } from "./browser";

const args = process.argv.slice(2).filter((a) => a !== "--");
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args.splice(i, 2)[1];
};
const out = resolve(flag("--out") ?? "visual-check/art-review"),
  base = flag("--url") ?? "http://localhost:4173",
  stress = flag("--stress")?.split(",").map(Number),
  ids = flag("--ids"),
  batch = Number(flag("--batch") ?? 0),
  tiles = flag("--tiles"),
  zoom = flag("--zoom") ?? (ids ? "4" : batch ? "2.5" : "2"),
  canvas = args.includes("--canvas");

interface Review {
  ready: boolean;
  pages: number;
  stats?: unknown;
}
async function show(page: Page, query: string) {
  await page.goto(`${base}/gallery.html?${query}`);
  await page.waitForFunction(() => (window as unknown as { __artReview?: Review }).__artReview?.ready, undefined, { timeout: 300_000 });
  // One more frame, so the scene has rendered what `create` set up.
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  return (await page.evaluate(() => (window as unknown as { __artReview: Review }).__artReview)) as Review;
}

const browser = await launch(base, canvas ? [] : WEBGL_ARGS);
mkdirSync(out, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } }),
    errors = await prepare(page),
    files: string[] = [];
  if (batch) {
    const roster = (Object.keys(DEFAULT_CONTENT.enemies) as EnemyId[]).filter((id) => artFor(id)),
      groups = Array.from({ length: Math.ceil(roster.length / batch) }, (_, i) => roster.slice(i * batch, (i + 1) * batch));
    for (const [i, group] of groups.entries()) {
      await show(page, `art&ids=${group.join(",")}&zoom=${zoom}${tiles ? `&tiles=${tiles}` : ""}`);
      const file = `${out}/batch-${String(i + 1).padStart(2, "0")}${tiles ? `-t${tiles.replaceAll(",", "-")}` : ""}.png`;
      await page.locator("#gallery canvas").screenshot({ path: file });
      files.push(file);
    }
  } else if (ids) {
    await show(page, `art&ids=${ids}&zoom=${zoom}${tiles ? `&tiles=${tiles}` : ""}`);
    const file = `${out}/ids-${ids.replaceAll(",", "-")}${tiles ? `-t${tiles.replaceAll(",", "-")}` : ""}.png`;
    await page.locator("#gallery canvas").screenshot({ path: file });
    files.push(file);
  } else if (stress)
    for (const n of stress) {
      const review = await show(page, `art=stress&n=${n}&zoom=1`);
      console.log(`stress ${n}: ${JSON.stringify(review.stats)}`);
    }
  else {
    const { pages } = await show(page, `art=lineup&zoom=${zoom}`);
    await page.locator("#gallery canvas").screenshot({ path: `${out}/lineup.png` });
    files.push(`${out}/lineup.png`);
    for (let p = 0; p < pages; p++) {
      await show(page, `art&page=${p}&zoom=${zoom}`);
      const file = `${out}/sheet-${p + 1}.png`;
      await page.locator("#gallery canvas").screenshot({ path: file });
      files.push(file);
    }
  }
  for (const f of files) console.log(f);
  for (const e of errors) console.log(`ERROR ${e}`);
} finally {
  await browser.close();
}
