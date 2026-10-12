// Renders music scenes offline to WAV for listening (needs `npm run dev`):
//   npx vite-node scripts/render-music.ts [-- --theme outpost]
// Writes visual-check/music/*.wav and index.html (play them back to back) and prints peak/RMS per clip.
import { mkdirSync, writeFileSync } from "node:fs";
import type { Family } from "../src/audio/families";
import type { Scenario } from "../src/music-render";
import { launch } from "./browser";

const BASE = "http://localhost:4173",
  OUT = "visual-check/music",
  theme = (process.argv.includes("--theme") ? process.argv[process.argv.indexOf("--theme") + 1] : "outpost") as Scenario["theme"],
  ALL: Family[] = ["rapid", "heavy", "electric", "control", "fire", "traps"],
  base = { theme, threat: 0.6, defense: 0.5, clear: 6, heavies: 0, bars: 8 };
const SCENES: [string, Scenario][] = [
  ...[5, 10, 20, 40, 80].map((rate): [string, Scenario] => [`rapid-${rate}`, { ...base, families: ["rapid"], rate }]),
  ...[5, 10, 20, 40, 80].map((rate): [string, Scenario] => [`mixed-${rate}`, { ...base, families: ALL, rate }]),
  ["heavy-20", { ...base, families: ["heavy"], rate: 20 }],
  ["calm", { ...base, families: ["rapid", "control"], rate: 6, threat: 0.1, defense: 0.2, clear: 2 }],
  ["climax", { ...base, families: ALL, rate: 40, threat: 0.95, defense: 0.9, clear: 12, heavies: 2 }],
];

mkdirSync(OUT, { recursive: true });
const browser = await launch(BASE),
  page = await browser.newPage();
await page.goto(`${BASE}/gallery.html?render`);
await page.waitForFunction(() => "__renderMusic" in window);
const rows: string[] = [];
for (const [name, scene] of SCENES) {
  const r = await page.evaluate((s) => (window as unknown as { __renderMusic: (s: Scenario) => Promise<{ wav: string; peak: number; rms: number }> }).__renderMusic(s), scene);
  writeFileSync(`${OUT}/${theme}-${name}.wav`, Buffer.from(r.wav, "base64"));
  rows.push(`${name}\t${r.peak.toFixed(1)} dBFS peak\t${r.rms.toFixed(1)} dBFS RMS`);
  console.log(rows[rows.length - 1]);
}
writeFileSync(
  `${OUT}/index.html`,
  `<!doctype html><meta charset="utf-8"><title>Music renders</title><body style="font:14px system-ui;background:#111;color:#ddd">${SCENES.map(([name], i) => `<p>${rows[i]}<br><audio controls preload="none" src="${theme}-${name}.wav"></audio></p>`).join("")}`,
);
await browser.close();
