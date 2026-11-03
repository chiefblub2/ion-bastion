import { missionById } from "../src/content/missions";
import { WEBGL_ARGS, call, launch, open, prepare } from "./browser";
const base = "http://localhost:4173", mission = missionById("lianenpfad")!;
const browser = await launch(base, WEBGL_ARGS);
for (const mode of ["cached", "live"]) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
  const errors = await prepare(page);
  await open(page, base, { mission: mission.id, wave: 12, credits: 1_000_000, ...(mode === "live" ? { turrets: "live" } : {}) });
  let n = 0;
  for (let y = 0; y < mission.map.rows && n < 30; y++)
    for (let x = 0; x < mission.map.columns && n < 30; x++)
      try { await call(page, "build_defense_tower", { tower: n % 2 ? "blast" : "pulse", x, y }); n++; } catch {}
  for (let r = 0; r < 4; r++) {
    const { towers } = await call<{ towers: { id: number; nextUpgrades: { id: string }[] }[] }>(page, "read_defense_state");
    for (const t of towers) { const u = t.nextUpgrades.find((u) => u.id.startsWith("level-")); if (u) await call(page, "upgrade_defense_tower", { id: t.id, upgrade: u.id }); }
  }
  await call(page, "start_defense_wave");
  await page.waitForTimeout(7000);
  await page.keyboard.press("p").catch(() => {});
  await page.waitForTimeout(300);
  await (await page.$("#board-wrap canvas"))!.screenshot({ path: `visual-check/concepts/game-${mode}.png` });
  const stats = await page.evaluate(() => (window as unknown as { __turretCache?: { stats(): object } }).__turretCache?.stats());
  console.log(mode, n, JSON.stringify(stats), errors.filter((e) => !e.includes("Failed to process file")).join(" | "));
  await page.close();
}
await browser.close();
