import { CELL, disc, hash01, type Ink, oval, shade } from "../shapes";
import { SQUASH, Y } from "../tower-art/tilt";
import { cellRandom, mulberry32, type Random, type StandingPiece, type Theme } from "./kit";
import { CHANNEL_STEP, channelOf, SEA_TILE, seaCells, seaField, shoreLine, wobble } from "../coast";
import { blend } from "../ground";
import { halo } from "../material";
import { fnv } from "../../core/hash";
import type { MapDefinition } from "../../core/types";
import type { Crystal } from "./shard-props";
import {
  boulderCracks, boulderOf, boulderShadow, BRAZIER_FIRE, brazierShadow, columnsOf, columnsShadow, CONE_CRATER, coneShadow, drawBoulder, drawBrazier,
  drawColumns, drawCone, drawFumarole, drawObsidian, drawShrine, drawTree, flame, fumaroleMouth, fumaroleShadow, MAGMA, obsidianOf, obsidianShadow,
  SHRINE_FIRE, shrineShadow, treeEmbers, treeOf, treeShadow, type Boulder, type Tree,
} from "./ember-props";

// Ember Pass: a cooling lava field at night. A crusted lava flow instead of a road: black crust plates split by
// glowing cracks; props in the towers' 3/4 tilt (`Theme.tilted`, `ember-props.ts`): basalt columns, cracked boulders,
// fumaroles, charred trees, obsidian spikes and braziers; a cinder cone and an obsidian shrine as landmarks; and
// obstacle groups at the board edge turned into a lava lake (`Theme.sea`): a molten rim, drifting crust plates with
// glowing seams, bubbles and rising sparks.

const ACCENT = 0xff7a3a;
/** Kind thresholds of the first `cellRandom` draw. */
const COLUMNS = 0.3,
  BOULDER = 0.48,
  FUMAROLE = 0.6,
  TREE = 0.72,
  OBSIDIAN = 0.86;
/** A lava shore meanders a little more than a quay. */
const SHORE = 6;

type Piece =
  | { kind: "columns"; columns: Crystal[] }
  | { kind: "boulder"; boulder: Boulder }
  | { kind: "fumarole"; s: number; boulder: Boulder }
  | { kind: "tree"; tree: Tree; obsidian: Crystal[] }
  | { kind: "obsidian"; obsidian: Crystal[] }
  | { kind: "brazier"; boulder: Boulder };
function pieceOf(rand: Random): Piece {
  const kind = rand();
  if (kind < COLUMNS) return { kind: "columns", columns: columnsOf(rand) };
  if (kind < BOULDER) return { kind: "boulder", boulder: boulderOf(rand) };
  if (kind < FUMAROLE) return { kind: "fumarole", s: 0.8 + rand() * 0.4, boulder: { ...boulderOf(rand), r: 6 } };
  if (kind < TREE) return { kind: "tree", tree: treeOf(rand), obsidian: obsidianOf(rand, 0.45) };
  if (kind < OBSIDIAN) return { kind: "obsidian", obsidian: obsidianOf(rand) };
  return { kind: "brazier", boulder: { ...boulderOf(rand), r: 7 } };
}
const groundOf = (x: number, y: number) => ({ gx: x + CELL / 2, gy: y + 36 });
/** A cell's piece rolled once per map for the ambient, from the same stream as its baked body. */
const PIECES = new Map<string, Piece>();
function pieceAt(map: MapDefinition, x: number, y: number) {
  const key = `${map.id}:${x}:${y}`;
  let p = PIECES.get(key);
  if (!p) PIECES.set(key, (p = pieceOf(cellRandom(map, x, y))));
  return p;
}

// ── Crack network ───────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Voronoi plates over the plane: one jittered seed per `cell` px block. Returns the plate's id and how close the
 * point lies to the plate's edge (the gap between the nearest and second nearest seed), so a small gap is a crack.
 */
