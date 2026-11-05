import { CELL, disc, fillOval, fillRound, hash01, type Ink, oval, shade, strokeOval } from "../shapes";
import { SQUASH, Y } from "../tower-art/tilt";
import { cellRandom, mulberry32, type Random, type StandingPiece, type Theme } from "./kit";
import { channelOf, SEA_TILE, seaCells, seaField, shoreLine } from "../coast";
import { blend } from "../ground";
import { halo } from "../material";
import { fnv } from "../../core/hash";
import type { MapDefinition } from "../../core/types";
import {
  bambooOf, bambooShadow, capsOf, drawBamboo, drawFig, drawHead, drawLeafy, drawLog, drawPyramid, drawRuin, drawTree, eyesOf, FIG_FUNGUS, figShadow,
  GLYPH, glyphOf, headShadow, leafyOf, leafyShadow, logOf, logShadow, pyramidShadow, ruinOf, ruinShadow, SHRINE, treeOf, treeShadow, type Bamboo,
  type Leafy, type Log, type Ruin, type Tree,
} from "./jungle-props";

// Jungle: a rainforest at dusk over the ruins of an old temple city. A muddy trail instead of the sunken track: roots
// across it, leaf litter, puddles and the odd old paving slab; props in the towers' 3/4 tilt (`Theme.tilted`,
// `jungle-props.ts`): rainforest trees on buttress roots, giant-leaved plants, mossy temple blocks with glowing glyphs,
// fallen logs with fungus, carved stone heads and bamboo; a stepped temple pyramid and a giant strangler fig as
// landmarks; obstacle groups at the board edge turned into a murky river (`Theme.sea`) with lily pads and reeds; and
// fireflies and mist drifting through.

const ACCENT = GLYPH;
/** Kind thresholds of the first `cellRandom` draw. */
const TREE = 0.32,
  LEAFY = 0.5,
  RUIN = 0.66,
  LOG = 0.78,
  HEAD = 0.86;
/** A jungle river meanders. */
const SHORE = 7;

type Piece =
  | { kind: "tree"; tree: Tree; leafy: Leafy }
  | { kind: "leafy"; leafy: Leafy }
  | { kind: "ruin"; ruin: Ruin }
  | { kind: "log"; log: Log; leafy: Leafy }
  | { kind: "head"; a: number }
  | { kind: "bamboo"; bamboo: Bamboo };
function pieceOf(rand: Random): Piece {
  const kind = rand();
  if (kind < TREE) return { kind: "tree", tree: treeOf(rand), leafy: leafyOf(rand) };
  if (kind < LEAFY) return { kind: "leafy", leafy: leafyOf(rand) };
  if (kind < RUIN) return { kind: "ruin", ruin: ruinOf(rand) };
  if (kind < LOG) return { kind: "log", log: logOf(rand), leafy: leafyOf(rand) };
  if (kind < HEAD) return { kind: "head", a: (rand() - 0.5) * 0.7 };
  return { kind: "bamboo", bamboo: bambooOf(rand) };
}
const groundOf = (x: number, y: number) => ({ gx: x + CELL / 2, gy: y + 38 });
/** A small plant at the tree's foot, in front; one behind a log. */
const small = (l: Leafy) => ({ ...l, leaves: l.leaves.map((q) => ({ ...q, len: q.len * 0.55, lift: q.lift * 0.5, w: q.w * 0.6 })), flower: false });
/** A cell's piece rolled once per map for the ambient, from the same stream as its baked body. */
const PIECES = new Map<string, Piece>();
function pieceAt(map: MapDefinition, x: number, y: number) {
  const key = `${map.id}:${x}:${y}`;
  let p = PIECES.get(key);
  if (!p) PIECES.set(key, (p = pieceOf(cellRandom(map, x, y))));
  return p;
}

// ── Trail ───────────────────────────────────────────────────────────────────────────────────────────────────────────
const MUD = 0x2e2618;
/**
 * The path as a muddy jungle trail with rounded bends (`coast.ts` `channelOf`): a fringe of ferns and moss, dark mud
 * with lighter trodden ruts, roots snaking across, leaf litter, puddles catching the sky and a few sunk paving slabs.
 */
