import { CELL, disc, fillOval, hash01, type Ink, oval, shade, star } from "../shapes";
import { facing } from "../material";
import { OUTLINE, SQUASH, X, Y, block, drum, fillPoints, point, quad, tube } from "../tower-art/tilt";
import { tubeAt } from "../tower-art/tilt-parts";
import { box, frame, rod } from "../tower-art/tilt-frame";
import { flow, type Random, type Theme } from "./kit";

// Palm Atoll: white sand, a turquoise tidal channel as the path, and the first terrain drawn in the towers' 3/4 tilt
// (`Theme.tilted`): palms, boulders, lagoon pools and a beached outrigger canoe stand up out of the board, north to
// south after the path, so palm crowns reach over the cell above. Every piece's shape is rolled once by `pieceOf`, so
// its shadow (drawn for all pieces first) and its body match.

const SAND = 0xe9dfc6;
/** Shadow colour on white sand: warm and see-through, never black. */
const SHADE = 0x6a5634;
const LEAF = 0x3f9a3a;
const WATER = { deep: 0x1c90ad, mid: 0x2fb8c4, shallow: 0x67d8d2, foam: 0xf4fffc } as const;
/** Kind thresholds of the first `cellRandom` draw (`hash` in the ambient names the piece the same way). */
const PALM = 0.42,
  ROCKS = 0.68,
  POOL = 0.84;
/** Light falls from the upper left: a point `h` px up casts its shadow this far right and down on the ground. */
const SUN = { x: 0.5, y: 0.3 } as const;
const F = new Float64Array(16),
  I = new Float64Array(16);

interface Rock { du: number; dv: number; r: number; h: number; radii: number[]; dark: boolean }
type Piece =
  | { kind: "palm"; lean: number; height: number; spin: number; nuts: number; tuft: boolean }
  | { kind: "rocks"; rocks: Rock[] }
  | { kind: "pool"; rx: number; ry: number; rocks: Rock[] }
  | { kind: "canoe"; angle: number; side: 1 | -1 };

const rock = (rand: Random, du: number, dv: number, r: number): Rock => ({
  du,
  dv,
  r,
  h: r * (0.7 + rand() * 0.5),
  radii: Array.from({ length: 6 }, () => 0.82 + rand() * 0.18),
  dark: rand() < 0.35,
});
/** Rolls a cell's piece; the first draw is its kind (`hash`). */
function pieceOf(rand: Random): Piece {
  const kind = rand();
  if (kind < PALM) return { kind: "palm", lean: (rand() - 0.5) * 2, height: 34 + rand() * 10, spin: rand() * Math.PI, nuts: 2 + Math.floor(rand() * 3), tuft: rand() < 0.5 };
  if (kind < ROCKS) {
    const rocks = [rock(rand, -6 + rand() * 4, -4 + rand() * 3, 11 + rand() * 4), rock(rand, 8 + rand() * 4, 3 + rand() * 3, 7 + rand() * 3)];
    if (rand() < 0.5) rocks.push(rock(rand, -12 + rand() * 4, 9, 4 + rand() * 2));
    return { kind: "rocks", rocks: rocks.sort((a, b) => a.dv - b.dv) };
  }
  if (kind < POOL) return { kind: "pool", rx: 19 + rand() * 3, ry: 14 + rand() * 2, rocks: [rock(rand, 15, 10, 4.5), rock(rand, -18, -6, 3.5)] };
  return { kind: "canoe", angle: (rand() - 0.5) * 0.7, side: rand() < 0.5 ? 1 : -1 };
}

/** Ground centre of a cell's piece (x, y0 in the tilt kit's terms). */
const groundOf = (x: number, y: number) => ({ cx: x + CELL / 2, y0: y + 36 });

// ── Palm ────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Trunk sideways offset at height fraction t. */
const bend = (p: Extract<Piece, { kind: "palm" }>, t: number) => p.lean * p.height * 0.32 * t * t;
const FRONDS = 8,
  FROND_LEN = 23;
