/**
 * Re-cuts the supplied enemy animation sheets (`assets-src/enemy-animations/<id>.png`, described by its
 * `manifest.json`, version 2) into the game sheets `public/assets/enemy-animations/<id>.png`, losslessly: every
 * pixel is copied, none is resampled.
 *
 *   npx vite-node scripts/normalize-enemy-animations.ts [-- --in <dir> --out <dir>]
 *
 * Source: one grid per enemy, `columns` × `rows` cells of `frameWidth` × `frameHeight` px, one animation per row
 * (`animations.<state>.row`, `frames` cells from the left). Why re-cut: the frames do not sit exactly in their cells.
 * Some reach past the right edge, so a nose, barrel or shield tip shows at the left edge of the next cell and is
 * missing from its own; some loops slide a few pixels per frame and snap back at the seam (aegis idle, drone move);
 * the aegis sheet carries faint grid lines along its cell boundaries (`eraseGridLines`).
 * Each row is cut at the empty columns between frames (a whole visible island stays with the frame its centre lies
 * in) and placed into a 256 px cell at its authored position relative to the pitch; every clip's opening frame is
 * aligned to the first idle frame, and loop frames are held on the resting body (unless that makes the loop less
 * steady, as for a gallop whose outline changes), so switching clips never jumps.
 * Output: the same grid with 256 px cells (8 × 4 → 2048 × 1024, a power of two, which WebGL mipmaps).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { ANIMATION_STATES, manifestClips, type AnimationManifest } from "../src/render/enemy-animations";
import { decodePng, encodePng, measureArt, VISIBLE_ALPHA, type Png } from "./png";

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
/** How far (source pixels) a cut may move from its predicted boundary to find the gap between two frames. */
const SEARCH = 40;