function drawTrail(g: Ink, map: MapDefinition) {
  const samples = channelOf(map),
    seed = fnv(`${map.id}:trail`),
    layer = (r: number, color: number) => {
      for (let i = 0; i < samples.length; i += 2) disc(g, samples[i].x, samples[i].y, r, color);
    },
    along = (o: number) => samples.map((p) => ({ x: p.x + p.nx * o, y: p.y + p.ny * o }));
  layer(26, 0x1a3a1a);
  layer(23.5, 0x241e14);
  layer(21.5, MUD);
  // Moss and fern tips over the edges.
  for (let i = 0; i < samples.length; i += 2) {
    const p = samples[i],
      h = hash01(seed, i);
    if (h > 0.55) continue;
    const side = h < 0.27 ? -1 : 1,
      o = side * (21 + hash01(seed, i, 2) * 4);
    disc(g, p.x + p.nx * o, p.y + p.ny * o, 1.6 + h * 4, shade(0x2a6a2a, (hash01(seed, i, 3) - 0.5) * 0.3), 0.9);
  }
  // Trodden ruts.
  for (const side of [-1, 1]) {
    g.lineStyle(5, shade(MUD, 0.12), 0.7);
    g.strokePoints(along(side * 8), false);
  }
  // Roots across the trail.
  for (let i = 9; i < samples.length; i += 22) {
    if (hash01(seed, i, 4) < 0.3) continue;
    const p = samples[i],
      tx = p.ny,
      ty = -p.nx,
      bend = (hash01(seed, i, 5) - 0.5) * 8,
      pts = [-1.1, -0.5, 0, 0.5, 1.1].map((k) => ({ x: p.x + p.nx * 22 * k + tx * bend * (1 - k * k), y: p.y + p.ny * 22 * k + ty * bend * (1 - k * k) }));
    g.lineStyle(3.2, 0x1a120a, 0.9);
    g.strokePoints(pts, false);
    g.lineStyle(1.6, 0x5a4428, 0.95);
    g.strokePoints(pts.map((q) => ({ x: q.x - 0.4, y: q.y - 0.6 })), false);
  }
  // Leaf litter and puddles.
  for (let i = 0; i < samples.length; i += 2) {
    const h = hash01(seed, i, 6);
    if (h > 0.35) continue;
    const p = samples[i],
      o = (hash01(seed, i, 7) - 0.5) * 36;
    oval(g, p.x + p.nx * o, p.y + p.ny * o, 1.6 + h * 3, 1, [0x6a5a2a, 0x8a6a2a, 0x4a5a24][i % 3], 0.85, hash01(seed, i, 8) * 3);
  }
  for (let i = 30; i < samples.length; i += 47) {
    const p = samples[i],
      o = (hash01(seed, i, 9) - 0.5) * 20,
      x = p.x + p.nx * o,
      y = p.y + p.ny * o;
    if (hash01(seed, i, 10) < 0.5) {
      oval(g, x, y, 8, 3.6, 0x1a2a2a);
      g.lineStyle(0.8, 0x6a8a8a, 0.4);
      g.lineBetween(x - 4, y - 1, x + 2, y - 1.2);
    } else {
      // An old paving slab sunk in the mud.
      g.fillStyle(0x4a5448);
      g.fillPoints([{ x: x - 7, y: y - 3 }, { x: x + 6, y: y - 4 }, { x: x + 7, y: y + 3 }, { x: x - 6, y: y + 4 }], true);
      g.lineStyle(0.6, 0x2f7a34, 0.8);
      g.lineBetween(x - 5, y + 2, x + 4, y + 2.5);
    }
  }
}