function plateAt(seed: number, x: number, y: number, cell: number) {
  const bx = Math.floor(x / cell),
    by = Math.floor(y / cell);
  let d1 = Infinity,
    d2 = Infinity,
    id = 0;
  for (let j = by - 1; j <= by + 1; j++)
    for (let i = bx - 1; i <= bx + 1; i++) {
      const sx = (i + 0.15 + 0.7 * hash01(seed, i, j)) * cell,
        sy = (j + 0.15 + 0.7 * hash01(seed, j, i)) * cell,
        d = Math.sqrt((x - sx) ** 2 + (y - sy) ** 2);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        id = i * 7919 + j;
      } else if (d < d2) d2 = d;
    }
  return { id, edge: d2 - d1 };
}

// ── Lava crust path ─────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * The path as a crusted lava flow with rounded bends (`coast.ts` `channelOf`): a border of loose scoria, black crust
 * folded into ropes across the flow and split into plates by cracks still glowing orange underneath.
 */
function drawCrust(g: Ink, map: MapDefinition) {
  const samples = channelOf(map),
    seed = fnv(`${map.id}:crust`),
    layer = (r: number, color: number) => {
      for (let i = 0; i < samples.length; i += 2) disc(g, samples[i].x, samples[i].y, r, color);
    };
  layer(25.5, 0x2c2422);
  layer(22, 0x161010);
  layer(19.5, 0x1e1716);
  // Scoria along the border.
  for (let i = 0; i < samples.length; i++) {
    const p = samples[i],
      h = hash01(seed, i);
    if (h > 0.5) continue;
    const o = (h < 0.25 ? -1 : 1) * (22.5 + hash01(seed, i, 2) * 3);
    disc(g, p.x + p.nx * o, p.y + p.ny * o, 0.8 + h * 2, shade(0x3a302c, (hash01(seed, i, 3) - 0.5) * 0.4), 0.9);
  }
  // Ropes of crust bowed across the flow.
  for (let i = 0; i < samples.length; i += 4) {
    const p = samples[i],
      tx = p.ny,
      ty = -p.nx,
      bow = 3 + hash01(seed, i, 4) * 2;
    g.lineStyle(1.2, 0x2e2422, 0.8);
    g.strokePoints([-0.85, -0.4, 0, 0.4, 0.85].map((k) => ({ x: p.x + p.nx * 18 * k - tx * bow * (1 - k * k), y: p.y + p.ny * 18 * k - ty * bow * (1 - k * k) })), false);
  }
  // Cracks between the crust plates: a Voronoi network painted in small tiles inside the crust, each crack a dark
  // seam with the glow running in it.
  const done = new Set<number>(),
    T = 1;
  for (let i = 0; i < samples.length; i += 3) {
    const p = samples[i];
    for (let ty = Math.floor((p.y - 19) / T); ty <= Math.floor((p.y + 19) / T); ty++)
      for (let tx = Math.floor((p.x - 19) / T); tx <= Math.floor((p.x + 19) / T); tx++) {
        const key = ty * 100000 + tx,
          x = tx * T + T / 2,
          y = ty * T + T / 2;
        if (done.has(key) || (x - p.x) ** 2 + (y - p.y) ** 2 > 18.5 ** 2) continue;
        done.add(key);
        const { edge } = plateAt(seed, x, y, 26);
        if (edge < 1.1) {
          g.fillStyle(MAGMA, 0.95);
          g.fillRect(tx * T, ty * T, T, T);
        } else if (edge < 2.4) {
          g.fillStyle(0x4a1406, 0.9);
          g.fillRect(tx * T, ty * T, T, T);
        }
      }
  }
}

