import { CELL, disc, fillOval, hash01, type Ink, oval, strokeOval } from "../shapes";
import { SQUASH, Y } from "../tower-art/tilt";
import { cellRandom, mulberry32, type Random, type StandingPiece, type Theme } from "./kit";
import { CHANNEL_STEP, channelOf, SEA_TILE, seaCells, seaField, shoreLine } from "../coast";
import { blend } from "../ground";
import { halo } from "../material";
import { fnv } from "../../core/hash";
import type { MapDefinition } from "../../core/types";
import {
  boatOf, boatShadow, drawBoat, drawDrift, drawHut, drawLighthouse, drawPool, drawPosts, drawStack, driftOf, driftShadow, HUT, LIGHT, lighthouseShadow,
  hutShadow, MOON, poolOf, poolShadow, postLantern, postsOf, postsShadow, stackOf, stackShadow, type Boat, type Drift, type Pool, type Posts, type Stack,
} from "./tide-props";

// Moon Lake: a tidal flat under a full moon, grey-blue sand silvered by moonlight. A shallow tidal channel instead of
// the sunken track: wet sand banks, dark water with a silver glitter road under the moon, ripples and foam; props in
// the towers' 3/4 tilt (`Theme.tilted`, `tide-props.ts`): barnacled sea stacks, tidepools, driftwood, mooring posts
// with a lantern and beached rowboats with creels; a lighthouse whose beam turns and a fisher's hut on stilts as
// landmarks; and obstacle groups at the board edge turned into the open lake (`Theme.sea`) with the moon's glitter on
// its swell. Its Circuit maps hold no obstacles at all, so the channel, the decor and the ambient carry the look.

const ACCENT = 0xbcd6f0;
/** Kind thresholds of the first `cellRandom` draw. */
const STACK = 0.3,
  POOL_KIND = 0.5,
  DRIFT = 0.66,
  POSTS = 0.8;
/** The lake's shore meanders like a coast. */
const SHORE = 7;

type Piece =
  | { kind: "stack"; stack: Stack }
  | { kind: "pool"; pool: Pool }
  | { kind: "drift"; drift: Drift }
  | { kind: "posts"; posts: Posts }
  | { kind: "boat"; boat: Boat };
