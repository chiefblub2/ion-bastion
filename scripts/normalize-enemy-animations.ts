/**
 * Re-cuts the supplied enemy animation sheets (`assets-src/enemy-animations/`, described by its `manifest.json`)
 * into the game sheets in `public/assets/enemy-animations/`, losslessly: every pixel is copied, none is resampled.
 *
 *   npx vite-node scripts/normalize-enemy-animations.ts [-- --in <dir> --out <dir>]
 *
 * Why: the supplied strips are declared as 222 px cells, but their frames are not on that grid. Most frames sit
 * 12–40 px right of their cell, so their noses, barrels and shields spill into the next cell (one frame's tip shows
 * at the left edge of the next one, and its own tip is missing); the drone's idle, move and hurt strips even hold
 * 7, 7 and 3 frames on a 250 px pitch. Each frame is cut at the empty columns between frames (the source pitch and
 * frame count, see `LAYOUT`) and placed into a 256 px square cell at its authored position relative to its pitch, so
 * the motion within a clip stays as drawn. The clip's resting body is then aligned to the idle clip's (`align`), so
 * switching clips never jumps. 256 px cells make power-of-two sheets, which WebGL mipmaps (`ART_FILTERING`).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { decodePng, encodePng, VISIBLE_ALPHA, type Png } from "./png";

const ROOT = new URL("../", import.meta.url);
const args = process.argv.slice(2),
  arg = (name: string, fallback: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : fallback;
  };
const dir = (path: string) => new URL(`${path.replace(/\/$/, "")}/`, path.startsWith("/") ? "file://" : ROOT);
const IN = dir(arg("--in", "assets-src/enemy-animations")),
  OUT = dir(arg("--out", "public/assets/enemy-animations"));
/** Edge of a game cell. */
export const CELL = 256;
const STATES = ["idle", "move", "hurt", "death"] as const;
type State = (typeof STATES)[number];
/**
 * Source layouts that differ from the manifest, reviewed by eye on the contact sheets: frame count and pitch in
 * source pixels. The drone strips were drawn wider than their cells; its hurt strip ends in a truncated fourth frame,
 * which is dropped.
 */
const LAYOUT: Partial<Record<string, Partial<Record<State, { frames: number; pitch: number }>>>> = {
  drone: { idle: { frames: 7, pitch: 250 }, move: { frames: 7, pitch: 250 }, hurt: { frames: 3, pitch: 250 } },
};
/** How far (source pixels) a cut may move from its predicted boundary to find the gap between two frames. */
const SEARCH = 40;

interface ManifestClip {
  sheet: string;
  frameCount: number;
  frameWidth: number;
  frameHeight: number;
}
const manifest = JSON.parse(readFileSync(new URL("manifest.json", IN), "utf8")) as { enemies: Record<string, { states: Record<State, ManifestClip> }> };

/** Number of visible pixels (alpha > `VISIBLE_ALPHA`) per column; fainter glow may be cut through. */
function columns(png: Png) {
  const col = new Array<number>(png.width).fill(0);
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) if (png.rgba[(y * png.width + x) * 4 + 3] > VISIBLE_ALPHA) col[x]++;
  return col;
}
/** The cut near `b`: the middle of the longest empty run of columns, else the emptiest column (`clean` false). */
function cut(col: number[], b: number) {
  let best = { at: b, len: 0 },
    run = -1;
  for (let x = Math.max(0, b - SEARCH); x <= Math.min(col.length - 1, b + SEARCH) + 1; x++) {
    const empty = x < col.length && x <= b + SEARCH && col[x] === 0;
    if (empty && run < 0) run = x;
    if (!empty && run >= 0) {
      if (x - run > best.len) best = { at: Math.floor((run + x) / 2), len: x - run };
      run = -1;
    }
  }
  if (best.len) return { at: best.at, clean: true, mass: 0 };
  let at = b;
  for (let x = Math.max(0, b - SEARCH); x <= Math.min(col.length - 1, b + SEARCH); x++) if (col[x] < col[at]) at = x;
  return { at, clean: false, mass: col[at] };
}
/**
 * A strip whose body runs off the bottom edge and continues at the top (a vertical wrap, drone and boss move): a
 * band of rows at the top, separated from the body by at least `WRAP_GAP` empty rows, while the bottom row is
 * drawn. The band is moved back below the body; the strip grows by its height (`band` > 0). A short band without
 * art at the bottom is erased (`band` < 0). Other strips come back unchanged.
 */
