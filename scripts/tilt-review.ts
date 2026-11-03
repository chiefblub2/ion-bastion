// Screenshot of the tilted towers' review sheet /gallery.html?tilt (with `npm run dev` running).
//   npx vite-node scripts/tilt-review.ts -- [only=flak,lance] [out=visual-check/tilt/sheet.png] [clock=0.6]
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { WEBGL_ARGS, launch } from "./browser";
const arg = Object.fromEntries(process.argv.slice(2).filter((a) => a !== "--").map((a) => a.split("=")));
const base = arg.url ?? "http://localhost:4173";
const q = ["tilt", arg.only && `only=${arg.only}`, arg.clock && `clock=${arg.clock}`].filter(Boolean).join("&");
const browser = await launch(base, WEBGL_ARGS);
try {
  const page = await browser.newPage({ viewport: { width: 2200, height: 1200 } });
  page.on("pageerror", (e) => console.log("ERROR", e.message));
  page.on("console", (m) => m.type() === "error" && console.log("ERROR", m.text()));
  await page.goto(`${base}/gallery.html?${q}`);
  await page.waitForSelector("#gallery canvas");
  await page.waitForTimeout(1500);
  const out = arg.out ?? "visual-check/tilt/sheet.png";
  mkdirSync(dirname(out), { recursive: true });
  await (await page.$("#gallery canvas"))!.screenshot({ path: out });
  console.log(out);
} finally {
  await browser.close();
}