function pieceOf(rand: Random): Piece {
  const kind = rand();
  if (kind < STACK) return { kind: "stack", stack: stackOf(rand) };
  if (kind < POOL_KIND) return { kind: "pool", pool: poolOf(rand) };
  if (kind < DRIFT) return { kind: "drift", drift: driftOf(rand) };
  if (kind < POSTS) return { kind: "posts", posts: postsOf(rand) };
  return { kind: "boat", boat: boatOf(rand) };
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
/** The moon's direction on the board: its glitter lies down the screen from it, a little to the right. */
const GLITTER = { dx: 0.18, dy: 1 } as const;

// ── Tidal channel ───────────────────────────────────────────────────────────────────────────────────────────────────
const WATER = 0x0c1c30;
/**
 * The path as a shallow tidal channel with rounded bends (`coast.ts` `channelOf`): wet sand banks darkening to the
 * waterline, a fringe of foam, dark water with soft ripples across it and the moon's glitter scattered on it.
 */
function drawChannel(g: Ink, map: MapDefinition) {
  const samples = channelOf(map),
    seed = fnv(`${map.id}:channel`),
    layer = (r: number, color: number) => {
      for (let i = 0; i < samples.length; i += 2) disc(g, samples[i].x, samples[i].y, r, color);
    },
    along = (o: number) => samples.map((p) => ({ x: p.x + p.nx * o, y: p.y + p.ny * o }));
  layer(26, 0x2a3e54);
  layer(23.5, 0x1e3248);
  layer(21.5, 0x16304a);
  layer(19, WATER);
  // A lighter shallow band along each bank and the foam line between it and the sand.
  for (const side of [-1, 1]) {
    g.lineStyle(4, 0x1a3a58, 0.8);
    g.strokePoints(along(side * 16.5), false);
    g.lineStyle(1, 0xc8dcea, 0.35);
    g.strokePoints(along(side * 20.5), false);
  }
  // Ripples bowed across the flow.
  for (let i = 0; i < samples.length; i += 5) {
    const p = samples[i],
      tx = p.ny,
      ty = -p.nx,
      bow = 2 + hash01(seed, i) * 2,
      o = (hash01(seed, i, 2) - 0.5) * 18;
    g.lineStyle(0.8, 0x3a5a7c, 0.5);
    g.strokePoints([-0.5, -0.2, 0, 0.2, 0.5].map((k) => ({ x: p.x + p.nx * (o + 14 * k) + tx * bow * (1 - 4 * k * k), y: p.y + p.ny * (o + 14 * k) + ty * bow * (1 - 4 * k * k) })), false);
  }
  // Pebbles and shells on the wet banks.
  for (let i = 0; i < samples.length; i += 4) {
    const p = samples[i],
      h = hash01(seed, i, 3);
    if (h > 0.4) continue;
    const o = (h < 0.2 ? -1 : 1) * (22.5 + hash01(seed, i, 4) * 3);
    disc(g, p.x + p.nx * o, p.y + p.ny * o, 0.8 + h * 2.5, h < 0.1 ? 0xdbe7f2 : 0x4a6a88, 0.9);
  }
}

// ── Lake ────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** The open lake on the edge cells: sand, a foam edge, shallows, then dark water with a band of swell. */
function drawLake(g: Ink, map: MapDefinition) {
  const n = CELL / SEA_TILE,
    seed = fnv(`${map.id}:lake`);
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
        if (d < 3) c = 0x2a3e54;
        else if (d < 4.5) c = 0x8aa4bc;
        else if (d < 10) c = blend(0x1e4060, 0x14304a, (d - 4.5) / 5.5);
        else {
          const swell = Math.sin(y * 0.09 + Math.sin(x * 0.02 + hash01(seed) * 6) * 2.5);
          c = blend(swell > 0.85 ? 0x1a3a58 : 0x0e2238, 0x08162a, Math.min(1, (d - 10) / 70));
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
/** Stones, driftwood and the odd mooring post along the lake shore, clear of the path. */
function shorePieces(map: MapDefinition): readonly StandingPiece[] {
  const cached = SHORE_PIECES.get(map.id);
  if (cached) return cached;
  const list: StandingPiece[] = [],
    path = map.path.map((p) => ({ x: (p.x + 0.5) * CELL, y: (p.y + 0.5) * CELL }));
  if (seaCells(map).size)
    for (const s of shoreLine(map, 1, 38)) {
      const rand = mulberry32(fnv(`${map.id}:shore:${Math.round(s.x)}:${Math.round(s.y)}`)),
        roll = rand();
      if (roll > 0.4 || path.some((p) => (p.x - s.x) ** 2 + (p.y - s.y) ** 2 < 44 * 44)) continue;
      if (roll < 0.14) {
        const d = { ...driftOf(rand), len: 10, r: 2.4, branch: 0 };
        list.push({ x: s.x, y: s.y, shadow: (g) => driftShadow(g, s.x, s.y, d), draw: (g) => drawDrift(g, s.x, s.y, d) });
      } else if (roll < 0.2) {
        const p = { list: [{ u: 0, v: 0, h: 18 + rand() * 8 }, { u: 6, v: 3, h: 12 }], lantern: false };
        list.push({ x: s.x, y: s.y, shadow: (g) => postsShadow(g, s.x, s.y, p), draw: (g) => drawPosts(g, s.x, s.y, p) });
      } else {
        const st = { tiers: [{ r: 5 + rand() * 3, h: 5 + rand() * 3, du: 0, dv: 0 }], seed: Math.floor(rand() * 1e6) };
        list.push({ x: s.x, y: s.y, shadow: (g) => stackShadow(g, s.x, s.y, st), draw: (g) => drawStack(g, s.x, s.y, st) });
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
/** A sparkle of moonlight on water: a short bright dash that flashes and fades. */
function glint(g: Ink, glow: Ink, x: number, y: number, on: number, lit: number) {
  if (on <= 0.05) return;
  g.lineStyle(1, 0xf0f8ff, 0.8 * on);
  g.lineBetween(x - 2.5, y, x + 2.5, y);
  disc(glow, x, y, 3, MOON, 0.25 * on * lit);
}

// ── Theme ───────────────────────────────────────────────────────────────────────────────────────────────────────────
export const tide: Theme = {
  backdrop: 0x081322,
  ground: [0x1e3248, 0x22364d],
  grid: 0x2c4663,
  path: { edge: 0x2a3e54, bed: WATER, line: 0xbcd6f0, arrow: 0xdceaf8 },
  accent: ACCENT,
  drawPath: drawChannel,
  sea: drawLake,
  obstacle: (g, x, y, rand) => {
    const p = pieceOf(rand),
      { gx, gy } = groundOf(x, y);
    if (p.kind === "stack") drawStack(g, gx, gy, p.stack);
    else if (p.kind === "pool") drawPool(g, gx, gy - 4, p.pool);
    else if (p.kind === "drift") drawDrift(g, gx, gy - 2, p.drift);
    else if (p.kind === "posts") drawPosts(g, gx, gy, p.posts);
    else drawBoat(g, gx, gy - 2, p.boat);
  },
  tilted: {
    shadow: (g, x, y, rand) => {
      const p = pieceOf(rand),
        { gx, gy } = groundOf(x, y);
      if (p.kind === "stack") stackShadow(g, gx, gy, p.stack);
      else if (p.kind === "pool") poolShadow(g, gx, gy - 4);
      else if (p.kind === "drift") driftShadow(g, gx, gy - 2, p.drift);
      else if (p.kind === "posts") postsShadow(g, gx, gy, p.posts);
      else boatShadow(g, gx, gy - 2, p.boat);
    },
    landmark: (g, x, y, s, variant) => {
      const { y0, k } = landmarkGround(x, y, s);
      scaled(g, x, y0, k, () => (variant ? hutShadow(g) : lighthouseShadow(g)));
      scaled(g, x, y0, k, () => (variant ? drawHut(g) : drawLighthouse(g)));
    },
    // The lighthouse lamp burns and its beam sweeps round; the hut's window glows warm.
    landmarkLight: (g, glow, x, y, s, variant, clock, lit) => {
      const { y0, k } = landmarkGround(x, y, s);
      if (variant) {
        const wx = x + HUT.window.u * k,
          wy = Y(y0, HUT.window.v * k, HUT.window.h * k),
          f = 0.9 + 0.1 * Math.sin(clock * 5 + x);
        g.fillStyle(0xffd890, 0.85 * f);
        g.fillRect(wx - 2.4 * k, wy - 2.6 * k, 4.8 * k, 5 * k);
        halo(glow, wx, wy, 12 * k, 0xffc870, 0.2 * f * lit);
        return;
      }
      const lx = x,
        ly = Y(y0, 0, (LIGHT.lamp - 5) * k),
        a = clock * 0.9;
      disc(g, lx, ly, 2.4 * k, 0xfff4d0);
      halo(glow, lx, ly, 16 * k, 0xfff0c0, 0.3 * lit);
      // The beam: a long wedge of light turning round the lamp, foreshortened on the ground plane.
      const reach = 160 * k,
        spread = 0.09,
        end = (t: number) => ({ x: lx + Math.cos(t) * reach, y: ly + Math.sin(t) * reach * SQUASH });
      const e0 = end(a - spread),
        e1 = end(a + spread);
      glow.fillStyle(0xfff0c0, 0.07 * lit);
      glow.fillTriangle(lx, ly, e0.x, e0.y, e1.x, e1.y);
      glow.fillStyle(0xfff0c0, 0.05 * lit);
      const b0 = end(a + Math.PI - spread * 0.7),
        b1 = end(a + Math.PI + spread * 0.7);
      glow.fillTriangle(lx, ly, b0.x, b0.y, b1.x, b1.y);
    },
    extras: shorePieces,
  },
  decor: (g, x, y, rand) => {
    const kind = rand(),
      cx = x + 12 + rand() * 32,
      cy = y + 12 + rand() * 32;
    if (kind < 0.3) {
      // Ripple marks left in the wet sand.
      g.lineStyle(1, 0x2c4663, 0.7);
      for (let i = 0; i < 3; i++) g.strokePoints([{ x: cx - 9, y: cy + i * 4 }, { x: cx - 3, y: cy + i * 4 - 1.5 }, { x: cx + 3, y: cy + i * 4 }, { x: cx + 9, y: cy + i * 4 - 1.5 }], false);
    } else if (kind < 0.5) {
      // A scallop shell.
      oval(g, cx + 1, cy + 2, 4.5, 2, 0x020812, 0.5);
      g.fillStyle(0xdbe7f2, 0.9);
      g.fillPoints([{ x: cx - 4, y: cy + 2 }, { x: cx - 3, y: cy - 2 }, { x: cx, y: cy - 3.5 }, { x: cx + 3, y: cy - 2 }, { x: cx + 4, y: cy + 2 }], true);
      g.lineStyle(1, 0x8aa4bc, 0.8);
      for (const dx of [-3, 0, 3]) g.lineBetween(cx, cy + 2, cx + dx, cy - 2.5);
    } else if (kind < 0.68) {
      // A puddle left by the ebb, the moon in it.
      oval(g, cx, cy, 9 + rand() * 5, 3.5 + rand() * 1.5, 0x12263c, 0.95);
      oval(g, cx - 2, cy - 0.5, 2.4, 0.8, MOON, 0.5);
    } else if (kind < 0.84) {
      // A tuft of weed washed up, and a worm cast.
      g.lineStyle(1.2, 0x2a5a4a, 0.9);
      g.strokePoints([{ x: cx - 6, y: cy }, { x: cx - 2, y: cy - 2 }, { x: cx + 2, y: cy + 1 }, { x: cx + 6, y: cy - 1 }], false);
      g.lineStyle(1, 0x3a4e64, 0.9);
      g.strokePoints([{ x: cx + 8, y: cy + 6 }, { x: cx + 10, y: cy + 5 }, { x: cx + 9, y: cy + 7 }, { x: cx + 11, y: cy + 7 }], false);
    } else {
      // A small crab.
      oval(g, cx, cy, 2.6, 1.8, 0xb85a3a);
      g.lineStyle(0.6, 0xb85a3a);
      for (const s of [-1, 1]) for (const d of [0, 1.4]) g.lineBetween(cx + s * 2, cy + d - 0.4, cx + s * 4.4, cy + d + 0.6);
    }
  },
  // The moon's glitter dancing on the channel and the lake, foam drifting, lanterns on the posts, glints in the
  // tidepools.
  ambient: ({ g, glow, lit, map, clock, blocked }) => {
    for (const b of blocked) {
      const p = pieceAt(map, b.x, b.y),
        { gx, gy } = groundOf(b.x * CELL, b.y * CELL);
      if (p.kind === "posts" && p.posts.lantern) {
        const l = postLantern(p.posts),
          lx = gx + l.u,
          ly = Y(gy + l.v * SQUASH, 0, l.h - 1),
          f = 0.85 + 0.15 * Math.sin(clock * 8 + b.x);
        disc(g, lx, ly, 1.3, 0xffe0a0, f);
        halo(glow, lx, ly, 12, 0xffc870, 0.22 * f * lit);
        glow.fillStyle(0xffc870, 0.05 * f * lit);
        fillOval(glow, lx, gy + l.v * SQUASH + 2, 34, 12);
      } else if (p.kind === "pool") {
        const on = Math.max(0, Math.sin(clock * 1.4 + b.x * 3 + b.y)) ** 6;
        glint(g, glow, gx - 4, gy - 5, on, lit);
      }
    }
    if (!map.columns) return;
    const samples = channelOf(map),
      total = samples[samples.length - 1].s;
    // Glitter: points along the channel flash when their phase comes round, densest where the water faces the moon.
    for (let i = 0; i < samples.length; i += 3) {
      const p = samples[i],
        o = (hash01(i, 1) - 0.5) * 30,
        on = Math.max(0, Math.sin(clock * (1.5 + hash01(i, 2) * 2) + hash01(i, 3) * 40)) ** 10;
      glint(g, glow, p.x + p.nx * o + GLITTER.dx, p.y + p.ny * o, on, lit);
    }
    // Foam rings drifting with the current.
    for (let k = 0; k * 120 < total; k++) {
      const s = (k * 120 + clock * 14) % total,
        p = samples[Math.min(samples.length - 1, Math.floor(s / CHANNEL_STEP))],
        o = Math.sin(k * 2.1 + clock * 0.4) * 10,
        sz = 0.5 + 0.5 * Math.sin(clock * 1.1 + k * 2.1);
      g.lineStyle(1.1, 0xdceaf8, 0.1 + 0.12 * sz);
      strokeOval(g, p.x + p.nx * o, p.y + p.ny * o, 14 + 8 * sz, (14 + 8 * sz) * 0.4);
    }
    // The lake: glitter on the swell and slow mist.
    const n = CELL / SEA_TILE;
    for (const [key, depths] of seaField(map, SHORE)) {
      const [cx, cy] = key.split(",").map(Number);
      for (let j = 0; j < 4; j++) {
        const tx = Math.floor(hash01(cx, cy, j) * n),
          ty = Math.floor(hash01(cy, cx, j + 5) * n);
        if (depths[ty * n + tx] < 10) continue;
        const on = Math.max(0, Math.sin(clock * (1.2 + hash01(j, cx)) + hash01(cx, cy, j) * 40)) ** 8;
        glint(g, glow, cx * CELL + tx * SEA_TILE, cy * CELL + ty * SEA_TILE, on, lit);
      }
      if (hash01(cx, cy, 9) < 0.3) {
        g.fillStyle(0xc8dcea, 0.04);
        fillOval(g, (cx + 0.5) * CELL + Math.sin(clock * 0.15 + cx) * 14, (cy + 0.5) * CELL, 90, 22);
      }
    }
  },
};