/** Screen point `t` along frond `a` (ground angle) from the crown at (tx, ty): arcs up, then droops. */
function frondPoint(tx: number, ty: number, a: number, t: number, len = FROND_LEN) {
  return { x: tx + Math.cos(a) * len * t, y: ty + Math.sin(a) * len * t * SQUASH - 5 * Math.sin(Math.PI * t) + 15 * t * t };
}
const frondAngle = (p: Extract<Piece, { kind: "palm" }>, i: number) => p.spin + (i * Math.PI * 2) / FRONDS + 0.18 * Math.sin(i * 2.3 + p.spin * 5);
function frond(g: Ink, tx: number, ty: number, a: number) {
  const n = 7,
    mid: { x: number; y: number }[] = [],
    left: { x: number; y: number }[] = [],
    right: { x: number; y: number }[] = [];
  for (let k = 0; k <= n; k++) mid.push(frondPoint(tx, ty, a, k / n));
  for (let k = 0; k <= n; k++) {
    const t = k / n,
      a0 = mid[Math.max(0, k - 1)],
      a1 = mid[Math.min(n, k + 1)],
      l = Math.sqrt((a1.x - a0.x) ** 2 + (a1.y - a0.y) ** 2) || 1,
      nx = -(a1.y - a0.y) / l,
      ny = (a1.x - a0.x) / l,
      w = 5.2 * Math.sin(Math.PI * Math.min(1, t * 1.15)) + 0.4;
    left.push({ x: mid[k].x + nx * w, y: mid[k].y + ny * w });
    right.push({ x: mid[k].x - nx * w * 0.8, y: mid[k].y - ny * w * 0.8 });
  }
  const tone = shade(LEAF, 0.28 * facing(a));
  const blade = [...left, ...[...right].reverse()];
  g.fillStyle(OUTLINE, 0.5);
  g.fillPoints(blade.map((p) => ({ x: p.x, y: p.y + 0.7 })), true);
  g.fillStyle(tone);
  g.fillPoints(blade, true);
  // The underside half a step darker, leaflet cuts across the blade and a lit midrib.
  g.fillStyle(shade(tone, -0.22));
  g.fillPoints([...mid, ...[...right].reverse()], true);
  g.lineStyle(0.9, shade(tone, -0.45), 0.8);
  for (let k = 2; k < n; k++) g.lineBetween(mid[k].x, mid[k].y, left[k].x * 0.75 + mid[k].x * 0.25, left[k].y * 0.75 + mid[k].y * 0.25);
  g.lineStyle(1, shade(tone, 0.4), 0.9);
  g.strokePoints(mid, false);
}
function palm(g: Ink, x: number, y: number, p: Extract<Piece, { kind: "palm" }>) {
  const { cx, y0 } = groundOf(x, y),
    bx = cx - p.lean * 3;
  // Sand mound and fallen coconuts round the foot.
  oval(g, bx + 1, y0 + 1, 13, 13 * SQUASH, shade(SAND, -0.1));
  oval(g, bx, y0, 11, 11 * SQUASH, shade(SAND, 0.05));
  if (p.tuft) for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.45;
    g.lineStyle(1.4, 0x5a8a34, 0.9);
    g.lineBetween(bx - 8, y0 + 3, bx - 8 + Math.cos(a) * 7, y0 + 3 + Math.sin(a) * 7);
  }
  // Ringed trunk: short drums stacked along the bend, every other one darker.
  const segments = 9;
  for (let i = 0; i < segments; i++) {
    const t0 = i / segments,
      t1 = (i + 1) / segments,
      r = 3.6 - 1.3 * t0;
    drum(g, bx + bend(p, (t0 + t1) / 2), y0, r, t0 * p.height, t1 * p.height + 0.6, i % 2 ? 0x8f6d48 : 0x7a5a3a, i % 2 ? 0xa8845a : 0x93714a, 8);
  }
  const tx = bx + bend(p, 1),
    ty = y0 - p.height,
    order = Array.from({ length: FRONDS }, (_, i) => frondAngle(p, i)).sort((a, b) => Math.sin(a) - Math.sin(b));
  // Back fronds, the coconut cluster, then the fronds facing the viewer.
  for (const a of order) if (Math.sin(a) < 0) frond(g, tx, ty, a);
  for (let i = 0; i < p.nuts; i++) {
    const a = (i / p.nuts) * Math.PI + 0.4;
    disc(g, tx + Math.cos(a) * 3.4, ty + 2.6 + Math.sin(a) * 1.4, 2.6, OUTLINE, 0.7);
    disc(g, tx + Math.cos(a) * 3.4, ty + 2.4 + Math.sin(a) * 1.4, 2.2, 0x6b4a2a);
    disc(g, tx + Math.cos(a) * 3.4 - 0.7, ty + 1.7 + Math.sin(a) * 1.4, 0.8, 0xa07a50);
  }
  disc(g, tx, ty, 3, 0x4c6a2a);
  for (const a of order) if (Math.sin(a) >= 0) frond(g, tx, ty, a);
}
function palmShadow(g: Ink, x: number, y: number, p: Extract<Piece, { kind: "palm" }>) {
  const { cx, y0 } = groundOf(x, y),
    bx = cx - p.lean * 3,
    sx = bx + bend(p, 1) + p.height * SUN.x,
    sy = y0 + p.height * SUN.y;
  g.lineStyle(4.5, SHADE, 0.16);
  g.lineBetween(bx + 1, y0, sx, sy);
  // The crown's shadow: a star through the frond tips, laid flat on the sand.
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < FRONDS; i++) {
    const a = frondAngle(p, i),
      b = a + Math.PI / FRONDS;
    pts.push({ x: sx + Math.cos(a) * FROND_LEN * 1.05, y: sy + Math.sin(a) * FROND_LEN * SQUASH * 1.05 + 4 });
    pts.push({ x: sx + Math.cos(b) * 6, y: sy + Math.sin(b) * 6 * SQUASH });
  }
  g.fillStyle(SHADE, 0.17);
  g.fillPoints(pts, true);
}

