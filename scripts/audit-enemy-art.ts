/**
 * Enemy art audit: reads the alpha of every PNG in public/assets/enemies/ and checks it against the content and the
 * art registry (`src/render/enemy-art.ts`). No browser and no dependency (`scripts/png.ts`).
 *
 *   npx vite-node scripts/audit-enemy-art.ts            # table and warnings; exit code 1 on errors
 *   npx vite-node scripts/audit-enemy-art.ts -- --fix   # erase the reviewed residue islands in `RESIDUE` (lossless)
 *   npx vite-node scripts/audit-enemy-art.ts -- --write # regenerate src/render/enemy-art-bounds.ts
 *
 * Columns: canvas size, visible bounds (alpha > 16) as a share of the canvas, centre of those bounds and of the alpha
 * mass (share of the canvas edge from its middle, +x is forward), the displayed canvas edge in body diameters
 * (`artEdge`) and the other registry tuning, and the displayed visible length and width in body radii (`r`).
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { DEFAULT_CONTENT } from "../src/content";
import type { EnemyId } from "../src/core/types";
import { artEdge, ENEMY_ART } from "../src/render/enemy-art";
import { decodePng, encodePng, islands, measureArt, type ArtMetrics } from "./png";

const DIR = new URL("../public/assets/enemies/", import.meta.url),
  BOUNDS_FILE = new URL("../src/render/enemy-art-bounds.ts", import.meta.url);
const args = process.argv.slice(2);

/**
 * Residue reviewed by eye: specks and slivers of neighbouring sprites left in the canvas when the sheet was cut.
 * `--fix` erases each island (other than the main one) that lies wholly inside one of these boxes (canvas pixels
 * x0, y0, x1, y1); every other pixel stays as it is.
 */
const RESIDUE: Partial<Record<EnemyId, [number, number, number, number][]>> = {
  ashwing: [[16, 126, 30, 152], [232, 170, 240, 182]],
  chainling: [[102, 200, 120, 208]],
  decoy: [[110, 220, 180, 240]],
  gale: [[96, 184, 154, 198]],
  mender: [[16, 154, 33, 174]],
  moth: [[224, 80, 240, 150]],
  nullbearer: [[224, 132, 240, 156]],
  twin: [[118, 15, 128, 24]],
  veiler: [[185, 38, 208, 46]],
  warden: [[200, 120, 224, 205], [165, 48, 177, 57]],
};
/** Detached islands reviewed and kept: they belong to the art. */
const KEPT: Partial<Record<EnemyId, string>> = { wolf: "ear spike", mender: "thruster pod" };
/** Detached islands at least this large (pixels) are reported; smaller ones are anti-aliasing specks. */
const REPORT_ISLAND = 40;

const files = readdirSync(DIR).filter((f) => f.endsWith(".png")).sort(),
  enemies = Object.keys(DEFAULT_CONTENT.enemies) as EnemyId[],
  errors: string[] = [];
const f2 = (v: number) => (v >= 0 ? " " : "") + v.toFixed(2);

// Coverage: content ↔ registry ↔ files.
const registered = Object.keys(ENEMY_ART) as EnemyId[];
for (const id of enemies) if (!ENEMY_ART[id]) console.log(`procedural: ${id} has no art (keeps its procedural body)`);
for (const id of registered) {
  if (!DEFAULT_CONTENT.enemies[id]) errors.push(`${id}: registered art for an enemy that does not exist`);
  if (!files.includes(`${id}.png`)) errors.push(`${id}: registered art file assets/enemies/${id}.png is missing`);
}
for (const f of files) if (!registered.includes(f.replace(/\.png$/, "") as EnemyId)) errors.push(`${f}: no registry entry (the file is never loaded)`);
const nonPng = readdirSync(DIR).filter((f) => !f.endsWith(".png"));
if (nonPng.length) errors.push(`unexpected files in assets/enemies/: ${nonPng.join(", ")}`);