// ── River ───────────────────────────────────────────────────────────────────────────────────────────────────────────
/** A river on the edge cells: a mud bank, reedy shallows, then murky green water with lily pads. */
function drawRiver(g: Ink, map: MapDefinition) {
  const n = CELL / SEA_TILE;
  for (const [k, depths] of seaField(map, SHORE)) {
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
        const d = depths[ty * n + tx];
        const c = d < 3 ? 0x2e2618 : d < 6 ? 0x3a3a1e : d < 10 ? blend(0x2a4a2a, 0x1e3a2a, (d - 6) / 4) : blend(0x1a3a30, 0x0e2620, Math.min(1, (d - 10) / 70));
        if (c !== color) {
          flush(tx);
          run = 0;
          color = c;
        }
        run++;
      }
      flush(n);
    }
    // Lily pads, a few in flower.
    for (let j = 0; j < 2; j++) {
      const tx = Math.floor(hash01(cx, cy, j + 40) * n),
        ty = Math.floor(hash01(cy, cx, j + 47) * n);
      if (depths[ty * n + tx] < 10) continue;
      const x = cx * CELL + tx * SEA_TILE,
        y = cy * CELL + ty * SEA_TILE,
        r = 3 + hash01(j, cx, cy) * 3,
        a = hash01(cx, j, cy) * 6;
      g.fillStyle(0x3a8a3a);
      g.fillPoints(Array.from({ length: 12 }, (_, i) => {
        const t = a + 0.5 + (i / 11) * (Math.PI * 2 - 1);
        return { x: x + Math.cos(t) * r, y: y + Math.sin(t) * r * 0.6 };
      }).concat([{ x, y }]), true);
      if (hash01(j, cy, cx) < 0.25) disc(g, x, y - 1, 1.4, 0xf0b0d8);
    }
  }
}
const SHORE_PIECES = new Map<string, StandingPiece[]>();
/** Giant-leaved plants, bamboo and the odd tree along the river bank, clear of the path. */
function shorePieces(map: MapDefinition): readonly StandingPiece[] {
  const cached = SHORE_PIECES.get(map.id);
  if (cached) return cached;
  const list: StandingPiece[] = [],
    path = map.path.map((p) => ({ x: (p.x + 0.5) * CELL, y: (p.y + 0.5) * CELL }));
  if (seaCells(map).size)
    for (const s of shoreLine(map, 3, 30)) {
      const rand = mulberry32(fnv(`${map.id}:bank:${Math.round(s.x)}:${Math.round(s.y)}`)),
        roll = rand();
      if (roll > 0.55 || path.some((p) => (p.x - s.x) ** 2 + (p.y - s.y) ** 2 < 44 * 44)) continue;
      if (roll < 0.1) {
        const t = treeOf(rand, 0.8);
        list.push({ x: s.x, y: s.y, shadow: (g) => treeShadow(g, s.x, s.y, t), draw: (g) => drawTree(g, s.x, s.y, t) });
      } else if (roll < 0.2) {
        const b = bambooOf(rand);
        list.push({ x: s.x, y: s.y, shadow: (g) => bambooShadow(g, s.x, s.y), draw: (g) => drawBamboo(g, s.x, s.y, b) });
      } else {
        const l = small(leafyOf(rand));
        list.push({ x: s.x, y: s.y, shadow: () => undefined, draw: (g) => drawLeafy(g, s.x, s.y, l) });
      }
    }
  SHORE_PIECES.set(map.id, list);
  return list;
}

// ── Landmarks ───────────────────────────────────────────────────────────────────────────────────────────────────────
function scaled(g: Ink, x: number, y0: number, k: number, draw: () => void) {
  g.save();
  g.translateCanvas(x, y0);
  g.scaleCanvas(k, k);
  draw();
  g.restore();
}
const landmarkGround = (x: number, y: number, s: number) => ({ y0: y + s * 0.3, k: s / CELL });

