/**
 * Minimal PNG reader for the dev tools and tests (no runtime use, no dependency): decodes non-interlaced 8-bit
 * truecolour PNGs (colour type 6 RGBA or 2 RGB) with `node:zlib`, and measures the visible pixels of sprite art.
 */
import { deflateSync, inflateSync } from "node:zlib";

export interface Png {
  width: number;
  height: number;
  /** Colour type from the header: 6 RGBA, 2 RGB. */
  colorType: number;
  /** RGBA, 4 bytes per pixel, row by row (opaque alpha for RGB files). */
  rgba: Uint8Array;
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function decodePng(file: Uint8Array): Png {
  if (!SIGNATURE.every((b, i) => file[i] === b)) throw new Error("not a PNG");
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength),
    idat: Uint8Array[] = [];
  let width = 0,
    height = 0,
    colorType = 0;
  for (let at = 8; at < file.length; ) {
    const length = view.getUint32(at),
      type = String.fromCharCode(...file.subarray(at + 4, at + 8)),
      data = file.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      width = view.getUint32(at + 8);
      height = view.getUint32(at + 12);
      const depth = data[8];
      colorType = data[9];
      if (depth !== 8 || (colorType !== 6 && colorType !== 2) || data[12] !== 0) throw new Error(`unsupported PNG (depth ${depth}, colour type ${colorType}, interlace ${data[12]})`);
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    at += 12 + length;
  }
  const channels = colorType === 6 ? 4 : 3,
    stride = width * channels,
    raw = inflateSync(Buffer.concat(idat)),
    rgba = new Uint8Array(width * height * 4);
  let prev = new Uint8Array(stride),
    line = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)],
      src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels] : 0,
        b = prev[i],
        c = i >= channels ? prev[i - channels] : 0;
      let v = src[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c,
          pa = Math.abs(p - a),
          pb = Math.abs(p - b),
          pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      line[i] = v & 255;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4,
        s = x * channels;
      rgba[o] = line[s];
      rgba[o + 1] = line[s + 1];
      rgba[o + 2] = line[s + 2];
      rgba[o + 3] = channels === 4 ? line[s + 3] : 255;
    }
    [prev, line] = [line, prev];
  }
  return { width, height, colorType, rgba };
}

/** Alpha above which a pixel counts as visible art (about 6%): faint glows stay in, compression noise stays out. */
export const VISIBLE_ALPHA = 16;

export interface ArtMetrics {
  width: number;
  height: number;
  /** Share of pixels with any alpha above `VISIBLE_ALPHA`. */
  coverage: number;
  /** Share of fully transparent pixels. */
  transparent: number;
  /** Visible bounds in pixels (inclusive min, exclusive max); all zero for an empty image. */
  bounds: { x0: number; y0: number; x1: number; y1: number };
  /** Visible bounds as a share of the canvas edge. */
  visibleWidth: number;
  visibleHeight: number;
  /** Alpha-weighted centre, -0.5..0.5 of the canvas edge from its middle (+x right, +y down). */
  center: { x: number; y: number };
  /** Centre of the visible bounds, same units. */
  boundsCenter: { x: number; y: number };
  /** Alpha of the 1 px canvas border: the share of its pixels that are not fully transparent. */
  borderOpaque: number;
  /** Mean luminance (0..1) of the visible pixels, alpha weighted. */
  luminance: number;
  /** Share of visible pixels brighter than 0.85 luminance (glows, hot cores). */
  bright: number;
  /** Visible edge pixels (alpha 16..250) that are near-black: a dark fringe from a matted background. */
  darkFringe: number;
  /** Same for near-white edge pixels: a bright halo. */
  lightFringe: number;
}