// ── Rocks ───────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Fills the scratch footprints of a rock (clockwise on the screen), centred on its ground offset. */
function footprint(r: Rock) {
  for (let i = 0; i < 6; i++) {
    const t = (i / 6) * Math.PI * 2 + 0.3;
    F[2 * i] = r.du + Math.cos(t) * r.r * r.radii[i];
    F[2 * i + 1] = r.dv + Math.sin(t) * r.r * r.radii[i];
    I[2 * i] = r.du + Math.cos(t) * r.r * r.radii[i] * 0.6;
    I[2 * i + 1] = r.dv + Math.sin(t) * r.r * r.radii[i] * 0.6 - 0.5;
  }
}
function boulder(g: Ink, cx: number, y0: number, r: Rock) {
  footprint(r);
  const wall = r.dark ? 0x5a5550 : 0x948b7c,
    top = r.dark ? 0x807a72 : 0xc2b9a6;
  block(g, cx, y0, F, I, 6, 0, r.h * 0.6, r.h * 0.4, wall, top, shade(top, 0.35));
}
function boulderShadow(g: Ink, cx: number, y0: number, r: Rock) {
  footprint(r);
  for (const k of [0.35, 0.7, 1])
    for (let i = 0; i < 6; i++) point(i, X(cx, F[2 * i]) + r.h * SUN.x * k + 1, Y(y0, F[2 * i + 1], 0) + r.h * SUN.y * k + 1);
  fillPoints(g, 6, SHADE, 0.2);
}

// ── Lagoon pool ─────────────────────────────────────────────────────────────────────────────────────────────────────
const poolCentre = (x: number, y: number) => ({ px: x + CELL / 2, py: y + CELL / 2 + 1 });
function pool(g: Ink, x: number, y: number, p: Extract<Piece, { kind: "pool" }>) {
  const { px, py } = poolCentre(x, y);
  oval(g, px + 1, py + 1, p.rx + 6, p.ry + 5, shade(SAND, -0.16));
  oval(g, px, py, p.rx + 4, p.ry + 3.5, 0xd2c39c);
  oval(g, px, py, p.rx + 1, p.ry + 0.8, WATER.foam, 0.85);
  // Sunken water: the rim's shadow lies inside on the upper left, the deep part towards the middle.
  oval(g, px, py, p.rx, p.ry, shade(WATER.mid, -0.3));
  oval(g, px + 1.6, py + 1.4, p.rx - 1.6, p.ry - 1.4, WATER.shallow);
  oval(g, px + 2, py + 1.8, p.rx * 0.68, p.ry * 0.62, WATER.mid);
  oval(g, px + 2.4, py + 2, p.rx * 0.36, p.ry * 0.32, WATER.deep);
  g.lineStyle(1, 0xffffff, 0.55);
  g.lineBetween(px - p.rx * 0.45, py - p.ry * 0.25, px - p.rx * 0.1, py - p.ry * 0.4);
  g.lineBetween(px + p.rx * 0.15, py + p.ry * 0.3, px + p.rx * 0.4, py + p.ry * 0.18);
  for (const r of p.rocks) boulder(g, px, py, r);
}
function poolShadow(g: Ink, x: number, y: number, p: Extract<Piece, { kind: "pool" }>) {
  const { px, py } = poolCentre(x, y);
  for (const r of p.rocks) boulderShadow(g, px, py, r);
}

