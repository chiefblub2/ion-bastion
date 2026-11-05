import { CELL, disc, fillOval, hash01, type Ink, oval, shade, strokeOval } from "../shapes";
import { SQUASH, Y } from "../tower-art/tilt";
import { cellRandom, mulberry32, type Random, type StandingPiece, type Theme } from "./kit";
import { channelOf, SEA_TILE, seaCells, seaField, shoreLine } from "../coast";
import { blend } from "../ground";
import { halo } from "../material";
import { fnv } from "../../core/hash";
import type { MapDefinition } from "../../core/types";
import {
  barrelsOf, barrelsShadow, digesterShadow, drawBarrels, drawDigester, drawFungus, drawPumpHouse, drawReeds, drawTank, drawTree, FLARE, fungusOf,
  fungusShadow, GOO, leakOf, pumpHouseShadow, reedsOf, reedsShadow, STACKS, tankDrip, tankOf, tankShadow, treeOf, treeShadow, type Barrel, type Cap,
  type Reed, type Tank, type Tree,
} from "./toxic-props";

// Toxic Marsh: a poisoned swamp by a chemical works at dusk. A rotten plank boardwalk over a sludge channel instead
// of a road; props in the towers' 3/4 tilt (`Theme.tilted`, `toxic-props.ts`): leaking waste barrels, dead trees hung
// with moss, glowing fungus, rusted chemical tanks and cattails; a digester tower with a burning flare and a pump house
// as landmarks; obstacle groups at the board edge turned into sludge lakes (`Theme.sea`) with an oily sheen and scum;
// and green fog drifting over everything.

const ACCENT = GOO;
/** Kind thresholds of the first `cellRandom` draw. */
const BARRELS = 0.28,
  TREE = 0.48,
  FUNGUS = 0.64,
  TANK = 0.78;
/** A sludge shore meanders. */
const SHORE = 7;

type Piece =
  | { kind: "barrels"; barrels: Barrel[] }
  | { kind: "tree"; tree: Tree; reeds: Reed[] }
  | { kind: "fungus"; caps: Cap[] }
  | { kind: "tank"; tank: Tank }
  | { kind: "reeds"; reeds: Reed[]; barrels: Barrel[] };