const WRAP_GAP = 4,
  WRAP_BAND = 30,
  SLIVER = 6;
export function unwrap(png: Png): { png: Png; band: number } {
  const rows = new Array<number>(png.height).fill(0);
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) if (png.rgba[(y * png.width + x) * 4 + 3] > VISIBLE_ALPHA) rows[y]++;
  if (!rows[0]) return { png, band: 0 };
  const band = rows.indexOf(0);
  if (band < 0 || band > WRAP_BAND || rows.slice(band, band + WRAP_GAP).some(Boolean)) return { png, band: 0 };
  // A sliver at the top without art at the bottom is not a wrap but debris cut by the strip's top edge (drone
  // death): at most `SLIVER` rows of it are erased.
  if (!rows[png.height - 1]) {
    if (band > SLIVER) return { png, band: 0 };
    const rgba = png.rgba.slice();
    rgba.fill(0, 0, band * png.width * 4);
    return { png: { ...png, rgba }, band: -band };
  }
  const height = png.height + band,
    rgba = new Uint8Array(png.width * height * 4),
    stride = png.width * 4;
  rgba.set(png.rgba.subarray(band * stride), band * stride);
  rgba.set(png.rgba.subarray(0, band * stride), png.height * stride);
  return { png: { ...png, height, rgba }, band };
}
/** First and last row with visible pixels. */
function rowRange(png: Png) {
  let y0 = png.height,
    y1 = -1;
  for (let y = 0; y < png.height; y++)
    for (let x = 0; x < png.width; x++)
      if (png.rgba[(y * png.width + x) * 4 + 3] > VISIBLE_ALPHA) {
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
        break;
      }
  return { y0, y1 };
}
/** Column cuts between the frames of a strip: frame i spans `[bounds[i], bounds[i + 1])`. */
function cuts(png: Png, frames: number, pitch: number, notes: string[]) {
  const col = columns(png),
    bounds = [0];
  for (let i = 1; i < frames; i++) {
    const c = cut(col, Math.round(i * pitch));
    if (!c.clean) notes.push(`frame ${i}/${i + 1}: no empty column between them, cut through ${c.mass} px at x=${c.at}`);
    bounds.push(c.at);
  }
  const last = Math.round(frames * pitch);
  bounds.push(last >= png.width ? png.width : cut(col, last).at);
  return bounds;
}
/**
 * How far right of its pitch window a strip's frames sit (source pixels): the mean offset of the cut windows'
 * centres. Removing it centres the frames in their cells without moving any frame against the others.
 */
const windowOffset = (bounds: number[], pitch: number) => Math.round(bounds.slice(0, -1).reduce((t, from, i) => t + (from + bounds[i + 1]) / 2 - (i + 0.5) * pitch, 0) / (bounds.length - 1));
/**
 * Which frame each pixel belongs to. A visible island (4-connected, alpha > `VISIBLE_ALPHA`) goes whole to the frame
 * its centre lies in, so a barrel or nose that reaches past a cut stays with its body; faint glow and islands wider
 * than a frame (smoke joining two frames) follow the column cuts. -1: transparent, or part of a dropped frame.
 */