/** Measures what of a sprite canvas is actually drawn: bounds, weighted centre, border, brightness and fringes. */
export function measureArt({ width, height, rgba }: Png): ArtMetrics {
  let x0 = width,
    y0 = height,
    x1 = 0,
    y1 = 0,
    visible = 0,
    clear = 0,
    weight = 0,
    sx = 0,
    sy = 0,
    lum = 0,
    bright = 0,
    edges = 0,
    dark = 0,
    light = 0,
    border = 0,
    borderOpaque = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4,
        a = rgba[o + 3];
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        border++;
        if (a > 0) borderOpaque++;
      }
      if (a === 0) clear++;
      if (a <= VISIBLE_ALPHA) continue;
      const l = (0.2126 * rgba[o] + 0.7152 * rgba[o + 1] + 0.0722 * rgba[o + 2]) / 255;
      visible++;
      weight += a;
      sx += a * (x + 0.5);
      sy += a * (y + 0.5);
      lum += a * l;
      if (l > 0.85) bright++;
      if (a < 250) {
        edges++;
        if (l < 0.06) dark++;
        if (l > 0.92) light++;
      }
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x + 1 > x1) x1 = x + 1;
      if (y + 1 > y1) y1 = y + 1;
    }
  const n = width * height;
  if (!visible) x0 = y0 = x1 = y1 = 0;
  return {
    width,
    height,
    coverage: visible / n,
    transparent: clear / n,
    bounds: { x0, y0, x1, y1 },
    visibleWidth: (x1 - x0) / width,
    visibleHeight: (y1 - y0) / height,
    center: weight ? { x: sx / weight / width - 0.5, y: sy / weight / height - 0.5 } : { x: 0, y: 0 },
    boundsCenter: { x: (x0 + x1) / 2 / width - 0.5, y: (y0 + y1) / 2 / height - 0.5 },
    borderOpaque: borderOpaque / border,
    luminance: weight ? lum / weight : 0,
    bright: visible ? bright / visible : 0,
    darkFringe: edges ? dark / edges : 0,
    lightFringe: edges ? light / edges : 0,
  };
}

export interface Island {
  /** Pixel count (alpha > 0). */
  area: number;
  bounds: { x0: number; y0: number; x1: number; y1: number };
  /** Every pixel index of the island, for erasing it. */
  pixels: number[];
}
/**
 * Islands of the art: 8-connected regions of pixels with any alpha. Faint glows and energy links join the parts
 * they belong to (a Damper's orbiting spheres stay one island with its body), so a separate island far smaller than
 * the main one is residue: a speck or a sliver of a neighbouring sprite left over from cutting a sheet.
 */
export function islands({ width, height, rgba }: Png): Island[] {
  const seen = new Uint8Array(width * height),
    found: Island[] = [];
  for (let start = 0; start < width * height; start++) {
    if (seen[start] || rgba[start * 4 + 3] === 0) continue;
    const pixels = [start],
      bounds = { x0: width, y0: height, x1: 0, y1: 0 };
    seen[start] = 1;
    for (let k = 0; k < pixels.length; k++) {
      const p = pixels[k],
        x = p % width,
        y = (p - x) / width;
      bounds.x0 = Math.min(bounds.x0, x);
      bounds.y0 = Math.min(bounds.y0, y);
      bounds.x1 = Math.max(bounds.x1, x + 1);
      bounds.y1 = Math.max(bounds.y1, y + 1);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx,
            ny = y + dy,
            q = ny * width + nx;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height || seen[q] || rgba[q * 4 + 3] === 0) continue;
          seen[q] = 1;
          pixels.push(q);
        }
    }
    found.push({ area: pixels.length, bounds, pixels });
  }
  return found.sort((a, b) => b.area - a.area);
}
/** Islands under this share of the main island's area count as residue. */
export const RESIDUE_SHARE = 0.03;
export const residue = (png: Png) => islands(png).filter((island, i, all) => i > 0 && island.area < all[0].area * RESIDUE_SHARE);

/** Grid edge of `artSignature`. */
const SIGNATURE_GRID = 8;
/**
 * Coarse look of a sprite, for checking that an animation sheet shows the enemy its file name claims: the bounding
 * square of the solid pixels (alpha ≥ 128), centred, split into `SIGNATURE_GRID`² cells, each with its solid
 * coverage and mean colour. Independent of resolution and placement; tolerant of small pose changes.
 */
