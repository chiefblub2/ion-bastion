import { disc, hash01, type Ink, oval, shade, star } from "../shapes";
import { facing } from "../material";
import { OUTLINE, SQUASH, drum } from "../tower-art/tilt";
import type { Random } from "./kit";

// The plants of Palm Atoll (`island.ts`), drawn in the towers' 3/4 tilt: coconut palms in three postures and two ages,
// and Caribbean bushes (sea grape, hibiscus, bougainvillea, agave, banana). Every plant stands on a ground point
// (gx, gy) in pixels; heights are drawn upwards. All shapes are rolled up front into plain records, so a plant's body
// and its shadow, drawn in separate passes, always agree.

/** Shadow colour on white sand: warm and see-through, never black. */
export const SHADE = 0x6a5634;
/** Light falls from the upper left: a point `h` px up casts its shadow this far right and down on the ground. */
export const SUN = { x: 0.5, y: 0.3 } as const;
type Pt = { x: number; y: number };

// ── Coconut palm ────────────────────────────────────────────────────────────────────────────────────────────────────
/** Upright: nearly straight with a faint sway; curved: a gentle bow; leaning: tilted at the foot, curving up to the light. */
export type Posture = "upright" | "curved" | "leaning";
export interface Palm {
  du: number;
  dv: number;
  /** Trunk height in px; young palms are short and their crowns sit low. */
  height: number;
  /** How far the crown stands off the foot, in px, and in which ground direction. */
  reach: number;
  dir: number;
  /** Crown radius in px. */
  crown: number;
  spin: number;
  nuts: number;
  /** A hanging old frond. */
  old: boolean;
}
/** Rolls a palm: posture (upright most often), age, height, crown and turn; `options` pin the posture, direction or age. */
export function palmOf(rand: Random, du: number, dv: number, options: { posture?: Posture; dir?: number; adult?: boolean; young?: boolean } = {}): Palm {
  const pose = options.posture ?? (rand() < 0.6 ? "upright" : rand() < 0.75 ? "curved" : "leaning"),
    dir = options.dir ?? rand() * Math.PI * 2,
    young = options.young ?? (!options.adult && rand() < 0.22),
    height = young ? 14 + rand() * 8 : 40 + rand() * 18,
    reach = pose === "upright" ? rand() * 3 : pose === "curved" ? 7 + rand() * 7 : height * (0.42 + rand() * 0.18);
  return { du, dv, height, reach, dir, crown: (young ? 22 : 31) + rand() * 6, spin: rand() * Math.PI * 2, nuts: young ? 0 : 2 + Math.floor(rand() * 3), old: !young && rand() < 0.4 };
}
/**
 * Ground offset of the trunk's centre at height fraction t: steepest at the foot and turning upright towards the
 * crown, as a palm grows towards the light.
 */
