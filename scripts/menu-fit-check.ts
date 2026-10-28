/**
 * The fitted landscape menus (menu.css, `FIT_QUERY` in app/compact.ts): plays the menu flow on phone-sized landscape
 * viewports and fails when a page scrolls or overflows (the Run map with a node's card included), Play does not open the mode list, the Codex switch does not
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
import { bossMapState, midMapState, runStates } from "./run-states";

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
const states = runStates();
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
  // The Run map fits one screen, and a node's card keeps its action on screen.
  await page.click('#run-page [data-run="new"]');
  await page.waitForTimeout(400);
  await page.click('#run-page [data-run^="starter"]');
  await step(page, size, "run-map", [w, h]);
  await page.click('.run-node[data-state="next"]');
  await step(page, size, "run-card", [w, h]);
  const action = await page.$eval(".run-inspector-action .primary", (e) => e.getBoundingClientRect().toJSON());
  if (action.bottom > h || action.right > w || action.height < 40) fail(size, "the Run card's action is off screen or squashed");
  // Every reward, camp and act decision fits one screen with its options, details and actions on it.
  for (const [name, state] of Object.entries(states)) {
    await page.evaluate((v) => localStorage.setItem("ion-bastion:run", v), JSON.stringify(state));
    await page.goto(`${base}/#run`);
    await page.reload();
    await page.waitForTimeout(500);
    const where = `${size} run-${name}`;
    const option = await page.$(".run-option:not(:disabled)");
    if (!option) fail(where, "no selectable option");
    else {
      await option.click();
      await page.waitForTimeout(150);
      if (!(await page.evaluate(() => document.activeElement?.classList.contains("run-option") && document.activeElement.getAttribute("aria-pressed") === "true")))
        fail(where, "the selected option lost the focus");
    }
    await step(page, size, `run-${name}`, [w, h]);
    const boxes = await page.$$eval(".run-decision-actions button, .run-continue .primary", (list) => list.map((e) => e.getBoundingClientRect().toJSON()));
    if (!boxes.length) fail(where, "no action");
    for (const b of boxes) if (b.bottom > h + 0.5 || b.right > w + 0.5 || b.top < 0 || b.height < 40) fail(where, `an action is off screen or small (${Math.round(b.top)}–${Math.round(b.bottom)}, ${Math.round(b.height)} px)`);
    // A full roster: Take opens the replacement, which lists what the replaced tower loses.
    if (name === "replace") {
      await page.click(".run-take");
      await page.waitForTimeout(200);
      await page.click(".run-option");
      await step(page, size, "run-replace-confirm", [w, h]);
      if (!(await page.locator(".run-loss li").count())) fail(where, "the replacement shows no consequences");
      await page.click('[data-run="cancel"]');
      await page.waitForTimeout(150);
      if ((await page.getAttribute(".run-decision", "data-step")) !== "towers") fail(where, "Cancel did not return to the draft");
    }
    // A double tap on Take claims the relic once.
    if (name === "relic") {
      const before = state.relics.length;
      await page.dblclick(".run-take");
      await page.waitForTimeout(200);
      const after = await page.evaluate(() => JSON.parse(localStorage.getItem("ion-bastion:run")!).relics.length);
      if (after !== before + 1) fail(where, `Take claimed ${after - before} relics`);
    }
    // The act reward: taking the Doctrine gives up the relic (no Master License).
    if (name === "act") {
      await page.click('.run-option[data-run="pick:doctrine"]');
      await page.click(".run-take");
      await page.waitForTimeout(150);
      await page.click(".run-option");
      await page.click(".run-take");
      await page.waitForTimeout(200);
      const offers = await page.evaluate(() => JSON.parse(localStorage.getItem("ion-bastion:run")!).offers);
      if (offers.legendary || offers.doctrine) fail(where, "the act reward left a second pick open");
    }
  }
  // A second-column mission's card shows its map too (it used to be squeezed beside the middle column and hid it).
  await page.evaluate((v) => localStorage.setItem("ion-bastion:run", v), JSON.stringify(midMapState()));
  await page.goto(`${base}/#run`);
  await page.reload();
  await page.waitForTimeout(500);
  if (!(await page.$(".run-inspector"))) await page.click('.run-node[data-state="next"]');
  await step(page, size, "run-mid-card", [w, h]);
  const mid = await page.$eval(".run-inspector .run-map", (e) => e.getBoundingClientRect().width).catch(() => 0);
  if (mid < 100) fail(size, "the second mission's card shows no map");
  // The act boss's card on the map: its modifiers, the technology it may leave, and Deploy on screen.
  await page.evaluate((v) => localStorage.setItem("ion-bastion:run", v), JSON.stringify(bossMapState()));
  await page.goto(`${base}/#run`);
  await page.reload();
  await page.waitForTimeout(500);
  // A single road on opens its card by itself; a tap would close it again.
  if (!(await page.$(".run-inspector"))) await page.click('.run-node[data-kind="boss"][data-state="next"]');
  await step(page, size, "run-boss-card", [w, h]);
  const deploy = await page.$eval(".run-inspector-action .primary", (e) => e.getBoundingClientRect().toJSON());
  if (deploy.bottom > h || deploy.right > w || deploy.height < 40) fail(size, "the boss card's Deploy is off screen or squashed");
  if (!(await page.locator(".run-inspector .run-loot").count())) fail(size, "the boss card shows no boss technology");
  await page.evaluate(() => localStorage.removeItem("ion-bastion:run"));
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
