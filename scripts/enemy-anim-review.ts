/**
 * Enemy animation QA: screenshots of the dev-only review page (`/gallery.html?anim`, `src/anim-review.ts`), one per
 * animated enemy and clip, paused on a frame: large cells on dark and light ground with the cell, resting bounds and
 * pivot, the frame at game size at four headings next to the static art, and the clip's filmstrip.
 *
 *   npm run dev   # in the background, on :4173
 *   npx vite-node scripts/enemy-anim-review.ts [-- --ids drone,tank] [--clips idle,death] [--frame 3] [--zoom 3]
 *                                             [--out visual-check/anim-review] [--canvas] [--url …]
 *
 * Saves <id>-<clip>.png and prints page errors. WebGL by default (SwiftShader), `--canvas` for Phaser's canvas renderer.
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { ANIMATION_STATES, ENEMY_ANIMATIONS } from "../src/render/enemy-animations";
import { launch, prepare, WEBGL_ARGS } from "./browser";

const args = process.argv.slice(2).filter((a) => a !== "--");
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args.splice(i, 2)[1];
};
const out = resolve(flag("--out") ?? "visual-check/anim-review"),
  base = flag("--url") ?? "http://localhost:4173",
  ids = flag("--ids")?.split(",") ?? Object.keys(ENEMY_ANIMATIONS),
  clips = flag("--clips")?.split(",") ?? [...ANIMATION_STATES],
  frame = flag("--frame") ?? "1",
  zoom = flag("--zoom") ?? "2",
  canvas = args.includes("--canvas");

const browser = await launch(base, canvas ? [] : WEBGL_ARGS);
mkdirSync(out, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 820 } }),
    errors = await prepare(page);
  for (const id of ids)
    for (const clip of clips) {
      await page.goto(`${base}/gallery.html?anim&id=${id}&clip=${clip}&frame=${frame}&zoom=${zoom}`);
      await page.waitForFunction(() => (window as unknown as { __animReview?: { ready: boolean } }).__animReview?.ready, undefined, { timeout: 120_000 });
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
      const file = resolve(out, `${id}-${clip}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(file);
    }
  if (errors.length) console.log(`Page errors:\n${errors.join("\n")}`);
} finally {
  await browser.close();
}
