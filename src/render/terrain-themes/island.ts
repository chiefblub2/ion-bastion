import { CELL, disc, fillOval, hash01, type Ink, oval, shade, star } from "../shapes";
import { facing } from "../material";
import { OUTLINE, SQUASH, X, Y, block, drum, fillPoints, point, quad, tube } from "../tower-art/tilt";
import { tubeAt } from "../tower-art/tilt-parts";
import { box, frame, rod } from "../tower-art/tilt-frame";
import { mulberry32, type Random, type StandingPiece, type Theme } from "./kit";
import { bankWidth, CHANNEL_STEP, channelOf, SEA_TILE, seaCells, seaField, type ShorePoint, shoreLine } from "../coast";
import { blend } from "../ground";
import { type Bush, bushOf, bushShadow, drawBush, drawPalm, type Palm, palmOf, palmShadow, SHADE, SUN, trunkOffset } from "./island-flora";
import { fnv } from "../../core/hash";
import type { MapDefinition } from "../../core/types";

// Palm Atoll, a Caribbean cay: powder-white sand, a turquoise tidal channel as the path, palms and flowering bushes,
// and the first terrain drawn in the towers' 3/4 tilt (`Theme.tilted`): palms, bushes (`island-flora.ts`), boulders,
// lagoon pools and painted dugouts stand up out of the board, north to south after the path, so palm crowns reach over
// the cell above; more palms and sea grape line the back of the beach (`tilted.extras`). Every piece's shape is rolled
// once by `pieceOf`, so its shadow (drawn for all pieces first) and its body match.

const SAND = 0xf2eada;
const WATER = { deep: 0x0d9bc4, mid: 0x1fc3d0, shallow: 0x62e4d6, foam: 0xf6fffd } as const;
/** Kind thresholds of the first `cellRandom` draw (`hash` in the ambient names the piece the same way). */
const PALMS = 0.42,
  BUSHES = 0.62,
  ROCKS = 0.72,
  POOL = 0.84;
const F = new Float64Array(16),
  I = new Float64Array(16);

interface Rock { du: number; dv: number; r: number; h: number; radii: number[]; dark: boolean }
type Piece =
  | { kind: "plants"; palms: Palm[]; bushes: Bush[] }
  | { kind: "rocks"; rocks: Rock[] }
  | { kind: "pool"; rx: number; ry: number; rocks: Rock[] }
  | { kind: "boat"; angle: number; side: 1 | -1; paint: number };

const rock = (rand: Random, du: number, dv: number, r: number): Rock => ({
  du,
  dv,
  r,
  h: r * (0.7 + rand() * 0.5),
  radii: Array.from({ length: 6 }, () => 0.82 + rand() * 0.18),
  dark: rand() < 0.35,
});
/** Hull colours of the painted dugouts. */
const BOAT_PAINT = [0x23a9bd, 0xe8604a, 0xf2c84a, 0x3f9a5a] as const;
/**
 * Rolls a cell's piece; the first draw is its kind (`hash`). Palm cells hold one to three palms, often with a bush at
 * their feet; bush cells one to three bushes of any kind.
 */