export function trunkOffset(p: Palm, t: number) {
  const d = p.reach * (1 - (1 - t) ** 2);
  return { u: Math.cos(p.dir) * d, v: Math.sin(p.dir) * d };
}
/** Screen point of the trunk's centre at height fraction t for a palm on (gx, gy). */
export function trunkPoint(gx: number, gy: number, p: Palm, t: number): Pt {
  const o = trunkOffset(p, t);
  return { x: gx + o.u, y: gy + o.v * SQUASH - t * p.height };
}
const BARK = { body: 0x988a72, lit: 0xc4b698, dark: 0x6a5e4c, scar: 0x564c3e, boot: 0x7a5a32 } as const;
/** Slender tapering trunk: a flared foot, lit left and shaded right side, leaf scars, and a boot of old leaf bases on top. */
function trunk(g: Ink, gx: number, gy: number, p: Palm) {
  const n = 12,
    w = Math.min(1.15, 0.6 + p.height / 80),
    spine: Pt[] = [],
    half: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    spine.push(trunkPoint(gx, gy, p, t));
    half.push((2.6 - 0.7 * t + 1.6 * Math.max(0, 1 - t / 0.12) ** 2) * w);
  }
  const edge = (k: number) =>
      spine.map((c, i) => {
        const a = spine[Math.max(0, i - 1)],
          b = spine[Math.min(n, i + 1)],
          l = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2) || 1;
        return { x: c.x - ((b.y - a.y) / l) * half[i] * k, y: c.y + ((b.x - a.x) / l) * half[i] * k };
      }),
    band = (k0: number, k1: number, color: number, alpha = 1) => {
      g.fillStyle(color, alpha);
      g.fillPoints([...edge(k0), ...edge(k1).reverse()], true);
    };
  band(-1.3, 1.3, OUTLINE, 0.55);
  band(-1, 1, BARK.body);
  band(0.35, 1, BARK.dark);
  band(-0.8, -0.3, BARK.lit, 0.9);
  // Leaf scars: short chevrons pointing down the trunk every couple of pixels.
  const scars = Math.round(p.height / 2.6);
  for (let i = 1; i < scars; i++) {
    const t = i / scars,
      c = trunkPoint(gx, gy, p, t),
      r = (2.6 - 0.7 * t) * w;
    g.lineStyle(0.8, BARK.scar, (0.35 + 0.3 * hash01(p.spin, i)) * (1 - 0.5 * t));
    g.beginPath();
    g.moveTo(c.x - r, c.y - 0.6);
    g.lineTo(c.x, c.y + 0.7);
    g.lineTo(c.x + r, c.y - 0.6);
    g.strokePath();
  }
  // Boot: old leaf bases wrapped round the top of the trunk.
  const top = spine[n];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.55;
    g.fillStyle(shade(BARK.boot, (i - 2) * -0.08));
    g.fillTriangle(top.x + Math.cos(a) * 1.5 - 2, top.y + 3, top.x + Math.cos(a) * 1.5 + 2, top.y + 3, top.x + Math.cos(a) * 5, top.y - 1.5);
  }
}
/** One frond: ground direction, length, how high its rachis arches and how far its tip falls, leaflet length, colour. */
interface Frond { a: number; len: number; lift: number; drop: number; leaf: number; color: number; teeth: number }
const GREEN = { frond: 0x3f9a3c, spear: 0x8acb55, old: 0xb69a48, rib: 0xc8dc7a } as const;
/**
 * The crown: nine mature fronds round the compass (jittered), three short spear fronds standing up in the heart,
 * and on some palms an old frond hanging limp. Derived from the palm's spin, so body and shadow agree.
 */
function fronds(p: Palm): Frond[] {
  const s = p.spin * 977,
    list: Frond[] = [];
  for (let i = 0; i < 9; i++) {
    const a = p.spin + (i * Math.PI * 2) / 9 + 0.3 * (hash01(s, i, 1) - 0.5),
      // A frond towards the viewer drops less on screen, so it never hangs over the trunk.
      toward = Math.max(0, Math.sin(a));
    list.push({
      a,
      len: p.crown * (0.88 + 0.24 * hash01(s, i, 2)),
      lift: 10 + 4 * hash01(s, i, 3),
      drop: (15 + 7 * hash01(s, i, 4)) * (1 - 0.55 * toward),
      leaf: p.crown * 0.27,
      color: shade(GREEN.frond, 0.12 * (hash01(s, i, 5) - 0.5)),
      teeth: 12,
    });
  }
  for (let i = 0; i < 3; i++)
    list.push({ a: p.spin + 0.7 + (i * Math.PI * 2) / 3, len: p.crown * 0.42, lift: 12, drop: 0, leaf: p.crown * 0.12, color: GREEN.spear, teeth: 5 });
  if (p.old) list.push({ a: p.spin + 2.4, len: p.crown * 0.7, lift: 1, drop: 22, leaf: p.crown * 0.16, color: GREEN.old, teeth: 7 });
  return list;
}
/** Screen point `t` along a frond's rachis from the crown top (tx, ty). */
function rachis(tx: number, ty: number, f: Frond, t: number): Pt {
  return { x: tx + Math.cos(f.a) * f.len * t, y: ty + Math.sin(f.a) * f.len * t * SQUASH - f.lift * Math.sin(Math.PI * Math.min(1, t * 1.15)) + f.drop * t * t };
}
/**
 * A frond as a serrated silhouette: each side a comb whose teeth are the leaflets, swept towards the tip and hanging a
 * little; the side turned to the light lighter, the other darker, and a thin lit rib along the middle.
 */
