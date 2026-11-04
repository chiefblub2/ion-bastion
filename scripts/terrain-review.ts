// Screenshot of the terrain review page /gallery.html?terrain (with `npm run dev` running).
//   npx vite-node scripts/terrain-review.ts -- [theme=island] [clock=1.5] [towers=0] [seed=b] [focus=7,7] [zoom=4] [flora=1] [props=1] [map=outpost-07] [out=visual-check/terrain/<theme>.png]
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { WEBGL_ARGS, launch } from "./browser";
const arg = Object.fromEntries(process.argv.slice(2).filter((a) => a !== "--").map((a) => a.split("=")));
const base = arg.url ?? "http://localhost:4173";
const theme = arg.theme ?? "island";
const q = ["terrain", (!arg.map || arg.theme) && `theme=${theme}`, `clock=${arg.clock ?? 1.5}`, arg.towers && `towers=${arg.towers}`, arg.seed && `seed=${arg.seed}`, arg.focus && `focus=${arg.focus}`, arg.zoom && `zoom=${arg.zoom}`, arg.flora && "flora", arg.props && "props", arg.map && `map=${arg.map}`].filter(Boolean).join("&");
const browser = await launch(base, WEBGL_ARGS);
try {
  const page = await browser.newPage({ viewport: { width: 2100, height: 1300 } });
  page.on("pageerror", (e) => console.log("ERROR", e.message));
  page.on("console", (m) => m.type() === "error" && console.log("ERROR", m.text()));
  await page.goto(`${base}/gallery.html?${q}`);
  await page.waitForFunction(() => (window as unknown as { __terrain?: { ready: boolean } }).__terrain?.ready);
  await page.waitForTimeout(800);
  const out = arg.out ?? `visual-check/terrain/${arg.map ?? theme}${arg.seed ?? ""}${arg.focus ? `-${arg.focus}` : ""}${arg.flora ? "-flora" : ""}${arg.props ? "-props" : ""}.png`;
  mkdirSync(dirname(out), { recursive: true });
  await (await page.$("#gallery canvas"))!.screenshot({ path: out });
  console.log(out);
} finally {
  await browser.close();
}