function pieceOf(rand: Random): Piece {
  const kind = rand();
  if (kind < PALMS) {
    const count = rand(),
      palms =
        count < 0.5 ? [palmOf(rand, 0, -2)]
        : count < 0.85 ? [palmOf(rand, -9, -5), palmOf(rand, 10, 5)]
        : [palmOf(rand, -11, -6), palmOf(rand, 11, -4), palmOf(rand, 1, 9)];
    return { kind: "plants", palms, bushes: rand() < 0.5 ? [bushOf(rand, palms.length === 1 ? 13 : -13, 9, undefined, 0.55 + rand() * 0.2)] : [] };
  }
  if (kind < BUSHES) {
    const count = rand(),
      spots = count < 0.35 ? [[0, 0]] : count < 0.75 ? [[-8, -4], [9, 6]] : [[-10, -6], [10, -4], [0, 9]];
    return { kind: "plants", palms: [], bushes: spots.map(([du, dv]) => bushOf(rand, du, dv, undefined, (spots.length === 1 ? 1.05 : 0.8) + rand() * 0.2)) };
  }
  if (kind < ROCKS) {
    const rocks = [rock(rand, -6 + rand() * 4, -4 + rand() * 3, 11 + rand() * 4), rock(rand, 8 + rand() * 4, 3 + rand() * 3, 7 + rand() * 3)];
    if (rand() < 0.5) rocks.push(rock(rand, -12 + rand() * 4, 9, 4 + rand() * 2));
    return { kind: "rocks", rocks: rocks.sort((a, b) => a.dv - b.dv) };
  }
  if (kind < POOL) return { kind: "pool", rx: 19 + rand() * 3, ry: 14 + rand() * 2, rocks: [rock(rand, 15, 10, 4.5), rock(rand, -18, -6, 3.5)] };
  return { kind: "boat", angle: (rand() - 0.5) * 0.7, side: rand() < 0.5 ? 1 : -1, paint: BOAT_PAINT[Math.floor(rand() * BOAT_PAINT.length)] };
}

/** Ground centre of a cell's piece (x, y0 in the tilt kit's terms). */
const groundOf = (x: number, y: number) => ({ cx: x + CELL / 2, y0: y + 36 });