function owners(png: Png, bounds: number[], pitch: number, offset: number) {
  const { width, height, rgba } = png,
    label = new Int32Array(width * height).fill(-1),
    owner = new Int8Array(width * height).fill(-1),
    byColumn = new Int8Array(width).fill(-1);
  for (let f = 0; f < bounds.length - 1; f++) byColumn.fill(f, bounds[f], bounds[f + 1]);
  const frames = bounds.length - 1,
    stack: number[] = [];
  for (let start = 0; start < width * height; start++) {
    if (label[start] >= 0 || rgba[start * 4 + 3] <= VISIBLE_ALPHA) continue;
    const members: number[] = [];
    let sx = 0,
      x0 = width,
      x1 = 0;
    label[start] = start;
    stack.push(start);
    while (stack.length) {
      const p = stack.pop()!,
        x = p % width;
      members.push(p);
      sx += x;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      for (const q of [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width])
        if (q >= 0 && q < width * height && label[q] < 0 && rgba[q * 4 + 3] > VISIBLE_ALPHA) {
          label[q] = start;
          stack.push(q);
        }
    }
    // An island centred past the last frame belongs to a truncated frame that is dropped.
    const f = Math.max(0, Math.floor((sx / members.length - offset) / pitch)),
      own = f < frames ? f : -1;
    for (const m of members) owner[m] = x1 - x0 > pitch * 1.1 ? byColumn[m % width] : own;
  }
  for (let p = 0; p < width * height; p++) if (owner[p] < 0 && rgba[p * 4 + 3] > 0) owner[p] = byColumn[p % width];
  return owner;
}
/**
 * Copies each frame into a game cell: source x minus its pitch origin and `offset`, centred; y moved down by `padY`.
 * `nudge` moves single frames further (loop alignment).
 */
function place(png: Png, bounds: number[], pitch: number, offset: number, padY: number, notes: string[], nudge: { dx: number; dy: number }[] = []): Png[] {
  const padX = Math.round((CELL - pitch) / 2) - offset,
    owner = owners(png, bounds, pitch, offset),
    frames = Array.from({ length: bounds.length - 1 }, () => ({ ...png, width: CELL, height: CELL, rgba: new Uint8Array(CELL * CELL * 4) })),
    lost = new Array<number>(frames.length).fill(0);
  for (let y = 0; y < png.height; y++)
    for (let x = 0; x < png.width; x++) {
      const p = y * png.width + x,
        i = owner[p];
      if (i < 0) continue;
      const nx = x - Math.round(i * pitch) + padX + (nudge[i]?.dx ?? 0),
        ny = y + padY + (nudge[i]?.dy ?? 0);
      if (nx < 0 || ny < 0 || nx >= CELL || ny >= CELL) {
        if (png.rgba[p * 4 + 3] > VISIBLE_ALPHA) lost[i]++;
        continue;
      }
      frames[i].rgba.set(png.rgba.subarray(p * 4, p * 4 + 4), (ny * CELL + nx) * 4);
    }
  lost.forEach((n, i) => n && notes.push(`frame ${i + 1}: ${n} visible px fall outside the ${CELL} px cell`));
  return frames;
}
/** Opaque mask (alpha ≥ 200) of a cell at half resolution, for alignment. */
function mask(cell: Png) {
  const n = CELL / 2,
    m = new Uint8Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) m[y * n + x] = cell.rgba[(y * 2 * CELL + x * 2) * 4 + 3] >= 200 ? 1 : 0;
  return m;
}
/** Search radius of the alignment, in cell pixels. */
const ALIGN = 48;
/**
 * The whole-pixel shift that lays `cell`'s solid body onto `ref`'s: the shift (within ±`ALIGN`, in steps of 2 px)
 * with the most overlapping opaque pixels. Thrust, sparks and smoke are mostly translucent, so the body decides.
 */