// ── Outrigger canoe ─────────────────────────────────────────────────────────────────────────────────────────────────
/** Ground offset of a point `d` along the hull and `q` across it. */
const hullAt = (a: number, d: number, q: number) => ({ u: Math.cos(a) * d - Math.sin(a) * q, v: Math.sin(a) * d + Math.cos(a) * q });
function canoe(g: Ink, x: number, y: number, p: Extract<Piece, { kind: "canoe" }>) {
  const { cx, y0 } = groundOf(x, y),
    a = p.angle,
    q = p.side * 13,
    float = () => {
      tubeAt(g, cx, y0, a, q, 2.6, -13, 13, 2.2, 0xd8c4a0);
      for (const d of [-7, 7]) {
        const h = hullAt(a, d, 0),
          f = hullAt(a, d, q);
        rod(g, cx, y0, h.u, h.v, 8.5, f.u, f.v, 4, 1.6, 0x7a5a3a);
      }
    },
    hull = () => {
      // Dugout hull: short tube pieces under an elliptic profile, the ends raised a little.
      const steps = 12,
        half = 22;
      for (let i = 0; i < steps; i++) {
        const d0 = -half + (2 * half * i) / steps,
          d1 = d0 + (2 * half) / steps + 0.4,
          m = (d0 + d1) / 2 / half,
          r = 5 * Math.sqrt(Math.max(0.08, 1 - m * m));
        tube(g, cx, y0, a, 5 + 2.2 * m * m, d0, d1, r, 0x95552f, 1, true);
      }
      tube(g, cx, y0, a, 8.2, -14, 14, 2.4, 0x3a2214, 1, false);
      // A painted band along the gunwale.
      tube(g, cx, y0, a, 6.6, -16, 16, 0.7, 0xe2c25a, 0.9, false);
    };
  // The float behind the hull (north) is drawn first.
  if (hullAt(a, 0, q).v < 0) {
    float();
    hull();
  } else {
    hull();
    float();
  }
  // A paddle lying in the sand beside it.
  const s = hullAt(a, -4, -p.side * 13);
  rod(g, cx, y0, s.u - 8, s.v + 1, 0.8, s.u + 9, s.v - 2, 0.8, 1.3, 0xb48a5a);
  oval(g, X(cx, s.u + 11), Y(y0, s.v - 2.4, 0.8), 3.4, 1.8, 0xb48a5a, 1, -0.2);
}
function canoeShadow(g: Ink, x: number, y: number, p: Extract<Piece, { kind: "canoe" }>) {
  const { cx, y0 } = groundOf(x, y),
    rot = Math.atan2(Math.sin(p.angle) * SQUASH, Math.cos(p.angle)),
    f = hullAt(p.angle, 0, p.side * 13);
  oval(g, cx + 3.5, y0 + 2.5, 25, 6, SHADE, 0.2, rot);
  oval(g, X(cx, f.u) + 2, Y(y0, f.v, 0) + 1.5, 15, 2.8, SHADE, 0.16, rot);
}

// ── Landmarks: a stilt hut and a lighthouse ─────────────────────────────────────────────────────────────────────────
const LEVEL = frame(0, 0, 0);
/** Calls `draw` with the ink scaled by `k` about (x, y0), so a landmark is drawn once at its 2×2 size. */
function scaled(g: Ink, x: number, y0: number, k: number, draw: () => void) {
  g.save();
  g.translateCanvas(x, y0);
  g.scaleCanvas(k, k);
  draw();
  g.restore();
}
/** Ground centre and scale of a landmark whose block has centre (x, y) and half size s. */
const landmarkGround = (x: number, y: number, s: number) => ({ y0: y + s * 0.38, k: s / CELL });
const THATCH = 0xc9a25a,
  ROOF = { eave: 30, depth: 24, base: 33, apex: 60 } as const;