// ── Plants ──────────────────────────────────────────────────────────────────────────────────────────────────────────
/** A cell's palms and bushes back to front, palms on a low sand mound with fallen coconuts. */
function plants(g: Ink, x: number, y: number, p: Extract<Piece, { kind: "plants" }>) {
  const { cx, y0 } = groundOf(x, y);
  if (p.palms.length) {
    oval(g, cx + 1, y0 + 1, 18, 18 * SQUASH, shade(SAND, -0.08));
    oval(g, cx, y0, 16, 16 * SQUASH, shade(SAND, 0.03));
    disc(g, cx + 6, y0 + 5, 2.4, 0x6b4a2a);
    disc(g, cx - 8, y0 + 6, 2.2, 0x7a5532);
  }
  const items = [...p.palms.map((q) => ({ dv: q.dv, draw: () => drawPalm(g, cx + q.du, y0 + q.dv * SQUASH, q) })), ...p.bushes.map((b) => ({ dv: b.dv, draw: () => drawBush(g, cx + b.du, y0 + b.dv * SQUASH, b) }))];
  for (const item of items.sort((a, b) => a.dv - b.dv)) item.draw();
}
function plantsShadow(g: Ink, x: number, y: number, p: Extract<Piece, { kind: "plants" }>) {
  const { cx, y0 } = groundOf(x, y);
  for (const b of p.bushes) bushShadow(g, cx + b.du, y0 + b.dv * SQUASH, b);
  for (const q of p.palms) palmShadow(g, cx + q.du, y0 + q.dv * SQUASH, q);
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
  oval(g, px, py, p.rx + 4, p.ry + 3.5, 0xd8c9a2);
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

// ── Painted dugout ──────────────────────────────────────────────────────────────────────────────────────────────────
/** Ground offset of a point `d` along the hull and `q` across it. */
const hullAt = (a: number, d: number, q: number) => ({ u: Math.cos(a) * d - Math.sin(a) * q, v: Math.sin(a) * d + Math.cos(a) * q });
function boat(g: Ink, x: number, y: number, p: Extract<Piece, { kind: "boat" }>) {
  const { cx, y0 } = groundOf(x, y),
    a = p.angle,
    q = p.side * 13,
    float = () => {
      tubeAt(g, cx, y0, a, q, 2.6, -13, 13, 2.2, 0xf0e6d0);
      for (const d of [-7, 7]) {
        const h = hullAt(a, d, 0),
          f = hullAt(a, d, q);
        rod(g, cx, y0, h.u, h.v, 8.5, f.u, f.v, 4, 1.6, 0x7a5a3a);
      }
    },
    hull = () => {
      // Dugout hull in bright paint: short tube pieces under an elliptic profile, the ends raised a little.
      const steps = 12,
        half = 22;
      for (let i = 0; i < steps; i++) {
        const d0 = -half + (2 * half * i) / steps,
          d1 = d0 + (2 * half) / steps + 0.4,
          m = (d0 + d1) / 2 / half,
          r = 5 * Math.sqrt(Math.max(0.08, 1 - m * m));
        tube(g, cx, y0, a, 5 + 2.2 * m * m, d0, d1, r, Math.abs(m) > 0.8 ? 0xf6f0e0 : p.paint, 1, true);
      }
      tube(g, cx, y0, a, 8.2, -14, 14, 2.4, 0x5a3a22, 1, false);
      // A contrasting band along the gunwale.
      tube(g, cx, y0, a, 6.6, -16, 16, 0.8, p.paint === 0xf2c84a ? 0xe8604a : 0xf2c84a, 0.95, false);
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
function boatShadow(g: Ink, x: number, y: number, p: Extract<Piece, { kind: "boat" }>) {
  const { cx, y0 } = groundOf(x, y),
    rot = Math.atan2(Math.sin(p.angle) * SQUASH, Math.cos(p.angle)),
    f = hullAt(p.angle, 0, p.side * 13);
  oval(g, cx + 3.5, y0 + 2.5, 25, 6, SHADE, 0.2, rot);
  oval(g, X(cx, f.u) + 2, Y(y0, f.v, 0) + 1.5, 15, 2.8, SHADE, 0.16, rot);
}

// ── The back of the beach ───────────────────────────────────────────────────────────────────────────────────────────
const SHORE_PLANTS = new Map<string, StandingPiece[]>();
/**
 * Palms and sea grape at the back of the beach, where the dry sand meets the land (`shoreLine` at the land's edge),
 * well away from the waterline and never near the path (entry and reactor included). The palms stand in every posture,
 * the leaning ones out towards the sea.
 */
function shorePlants(map: MapDefinition): readonly StandingPiece[] {
  const cached = SHORE_PLANTS.get(map.id);
  if (cached) return cached;
  const list: StandingPiece[] = [],
    path = map.path.map((p) => ({ x: (p.x + 0.5) * CELL, y: (p.y + 0.5) * CELL }));
  if (seaCells(map).size)
    for (const s of shoreLine(map, 3, 30)) {
      const rand = mulberry32(fnv(`${map.id}:shore-plant:${Math.round(s.x)}:${Math.round(s.y)}`)),
        roll = rand();
      if (roll > 0.6 || path.some((p) => (p.x - s.x) ** 2 + (p.y - s.y) ** 2 < 46 * 46)) continue;
      if (roll < 0.32) {
        const pose = rand(),
          p = palmOf(rand, 0, 0, { posture: pose < 0.4 ? "leaning" : pose < 0.75 ? "curved" : "upright", dir: Math.atan2(s.ny, s.nx) + (rand() - 0.5) * 0.8 });
        list.push({ x: s.x, y: s.y, shadow: (g) => palmShadow(g, s.x, s.y, p), draw: (g) => drawPalm(g, s.x, s.y, p) });
      } else {
        const b = bushOf(rand, 0, 0, rand() < 0.8 ? "seagrape" : "agave", 0.75 + rand() * 0.3);
        list.push({ x: s.x, y: s.y, shadow: (g) => bushShadow(g, s.x, s.y, b), draw: (g) => drawBush(g, s.x, s.y, b) });
      }
    }
  SHORE_PLANTS.set(map.id, list);
  return list;
}

// ── Landmarks: a painted beach shack and a palm grove with a hammock ────────────────────────────────────────────────
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
const THATCH = 0xd2ab62,
  WALL = 0x5fc9c0,
  ROOF = { eave: 30, depth: 24, base: 33, apex: 60 } as const;
function shack(g: Ink) {
  // Stilts, the deck, a ladder, turquoise plank walls with a coral door and yellow shutters, then a hipped thatch roof.
  for (const [u, v] of [[-25, -17], [25, -17], [-25, 17], [25, 17]]) rod(g, 0, 0, u, v, 0, u, v, 11, 2.6, 0x6b4a2c);
  box(g, 0, 0, LEVEL, -30, 30, -22, 22, 10, 13, 0x9a7448);
  g.lineStyle(0.7, 0x5a3e22, 0.7);
  for (let u = -24; u <= 24; u += 6) g.lineBetween(X(0, u), Y(0, 22, 10.5), X(0, u), Y(0, 22, 12.5));
  for (const u of [4, 12]) rod(g, 0, 0, u, 32, 0, u, 22, 11, 1.4, 0x7a5a3a);
  for (let h = 3; h < 11; h += 3) rod(g, 0, 0, 4, 32 - h * 0.9, h, 12, 32 - h * 0.9, h, 1, 0x8a6a48);
  box(g, 0, 0, LEVEL, -21, 21, -15, 15, 13, ROOF.base, WALL);
  g.lineStyle(0.6, shade(WALL, -0.35), 0.7);
  for (let h = 16; h < ROOF.base; h += 3.5) g.lineBetween(X(0, -21), Y(0, 15, h), X(0, 21), Y(0, 15, h));
  const pane = (u0: number, u1: number, h0: number, h1: number, color: number) => quad(g, X(0, u0), Y(0, 15, h0), X(0, u1), Y(0, 15, h0), X(0, u1), Y(0, 15, h1), X(0, u0), Y(0, 15, h1), color);
  pane(2.5, 13.5, 13, 28, shade(0xe8604a, -0.1));
  pane(4, 12, 14, 26.5, 0x2a1a10);
  pane(-17, -13, 18, 28, 0xf2c84a);
  pane(-13, -6, 18, 28, 0x2a1a10);
  pane(-6, -2, 18, 28, 0xf2c84a);
  const { eave: e, depth: d, base: b, apex } = ROOF,
    ridge = 9,
    corner = (u: number, v: number) => [X(0, u), Y(0, v, b)] as const,
    top = (u: number) => [X(0, u), Y(0, 0, apex)] as const,
    face = (pts: (readonly [number, number])[], normal: number) => {
      pts.forEach(([px, py], i) => point(i, px, py));
      fillPoints(g, pts.length, OUTLINE, 0.9);
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
function shackShadow(g: Ink) {
  const { eave: e, depth: d, base: b } = ROOF;
  // The roof's shadow, feathered: three passes from its own outline to the full offset.
  for (const k of [0.55, 0.8, 1]) {
    const q = (u: number, v: number) => ({ x: X(0, u) + b * SUN.x * k, y: Y(0, v, 0) + b * SUN.y * k });
    g.fillStyle(SHADE, 0.08);
    g.fillPoints([q(-e, -d), q(e, -d), q(e, d), q(-e, d)], true);
  }
}
/** The grove: two curved palms holding the hammock, a tall upright one behind, and flowering bushes at their feet. */
function groveOf(rand: Random) {
  const hold = [palmOf(rand, -27, -10, { posture: "curved", dir: Math.PI, adult: true }), palmOf(rand, 25, -13, { posture: "curved", dir: 0, adult: true })];
  return {
    hold,
    palms: [...hold, palmOf(rand, 6, -30, { posture: "upright", adult: true })].map((p) => ({ ...p, height: Math.max(p.height, 50) })),
    bushes: [bushOf(rand, -36, 20, "hibiscus", 0.9), bushOf(rand, 34, 18, "banana", 1), bushOf(rand, 46, -2, "bougainvillea", 0.8), bushOf(rand, -12, 26, "seagrape", 0.7)],
  };
}
const HAMMOCK = [0xe8483a, 0xf2c84a, 0x23a9bd, 0xf6f0e0] as const;
/** A striped hammock slung between two trunks at height h, sagging in the middle. */
function hammock(g: Ink, a: Palm, b: Palm, h: number) {
  const at = (p: Palm) => {
      const o = trunkOffset(p, h / p.height);
      return { x: X(0, p.du + o.u), y: Y(0, p.dv + o.v, h) };
    },
    p0 = at(a),
    p1 = at(b),
    curve = (dy: number) =>
      Array.from({ length: 13 }, (_, i) => {
        const t = i / 12;
        return { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t + Math.sin(Math.PI * t) * 9 + dy * Math.sin(Math.PI * t) };
      });
  g.lineStyle(0.9, 0x5a4a3a, 0.9);
  g.strokePoints(curve(-2.5), false);
  g.lineStyle(7.5, OUTLINE, 0.6);
  g.strokePoints(curve(1), false);
  HAMMOCK.forEach((c, i) => {
    g.lineStyle(1.8, c);
    g.strokePoints(curve(-1.2 + i * 1.6), false);
  });
}
/** Draws the grove back to front, the hammock right after the two palms that hold it. */
function grove(g: Ink, rand: Random) {
  const { hold, palms, bushes } = groveOf(rand),
    items = [
      ...palms.map((p) => ({ dv: p.dv, draw: () => drawPalm(g, p.du, p.dv * SQUASH, p) })),
      ...bushes.map((b) => ({ dv: b.dv, draw: () => drawBush(g, b.du, b.dv * SQUASH, b) })),
      { dv: Math.max(hold[0].dv, hold[1].dv) + 0.1, draw: () => hammock(g, hold[0], hold[1], 13) },
    ].sort((a, b) => a.dv - b.dv);
  oval(g, 0, 4, 46, 30, shade(SAND, -0.05));
  for (const item of items) item.draw();
}
function groveShadow(g: Ink, rand: Random) {
  const { palms, bushes } = groveOf(rand);
  for (const b of bushes) bushShadow(g, b.du, b.dv * SQUASH, b);
  for (const p of palms) palmShadow(g, p.du, p.dv * SQUASH, p);
}

// ── Channel (the path) and the sea ──────────────────────────────────────────────────────────────────────────────────
/** Half widths of the channel's layers from the outside in: damp and wet sand, foam line, water, mid and deep water. */
const BANKS = { damp: 27, wet: 23, foam: 19.6, water: 18.6, mid: 12.5, deep: 6.5 } as const;
const channelSeed = (map: MapDefinition) => fnv(`${map.id}:channel`);
/**
 * The path as a tidal channel instead of a road: rounded turns and banks that meander a little (`coast.ts`), damp and
 * wet sand, a foam line, the bank's shadow on the water, then shallow to deeper water; sand ripples and pebbles on
 * the bed and sea grass on the banks. No kerbs, lanes, centre line or arrows: the drifting foam shows the way.
 */
function drawChannel(g: Ink, map: MapDefinition) {
  const samples = channelOf(map),
    seed = channelSeed(map),
    layer = (base: number, k: number, color: number, dx = 0, dy = 0, step = 2) => {
      for (let i = 0; i < samples.length; i += step) {
        const p = samples[i];
        disc(g, p.x + dx, p.y + dy, bankWidth(seed, p.s, base, k), color);
      }
    };
  layer(BANKS.damp, 0, 0xe6dbbf);
  layer(BANKS.wet, 1, 0xd2c098);
  layer(BANKS.foam, 2, WATER.foam);
  layer(BANKS.water, 3, shade(WATER.shallow, -0.22));
  layer(BANKS.water - 1.4, 3, WATER.shallow, 1.4, 1.6);
  layer(BANKS.mid, 4, WATER.mid, 1, 1.2);
  layer(BANKS.deep, 5, 0x10a9c6, 1, 1.2);
  for (let i = 0; i < samples.length; i += 4) {
    const p = samples[i],
      r = hash01(seed, i, 1),
      half = bankWidth(seed, p.s, BANKS.water, 3);
    // Sand ripples across the bed, bending with the current.
    if (i % 12 === 0) {
      const tx = p.ny,
        ty = -p.nx,
        bow = 2.5 + r * 2;
      g.lineStyle(1.2, shade(WATER.mid, 0.3), 0.32);
      g.strokePoints([-0.7, -0.35, 0, 0.35, 0.7].map((k) => ({ x: p.x + p.nx * half * k + tx * bow * (1 - 2 * k * k), y: p.y + p.ny * half * k + ty * bow * (1 - 2 * k * k) })), false);
    }
    if (r < 0.12) disc(g, p.x + p.nx * (hash01(seed, i, 2) - 0.5) * half * 1.4, p.y + p.ny * (hash01(seed, i, 2) - 0.5) * half * 1.4, 1 + r * 10, shade(WATER.mid, -0.18), 0.45);
    // Sea grass and a stone here and there on the wet sand.
    if (r > 0.94) {
      const side = r > 0.97 ? 1 : -1,
        o = bankWidth(seed, p.s, BANKS.wet, 1) - 1.5,
        bx = p.x + p.nx * o * side,
        by = p.y + p.ny * o * side;
      for (let k = 0; k < 4; k++) {
        const a = -Math.PI / 2 + (k - 1.5) * 0.4;
        g.lineStyle(1.2, 0x4f8a3a, 0.85);
        g.lineBetween(bx + k - 1.5, by + 1, bx + k - 1.5 + Math.cos(a) * 6, by + 1 + Math.sin(a) * 6);
      }
    } else if (r > 0.9) {
      const side = r > 0.92 ? 1 : -1,
        o = bankWidth(seed, p.s, BANKS.wet, 1) - 2;
      oval(g, p.x + p.nx * o * side + 0.8, p.y + p.ny * o * side + 1, 3.6, 2.4, SHADE, 0.25);
      oval(g, p.x + p.nx * o * side, p.y + p.ny * o * side, 3.4, 2.4, 0xa8a090);
    }
  }
}
/** Shore colours by sea depth (`coast.ts` `seaDepth`): a wide white beach (palms stand at its back), wet sand, the foam line, lagoon shallows, then the deep ocean. */
const SHORE: readonly [number, number][] = [
  [0, 0xf4ecdc],
  [22, 0xefe5cf],
  [29, 0xd9c8a0],
  [29.01, WATER.foam],
  [31.5, WATER.foam],
  [34, 0x9cf2e4],
  [58, 0x34d2d4],
  [110, 0x0fa0c8],
  [180, 0x0a62a0],
];
/** Depth of the foam line, where the surf runs. */
const FOAM = 30.3;
function shoreColor(d: number) {
  if (d <= SHORE[0][0]) return SHORE[0][1];
  for (let i = 1; i < SHORE.length; i++) {
    const [d1, c1] = SHORE[i];
    if (d < d1) {
      const [d0, c0] = SHORE[i - 1];
      return blend(c0, c1, (d - d0) / (d1 - d0));
    }
  }
  return SHORE[SHORE.length - 1][1];
}
/**
 * The ocean on the sea cells, painted tile by tile from the sea's depth field (runs of one colour merged): a wide
 * beach that continues the sand, a curving foam line, lagoon shallows and the deep blue towards the board edge.
 */
function drawSea(g: Ink, map: MapDefinition) {
  const n = CELL / SEA_TILE;
  for (const [k, depths] of seaField(map)) {
    const [cx, cy] = k.split(",").map(Number);
    for (let ty = 0; ty < n; ty++) {
      let run = 0,
        color = -1;
      const y = cy * CELL + ty * SEA_TILE,
        flush = (tx: number) => {
          if (!run) return;
          g.fillStyle(color);
          g.fillRect(cx * CELL + (tx - run) * SEA_TILE, y, run * SEA_TILE, SEA_TILE);
        };
      for (let tx = 0; tx < n; tx++) {
        const c = shoreColor(Math.round(depths[ty * n + tx] * 2) / 2);
        if (c !== color) {
          flush(tx);
          run = 0;
          color = c;
        }
        run++;
      }
      flush(n);
    }
  }
}
/** Surf on the shore: a wave washing up the beach and drawing back, a swell line rolling in behind it, sparkles out at sea. */
function surf(g: Ink, glow: Ink, map: MapDefinition, clock: number, lit: number) {
  if (!seaCells(map).size) return;
  const dash = (p: ShorePoint, o: number, width: number, alpha: number) => {
    if (alpha < 0.03) return;
    const x = p.x + p.nx * o,
      y = p.y + p.ny * o;
    g.lineStyle(width, WATER.foam, alpha);
    g.lineBetween(x + p.ny * 4.5, y - p.nx * 4.5, x - p.ny * 4.5, y + p.nx * 4.5);
  };
  for (const p of shoreLine(map, FOAM)) {
    const lap = 0.5 + 0.5 * Math.sin(clock * 0.9 + (p.x + p.y * 1.3) * 0.012);
    dash(p, -8 * lap + 4, 1.8, 0.7 * lap);
  }
  for (const p of shoreLine(map, 52, 9)) {
    const roll = (clock * 0.2 + (p.x + p.y * 1.3) * 0.004) % 1;
    dash(p, -20 * roll, 1.4, 0.35 * Math.sin(Math.PI * roll));
  }
  for (const [k, depths] of seaField(map)) {
    const [x, y] = k.split(",").map(Number),
      n = CELL / SEA_TILE;
    for (let j = 0; j < 2; j++) {
      const tx = Math.floor(hash01(x, y, j) * n),
        ty = Math.floor(hash01(y, x, j + 5) * n);
      if (depths[ty * n + tx] > 42) twinkle(g, glow, x * CELL + (tx + 0.5) * SEA_TILE, y * CELL + (ty + 0.5) * SEA_TILE, clock, hash01(j, x, y), lit);
    }
  }
}
/** The channel's life: foam lapping at both banks, foam flecks drifting with the current and sparkles. */
function channelLife(g: Ink, glow: Ink, map: MapDefinition, clock: number, lit: number) {
  const samples = channelOf(map),
    seed = channelSeed(map);
  for (let i = 0; i < samples.length; i += 4) {
    const p = samples[i],
      tx = p.ny,
      ty = -p.nx;
    for (const side of [-1, 1]) {
      const swell = 0.5 + 0.5 * Math.sin(clock * 1.3 + p.s * 0.05 + side * 1.7),
        o = side * (bankWidth(seed, p.s, BANKS.water, 3) - 0.5 - 2.6 * swell),
        x = p.x + p.nx * o,
        y = p.y + p.ny * o;
      g.lineStyle(1.5, WATER.foam, 0.18 + 0.4 * swell);
      g.lineBetween(x - tx * 3.5, y - ty * 3.5, x + tx * 3.5, y + ty * 3.5);
    }
  }
  const total = samples[samples.length - 1].s;
  for (let k = 0; k * 34 < total; k++) {
    const s = (k * 34 + clock * 22) % total,
      p = samples[Math.min(samples.length - 1, Math.floor(s / CHANNEL_STEP))],
      side = (((k * 7) % 5) - 2) * 4;
    g.fillStyle(WATER.foam, 0.3 + 0.15 * Math.sin(clock * 2 + k));
    fillOval(g, p.x + p.nx * side, p.y + p.ny * side, 4 + (k % 3), 1.6);
  }
  for (let i = 0; i < samples.length; i += 9) {
    const p = samples[i],
      o = (hash01(seed, i, 7) - 0.5) * 26;
    twinkle(g, glow, p.x + p.nx * o, p.y + p.ny * o, clock, hash01(i, seed, 8), lit);
  }
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
  ground: [SAND, 0xece3cf],
  grid: 0xbcae8c,
  path: { edge: 0xd6c69c, bed: 0x22c1cf, line: 0xf4fffc, arrow: 0xffffff },
  accent: 0xff7d5e,
  drawPath: drawChannel,
  sea: drawSea,
  obstacle: (g, x, y, rand) => {
    const p = pieceOf(rand);
    if (p.kind === "plants") plants(g, x, y, p);
    else if (p.kind === "rocks") {
      const { cx, y0 } = groundOf(x, y);
      for (const r of p.rocks) boulder(g, cx, y0, r);
    } else if (p.kind === "pool") pool(g, x, y, p);
    else boat(g, x, y, p);
  },
  tilted: {
    shadow: (g, x, y, rand) => {
      const p = pieceOf(rand);
      if (p.kind === "plants") plantsShadow(g, x, y, p);
      else if (p.kind === "rocks") {
        const { cx, y0 } = groundOf(x, y);
        for (const r of p.rocks) boulderShadow(g, cx, y0, r);
      } else if (p.kind === "pool") poolShadow(g, x, y, p);
      else boatShadow(g, x, y, p);
    },
    // Two streams of the same seed, so the grove's shadow and body roll the same palms.
    landmark: (g, x, y, s, variant, rand) => {
      const { y0, k } = landmarkGround(x, y, s),
        seed = Math.floor(rand() * 2 ** 32);
      scaled(g, x, y0, k, () => (variant ? groveShadow(g, mulberry32(seed)) : shackShadow(g)));
      scaled(g, x, y0, k, () => (variant ? grove(g, mulberry32(seed)) : shack(g)));
    },
    // The shack's doorway lantern flickers.
    landmarkLight: (g, glow, x, y, s, variant, clock, lit) => {
      if (variant) return;
      const { y0, k } = landmarkGround(x, y, s),
        f = 0.75 + 0.15 * Math.sin(clock * 7 + x) + 0.1 * Math.sin(clock * 17 + y);
      disc(glow, x + 8 * k, Y(y0, 15 * k, 24 * k), 9 * k, 0xffb860, 0.22 * f * lit);
      disc(glow, x + 8 * k, Y(y0, 15 * k, 24 * k), 3.5 * k, 0xffe0a0, 0.3 * f * lit);
    },
    extras: shorePlants,
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
    } else if (kind < 0.8) {
      // A fallen hibiscus flower.
      const c = rand() < 0.5 ? 0xe8364a : 0xf06aa0;
      star(g, cx + 0.8, cy + 1, 5.4, 3.4, 5, SHADE, rand() * 6, 0.15);
      star(g, cx, cy, 5.4, 3.4, 5, c, rand() * 6);
      disc(g, cx, cy, 1.4, 0xffe27a);
    } else if (kind < 0.9) {
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
  // Sunlight on the water: surf on the shore, foam on the channel's banks and drifting down it, sparkles on the sea,
  // the channel and the pools, cloud shadows and gulls.
  ambient: ({ g, glow, lit, map, clock, hash, blocked }) => {
    const w = map.columns * CELL,
      h = map.rows * CELL;
    for (const b of blocked) {
      if (hash(b.x, b.y) < ROCKS || hash(b.x, b.y) >= POOL) continue;
      const { px, py } = poolCentre(b.x * CELL, b.y * CELL);
      for (let j = 0; j < 3; j++) twinkle(g, glow, px + (hash01(b.x, b.y, j) - 0.5) * 24, py + (hash01(b.y, j, b.x) - 0.5) * 14, clock, hash01(j, b.x, b.y), lit);
    }
    // The board-wide parts below never run in the big pieces' scaled pass (a board of size 0).
    if (!map.columns) return;
    surf(g, glow, map, clock, lit);
    channelLife(g, glow, map, clock, lit);
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