function pieceOf(rand: Random): Piece {
  const kind = rand();
  if (kind < BARRELS) return { kind: "barrels", barrels: barrelsOf(rand) };
  if (kind < TREE) return { kind: "tree", tree: treeOf(rand), reeds: reedsOf(rand).slice(0, 5).map((r) => ({ ...r, u: r.u * 0.6 + 12, v: r.v * 0.6 + 6 })) };
  if (kind < FUNGUS) return { kind: "fungus", caps: fungusOf(rand) };
  if (kind < TANK) return { kind: "tank", tank: tankOf(rand) };
  return { kind: "reeds", reeds: reedsOf(rand), barrels: rand() < 0.4 ? [{ du: 9, dv: 6, color: 0x3a5a6a, lying: 2.4 }] : [] };
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

// ── Boardwalk ───────────────────────────────────────────────────────────────────────────────────────────────────────
const SLUDGE = 0x2a3a14;
/**
 * The path as a boardwalk with rounded bends (`coast.ts` `channelOf`): a muddy bank, a channel of sludge, and across
 * it weathered planks on two stringers, each plank its own tone, some cracked, a few missing; green slime in the gaps.
 */
function drawBoardwalk(g: Ink, map: MapDefinition) {
  const samples = channelOf(map),
    seed = fnv(`${map.id}:boards`),
    layer = (r: number, color: number) => {
      for (let i = 0; i < samples.length; i += 2) disc(g, samples[i].x, samples[i].y, r, color);
    },
    along = (o: number) => samples.map((p) => ({ x: p.x + p.nx * o, y: p.y + p.ny * o }));
  layer(26, 0x2a2818);
  layer(23.5, 0x3a4a1a);
  layer(22, SLUDGE);
  // Slime glints on the sludge.
  for (let i = 0; i < samples.length; i += 5) {
    const p = samples[i],
      o = (hash01(seed, i) < 0.5 ? -1 : 1) * (18 + hash01(seed, i, 1) * 3);
    oval(g, p.x + p.nx * o, p.y + p.ny * o, 2 + hash01(seed, i, 2) * 3, 1.2, 0x6f8f2a, 0.7);
  }
  // Stringers under the planks.
  for (const side of [-1, 1]) {
    g.lineStyle(3, 0x1e1a10, 1);
    g.strokePoints(along(side * 11), false);
  }
  // Planks: one every 9 px of path, about 34 px long, each its own tone, a few missing.
  for (let i = 0; i < samples.length; i += 3) {
    const p = samples[i],
      h = hash01(seed, i, 3);
    if (h < 0.94) {
      const tx = p.ny,
        ty = -p.nx,
        l0 = -16 - hash01(seed, i, 4) * 1.5,
        l1 = 16 + hash01(seed, i, 5) * 1.5,
        tone = (hash01(seed, i, 6) - 0.5) * 0.3,
        color = shade(h < 0.15 ? 0x4a4a32 : 0x5a4a32, tone),
        plank = (a: number, b: number, w0: number, w1: number) =>
          [[a, w0], [b, w0], [b, w1], [a, w1]].map(([n, t]) => ({ x: p.x + p.nx * n + tx * t, y: p.y + p.ny * n + ty * t }));
      g.fillStyle(0x14120a, 0.9);
      g.fillPoints(plank(l0 - 0.5, l1 + 0.5, -3.4, 3.8), true);
      g.fillStyle(color);
      g.fillPoints(plank(l0, l1, -3, 3), true);
      g.fillStyle(shade(color, 0.2));
      g.fillPoints(plank(l0, l1, -3, -2), true);
      // A crack along some planks, nail heads at the stringers.
      if (hash01(seed, i, 7) < 0.25) {
        g.lineStyle(0.6, 0x1e1a10, 0.9);
        g.lineBetween(p.x + p.nx * l0 * 0.6 + tx * 0.3, p.y + p.ny * l0 * 0.6 + ty * 0.3, p.x + p.nx * l1 * 0.2, p.y + p.ny * l1 * 0.2);
      }
      for (const o of [-11, 11]) disc(g, p.x + p.nx * o, p.y + p.ny * o, 0.6, 0x8a8a7a, 0.9);
    }
  }
}

// ── Sludge lake ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** Sludge by distance from the shore: mud, a crust of dried waste, green scum, then dark sludge with an oily sheen. */
function drawSludgeLake(g: Ink, map: MapDefinition) {
  const n = CELL / SEA_TILE,
    seed = fnv(`${map.id}:sheen`);
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
        if (d < 3) c = 0x2a2818;
        else if (d < 6) c = 0x4a4a28;
        else if (d < 8) c = blend(0x4e6a1a, 0x34480f, (d - 6) / 2);
        else {
          // Oily patches: two slow waves crossed, so the sheen lies in blobs, not stripes.
          const w = Math.sin(x * 0.05 + Math.sin(y * 0.07 + hash01(seed) * 6) * 2) * Math.sin(y * 0.045 + Math.sin(x * 0.03) * 2),
            base = blend(0x1e2c0a, 0x131c06, Math.min(1, (d - 8) / 60));
          c = w > 0.82 ? blend(base, 0x3a4a3a, 0.5) : w > 0.6 ? blend(base, 0x2e3a28, 0.35) : base;
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
    // Patches of pale scum.
    for (let j = 0; j < 1; j++) {
      const tx = Math.floor(hash01(cx, cy, j + 11) * n),
        ty = Math.floor(hash01(cy, cx, j + 13) * n);
      if (depths[ty * n + tx] < 14) continue;
      const x = cx * CELL + tx * SEA_TILE,
        y = cy * CELL + ty * SEA_TILE;
      for (let i = 0; i < 3; i++) oval(g, x + (hash01(cx, i, j) - 0.5) * 14, y + (hash01(cy, i, j) - 0.5) * 6, 2 + hash01(i, cx, cy) * 3, 1.2, 0x6a7a4a, 0.5);
    }
  }
}
const SHORE_PIECES = new Map<string, StandingPiece[]>();
/** Cattails and the odd dead tree or barrel along the sludge shore, clear of the path. */
function shorePieces(map: MapDefinition): readonly StandingPiece[] {
  const cached = SHORE_PIECES.get(map.id);
  if (cached) return cached;
  const list: StandingPiece[] = [],
    path = map.path.map((p) => ({ x: (p.x + 0.5) * CELL, y: (p.y + 0.5) * CELL }));
  if (seaCells(map).size)
    for (const s of shoreLine(map, 3, 30)) {
      const rand = mulberry32(fnv(`${map.id}:shore:${Math.round(s.x)}:${Math.round(s.y)}`)),
        roll = rand();
      if (roll > 0.5 || path.some((p) => (p.x - s.x) ** 2 + (p.y - s.y) ** 2 < 44 * 44)) continue;
      if (roll < 0.07) {
        const t = { ...treeOf(rand), h: 24 + rand() * 8 };
        list.push({ x: s.x, y: s.y, shadow: (g) => treeShadow(g, s.x, s.y, t), draw: (g) => drawTree(g, s.x, s.y, t) });
      } else if (roll < 0.12) {
        const b: Barrel[] = [{ du: 0, dv: 0, color: 0x8a7a2a, lying: rand() * 3 }];
        list.push({ x: s.x, y: s.y, shadow: () => undefined, draw: (g) => drawBarrels(g, s.x, s.y, b) });
      } else {
        const r = reedsOf(rand).slice(0, 6);
        list.push({ x: s.x, y: s.y, shadow: () => undefined, draw: (g) => drawReeds(g, s.x, s.y, r) });
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
/** Fume puffs rising from (x, y), drifting right and fading. */
function fumes(g: Ink, x: number, y: number, clock: number, seed: number, size = 1, count = 4, color = 0x8a9a6a) {
  for (let i = 0; i < count; i++) {
    const life = (clock * 0.25 + i / count + hash01(seed)) % 1;
    disc(g, x + life * 14 * size + Math.sin(clock + i * 2) * 2 * size, y - life * 28 * size, (2.5 + life * 7) * size, color, 0.2 * Math.sin(Math.PI * life));
  }
}
/** A green gas flare: tongues of flame swaying with the clock. */
function greenFlame(g: Ink, x: number, y: number, s: number, clock: number, seed: number) {
  for (let i = 0; i < 3; i++) {
    const sway = Math.sin(clock * 8 + seed + i * 2.1) * 1.8 * s,
      h = (8 + 3 * Math.sin(clock * 12 + seed * 3 + i)) * s,
      w = (3 - i * 0.7) * s,
      cx = x + (i - 1) * 1.6 * s;
    g.fillStyle([0x4a9a1a, 0x9af04a, 0xe8ffb0][i], 0.9);
    g.fillTriangle(cx - w, y, cx + w, y, cx + sway, y - h + i * 1.4 * s);
  }
}

// ── Theme ───────────────────────────────────────────────────────────────────────────────────────────────────────────
export const toxic: Theme = {
  backdrop: 0x0f140c,
  ground: [0x182014, 0x151c11],
  grid: 0x3a4a2c,
  path: { edge: 0x3a4a1a, bed: SLUDGE, line: 0xb6f04a, arrow: 0xc4f562 },
  accent: ACCENT,
  drawPath: drawBoardwalk,
  sea: drawSludgeLake,
  obstacle: (g, x, y, rand) => {
    const p = pieceOf(rand),
      { gx, gy } = groundOf(x, y);
    if (p.kind === "barrels") drawBarrels(g, gx, gy, p.barrels);
    else if (p.kind === "tree") {
      drawTree(g, gx - 4, gy - 2, p.tree);
      drawReeds(g, gx, gy, p.reeds);
    } else if (p.kind === "fungus") drawFungus(g, gx, gy, p.caps);
    else if (p.kind === "tank") drawTank(g, gx, gy, p.tank);
    else {
      drawReeds(g, gx, gy, p.reeds);
      drawBarrels(g, gx, gy, p.barrels);
    }
  },
  tilted: {
    shadow: (g, x, y, rand) => {
      const p = pieceOf(rand),
        { gx, gy } = groundOf(x, y);
      if (p.kind === "barrels") barrelsShadow(g, gx, gy, p.barrels);
      else if (p.kind === "tree") treeShadow(g, gx - 4, gy - 2, p.tree);
      else if (p.kind === "fungus") fungusShadow(g, gx, gy, p.caps);
      else if (p.kind === "tank") tankShadow(g, gx, gy, p.tank);
      else reedsShadow(g, gx, gy);
    },
    landmark: (g, x, y, s, variant) => {
      const { y0, k } = landmarkGround(x, y, s);
      scaled(g, x, y0, k, () => (variant ? pumpHouseShadow(g) : digesterShadow(g)));
      scaled(g, x, y0, k, () => (variant ? drawPumpHouse(g) : drawDigester(g)));
    },
    // The digester's flare burns green; the pump house's stacks fume and its window glows.
    landmarkLight: (g, glow, x, y, s, variant, clock, lit) => {
      const { y0, k } = landmarkGround(x, y, s);
      if (variant) {
        for (const st of STACKS) fumes(g, x + st.u * k, Y(y0, st.v * k, st.h * k), clock, x + st.u, 1.4 * k, 5);
        halo(glow, x + 8 * k, Y(y0, 14 * k, 16 * k), 12 * k, 0xd8e070, 0.18 * lit);
        return;
      }
      const fx = x + FLARE.u * k,
        fy = Y(y0, -6 * k, FLARE.h * k);
      greenFlame(g, fx, fy, 1.4 * k, clock, x);
      halo(glow, fx, fy - 6 * k, 26 * k, ACCENT, (0.22 + 0.06 * Math.sin(clock * 9 + x)) * lit);
      fumes(g, fx, fy - 12 * k, clock, x, 1.2 * k, 4, 0x4a5a3a);
    },
    extras: shorePieces,
  },
  decor: (g, x, y, rand) => {
    const kind = rand(),
      cx = x + 10 + rand() * 36,
      cy = y + 10 + rand() * 36;
    if (kind < 0.35) {
      // A sludge puddle with a glint.
      oval(g, cx, cy, 8 + rand() * 6, 3.5 + rand() * 2, 0x24321a, 0.95);
      oval(g, cx - 2, cy - 1, 3, 1, 0x5e7a22, 0.6);
    } else if (kind < 0.6) {
      // Dead leaves and pebbles.
      for (let i = 0; i < 4; i++) disc(g, cx + (rand() - 0.5) * 14, cy + (rand() - 0.5) * 10, 1.2 + rand(), rand() < 0.5 ? 0x3a4a22 : 0x4a3a22, 0.9);
    } else if (kind < 0.8) {
      // A tuft of sedge.
      g.lineStyle(1, 0x4a5a24, 0.9);
      for (let i = 0; i < 5; i++) g.lineBetween(cx + i * 1.5 - 3, cy, cx + (i - 2) * 2.4, cy - 5 - rand() * 4);
    } else {
      // A burst bag of chemical powder.
      oval(g, cx, cy, 6, 3, 0x8a8a6a, 0.5);
      g.fillStyle(0xd8d8c0, 0.85);
      g.fillPoints([{ x: cx - 4, y: cy - 1 }, { x: cx + 3, y: cy - 3 }, { x: cx + 4, y: cy + 1 }, { x: cx - 3, y: cy + 2 }], true);
    }
  },
  // Fungus glowing and breathing, drips from the barrels and tanks, bubbles through the boardwalk's gaps, bubbles and
  // fumes over the sludge lakes, and green fog drifting across the marsh.
  ambient: ({ g, glow, lit, map, clock, blocked, still }) => {
    for (const b of blocked) {
      const p = pieceAt(map, b.x, b.y),
        { gx, gy } = groundOf(b.x * CELL, b.y * CELL);
      if (p.kind === "fungus")
        for (const c of p.caps) {
          const on = 0.6 + 0.4 * Math.sin(clock * 1.3 + c.u + b.x);
          disc(glow, gx + c.u, Y(gy + c.v * SQUASH, 0, c.h + c.r * 0.4), c.r * 1.8, c.color, 0.12 * on * lit);
        }
      else if (p.kind === "barrels" || p.kind === "tank") {
        const at = p.kind === "tank" ? tankDrip(p.tank) : leakOf(p.barrels),
          x = gx + at.u,
          y = gy + at.v * SQUASH,
          life = (clock * 0.8 + hash01(b.x, b.y)) % 1;
        disc(g, x, y - 6 + life * 6, 1, GOO, 0.9 * (1 - life));
        g.lineStyle(0.8, GOO, 0.5 * (1 - life));
        strokeOval(g, x, y + 2, 4 + life * 10, (4 + life * 10) * 0.5);
        halo(glow, x, y + 2, 8, ACCENT, 0.08 * lit);
      }
    }
    if (!map.columns) return;
    const samples = channelOf(map);
    // Bubbles rising between the planks.
    for (let i = 7; i < samples.length; i += 23) {
      const p = samples[i],
        life = (clock * 0.7 + hash01(i, 3)) % 1,
        o = (hash01(i, 5) - 0.5) * 30;
      g.lineStyle(1, 0xc4f562, 0.6 * (1 - life));
      strokeOval(g, p.x + p.nx * o, p.y + p.ny * o, 2 + life * 5, 2 + life * 5);
    }
    // Bubbles and fumes on the sludge lakes.
    const n = CELL / SEA_TILE;
    for (const [key, depths] of seaField(map, SHORE)) {
      const [cx, cy] = key.split(",").map(Number);
      for (let j = 0; j < 2; j++) {
        const tx = Math.floor(hash01(cx, cy, j) * n),
          ty = Math.floor(hash01(cy, cx, j + 5) * n);
        if (depths[ty * n + tx] < 12) continue;
        const x = cx * CELL + tx * SEA_TILE,
          y = cy * CELL + ty * SEA_TILE,
          life = (clock * 0.45 + hash01(j, cx, cy)) % 1;
        if (life < 0.8) {
          const r = 1 + life * 4;
          oval(g, x, y, r, r * SQUASH, 0x6f8f2a, 0.9);
          oval(g, x - r * 0.3, y - r * 0.3 * SQUASH, r * 0.35, r * 0.2, 0xd8ff8a, 0.7);
        } else disc(glow, x, y, 6, ACCENT, 0.3 * (1 - life) * 5 * lit);
      }
      if (hash01(cx, cy, 9) < 0.3) halo(glow, (cx + 0.5) * CELL, (cy + 0.5) * CELL, 34, ACCENT, 0.05 * lit);
    }
    // Green fog banks drifting slowly across the board.
    if (still) return;
    const w = map.columns * CELL,
      h = map.rows * CELL;
    for (let k = 0; k < Math.ceil(map.columns / 3); k++) {
      const x = ((hash01(k, 1) * w + clock * (6 + hash01(k, 2) * 6)) % (w + 240)) - 120,
        y = hash01(k, 3) * h;
      g.fillStyle(0x9aba6a, 0.045);
      fillOval(g, x, y, 220 + hash01(k, 4) * 120, 60 + hash01(k, 5) * 30);
    }
  },
};