// ── Theme ───────────────────────────────────────────────────────────────────────────────────────────────────────────
export const jungle: Theme = {
  backdrop: 0x08140a,
  ground: [0x0f2412, 0x0d2010],
  grid: 0x1c3a20,
  path: { edge: 0x1a3a1a, bed: MUD, line: 0xb6ff6a, arrow: 0xd8ffa0 },
  accent: ACCENT,
  drawPath: drawTrail,
  sea: drawRiver,
  obstacle: (g, x, y, rand) => {
    const p = pieceOf(rand),
      { gx, gy } = groundOf(x, y);
    if (p.kind === "tree") {
      drawTree(g, gx, gy - 4, p.tree);
      drawLeafy(g, gx + 9, gy + 6, small(p.leafy));
    } else if (p.kind === "leafy") drawLeafy(g, gx, gy, p.leafy);
    else if (p.kind === "ruin") drawRuin(g, gx, gy - 2, p.ruin);
    else if (p.kind === "log") {
      drawLeafy(g, gx - 8, gy - 8, small(p.leafy));
      drawLog(g, gx, gy, p.log);
    } else if (p.kind === "head") drawHead(g, gx, gy - 2, p.a);
    else drawBamboo(g, gx, gy, p.bamboo);
  },
  tilted: {
    shadow: (g, x, y, rand) => {
      const p = pieceOf(rand),
        { gx, gy } = groundOf(x, y);
      if (p.kind === "tree") treeShadow(g, gx, gy - 4, p.tree);
      else if (p.kind === "leafy") leafyShadow(g, gx, gy);
      else if (p.kind === "ruin") ruinShadow(g, gx, gy - 2, p.ruin);
      else if (p.kind === "log") logShadow(g, gx, gy, p.log);
      else if (p.kind === "head") headShadow(g, gx, gy - 2, p.a);
      else bambooShadow(g, gx, gy);
    },
    landmark: (g, x, y, s, variant) => {
      const { y0, k } = landmarkGround(x, y, s);
      scaled(g, x, y0, k, () => (variant ? figShadow(g) : pyramidShadow(g)));
      scaled(g, x, y0, k, () => (variant ? drawFig(g) : drawPyramid(g)));
    },
    // A glyph fire burns in the pyramid's shrine; fungus glows at the fig's foot and fireflies circle its crown.
    landmarkLight: (g, glow, x, y, s, variant, clock, lit) => {
      const { y0, k } = landmarkGround(x, y, s);
      if (variant) {
        for (const [u, v] of FIG_FUNGUS) {
          const on = 0.6 + 0.4 * Math.sin(clock * 1.4 + u);
          disc(g, x + u * k, y0 + v * k, 1.8 * k, 0xc8ff9a, 0.5 + 0.5 * on);
          halo(glow, x + u * k, y0 + v * k, 9 * k, ACCENT, 0.2 * on * lit);
        }
        for (let i = 0; i < 6; i++) {
          const t = clock * (0.4 + i * 0.07) + i * 1.3,
            fx = x + Math.cos(t) * (26 + i * 3) * k,
            fy = Y(y0, Math.sin(t) * 14 * k, (42 + Math.sin(t * 1.7) * 8) * k),
            on = 0.5 + 0.5 * Math.sin(clock * 2 + i * 2);
          disc(g, fx, fy, 1.2 * k, 0xf4ffb0, 0.4 + 0.6 * on);
          disc(glow, fx, fy, 5 * k, 0xd8ff7a, 0.2 * on * lit);
        }
        return;
      }
      const sy = Y(y0, 7 * k, (SHRINE.h - 4) * k),
        on = 0.75 + 0.25 * Math.sin(clock * 7 + x) * Math.sin(clock * 3.1);
      g.fillStyle(0xd8ffa0, 0.8 * on);
      g.fillTriangle(x - 2 * k, sy + 2 * k, x + 2 * k, sy + 2 * k, x + Math.sin(clock * 6) * k, sy - 3 * k);
      halo(glow, x, sy, 16 * k, ACCENT, 0.26 * on * lit);
    },
    extras: shorePieces,
  },
  decor: (g, x, y, rand) => {
    const kind = rand(),
      cx = x + 12 + rand() * 32,
      cy = y + 14 + rand() * 28;
    if (kind < 0.4) {
      // Fern: radiating fronds.
      g.lineStyle(1.5, 0x3a9a44, 0.85);
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.55;
        g.lineBetween(cx, cy + 4, cx + Math.cos(a) * 9, cy + 4 + Math.sin(a) * 9);
      }
    } else if (kind < 0.65) {
      // Flower on a stem.
      const petal = rand() < 0.5 ? 0xff8ac0 : 0xffd84a;
      g.lineStyle(1, 0x2f8a38, 0.9);
      g.lineBetween(cx, cy + 5, cx, cy - 1);
      for (let i = 0; i < 4; i++) disc(g, cx + Math.cos(i * 1.57) * 2.2, cy - 1 + Math.sin(i * 1.57) * 2.2, 1.6, petal, 0.9);
      disc(g, cx, cy - 1, 1, 0xfff4c0);
    } else if (kind < 0.85) {
      // Root running over the ground.
      g.lineStyle(2.5, 0x3a2a18, 0.85);
      g.strokePoints([{ x: cx - 10, y: cy + 2 }, { x: cx - 3, y: cy - 2 }, { x: cx + 4, y: cy + 2 }, { x: cx + 11, y: cy - 1 }], false);
    } else {
      // Fallen leaves.
      for (let i = 0; i < 4; i++) oval(g, cx + (rand() - 0.5) * 14, cy + (rand() - 0.5) * 8, 2.4, 1.2, rand() < 0.5 ? 0x6a5a2a : 0x3a5a24, 0.85, rand() * 3);
    }
  },
  // Glyphs pulsing on the temple blocks and in the stone heads' eyes, fungus glowing on logs, fireflies and mist.
  ambient: ({ g, glow, lit, map, clock, hash, blocked, still }) => {
    for (const b of blocked) {
      const p = pieceAt(map, b.x, b.y),
        { gx, gy } = groundOf(b.x * CELL, b.y * CELL),
        pulse = 0.5 + 0.5 * Math.sin(clock * 1.2 + b.x * 1.7 + b.y);
      if (p.kind === "ruin" && p.ruin.glyph) {
        const q = glyphOf(p.ruin);
        halo(glow, gx + q.x, gy - 2 + q.y, 8, ACCENT, (0.12 + 0.12 * pulse) * lit);
      } else if (p.kind === "head")
        for (const e of eyesOf(p.a)) {
          disc(g, gx + e.x, gy - 2 + e.y, 1.2, 0xd8ffa0, 0.3 + 0.6 * pulse);
          disc(glow, gx + e.x, gy - 2 + e.y, 4, ACCENT, 0.2 * pulse * lit);
        }
      else if (p.kind === "log")
        for (const c of capsOf(p.log)) disc(glow, gx + c.u, Y(gy, c.v, c.h), 4, 0xe8ffb0, 0.12 * pulse * lit);
    }
    if (!map.columns) return;
    const w = map.columns * CELL,
      h = map.rows * CELL;
    // Mist drifting low over the ground and the river.
    if (!still)
      for (let k = 0; k < Math.ceil(map.columns / 3); k++) {
        const x = ((hash01(k, 11) * w + clock * (4 + hash01(k, 12) * 4)) % (w + 200)) - 100,
          y = hash01(k, 13) * h;
        g.fillStyle(0xcfffd0, 0.035);
        fillOval(g, x, y, 180, 50);
      }
    // Fireflies.
    for (let k = 0; k < Math.ceil(map.columns * 1.2); k++) {
      const s = hash(k, 55),
        t = clock * (0.15 + s * 0.1) + s * 30,
        fx = ((s * 7.3) % 1) * w + Math.sin(t) * 22,
        fy = hash(k, 56) * h + Math.cos(t * 0.8) * 16,
        on = 0.5 + 0.5 * Math.sin(clock * 1.6 + s * 40);
      disc(glow, fx, fy, 7, 0xd8ff7a, 0.16 * on * lit);
      g.fillStyle(0xf4ffb0, 0.35 + 0.5 * on);
      fillRound(g, fx, fy, 1.4);
    }
    // Ripples on the river.
    const n = CELL / SEA_TILE;
    for (const [key, depths] of seaField(map, SHORE)) {
      const [cx, cy] = key.split(",").map(Number),
        tx = Math.floor(hash01(cx, cy, 70) * n),
        ty = Math.floor(hash01(cy, cx, 71) * n);
      if (depths[ty * n + tx] < 12) continue;
      const life = (clock * 0.3 + hash01(cx, cy, 72)) % 1;
      g.lineStyle(0.8, 0x9adab0, 0.25 * (1 - life));
      strokeOval(g, cx * CELL + tx * SEA_TILE, cy * CELL + ty * SEA_TILE, 6 + life * 24, (6 + life * 24) * SQUASH);
    }
  },
};