function hut(g: Ink) {
  // Stilts, the deck, a ladder, the walls with a dark doorway, then a hipped thatch roof.
  for (const [u, v] of [[-25, -17], [25, -17], [-25, 17], [25, 17]]) rod(g, 0, 0, u, v, 0, u, v, 11, 2.6, 0x6b4a2c);
  box(g, 0, 0, LEVEL, -30, 30, -22, 22, 10, 13, 0x9a7448);
  g.lineStyle(0.7, 0x5a3e22, 0.7);
  for (let u = -24; u <= 24; u += 6) g.lineBetween(X(0, u), Y(0, 22, 10.5), X(0, u), Y(0, 22, 12.5));
  for (const u of [4, 12]) rod(g, 0, 0, u, 32, 0, u, 22, 11, 1.4, 0x7a5a3a);
  for (let h = 3; h < 11; h += 3) rod(g, 0, 0, 4, 32 - h * 0.9, h, 12, 32 - h * 0.9, h, 1, 0x8a6a48);
  box(g, 0, 0, LEVEL, -21, 21, -15, 15, 13, ROOF.base, 0xb88e56);
  g.lineStyle(0.6, 0x7a5a32, 0.6);
  for (let u = -18; u <= 18; u += 4) g.lineBetween(X(0, u), Y(0, 15, 13.5), X(0, u), Y(0, 15, ROOF.base - 0.5));
  quad(g, X(0, 3), Y(0, 15, 13), X(0, 13), Y(0, 15, 13), X(0, 13), Y(0, 15, 27), X(0, 3), Y(0, 15, 27), 0x2a1a10);
  const { eave: e, depth: d, base: b, apex } = ROOF,
    ridge = 9,
    corner = (u: number, v: number) => [X(0, u), Y(0, v, b)] as const,
    top = (u: number) => [X(0, u), Y(0, 0, apex)] as const,
    face = (pts: (readonly [number, number])[], normal: number) => {
      pts.forEach(([px, py], i) => point(i, px, py));
      fillPoints(g, pts.length, OUTLINE, 0.9);
      pts.forEach(([px, py], i) => point(i, px, py + 0.01));
      fillPoints(g, pts.length, shade(THATCH, 0.26 * facing(normal)));
    };
  face([corner(-e, -d), corner(e, -d), top(ridge), top(-ridge)], -Math.PI / 2);
  face([corner(-e, d), corner(-e, -d), top(-ridge)], Math.PI);
  face([corner(e, -d), corner(e, d), top(ridge)], 0);
  face([corner(e, d), corner(-e, d), top(-ridge), top(ridge)], Math.PI / 2);
  // Thatch strokes down the front face and a ragged fringe along its eave.
  g.lineStyle(0.8, shade(THATCH, -0.45), 0.7);
  for (let i = 1; i < 10; i++) {
    const t = i / 10,
      [ex, ey] = corner(-e + 2 * e * t, d),
      [rx, ry] = top(-ridge + 2 * ridge * t);
    g.lineBetween(ex, ey, rx, ry);
  }
  g.fillStyle(shade(THATCH, -0.3));
  for (let i = 0; i < 12; i++) {
    const [ex, ey] = corner(-e + (2 * e * (i + 0.5)) / 12, d);
    g.fillTriangle(ex - 2.6, ey - 0.5, ex + 2.6, ey - 0.5, ex, ey + 3);
  }
}
function hutShadow(g: Ink) {
  const { eave: e, depth: d, base: b } = ROOF;
  // The roof's shadow, feathered: three passes from its own outline to the full offset.
  for (const k of [0.55, 0.8, 1]) {
    const q = (u: number, v: number) => ({ x: X(0, u) + b * SUN.x * k, y: Y(0, v, 0) + b * SUN.y * k });
    g.fillStyle(SHADE, 0.08);
    g.fillPoints([q(-e, -d), q(e, -d), q(e, d), q(-e, d)], true);
  }
}
const LIGHTHOUSE = { tower: 64, lantern: 76, cap: 88 } as const;
function lighthouse(g: Ink) {
  for (const r of [{ du: -14, dv: -6, r: 12, h: 10, radii: [1, 0.9, 0.95, 1, 0.88, 0.94], dark: true }, { du: 12, dv: 8, r: 10, h: 8, radii: [0.9, 1, 0.92, 0.9, 1, 0.95], dark: false }])
    boulder(g, 0, 0, r);
  drum(g, 0, 0, 16, 0, 5, 0x8a8478, 0xb0a898, 14);
  const bands = 6;
  for (let i = 0; i < bands; i++) {
    const h0 = 5 + ((LIGHTHOUSE.tower - 5) * i) / bands,
      h1 = 5 + ((LIGHTHOUSE.tower - 5) * (i + 1)) / bands;
    drum(g, 0, 0, 12.5 - (3.5 * (i + 0.5)) / bands, h0, h1 + 0.5, i % 2 ? 0xd8483a : 0xf0ece2, undefined, 14);
  }
  quad(g, X(0, -2.6), Y(0, 9, 24), X(0, 2.6), Y(0, 9, 24), X(0, 2.6), Y(0, 9, 31), X(0, -2.6), Y(0, 9, 31), 0x23343a);
  drum(g, 0, 0, 12.5, LIGHTHOUSE.tower, LIGHTHOUSE.tower + 2.5, 0x3a3e40, 0x5a6064, 14);
  drum(g, 0, 0, 7.2, LIGHTHOUSE.tower + 2.5, LIGHTHOUSE.lantern, 0x2f5a60, 0x4a7076, 12);
  disc(g, 0, Y(0, 0, LIGHTHOUSE.lantern - 5), 3.2, 0xffe6a0);
  for (const u of [-5, 0, 5]) rod(g, 0, 0, u, 5.5, LIGHTHOUSE.tower + 2.5, u, 5.5, LIGHTHOUSE.lantern, 0.8, 0x2a2e30);
  // Conical cap: front half shaded by its facing, then the finial.
  const n = 12,
    apex = Y(0, 0, LIGHTHOUSE.cap);
  for (let i = 0; i < n; i++) {
    const t0 = (i / n) * Math.PI,
      t1 = ((i + 1) / n) * Math.PI;
    g.fillStyle(shade(0xa8352a, 0.3 * facing((t0 + t1) / 2)));
    g.fillTriangle(X(0, Math.cos(t0) * 9), Y(0, Math.sin(t0) * 9, LIGHTHOUSE.lantern), X(0, Math.cos(t1) * 9), Y(0, Math.sin(t1) * 9, LIGHTHOUSE.lantern), 0, apex);
  }
  disc(g, 0, apex - 1.5, 2, 0x3a3e40);
}
function lighthouseShadow(g: Ink) {
  const h = LIGHTHOUSE.cap,
    tip = { x: h * SUN.x, y: h * SUN.y };
  g.fillStyle(SHADE, 0.2);
  g.fillPoints([{ x: -9, y: 3 }, { x: 9, y: -4 }, { x: tip.x + 4, y: tip.y - 2 }, { x: tip.x - 2, y: tip.y + 3 }], true);
  oval(g, 3, 3, 22, 13, SHADE, 0.14);
}