function frond(g: Ink, tx: number, ty: number, f: Frond) {
  const m = f.teeth,
    rib = Array.from({ length: m + 1 }, (_, i) => rachis(tx, ty, f, i / m)),
    lit = facing(f.a),
    side = (k: 1 | -1) => {
      const pts: Pt[] = [rib[0]];
      for (let i = 1; i <= m; i++) {
        const c = rib[i],
          b = rib[i - 1],
          l = Math.sqrt((c.x - b.x) ** 2 + (c.y - b.y) ** 2) || 1,
          dx = (c.x - b.x) / l,
          dy = (c.y - b.y) / l,
          t = i / m,
          w = f.leaf * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.95));
        // A notch back at the rib, then the leaflet tip out to the side, forward and a little down.
        pts.push({ x: b.x + dx * l * 0.55, y: b.y + dy * l * 0.55 });
        pts.push({ x: c.x - dy * k * w + dx * w * 0.5, y: c.y + dx * k * w * SQUASH + dy * w * 0.5 + w * 0.45 });
      }
      pts.push(rib[m]);
      return [...pts, ...[...rib].reverse()];
    };
  for (const k of [1, -1] as const) {
    const pts = side(k);
    g.fillStyle(OUTLINE, 0.45);
    g.fillPoints(pts.map((q) => ({ x: q.x, y: q.y + 0.8 })), true);
    g.fillStyle(shade(f.color, 0.24 * lit + (k < 0 ? 0.12 : -0.1)));
    g.fillPoints(pts, true);
  }
  g.lineStyle(0.9, f.color === GREEN.old ? 0x8a7034 : GREEN.rib, 0.8);
  g.strokePoints(rib, false);
}
/** A palm on the ground point (gx, gy): trunk, the back half of the crown, heart and coconuts, then the front half. */
export function drawPalm(g: Ink, gx: number, gy: number, p: Palm) {
  trunk(g, gx, gy, p);
  const top = trunkPoint(gx, gy, p, 1),
    list = fronds(p).sort((a, b) => Math.sin(a.a) - Math.sin(b.a)),
    spear = (f: Frond) => f.color === GREEN.spear;
  for (const f of list) if (!spear(f) && Math.sin(f.a) < 0) frond(g, top.x, top.y, f);
  disc(g, top.x, top.y + 0.5, 3.2, 0x4a5a26);
  for (let i = 0; i < p.nuts; i++) {
    const a = 0.35 + (i / Math.max(1, p.nuts - 1)) * 2.4,
      x = top.x + Math.cos(a) * 4,
      y = top.y + 3.6 + Math.sin(a) * 1.5,
      color = i % 2 ? 0x8a9a3a : 0x6b4a2a;
    disc(g, x, y + 0.5, 3, OUTLINE, 0.55);
    disc(g, x, y, 2.6, color);
    disc(g, x - 0.9, y - 0.9, 0.9, shade(color, 0.45));
  }
  for (const f of list) if (spear(f)) frond(g, top.x, top.y, f);
  for (const f of list) if (!spear(f) && Math.sin(f.a) >= 0) frond(g, top.x, top.y, f);
}
/** The palm's shadow on the sand: the trunk as a soft band, every frond as a long serrated wedge. */
export function palmShadow(g: Ink, gx: number, gy: number, p: Palm) {
  const top = trunkOffset(p, 1),
    sx = gx + top.u + p.height * SUN.x,
    sy = gy + top.v * SQUASH + p.height * SUN.y;
  g.lineStyle(4.5, SHADE, 0.15);
  g.lineBetween(gx + 1, gy, sx, sy);
  g.fillStyle(SHADE, 0.13);
  for (const f of fronds(p)) {
    if (f.color === GREEN.spear) continue;
    const ex = sx + Math.cos(f.a) * f.len,
      ey = sy + Math.sin(f.a) * f.len * SQUASH + f.drop * 0.3,
      nx = -Math.sin(f.a) * f.leaf,
      ny = Math.cos(f.a) * f.leaf * SQUASH,
      mx = sx + (ex - sx) * 0.55,
      my = sy + (ey - sy) * 0.55;
    g.fillTriangle(sx, sy, mx + nx, my + ny, ex, ey);
    g.fillTriangle(sx, sy, mx - nx, my - ny, ex, ey);
  }
}