export function artSignature({ width, height, rgba }: Png): Float64Array {
  let x0 = width,
    y0 = height,
    x1 = 0,
    y1 = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (rgba[(y * width + x) * 4 + 3] >= 128) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
  const n = SIGNATURE_GRID,
    side = Math.max(x1 - x0, y1 - y0) + 1,
    cx = (x0 + x1) / 2,
    cy = (y0 + y1) / 2,
    sig = new Float64Array(n * n * 4),
    count = new Float64Array(n * n);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const k = (y * width + x) * 4;
      if (rgba[k + 3] < 128) continue;
      const gx = Math.floor(((x - cx) / side + 0.5) * n),
        gy = Math.floor(((y - cy) / side + 0.5) * n);
      if (gx < 0 || gy < 0 || gx >= n || gy >= n) continue;
      const c = gy * n + gx;
      count[c]++;
      for (let j = 0; j < 3; j++) sig[c * 4 + j] += rgba[k + j];
    }
  const area = (side * side) / (n * n);
  for (let c = 0; c < n * n; c++) {
    for (let j = 0; j < 3; j++) sig[c * 4 + j] = count[c] ? sig[c * 4 + j] / count[c] / 255 : 0;
    sig[c * 4 + 3] = count[c] / area;
  }
  return sig;
}
/**
 * Difference of two `artSignature`s (0 alike, about 1 unrelated): coverage difference per cell, plus the colour
 * difference where both cells are solid, or a flat penalty where only one is.
 */
export function signatureDistance(a: Float64Array, b: Float64Array) {
  const cells = a.length / 4;
  let d = 0;
  for (let c = 0; c < cells; c++) {
    const ca = a[c * 4 + 3],
      cb = b[c * 4 + 3];
    d += Math.abs(ca - cb);
    if (ca > 0.2 && cb > 0.2) for (let j = 0; j < 3; j++) d += Math.abs(a[c * 4 + j] - b[c * 4 + j]);
    else if (ca > 0.2 || cb > 0.2) d += 0.5;
  }
  return d / cells;
}
/**
 * Which static art some animation frames (an idle clip) look like: every candidate with its mean signature distance
 * over the frames, closest first.
 */
export function identify(frames: Png[], statics: ReadonlyMap<string, Float64Array>): { id: string; distance: number }[] {
  const sigs = frames.map(artSignature);
  return [...statics].map(([id, s]) => ({ id, distance: sigs.reduce((t, f) => t + signatureDistance(f, s), 0) / sigs.length })).sort((a, b) => a.distance - b.distance);
}
/** An identity is ambiguous (worth a look by eye) when the runner-up is within this ratio of the best distance. */
export const IDENTITY_MARGIN = 0.85;

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length),
    view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(Buffer.from(type, "latin1"), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
/**
 * Lossless RGBA PNG (colour type 6), each row with the filter that leaves the smallest absolute sum (the usual
 * heuristic of PNG encoders), deflated at level 9.
 */
export function encodePng({ width, height, rgba }: Pick<Png, "width" | "height" | "rgba">) {
  const stride = width * 4,
    raw = new Uint8Array(height * (stride + 1)),
    candidate = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const line = rgba.subarray(y * stride, (y + 1) * stride),
      prev = y ? rgba.subarray((y - 1) * stride, y * stride) : new Uint8Array(stride);
    let best = Infinity;
    for (let filter = 0; filter <= 4; filter++) {
      let sum = 0;
      for (let i = 0; i < stride; i++) {
        const a = i >= 4 ? line[i - 4] : 0,
          b = prev[i],
          c = i >= 4 ? prev[i - 4] : 0;
        let p = 0;
        if (filter === 1) p = a;
        else if (filter === 2) p = b;
        else if (filter === 3) p = (a + b) >> 1;
        else if (filter === 4) {
          const q = a + b - c,
            pa = Math.abs(q - a),
            pb = Math.abs(q - b),
            pc = Math.abs(q - c);
          p = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        }
        candidate[i] = (line[i] - p) & 255;
        sum += candidate[i] < 128 ? candidate[i] : 256 - candidate[i];
      }
      if (sum < best) {
        best = sum;
        raw[y * (stride + 1)] = filter;
        raw.set(candidate, y * (stride + 1) + 1);
      }
    }
  }
  const header = new Uint8Array(13),
    view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from(SIGNATURE), chunk("IHDR", header), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", new Uint8Array())]);
}