// ── Theme ───────────────────────────────────────────────────────────────────────────────────────────────────────────
/** A small sparkle that flashes briefly once per cycle; `seed` sets its phase. */
function twinkle(g: Ink, glow: Ink, x: number, y: number, clock: number, seed: number, lit: number) {
  const on = Math.max(0, Math.sin(clock * 1.7 + seed * 40)) ** 10;
  if (on < 0.05) return;
  star(g, x, y, 3.4 * on + 0.6, 0.6, 4, 0xffffff, 0, 0.85 * on);
  disc(glow, x, y, 4, 0xffffff, 0.25 * on * lit);
}
export const island: Theme = {
  backdrop: 0x0b4f5e,
  ground: [SAND, 0xe2d6ba],
  grid: 0xb3a27c,
  path: { edge: 0xd0bc8e, bed: 0x3cbcc6, line: 0xf4fffc, arrow: 0xffffff },
  accent: 0xff7d5e,
  obstacle: (g, x, y, rand) => {
    const p = pieceOf(rand);
    if (p.kind === "palm") palm(g, x, y, p);
    else if (p.kind === "rocks") {
      const { cx, y0 } = groundOf(x, y);
      for (const r of p.rocks) boulder(g, cx, y0, r);
    } else if (p.kind === "pool") pool(g, x, y, p);
    else canoe(g, x, y, p);
  },
  tilted: {
    shadow: (g, x, y, rand) => {
      const p = pieceOf(rand);
      if (p.kind === "palm") palmShadow(g, x, y, p);
      else if (p.kind === "rocks") {
        const { cx, y0 } = groundOf(x, y);
        for (const r of p.rocks) boulderShadow(g, cx, y0, r);
      } else if (p.kind === "pool") poolShadow(g, x, y, p);
      else canoeShadow(g, x, y, p);
    },
    landmark: (g, x, y, s, variant) => {
      const { y0, k } = landmarkGround(x, y, s);
      scaled(g, x, y0, k, () => (variant ? lighthouseShadow(g) : hutShadow(g)));
      scaled(g, x, y0, k, () => (variant ? lighthouse(g) : hut(g)));
    },
    // The hut's doorway lantern flickers; the lighthouse sweeps its beam round the board.
    landmarkLight: (g, glow, x, y, s, variant, clock, lit) => {
      const { y0, k } = landmarkGround(x, y, s);
      if (!variant) {
        const f = 0.75 + 0.15 * Math.sin(clock * 7 + x) + 0.1 * Math.sin(clock * 17 + y);
        disc(glow, x + 8 * k, Y(y0, 15 * k, 24 * k), 9 * k, 0xffb860, 0.22 * f * lit);
        disc(glow, x + 8 * k, Y(y0, 15 * k, 24 * k), 3.5 * k, 0xffe0a0, 0.3 * f * lit);
        return;
      }
      const lx = x,
        ly = y0 - (LIGHTHOUSE.lantern - 5) * k,
        a = clock * 0.8,
        reach = CELL * 4 * k,
        spread = 0.16;
      for (const [w, alpha] of [[1, 0.06], [0.55, 0.08]] as const) {
        glow.fillStyle(0xfff0c0, alpha * lit);
        glow.fillTriangle(lx, ly, lx + Math.cos(a - spread * w) * reach, ly + Math.sin(a - spread * w) * reach * SQUASH, lx + Math.cos(a + spread * w) * reach, ly + Math.sin(a + spread * w) * reach * SQUASH);
      }
      disc(glow, lx, ly, 10 * k, 0xffe6a0, 0.3 * lit);
      disc(g, lx, ly, 2.6 * k, 0xfff6d8, 0.9);
    },
  },
  decor: (g, x, y, rand) => {
    const kind = rand(),
      cx = x + 12 + rand() * 32,
      cy = y + 12 + rand() * 32;
    if (kind < 0.22) {
      // Starfish.
      const c = rand() < 0.5 ? 0xf08a5a : 0xe86a6a;
      star(g, cx + 0.8, cy + 1, 6, 2.4, 5, SHADE, rand() * 6, 0.18);
      star(g, cx, cy, 6, 2.4, 5, c, rand() * 6);
    } else if (kind < 0.42) {
      // Scallop shell with ribs.
      oval(g, cx + 0.8, cy + 1, 5, 2.6, SHADE, 0.18);
      oval(g, cx, cy, 4.6, 3.6, 0xf6e2d6);
      g.lineStyle(0.6, 0xd2a898, 0.9);
      for (let i = -2; i <= 2; i++) g.lineBetween(cx, cy + 3, cx + i * 1.8, cy - 2.6);
    } else if (kind < 0.58) {
      // A pair of footprints walking up the beach.
      const a = rand() * Math.PI * 2;
      for (const [s, t] of [[-1, 0], [1, 7]]) oval(g, cx + Math.cos(a) * t - Math.sin(a) * s * 2.6, cy + Math.sin(a) * t + Math.cos(a) * s * 2.6, 2.6, 1.5, shade(SAND, -0.14), 0.9, a);
    } else if (kind < 0.72) {
      // Washed-up seaweed.
      g.lineStyle(1.6, 0x5a7a3a, 0.75);
      g.strokePoints([{ x: cx - 8, y: cy }, { x: cx - 3, y: cy - 2 }, { x: cx + 2, y: cy + 1 }, { x: cx + 8, y: cy - 1 }], false);
      g.lineStyle(1, 0x7a9a4a, 0.7);
      g.strokePoints([{ x: cx - 5, y: cy + 2 }, { x: cx, y: cy + 3 }, { x: cx + 5, y: cy + 1 }], false);
    } else if (kind < 0.85) {
      // Pebbles.
      for (let i = 0; i < 3; i++) {
        const px = cx + (rand() - 0.5) * 12,
          py = cy + (rand() - 0.5) * 8,
          r = 1.4 + rand() * 1.4;
        oval(g, px + 0.6, py + 0.8, r, r * 0.7, SHADE, 0.2);
        oval(g, px, py, r, r * 0.7, rand() < 0.5 ? 0xb8ae9c : 0x8c8478);
      }
    } else {
      // A fallen coconut.
      oval(g, cx + 1.4, cy + 1.6, 4.6, 2.6, SHADE, 0.2);
      disc(g, cx, cy, 4, 0x6b4a2a);
      disc(g, cx - 1.2, cy - 1.2, 1.4, 0x9a744a);
    }
  },
  // Sunlight on the water: foam drifting down the channel, sparkles on it and in the pools, cloud shadows and gulls.
  ambient: ({ g, glow, lit, map, path, clock, hash, blocked }) => {
    const w = map.columns * CELL,
      h = map.rows * CELL;
    flow(path, clock, 0.8, 0.45, (p, k) => {
      const side = ((k * 7) % 5) - 2;
      g.fillStyle(WATER.foam, 0.28 + 0.12 * Math.sin(clock * 2 + k));
      fillOval(g, p.x - Math.sin(p.angle) * side * 5, p.y + Math.cos(p.angle) * side * 5, 4 + (k % 3), 1.6);
    });
    // Foam lapping at both banks: short dashes that swell and draw back, out of step along the channel.
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i],
        b = path[i + 1],
        l = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2) || 1,
        nx = -(b.y - a.y) / l,
        ny = (b.x - a.x) / l;
      for (const side of [-1, 1])
        for (let d = 0; d < l; d += 14) {
          const swell = 0.5 + 0.5 * Math.sin(clock * 1.3 + (i * l + d) * 0.09 + side),
            o = side * (16.5 - 2.2 * swell),
            x0 = a.x + ((b.x - a.x) * d) / l + nx * o,
            y0 = a.y + ((b.y - a.y) * d) / l + ny * o,
            t = Math.min(10, l - d) / l;
          g.lineStyle(1.6, WATER.foam, 0.2 + 0.35 * swell);
          g.lineBetween(x0, y0, x0 + (b.x - a.x) * t, y0 + (b.y - a.y) * t);
        }
    }
    for (let i = 0; i < path.length; i++)
      for (let j = 0; j < 2; j++) {
        const s = hash01(i, j, 91);
        twinkle(g, glow, path[i].x + (s - 0.5) * 30, path[i].y + (hash01(j, i, 92) - 0.5) * 30, clock, s, lit);
      }
    for (const b of blocked) {
      if (hash(b.x, b.y) < ROCKS || hash(b.x, b.y) >= POOL) continue;
      const { px, py } = poolCentre(b.x * CELL, b.y * CELL);
      for (let j = 0; j < 3; j++) twinkle(g, glow, px + (hash01(b.x, b.y, j) - 0.5) * 24, py + (hash01(b.y, j, b.x) - 0.5) * 14, clock, hash01(j, b.x, b.y), lit);
    }
    if (!map.columns) return;
    // Two slow cloud shadows crossing the island.
    for (let k = 0; k < 2; k++) {
      const s = hash(k, 401),
        cx = ((clock * (9 + s * 5) + s * w * 3) % (w + 400)) - 200,
        cy = h * (0.25 + 0.5 * hash(k, 402));
      g.fillStyle(0x2a6a88, 0.045);
      fillOval(g, cx, cy, 150, 60);
      fillOval(g, cx + 60, cy + 20, 90, 40);
      fillOval(g, cx - 70, cy + 15, 80, 34);
    }
    // Gulls gliding over, with their shadows on the sand.
    for (let k = 0; k < 2; k++) {
      const s = hash(k, 403),
        gx = ((clock * (34 + s * 12) + s * w * 5) % (w + 240)) - 120,
        gy = h * (0.15 + 0.6 * hash(k, 404)) + Math.sin(clock * 0.4 + k * 3) * 24,
        flap = Math.sin(clock * 5 + k * 2) * 3,
        wing = (ink: Ink, x: number, y: number, color: number, alpha: number, width: number) => {
          ink.lineStyle(width, color, alpha);
          ink.strokePoints([{ x: x - 7, y: y - 1 - flap }, { x: x - 3, y: y - 2.5 }, { x, y }, { x: x + 3, y: y - 2.5 }, { x: x + 7, y: y - 1 - flap }], false);
        };
      wing(g, gx + 40, gy + 26, SHADE, 0.16, 2);
      wing(g, gx, gy, 0x2a3a44, 0.85, 2);
      wing(g, gx, gy - 0.6, 0xffffff, 0.9, 1);
    }
  },
};