// ── Bushes ──────────────────────────────────────────────────────────────────────────────────────────────────────────
export type BushKind = "seagrape" | "hibiscus" | "bougainvillea" | "agave" | "banana";
export interface Bush { kind: BushKind; du: number; dv: number; size: number; seed: number }
const BUSH_KINDS: readonly BushKind[] = ["seagrape", "hibiscus", "bougainvillea", "agave", "banana"];
export function bushOf(rand: Random, du: number, dv: number, kind?: BushKind, size = 0.8 + rand() * 0.4): Bush {
  return { kind: kind ?? BUSH_KINDS[Math.floor(rand() * BUSH_KINDS.length)], du, dv, size, seed: Math.floor(rand() * 1e6) };
}
/** Footprint radius and height of a bush in px, for its shadow and for spacing. */
const SPAN: Record<BushKind, { r: number; h: number }> = {
  seagrape: { r: 15, h: 15 },
  hibiscus: { r: 12, h: 14 },
  bougainvillea: { r: 13, h: 12 },
  agave: { r: 13, h: 12 },
  banana: { r: 22, h: 28 },
};
/** A leaf on a dome: its ground offset, height and how much it faces the light. */
interface DomeLeaf { u: number; v: number; h: number; lit: number; k: number }
/**
 * Points spread over a dome of radius r and height h (a golden-angle spiral, jittered by the seed), sorted back to
 * front; `lit` is how much the dome's surface faces the light from the upper left and above.
 */
function dome(r: number, h: number, count: number, seed: number): DomeLeaf[] {
  const leaves: DomeLeaf[] = [];
  for (let k = 0; k < count; k++) {
    const d = Math.sqrt((k + 0.5) / count) * r * (0.92 + 0.12 * hash01(seed, k)),
      a = k * 2.39996 + hash01(seed, k, 2) * 0.6,
      u = Math.cos(a) * d,
      v = Math.sin(a) * d,
      z = h * Math.sqrt(Math.max(0, 1 - (d / r) ** 2)),
      slope = d / r;
    leaves.push({ u, v, h: z, lit: 0.55 * (1 - slope) + slope * facing(a), k });
  }
  return leaves.sort((p, q) => p.v + p.h * 0.3 - (q.v + q.h * 0.3));
}
/**
 * Dark mass under a leafy bush, so gaps between leaves read as depth instead of sand: a few overlapping lobes of
 * different sizes, so the outline is lumpy rather than a ball.
 */