const measured: [EnemyId, ArtMetrics][] = [];
let totalBytes = 0;
console.log("id           size     visible   bounds ctr  mass ctr    edge  shift angle  shown L×W (r)  warnings");
for (const file of files) {
  const id = file.replace(/\.png$/, "") as EnemyId,
    path = new URL(file, DIR),
    bytes = readFileSync(path);
  totalBytes += bytes.length;
  let png;
  try {
    png = decodePng(bytes);
  } catch (e) {
    errors.push(`${file}: ${(e as Error).message}`);
    continue;
  }
  const warnings: string[] = [];
  if (png.colorType !== 6) errors.push(`${file}: no alpha channel (colour type ${png.colorType})`);
  if (args.includes("--fix") && RESIDUE[id]) {
    const boxes = RESIDUE[id]!,
      erased = islands(png).slice(1).filter((island) => boxes.some(([x0, y0, x1, y1]) => island.bounds.x0 >= x0 && island.bounds.y0 >= y0 && island.bounds.x1 <= x1 && island.bounds.y1 <= y1));
    for (const island of erased) for (const p of island.pixels) png.rgba.fill(0, p * 4, p * 4 + 4);
    if (erased.length) {
      const out = encodePng(png);
      writeFileSync(path, out);
      console.log(`fixed ${file}: erased ${erased.length} residue island(s), ${erased.reduce((s, i) => s + i.area, 0)} px; ${bytes.length} → ${out.length} bytes`);
    }
  }
  const m = measureArt(png),
    art = ENEMY_ART[id],
    d = DEFAULT_CONTENT.enemies[id];
  measured.push([id, m]);
  if (m.coverage === 0) errors.push(`${file}: fully transparent`);
  else if (m.coverage < 0.08) warnings.push(`mostly empty (${(m.coverage * 100).toFixed(0)}% visible)`);
  if (m.transparent < 0.2) errors.push(`${file}: only ${(m.transparent * 100).toFixed(0)}% transparent (opaque background?)`);
  if (m.borderOpaque > 0) warnings.push(`art touches the canvas edge (${(m.borderOpaque * 100).toFixed(1)}% of the border): clipped?`);
  const detached = islands(png).filter((island, i, all) => i > 0 && island.area >= REPORT_ISLAND && island.area < all[0].area * 0.03);
  if (!KEPT[id]) for (const island of detached) warnings.push(`detached island ${island.area} px at ${island.bounds.x0},${island.bounds.y0}-${island.bounds.x1},${island.bounds.y1} (residue? review)`);
  if (Math.hypot(m.boundsCenter.x, m.boundsCenter.y) > 0.03) warnings.push(`off-centre bounds (${f2(m.boundsCenter.x)},${f2(m.boundsCenter.y)}): re-centred from ART_BOUNDS`);
  if (m.darkFringe > 0.5) warnings.push(`dark edge ${(m.darkFringe * 100).toFixed(0)}% (ink outline or matte halo)`);
  if (m.lightFringe > 0.1) warnings.push(`light edge halo ${(m.lightFringe * 100).toFixed(0)}%`);
  if (m.bright > 0.15) warnings.push(`very bright (${(m.bright * 100).toFixed(0)}% of pixels): may wash out on light ground`);
  // The art as measured now (not the bounds table, which may be stale): its square edge is 2 r × edge.
  const edge = art ? artEdge({ ...art, bounds: { w: m.visibleWidth, h: m.visibleHeight, x: m.boundsCenter.x, y: m.boundsCenter.y } }) : 0,
    // Visible extents in body radii.
    length = 2 * edge * m.visibleWidth,
    width = 2 * edge * m.visibleHeight;
  if (art && d.visual.shape !== "worm" && (Math.max(length, width) < 1.8 || Math.max(length, width) > 2.9)) warnings.push(`shown ${length.toFixed(2)} r long: outside 1.8–2.9 r`);
  console.log(
    `${id.padEnd(12)} ${`${m.width}²`.padEnd(8)} ${m.visibleWidth.toFixed(2)}×${m.visibleHeight.toFixed(2)} ${f2(m.boundsCenter.x)},${f2(m.boundsCenter.y)}  ${f2(m.center.x)},${f2(m.center.y)}  ${edge.toFixed(2)}  ${(art?.shift ?? 0).toFixed(2)}  ${(art?.angleOffset ?? 0).toFixed(2)}   ${length.toFixed(2)}×${width.toFixed(2)}      ${warnings.join("; ")}`,
  );
}
console.log(`\n${enemies.length} enemies, ${files.length} PNGs, ${registered.length} registered, ${(totalBytes / 1024).toFixed(0)} KiB of art`);

if (args.includes("--write")) {
  const n = (v: number) => (Math.abs(v) < 0.0005 ? 0 : v).toFixed(3),
    rows = measured.map(([id, m]) => `  ${id}: { w: ${n(m.visibleWidth)}, h: ${n(m.visibleHeight)}, x: ${n(m.boundsCenter.x)}, y: ${n(m.boundsCenter.y)} },`);
  writeFileSync(
    BOUNDS_FILE,
    `import type { EnemyId } from "../core/types";
import type { ArtBounds } from "./enemy-art";
/**
 * Generated by \`npx vite-node scripts/audit-enemy-art.ts -- --write\`; \`enemy-art.test.ts\` re-measures the PNGs and fails
 * when this table is stale. Visible bounds (alpha > 16) of each art file as a share of its square canvas.
 */
export const ART_BOUNDS: Readonly<Partial<Record<EnemyId, ArtBounds>>> = {
${rows.join("\n")}
};
`,
  );
  console.log(`wrote ${BOUNDS_FILE.pathname}`);
}
for (const e of errors) console.error(`ERROR ${e}`);
if (errors.length) process.exit(1);
