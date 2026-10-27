/**
 * The fitted landscape menus (menu.css, `FIT_QUERY` in app/compact.ts): plays the menu flow on phone-sized landscape
 * viewports and fails when a page scrolls or overflows, Play does not open the mode list, the Codex switch does not
 * swap its pages, Start Mission leaves the screen, a locked mission loses its
 * explanation, Intel is empty, the atlas forgets the browsed mission after Back, or Start does not open the game.
 * Tablet, desktop and portrait sizes are checked for horizontal overflow only (their pages scroll by design).
 *
 *   npm run dev   # in the background, on :4173
 *   npx vite-node scripts/menu-fit-check.ts [-- --sizes 667x375,844x390] [--out dir] [--url http://localhost:4173]
 *
 * Screenshots of every step go to visual-check/menu-fit/ (git-ignored). `CHROME_PATH` picks another browser binary.
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "playwright-core";
import { launch } from "./browser";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const base = arg("url") ?? "http://localhost:4173",
  out = resolve(arg("out") ?? "visual-check/menu-fit"),
  phones = (arg("sizes") ?? "667x375,740x360,844x390,932x430,956x440").split(",").map((s) => s.split("x").map(Number) as [number, number]),
  others: [number, number][] = [
    [1024, 768],
    [1440, 900],
    [390, 844],
  ];
mkdirSync(out, { recursive: true });
const browser = await launch(base);
let failures = 0;
const fail = (where: string, what: string) => {
  failures++;
  console.log(`  FAIL ${where}: ${what}`);
};
/** Page size, Start Mission's box and every visible menu control smaller than 40 px either way. */
const measure = (page: Page) =>
  page.evaluate(() => {
    const doc = document.scrollingElement!,
      start = document.querySelector("#mission-page:not([hidden]) .atlas-start")?.getBoundingClientRect(),
      small = [...document.querySelectorAll<HTMLElement>("#start-screen button:not(.world-body, .region), #start-screen a")]
        .filter((e) => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && !e.closest("[hidden]") && (r.width < 40 || r.height < 40);
        })
        .map((e) => e.id || e.className);
    return { width: doc.scrollWidth, height: doc.scrollHeight, start: start && { top: start.top, bottom: start.bottom, right: start.right }, small };
  });
async function step(page: Page, size: string, name: string, [w, h]: [number, number], { start = false, fitted = true } = {}) {
  await page.waitForTimeout(900);
  const m = await measure(page),
    where = `${size} ${name}`;
  if (m.width > w) fail(where, `horizontal overflow (${m.width} px)`);
  if (fitted && m.height > h) fail(where, `the page scrolls (${m.height} px)`);
  if (start && (!m.start || m.start.top < 0 || m.start.bottom > h || m.start.right > w)) fail(where, "Start Mission is off screen");
  console.log(`${where}: ${m.width}×${m.height}${m.small.length ? `  (small targets: ${[...new Set(m.small)].join(", ")})` : ""}`);
  await page.screenshot({ path: `${out}/${size}-${name}.png` });
}
/** DOM clicks for the map's anchors: a station or label button is a zero-size anchor with its plate beside it. */
const tap = (page: Page, selector: string) => page.$eval(selector, (e) => (e as HTMLElement).click());

for (const [w, h] of phones) {
  const size = `${w}x${h}`,
    page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
  page.on("pageerror", (e) => fail(size, String(e)));
  await page.goto(`${base}/`);
  await step(page, size, "home", [w, h]);
  for (const hash of ["play", "gegnerakte", "turmakte", "spielhilfe", "mehrspieler", "run"]) {
    await page.goto(`${base}/#${hash}`);
    await step(page, size, hash, [w, h]);
  }
  await page.goto(`${base}/#gegnerakte`);
  await page.waitForTimeout(400);
  await page.click('#codex-page [data-codex="towers"]');
  await page.waitForTimeout(300);
  if (!(await page.isVisible("#towers-page"))) fail(size, "the Codex switch did not open the towers");
  // Home → Play → Campaign: a fresh visitor's Play button opens the mode list.
  await page.goto(`${base}/`);
  await page.waitForTimeout(600);
  await page.click("#menu-primary");
  await page.waitForTimeout(300);
  if (!(await page.isVisible("#play-page"))) fail(size, "Play did not open the mode list");
  await page.click("#menu-campaign");
  await step(page, size, "atlas", [w, h], { start: true });
  // Out to the star system and back down: a world, a sector, a locked mission.
  await page.click("#world-zoom");
  await page.waitForTimeout(300);
  await page.click("#world-zoom");
  await step(page, size, "system", [w, h], { start: true });
  await tap(page, "#system-bodies [data-planet]");
  await step(page, size, "world", [w, h], { start: true });
  await tap(page, "#sector-tabs [data-sector]");
  await step(page, size, "sector", [w, h], { start: true });
  await tap(page, "#mission-list [data-pick]:nth-child(2)");
  await step(page, size, "locked", [w, h], { start: true });
  if (!/to unlock/.test((await page.textContent("#brief-actions")) ?? "")) fail(size, "a locked mission shows no unlock rule");
  await page.click('[data-brief-tab="intel"]');
  await step(page, size, "intel", [w, h], { start: true });
  if (!(await page.locator("#brief-intel .brief-enemies li").count())) fail(size, "Intel lists no enemies");
  await page.click('[data-brief-tab="overview"]');
  await page.click('#brief-actions [data-step="prev"]');
  await step(page, size, "previous", [w, h], { start: true });
  // Back to Play and into the campaign again: the browsed mission is still featured.
  const picked = await page.getAttribute("#mission-list [aria-pressed=true]", "data-pick");
  await page.click("#mission-page [data-back]");
  await step(page, size, "back", [w, h]);
  await page.click("#menu-campaign");
  await page.waitForTimeout(900);
  if ((await page.getAttribute("#mission-list [aria-pressed=true]", "data-pick")) !== picked) fail(size, "the atlas lost the browsed mission");
  await page.click('#mission-modes [data-sector]:not([aria-selected="true"])');
  await step(page, size, "circuit", [w, h], { start: true });
  // A turn to portrait and back refits the map.
  await page.setViewportSize({ width: h, height: w });
  await page.waitForTimeout(400);
  await page.setViewportSize({ width: w, height: h });
  await step(page, size, "rotated", [w, h], { start: true });
  await page.click("#mission-modes [data-sector]");
  await page.waitForTimeout(800);
  await page.click(".atlas-start:not(:disabled)");
  await page.waitForTimeout(600);
  if ((await page.evaluate(() => document.documentElement.dataset.view)) !== "game") fail(size, "Start Mission did not open the game");
  await page.close();
}
for (const [w, h] of others) {
  const size = `${w}x${h}`,
    page = await browser.newPage({ viewport: { width: w, height: h } });
  for (const hash of ["", "#play", "#missionen"]) {
    await page.goto(`${base}/${hash}`);
    await step(page, size, hash.slice(1) || "home", [w, h], { fitted: false });
  }
  await page.close();
}
await browser.close();
console.log(failures ? `${failures} failure(s)` : "All menu checks passed.");
process.exit(failures ? 1 : 0);