function body(g: Ink, gx: number, gy: number, r: number, h: number, color: number, seed = 0) {
  const lobes = Array.from({ length: 5 }, (_, i) => {
    const a = (i / 5) * Math.PI * 2 + hash01(seed, i) * 0.8,
      d = r * (0.35 + 0.25 * hash01(seed, i, 2)),
      k = 0.55 + 0.25 * hash01(seed, i, 3);
    return { x: gx + Math.cos(a) * d, y: gy + Math.sin(a) * d * SQUASH - h * (0.3 + 0.25 * hash01(seed, i, 4)), rx: r * k, ry: (h * 0.5 + r * SQUASH * 0.4) * k };
  });
  for (const l of lobes) oval(g, l.x, l.y + 0.8, l.rx + 1.2, l.ry + 1.2, OUTLINE, 0.45);
  for (const l of lobes) oval(g, l.x, l.y, l.rx, l.ry, shade(color, -0.35));
}
/** Sea grape: a mound of big round leaves with red veins, a few turning red, and clusters of green grapes. */
function seagrape(g: Ink, gx: number, gy: number, b: Bush) {
  const { r, h } = SPAN.seagrape,
    R = r * b.size,
    H = h * b.size;
  body(g, gx, gy, R, H, 0x5a8a34, b.seed);
  for (const l of dome(R, H, 22, b.seed)) {
    const x = gx + l.u,
      y = gy + l.v * SQUASH - l.h,
      red = hash01(b.seed, l.k, 3) < 0.12,
      base = red ? 0xb0542e : 0x6f9e3a,
      c = shade(base, 0.3 * l.lit - 0.08);
    disc(g, x + 0.3, y + 0.8, 4.4, OUTLINE, 0.4);
    disc(g, x, y, 4.2, c);
    g.lineStyle(0.6, red ? 0x7a2a1a : 0xa04a2a, 0.7);
    g.lineBetween(x - 2.6, y + 1.2, x + 2.4, y - 1.4);
  }
  for (let i = 0; i < 3; i++) {
    const a = hash01(b.seed, i, 7) * Math.PI * 2,
      x = gx + Math.cos(a) * R * 0.6,
      y = gy + Math.sin(a) * R * 0.6 * SQUASH - H * 0.35;
    for (let j = 0; j < 4; j++) disc(g, x + (j % 2) * 1.6 - 0.8, y + j * 1.2, 1.1, 0x9ab04a);
  }
}
/** A leafy mound of small leaves with flowers: hibiscus (red, big trumpets) or bougainvillea (masses of magenta bracts). */
function flowering(g: Ink, gx: number, gy: number, b: Bush, leaf: number, flower: number, many: boolean) {
  const { r, h } = SPAN[b.kind],
    R = r * b.size,
    H = h * b.size;
  body(g, gx, gy, R, H, leaf, b.seed);
  for (const l of dome(R, H, 42, b.seed)) {
    const x = gx + l.u,
      y = gy + l.v * SQUASH - l.h,
      rot = hash01(b.seed, l.k, 4) * Math.PI;
    oval(g, x, y, 3, 1.8, shade(leaf, 0.3 * l.lit - 0.1), 1, rot);
  }
  const blooms = many ? 18 : 6;
  for (const l of dome(R * 0.95, H, blooms, b.seed + 11)) {
    const x = gx + l.u,
      y = gy + l.v * SQUASH - l.h - 0.5,
      c = shade(flower, 0.2 * l.lit);
    if (many) {
      // Bougainvillea: papery bracts in threes.
      for (let j = 0; j < 3; j++) disc(g, x + Math.cos(j * 2.1 + l.k) * 1.6, y + Math.sin(j * 2.1 + l.k) * 1.1, 1.6, c);
    } else {
      star(g, x + 0.3, y + 0.6, 4, 2.2, 5, OUTLINE, l.k, 0.35);
      star(g, x, y, 4, 2.2, 5, c, l.k);
      disc(g, x, y, 1, 0xffe27a);
    }
  }
}
/** Agave: a rosette of thick, pointed blue-green leaves curving out and up from the heart, pale edges, dark tips. */
function agave(g: Ink, gx: number, gy: number, b: Bush) {
  const n = 15,
    len = 17 * b.size,
    leaves = Array.from({ length: n }, (_, i) => {
      // An outer ring spreading low, an inner ring standing up from the heart.
      const inner = i >= 10,
        a = ((inner ? i - 10 : i) / (inner ? 5 : 10)) * Math.PI * 2 + hash01(b.seed, i) * 0.4 + (inner ? 0.3 : 0),
        up = inner ? 1.1 : 0.5;
      return { a, up, len: len * (inner ? 0.75 : 0.9 + 0.25 * hash01(b.seed, i, 2)) };
    }).sort((p, q) => p.up - q.up || Math.sin(p.a) - Math.sin(q.a));
  for (const l of leaves) {
    const tip = { x: gx + Math.cos(l.a) * l.len, y: gy + Math.sin(l.a) * l.len * SQUASH - l.len * l.up },
      mid = { x: gx + Math.cos(l.a) * l.len * 0.45, y: gy + Math.sin(l.a) * l.len * 0.45 * SQUASH - l.len * l.up * 0.55 },
      nx = -Math.sin(l.a) * 3.8 * b.size,
      ny = Math.cos(l.a) * 3.8 * b.size * SQUASH,
      c = shade(0x6e9e8c, 0.25 * facing(l.a));
    g.fillStyle(OUTLINE, 0.5);
    g.fillPoints([{ x: gx + nx * 1.2, y: gy + ny * 1.2 + 0.8 }, { x: mid.x + nx * 1.2, y: mid.y + ny * 1.2 + 0.8 }, { x: tip.x, y: tip.y + 0.8 }, { x: mid.x - nx * 1.2, y: mid.y - ny * 1.2 + 0.8 }, { x: gx - nx * 1.2, y: gy - ny * 1.2 + 0.8 }], true);
    g.fillStyle(c);
    g.fillPoints([{ x: gx + nx, y: gy + ny }, { x: mid.x + nx, y: mid.y + ny }, tip, { x: mid.x - nx, y: mid.y - ny }, { x: gx - nx, y: gy - ny }], true);
    g.fillStyle(shade(c, 0.22));
    g.fillPoints([{ x: gx + nx * 0.4, y: gy + ny * 0.4 }, { x: mid.x + nx * 0.5, y: mid.y + ny * 0.5 }, tip, mid], true);
    disc(g, tip.x, tip.y, 0.9, 0x3a2a1a);
  }
}
/** Banana plant: a short green-brown pseudostem and big paddle leaves arching out, bright green, torn at the edges. */
function banana(g: Ink, gx: number, gy: number, b: Bush) {
  const s = b.size;
  drum(g, gx, gy, 3.2 * s, 0, 14 * s, 0x6a7a3a, 0x7a8a44, 8);
  const top = { x: gx, y: gy - 14 * s },
    leaves = Array.from({ length: 6 }, (_, i) => ({ a: (i / 6) * Math.PI * 2 + hash01(b.seed, i) * 0.7, len: (24 + 7 * hash01(b.seed, i, 2)) * s })).sort((p, q) => Math.sin(p.a) - Math.sin(q.a));
  if (hash01(b.seed, 9) < 0.5)
    for (let j = 0; j < 4; j++) disc(g, top.x + 3 + (j % 2) * 2, top.y + 4 + j * 1.6, 1.6, 0x9ab040);
  for (const l of leaves) {
    const n = 8,
      spine = Array.from({ length: n + 1 }, (_, i) => {
        const t = i / n;
        return { x: top.x + Math.cos(l.a) * l.len * t, y: top.y + Math.sin(l.a) * l.len * t * SQUASH - 18 * s * Math.sin(Math.PI * t * 0.75) + 9 * s * t * t };
      }),
      width = (t: number) => 7.5 * s * Math.sin(Math.PI * Math.min(1, 0.1 + t)),
      edge = (k: number) =>
        spine.map((c, i) => {
          const t = i / n,
            torn = i > 1 && i < n && hash01(b.seed, i, l.a * 10 + k) < 0.3 ? 0.55 : 1;
          return { x: c.x - Math.sin(l.a) * width(t) * k * torn, y: c.y + Math.cos(l.a) * width(t) * k * SQUASH * torn - width(t) * 0.25 };
        }),
      c = shade(0x5aae3a, 0.25 * facing(l.a));
    const blade = [...edge(1), ...edge(-1).reverse()];
    g.fillStyle(OUTLINE, 0.45);
    g.fillPoints(blade.map((q) => ({ x: q.x, y: q.y + 0.8 })), true);
    g.fillStyle(c);
    g.fillPoints(blade, true);
    g.fillStyle(shade(c, -0.15));
    g.fillPoints([...edge(-1), ...[...spine].reverse()], true);
    g.lineStyle(1, 0xd8e08a, 0.8);
    g.strokePoints(spine, false);
  }
}
/** A bush on the ground point (gx, gy). */
export function drawBush(g: Ink, gx: number, gy: number, b: Bush) {
  if (b.kind === "seagrape") seagrape(g, gx, gy, b);
  else if (b.kind === "hibiscus") flowering(g, gx, gy, b, 0x2f7a34, 0xe8364a, false);
  else if (b.kind === "bougainvillea") flowering(g, gx, gy, b, 0x3a7a30, 0xd8308a, true);
  else if (b.kind === "agave") agave(g, gx, gy, b);
  else banana(g, gx, gy, b);
}
/** A bush's shadow: a soft oval thrown to the lower right, longer for taller plants. */
export function bushShadow(g: Ink, gx: number, gy: number, b: Bush) {
  const { r, h } = SPAN[b.kind];
  for (const k of [0.6, 1]) oval(g, gx + h * b.size * SUN.x * k * 0.6, gy + h * b.size * SUN.y * k * 0.6, r * b.size * (0.8 + 0.2 * k), r * b.size * SQUASH * (0.8 + 0.2 * k), SHADE, 0.1);
}