// ── Lava lake ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** The lava lake on the edge cells: basalt rim, a molten edge glowing bright, then dark crust plates with glowing seams. */
function drawLavaLake(g: Ink, map: MapDefinition) {
  const n = CELL / SEA_TILE,
    seed = fnv(`${map.id}:plates`);
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
        const x = cx * CELL + tx * SEA_TILE,
          d = depths[ty * n + tx];
        let c: number;
        if (d < 3) c = 0x2c2422;
        else if (d < 6) c = 0x3a1a10;
        else if (d < 12) c = blend(0xffc060, 0xff5a14, (d - 6) / 6);
        else {
          const { id, edge } = plateAt(seed, x, y, 30),
            tone = (hash01(seed, id) - 0.5) * 0.16;
          c = edge < 2.2 ? 0xffa040 : edge < 4.5 ? 0xff5a14 : edge < 6 ? 0x6a2410 : shade(blend(0x2e1a14, 0x5a2210, Math.min(1, (d - 12) / 90)), tone);
        }
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
const SHORE_PIECES = new Map<string, StandingPiece[]>();
/** Obsidian spikes and the odd charred tree along the lava shore, clear of the path. */
function shorePieces(map: MapDefinition): readonly StandingPiece[] {
  const cached = SHORE_PIECES.get(map.id);
  if (cached) return cached;
  const list: StandingPiece[] = [],
    path = map.path.map((p) => ({ x: (p.x + 0.5) * CELL, y: (p.y + 0.5) * CELL }));
  if (seaCells(map).size)
    for (const s of shoreLine(map, 3, 32)) {
      const rand = mulberry32(fnv(`${map.id}:shore:${Math.round(s.x)}:${Math.round(s.y)}`)),
        roll = rand();
      if (roll > 0.5 || path.some((p) => (p.x - s.x) ** 2 + (p.y - s.y) ** 2 < 44 * 44)) continue;
      if (roll < 0.12) {
        const t = treeOf(rand);
        list.push({ x: s.x, y: s.y, shadow: (g) => treeShadow(g, s.x, s.y, t), draw: (g) => drawTree(g, s.x, s.y, t) });
      } else {
        const o = obsidianOf(rand, 0.55 + rand() * 0.25);
        list.push({ x: s.x, y: s.y, shadow: (g) => obsidianShadow(g, s.x, s.y, o), draw: (g) => drawObsidian(g, s.x, s.y, o) });
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
/** Smoke puffs rising from (x, y), drifting right and fading. */
function smoke(g: Ink, x: number, y: number, clock: number, seed: number, size = 1, count = 4) {
  for (let i = 0; i < count; i++) {
    const life = (clock * 0.3 + i / count + hash01(seed)) % 1;
    disc(g, x + life * 10 * size + Math.sin(clock + i * 2) * 2, y - life * 30 * size, (2 + life * 6) * size, 0x5a5250, 0.22 * Math.sin(Math.PI * life));
  }
}

// ── Theme ───────────────────────────────────────────────────────────────────────────────────────────────────────────
export const ember: Theme = {
  backdrop: 0x140d0a,
  ground: [0x231b18, 0x201815],
  grid: 0x40302a,
  path: { edge: 0x2c2422, bed: 0x1e1716, line: MAGMA, arrow: ACCENT },
  accent: ACCENT,
  drawPath: drawCrust,
  sea: drawLavaLake,
  obstacle: (g, x, y, rand) => {
    const p = pieceOf(rand),
      { gx, gy } = groundOf(x, y);
    if (p.kind === "columns") drawColumns(g, gx, gy - 2, p.columns);
    else if (p.kind === "boulder") drawBoulder(g, gx, gy, p.boulder);
    else if (p.kind === "fumarole") {
      drawBoulder(g, gx - 13, gy - 6, p.boulder);
      drawFumarole(g, gx + 2, gy, p.s);
    } else if (p.kind === "tree") {
      drawObsidian(g, gx + 10, gy + 4, p.obsidian);
      drawTree(g, gx - 3, gy - 2, p.tree);
    } else if (p.kind === "obsidian") drawObsidian(g, gx, gy, p.obsidian);
    else {
      drawBoulder(g, gx + 12, gy + 4, p.boulder);
      drawBrazier(g, gx - 3, gy - 2);
    }
  },
  tilted: {
    shadow: (g, x, y, rand) => {
      const p = pieceOf(rand),
        { gx, gy } = groundOf(x, y);
      if (p.kind === "columns") columnsShadow(g, gx, gy - 2, p.columns);
      else if (p.kind === "boulder") boulderShadow(g, gx, gy, p.boulder);
      else if (p.kind === "fumarole") fumaroleShadow(g, gx + 2, gy, p.s);
      else if (p.kind === "tree") treeShadow(g, gx - 3, gy - 2, p.tree);
      else if (p.kind === "obsidian") obsidianShadow(g, gx, gy, p.obsidian);
      else brazierShadow(g, gx - 3, gy - 2);
    },
    landmark: (g, x, y, s, variant) => {
      const { y0, k } = landmarkGround(x, y, s);
      scaled(g, x, y0, k, () => (variant ? shrineShadow(g) : coneShadow(g)));
      scaled(g, x, y0, k, () => (variant ? drawShrine(g) : drawCone(g)));
    },
    // The cinder cone glows and smokes, spitting embers; the shrine's great brazier burns.
    landmarkLight: (g, glow, x, y, s, variant, clock, lit) => {
      const { y0, k } = landmarkGround(x, y, s);
      if (variant) {
        const fy = Y(y0 + 4 * k, 0, SHRINE_FIRE.h * k * 0.79);
        flame(g, x, fy, 1.8 * k, clock, x);
        halo(glow, x, fy - 6 * k, 30 * k, 0xff8a3a, (0.2 + 0.05 * Math.sin(clock * 11)) * lit);
        return;
      }
      const cy = Y(y0, 0, CONE_CRATER * k);
      halo(glow, x, cy, 26 * k, 0xff6a1a, (0.22 + 0.06 * Math.sin(clock * 2 + x)) * lit);
      smoke(g, x, cy - 4 * k, clock, x, 1.6 * k, 6);
      for (let i = 0; i < 4; i++) {
        const life = (clock * 0.7 + i / 4 + hash01(x, i)) % 1,
          a = -Math.PI / 2 + (hash01(i, Math.floor(clock * 0.7 + i / 4)) - 0.5) * 1.6;
        disc(g, x + Math.cos(a) * life * 30 * k, cy + Math.sin(a) * life * 30 * k + life * life * 30 * k, 1.4 * k, 0xffb04a, 1 - life);
      }
    },
    extras: shorePieces,
  },
  decor: (g, x, y, rand) => {
    const kind = rand(),
      cx = x + 12 + rand() * 32,
      cy = y + 12 + rand() * 32;
    if (kind < 0.35) {
      // A hairline crack still glowing.
      let px = cx - 9,
        py = cy;
      g.lineStyle(1, 0xc8501a, 0.55);
      g.beginPath();
      g.moveTo(px, py);
      for (let i = 0; i < 4; i++) {
        px += 4 + rand() * 2;
        py += (rand() - 0.5) * 6;
        g.lineTo(px, py);
      }
      g.strokePath();
    } else if (kind < 0.6) {
      // A drift of grey ash.
      oval(g, cx, cy, 8 + rand() * 6, 3 + rand() * 2, 0x4a4240, 0.45);
    } else if (kind < 0.8) {
      // Scoria pebbles.
      for (let i = 0; i < 4; i++) disc(g, cx + (rand() - 0.5) * 12, cy + (rand() - 0.5) * 8, 0.9 + rand() * 1.2, rand() < 0.5 ? 0x4a3c38 : 0x2e2624, 0.9);
    } else {
      // A coal still burning.
      disc(g, cx, cy, 2.2, 0x3a1408, 0.9);
      disc(g, cx, cy, 1.2, 0xff8a3a, 0.9);
    }
  },
  // Heat pulses along the crust, smoke from the fumaroles, embers on the trees, braziers burning, cracks breathing,
  // and on the lava lake bubbles, drifting heat and sparks.
  ambient: ({ g, glow, lit, map, clock, blocked }) => {
    for (const b of blocked) {
      const p = pieceAt(map, b.x, b.y),
        { gx, gy } = groundOf(b.x * CELL, b.y * CELL);
      if (p.kind === "fumarole") {
        const my = Y(gy, 0, fumaroleMouth(p.s));
        halo(glow, gx + 2, my, 10 * p.s, 0xff6a1a, (0.18 + 0.06 * Math.sin(clock * 3 + b.x)) * lit);
        smoke(g, gx + 2, my - 2, clock, b.x * 7 + b.y, p.s);
      } else if (p.kind === "tree")
        for (const e of treeEmbers(p.tree)) {
          const on = 0.5 + 0.5 * Math.sin(clock * 2.3 + e.u * 3 + e.h);
          disc(g, gx - 3 + e.u, Y(gy - 2, e.v, e.h), 1.1, 0xff9a3a, 0.4 + 0.6 * on);
          disc(glow, gx - 3 + e.u, Y(gy - 2, e.v, e.h), 3, 0xff7a2a, 0.2 * on * lit);
        }
      else if (p.kind === "brazier") {
        flame(g, gx - 3, Y(gy - 2, 0, BRAZIER_FIRE), 1, clock, b.x * 3 + b.y);
        halo(glow, gx - 3, Y(gy - 2, 0, BRAZIER_FIRE + 4), 12, 0xff8a3a, (0.12 + 0.04 * Math.sin(clock * 12 + b.x)) * lit);
      } else if (p.kind === "boulder") {
        const on = 0.5 + 0.5 * Math.sin(clock * 1.1 + b.x * 2 + b.y);
        for (const line of boulderCracks(p.boulder)) {
          glow.lineStyle(3, MAGMA, 0.15 * on * lit);
          glow.strokePoints(line.map((q) => ({ x: gx + q.x, y: gy + q.y })), false);
        }
      }
    }
    if (!map.columns) return;
    const samples = channelOf(map),
      total = samples[samples.length - 1].s;
    for (let k = 0; k * 150 < total; k++) {
      const s = (k * 150 + clock * 30) % total,
        p = samples[Math.min(samples.length - 1, Math.floor(s / CHANNEL_STEP))];
      halo(glow, p.x, p.y, 16, 0xff6a1a, 0.18 * lit);
    }
    // The lava lake: bubbles swelling and popping, heat drifting, sparks rising.
    const n = CELL / SEA_TILE;
    for (const [key, depths] of seaField(map, SHORE)) {
      const [cx, cy] = key.split(",").map(Number);
      for (let j = 0; j < 2; j++) {
        const tx = Math.floor(hash01(cx, cy, j) * n),
          ty = Math.floor(hash01(cy, cx, j + 5) * n);
        if (depths[ty * n + tx] < 14) continue;
        const x = cx * CELL + tx * SEA_TILE,
          y = cy * CELL + ty * SEA_TILE,
          life = (clock * 0.5 + hash01(j, cx, cy)) % 1;
        if (life < 0.8) {
          const r = 1 + life * 4;
          oval(g, x, y, r, r * SQUASH, 0xffb04a, 0.8);
          oval(g, x - r * 0.3, y - r * 0.3 * SQUASH, r * 0.4, r * 0.25, 0xffe0a0, 0.8);
        } else disc(glow, x, y, 6, 0xffb04a, 0.4 * (1 - life) * 5 * lit);
        const spark = (clock * 0.4 + hash01(cx, j, cy)) % 1;
        disc(g, x + spark * 6, y - spark * 40, 1, 0xffc070, 1 - spark);
      }
      if (hash01(cx, cy, 9) < 0.4) halo(glow, (cx + 0.5) * CELL + Math.sin(clock * 0.3 + cx) * 10, (cy + 0.5) * CELL, 40, 0xff5a14, 0.08 * lit);
    }
  },
};
