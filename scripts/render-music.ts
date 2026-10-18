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
  base: Scenario = { theme, phase: "wave", threat: 0.6, danger: 0.3, arc: 0.4, heavies: 0, bosses: 0, towers: 0, families: ALL, rate: 1.5, music: true, bars: 8 };
const SCENES: [string, Scenario][] = [
  ["menu", { ...base, phase: "menu", threat: 0, danger: 0, arc: 0 }],
  ["build", { ...base, phase: "build", threat: 0, danger: 0.1 }],
  ["wave-low", { ...base, threat: 0.3, danger: 0.1, arc: 0.1 }],
  ["wave-mid", { ...base }],
  ["wave-danger", { ...base, danger: 0.8 }],
  ["escalated", { ...base, threat: 0.95, heavies: 2, danger: 0.6, arc: 0.8 }],
  ["boss", { ...base, threat: 0.5, heavies: 1, bosses: 1 }],
  ["wave-12-towers", { ...base, towers: 12 }],
  // The shot storm alone (music off): the level should barely move from 3 to 40 towers.
  ...[3, 15, 40].map((towers): [string, Scenario] => [`shots-${towers}`, { ...base, towers, music: false }]),
  ["shots-rapid-40", { ...base, towers: 40, families: ["rapid"], music: false }],
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