export function alignment(ref: Png, cell: Png) {
  const n = CELL / 2,
    a = mask(ref),
    b = mask(cell),
    r = ALIGN / 2;
  let best = { dx: 0, dy: 0, score: -1 };
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      let score = 0;
      for (let y = Math.max(0, dy); y < Math.min(n, n + dy); y++) {
        const row = y * n,
          src = (y - dy) * n - dx;
        for (let x = Math.max(0, dx); x < Math.min(n, n + dx); x++) score += a[row + x] & b[src + x];
      }
      // Ties keep the smaller shift.
      if (score > best.score || (score === best.score && Math.abs(dx) + Math.abs(dy) < Math.abs(best.dx) + Math.abs(best.dy))) best = { dx, dy, score };
    }
  return { dx: best.dx * 2, dy: best.dy * 2 };
}
/** The frames side by side; the strip is padded with empty cells to a power-of-two width, so WebGL mipmaps it. */
function strip(frames: Png[]): Png {
  const width = 2 ** Math.ceil(Math.log2(CELL * frames.length)),
    rgba = new Uint8Array(width * CELL * 4);
  frames.forEach((f, i) => {
    for (let y = 0; y < CELL; y++) rgba.set(f.rgba.subarray(y * CELL * 4, (y + 1) * CELL * 4), (y * width + i * CELL) * 4);
  });
  return { ...frames[0], width, height: CELL, rgba };
}

for (const [id, set] of Object.entries(manifest.enemies)) {
  mkdirSync(new URL(`${id}/`, OUT), { recursive: true });
  const clips = STATES.map((state) => {
    const notes: string[] = [],
      { png, band } = unwrap(decodePng(readFileSync(new URL(`${id}/${state}.png`, IN)))),
      { frames, pitch } = LAYOUT[id]?.[state] ?? { frames: set.states[state].frameCount, pitch: set.states[state].frameWidth };
    if (band > 0) notes.push(`unwrapped ${band} rows from the top back below the body`);
    if (band < 0) notes.push(`erased a ${-band} px sliver of cut debris at the top edge`);
    const bounds = cuts(png, frames, pitch, notes);
    return { state, png, frames, pitch, bounds, notes, offset: windowOffset(bounds, pitch), rows: rowRange(png) };
  });
  // One offset per pitch (the idle clip's, else the clip's own) and one vertical pad per enemy, so every clip keeps
  // the authored position of the body and switching clips never jumps.
  const idle = clips[0],
    y0 = Math.min(...clips.map((c) => c.rows.y0)),
    y1 = Math.max(...clips.map((c) => c.rows.y1)),
    padY = Math.max(-y0, Math.min(Math.round((CELL - set.states.idle.frameHeight) / 2), CELL - 1 - y1));
  let rest: Png | undefined;
  for (const c of clips) {
    const offset = c.pitch === idle.pitch ? idle.offset : c.offset,
      first = place(c.png, c.bounds, c.pitch, offset, padY, []),
      // Every clip's opening frame (for death the intact body) is laid onto the first idle frame.
      shift = rest ? alignment(rest, first[0]) : { dx: 0, dy: 0 },
      placed = place(c.png, c.bounds, c.pitch, offset - shift.dx, padY + shift.dy, []),
      // Loops hold the body still: some supplied loops slide (aegis idle drifts 28 px and jumps back at the seam).
      // Each frame is laid onto the resting body; hurt and death keep their recoil and debris as drawn.
      loop = c.state === "idle" || c.state === "move",
      nudge = loop ? placed.map((f) => alignment(rest ?? placed[0], f)) : [],
      frames = place(c.png, c.bounds, c.pitch, offset - shift.dx, padY + shift.dy, c.notes, nudge);
    rest ??= frames[0];
    if (nudge.some((n) => n.dx || n.dy)) c.notes.push(`loop frames nudged ${nudge.map((n) => `${n.dx},${n.dy}`).join(" ")}`);
    writeFileSync(new URL(`${id}/${c.state}.png`, OUT), encodePng(strip(frames)));
    console.log(`${id}/${c.state}: ${c.frames} frames from a ${c.pitch} px pitch, offset ${offset}, pad ${padY}${shift.dx || shift.dy ? `, aligned ${shift.dx}, ${shift.dy} px onto idle` : ""}`);
    for (const n of c.notes) console.log(`  ${n}`);
  }
}