/** The supplied pack (`manifest.json`, version 2; `AnimationManifest` describes it). */
const manifest = JSON.parse(readFileSync(new URL("manifest.json", IN), "utf8")) as AnimationManifest;

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
 * its centre lies in, so a barrel, nose or shield that reaches past a cut stays with its body; a small island goes to
 * the frame of the nearest owned pixels, so a flame tip broken off at a boundary stays with its flame; faint glow
 * an island wider than a frame (two frames' art touching) is split from its solid cores outward
 * (`splitWide`); faint glow outside every island follows the column cuts. -1: transparent, or part of a
 * dropped frame.
 */
function owners(png: Png, bounds: number[], pitch: number, offset: number) {
  const { width, height, rgba } = png,
    label = new Int32Array(width * height).fill(-1),
    owner = new Int8Array(width * height).fill(-1),
    byColumn = new Int8Array(width).fill(-1);
  for (let f = 0; f < bounds.length - 1; f++) byColumn.fill(f, bounds[f], bounds[f + 1]);
  const frames = bounds.length - 1,
    stack: number[] = [],
    islands: { members: number[]; cx: number; x0: number; x1: number; y0: number; y1: number }[] = [];
  for (let start = 0; start < width * height; start++) {
    if (label[start] >= 0 || rgba[start * 4 + 3] <= VISIBLE_ALPHA) continue;
    const island = { members: [] as number[], cx: 0, x0: width, x1: 0, y0: height, y1: 0 };
    label[start] = start;
    stack.push(start);
    while (stack.length) {
      const p = stack.pop()!,
        x = p % width,
        y = (p - x) / width;
      island.members.push(p);
      island.cx += x;
      island.x0 = Math.min(island.x0, x);
      island.x1 = Math.max(island.x1, x);
      island.y0 = Math.min(island.y0, y);
      island.y1 = Math.max(island.y1, y);
      for (const q of [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width])
        if (q >= 0 && q < width * height && label[q] < 0 && rgba[q * 4 + 3] > VISIBLE_ALPHA) {
          label[q] = start;
          stack.push(q);
        }
    }
    island.cx /= island.members.length;
    islands.push(island);
  }
  /**
   * An island wider than a frame: two frames' art touching (a shield rim on the next frame's thrust flame) or smoke.
   * Its solid cores (alpha > `CORE_ALPHA`) go to the frame of their centre (one still wider than a frame follows the
   * column cuts); the rest of the island then grows outward from the cores through its own connected pixels
   * (breadth first, all cores at once), so each glow pixel joins the core it is joined to most directly.
   */
  const splitWide = (members: number[]) => {
    const inIsland = new Set(members),
      seen = new Set<number>(),
      queue: number[] = [];
    for (const start of members) {
      if (seen.has(start) || rgba[start * 4 + 3] <= CORE_ALPHA) continue;
      const core: number[] = [start];
      seen.add(start);
      for (let k = 0; k < core.length; k++) {
        const p = core[k],
          x = p % width;
        for (const q of [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width])
          if (inIsland.has(q) && !seen.has(q) && rgba[q * 4 + 3] > CORE_ALPHA) {
            seen.add(q);
            core.push(q);
          }
      }
      let cx = 0,
        x0 = width,
        x1 = 0;
      for (const p of core) {
        const x = p % width;
        cx += x;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
      }
      const f = Math.max(0, Math.floor((cx / core.length - offset) / pitch));
      for (const p of core) owner[p] = x1 - x0 > pitch * 1.1 ? byColumn[p % width] : f < frames ? f : -1;
      queue.push(...core);
    }
    for (let k = 0; k < queue.length; k++) {
      const p = queue[k],
        x = p % width;
      for (const q of [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width])
        if (inIsland.has(q) && !seen.has(q)) {
          seen.add(q);
          owner[q] = owner[p];
          queue.push(q);
        }
    }
    for (const m of members) if (!seen.has(m)) owner[m] = byColumn[m % width];
  };
  // Largest first: bodies decide by their centre, slivers then follow the bodies around them.
  islands.sort((a, b) => b.members.length - a.members.length);
  for (const island of islands) {
    let own: number;
    if (island.x1 - island.x0 > pitch * 1.1) {
      splitWide(island.members);
      continue;
    }
    // An island centred past the last frame belongs to a truncated frame that is dropped.
    const f = Math.max(0, Math.floor((island.cx - offset) / pitch));
    own = f < frames ? f : -1;
    if (island.members.length < SLIVER_AREA) {
      // A sliver (a glow tip, a spark, an anti-aliased fringe) joins the frame of the nearest owned pixels: the
      // ring at the smallest distance (up to `NEAR`) that holds any, by majority. A flame tip broken off its flame
      // finds the flame a pixel or two away before a neighbouring frame's shield further off.
      for (let r = 1; r <= NEAR; r++) {
        const votes = new Map<number, number>();
        for (const m of island.members) {
          const mx = m % width,
            my = (m - mx) / width;
          for (let dy = -r; dy <= r; dy++)
            for (let dx = -r; dx <= r; dx++) {
              if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
              const x = mx + dx,
                y = my + dy;
              if (x < 0 || y < 0 || x >= width || y >= height) continue;
              const o = owner[y * width + x];
              if (o >= 0) votes.set(o, (votes.get(o) ?? 0) + 1);
            }
        }
        if (!votes.size) continue;
        let best = 0;
        for (const [frame, n] of votes) if (n > best) [own, best] = [frame, n];
        break;
      }
    }
    for (const m of island.members) owner[m] = own;
  }
  for (let p = 0; p < width * height; p++) if (owner[p] < 0 && rgba[p * 4 + 3] > 0) owner[p] = byColumn[p % width];
  return owner;
}
/** Islands smaller than this (pixels) are slivers that follow their nearest neighbour; `NEAR` is how far they look. */
const SLIVER_AREA = 200,
  NEAR = 8;
/** Alpha of the solid cores that split an island wider than a frame (`splitWide`). */
const CORE_ALPHA = 160;
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
/**
 * Loop nudges are dropped when they leave a frame-to-frame drift above `STEADY` (the audit's warning level, share of
 * the cell) that is more than `STEADY_MARGIN` worse than the frames as drawn.
 */
const STEADY = 0.03,
  STEADY_MARGIN = 0.01;
/** Largest jump of the alpha-weighted centre between neighbouring frames of a loop, seam included (share of the cell). */
function drift(frames: Png[]) {
  const centres = frames.map((f) => measureArt(f).center);
  return Math.max(...centres.map((a, i) => Math.hypot(a.x - centres[(i + 1) % centres.length].x, a.y - centres[(i + 1) % centres.length].y)));
}
/**
 * Faint grid lines left in a source sheet (aegis): single columns or rows of grey pixels at alpha ~8–40 along the
 * cell boundaries. A line is a column (row) whose pixels stay faintly opaque where the pixels `LINE_SPAN` to either
 * side are empty; its pixels at alpha ≤ `LINE_ALPHA` with faint sides are erased, so art crossing it is kept.
 * Returns the sheet without them and the lines found.
 */
const LINE_SPAN = 4,
  LINE_ALPHA = 40,
  LINE_ERASE = 80;
export function eraseGridLines(png: Png): { png: Png; lines: string[] } {
  const { width, height } = png,
    rgba = png.rgba.slice(),
    lines: string[] = [],
    alpha = (x: number, y: number) => rgba[(y * width + x) * 4 + 3];
  const scan = (vertical: boolean) => {
    const n = vertical ? width : height,
      m = vertical ? height : width,
      at = (i: number, j: number) => (vertical ? alpha(i, j) : alpha(j, i));
    for (let i = LINE_SPAN; i < n - LINE_SPAN; i++) {
      let quiet = 0,
        faint = 0;
      for (let j = 0; j < m; j++)
        if (at(i - LINE_SPAN, j) < 6 && at(i + LINE_SPAN, j) < 6) {
          quiet++;
          if (at(i, j) >= 6 && at(i, j) <= LINE_ALPHA) faint++;
        }
      // Most of its empty stretch is faintly drawn: a line, not the edge of some art.
      if (quiet < m / 4 || faint < quiet * 0.5) continue;
      let erased = 0;
      for (let j = 0; j < m; j++) {
        if (at(i, j) > LINE_ERASE || at(i - LINE_SPAN, j) > LINE_ALPHA || at(i + LINE_SPAN, j) > LINE_ALPHA) continue;
        const k = ((vertical ? j * width + i : i * width + j) * 4) + 3;
        if (rgba[k]) erased++;
        rgba[k] = 0;
      }
      lines.push(`${vertical ? "x" : "y"}=${i} (${erased} px)`);
    }
  };
  scan(true);
  scan(false);
  return { png: { ...png, rgba }, lines };
}
/** One row of a source grid as a strip of its own. */
function row(png: Png, r: number, height: number): Png {
  return { ...png, height, rgba: png.rgba.slice(r * height * png.width * 4, (r + 1) * height * png.width * 4) };
}
/** The game grid: each clip's frames on its row, left-aligned, in 256 px cells; unused cells stay empty. */
function grid(clips: { row: number; frames: Png[] }[], columns: number, rows: number): Png {
  const width = CELL * columns,
    rgba = new Uint8Array(width * CELL * rows * 4);
  for (const c of clips)
    c.frames.forEach((f, i) => {
      for (let y = 0; y < CELL; y++) rgba.set(f.rgba.subarray(y * CELL * 4, (y + 1) * CELL * 4), ((c.row * CELL + y) * width + i * CELL) * 4);
    });
  return { ...clips[0].frames[0], width, height: CELL * rows, rgba };
}

if (manifest.version !== 2) throw new Error(`manifest version ${manifest.version}: expected 2 (one grid per enemy)`);
mkdirSync(OUT, { recursive: true });
for (const [id, entry] of Object.entries(manifest.enemies)) {
  // A disabled sheet stays in the pack for the record but gets no game sheet (the audit flags a leftover one).
  if (entry.disabled) {
    console.log(`${id}: disabled (${entry.disabled}), skipped`);
    continue;
  }
  const { sheet } = entry,
    declared = manifestClips(entry, manifest);
  if (!declared.idle) throw new Error(`${id}: the idle clip is the reference of every other clip and cannot be dropped`);
  const cleaned = eraseGridLines(decodePng(readFileSync(new URL(sheet, ROOT)))),
    source = cleaned.png,
    { frameWidth: pitch, frameHeight, columns, rows } = manifest;
  if (source.width !== pitch * columns || source.height !== frameHeight * rows) throw new Error(`${sheet}: ${source.width}×${source.height} is not ${columns}×${rows} cells of ${pitch}×${frameHeight}`);
  if (cleaned.lines.length) console.log(`${id}: erased faint grid lines ${cleaned.lines.join(", ")}`);
  const clips = ANIMATION_STATES.filter((state) => declared[state]).map((state) => {
    const notes: string[] = [],
      a = declared[state]!,
      { png, band } = unwrap(row(source, a.row, frameHeight));
    if (band > 0) notes.push(`unwrapped ${band} rows from the top back below the body`);
    if (band < 0) notes.push(`erased a ${-band} px sliver of cut debris at the top edge`);
    const bounds = cuts(png, a.frames, pitch, notes);
    return { state, row: a.row, png, frames: a.frames, bounds, notes, offset: windowOffset(bounds, pitch), rows: rowRange(png) };
  });
  // One horizontal offset (the idle row's) and one vertical pad per enemy, so every clip keeps the authored position
  // of the body; then each clip's opening frame is aligned to the first idle frame.
  const idle = clips[0],
    y0 = Math.min(...clips.map((c) => c.rows.y0)),
    y1 = Math.max(...clips.map((c) => c.rows.y1)),
    padY = Math.max(-y0, Math.min(Math.round((CELL - frameHeight) / 2), CELL - 1 - y1));
  let rest: Png | undefined;
  const placed = clips.map((c) => {
    const first = place(c.png, c.bounds, pitch, idle.offset, padY, []),
      shift = rest ? alignment(rest, first[0]) : { dx: 0, dy: 0 },
      held = place(c.png, c.bounds, pitch, idle.offset - shift.dx, padY + shift.dy, []),
      // Loops hold the body still (some supplied loops slide and snap back at the seam); hurt and death keep their
      // recoil and debris as drawn.
      loop = c.state === "idle" || c.state === "move",
      aligned = loop ? held.map((f) => alignment(rest ?? held[0], f)) : [],
      // A body whose outline changes a lot (a gallop: legs and tail sweep) can fool the overlap alignment into
      // shifting frames back and forth; when that makes the loop visibly less steady, the frames stay as drawn.
      nudged = aligned.some((n) => n.dx || n.dy) ? drift(place(c.png, c.bounds, pitch, idle.offset - shift.dx, padY + shift.dy, [], aligned)) : 0,
      nudge = nudged > STEADY && nudged > drift(held) + STEADY_MARGIN ? [] : aligned,
      frames = place(c.png, c.bounds, pitch, idle.offset - shift.dx, padY + shift.dy, c.notes, nudge);
    if (aligned.some((n) => n.dx || n.dy) && !nudge.length) c.notes.push("loop kept as drawn: nudging would make its pivot drift more");
    rest ??= frames[0];
    if (nudge.some((n) => n.dx || n.dy)) c.notes.push(`loop frames nudged ${nudge.map((n) => `${n.dx},${n.dy}`).join(" ")}`);
    console.log(`${id}/${c.state}: ${c.frames} frames, offset ${idle.offset}, pad ${padY}${shift.dx || shift.dy ? `, aligned ${shift.dx}, ${shift.dy} px onto idle` : ""}`);
    for (const n of c.notes) console.log(`  ${n}`);
    return { row: c.row, frames };
  });
  writeFileSync(new URL(`${id}.png`, OUT), encodePng(grid(placed, columns, rows)));
}
