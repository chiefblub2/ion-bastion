import { CELL, disc, fillOval, fillRound, hash01, type Ink, oval, shade, strokeOval } from "../shapes";
import { SQUASH, Y } from "../tower-art/tilt";
import { cellRandom, mulberry32, plateAt, type Random, type StandingPiece, type Theme } from "./kit";
import { CHANNEL_STEP, channelOf, SEA_TILE, seaCells, seaField, shoreLine } from "../coast";
import { blend } from "../ground";
import { halo } from "../material";
import { fnv } from "../../core/hash";
import type { MapDefinition } from "../../core/types";
import type { Crystal } from "./shard-props";
import {
  anemometer, cacheOf, cacheShadow, domeShadow, DOME, drawCache, drawDome, drawPines, drawRocks, drawSerac, drawShards, drawStation, pinesOf, pinesShadow,
  rocksOf, rocksShadow, seracShadow, shardsOf, shardsShadow, SNOW, STATION, stationShadow, type Cache, type Pine, type Rock,
} from "./frost-props";

// Frost Belt: a polar night on the ice. A frozen river instead of a road: clear blue ice cracked into plates between
// snow banks; props in the towers' 3/4 tilt (`Theme.tilted`, `frost-props.ts`): snow-laden pines, ice shards,
// snow-capped rocks, weather stations and supply caches; a research dome and an ice serac as landmarks; and obstacle
// groups at the board edge turned into open polar water (`Theme.sea`) behind a shelf of shore ice, with drifting floes.

const ACCENT = 0xbfe9ff;
/** Kind thresholds of the first `cellRandom` draw. */
const PINES = 0.34,
  SHARDS = 0.54,
  ROCKS = 0.74,
  STATION_KIND = 0.86;
/** A shore of ice meanders like a coast. */
const SHORE = 6;

type Piece =
  | { kind: "pines"; pines: Pine[] }
  | { kind: "shards"; shards: Crystal[] }
  | { kind: "rocks"; rocks: Rock[]; pines: Pine[] }
  | { kind: "station"; rocks: Rock[] }
  | { kind: "cache"; cache: Cache };
function pieceOf(rand: Random): Piece {
  const kind = rand();
  if (kind < PINES) return { kind: "pines", pines: pinesOf(rand) };
  if (kind < SHARDS) return { kind: "shards", shards: shardsOf(rand) };
  if (kind < ROCKS) {
    const rocks = rocksOf(rand);
    return { kind: "rocks", rocks, pines: rocks.length === 1 && rand() < 0.5 ? [{ u: 11, v: -8, h: 24, r: 7 }] : [] };
  }
  if (kind < STATION_KIND) return { kind: "station", rocks: [{ ...rocksOf(rand)[0], r: 6, du: 11, dv: 7 }] };
  return { kind: "cache", cache: cacheOf(rand) };
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

// ── Frozen river ────────────────────────────────────────────────────────────────────────────────────────────────────
const RIVER = 0x24506a;
/**
 * The path as a frozen river with rounded bends (`coast.ts` `channelOf`): banks of drifted snow, a rim of white
 * shore ice, then clear dark-blue ice split into plates by pale cracks, with frost dusting and trapped bubbles.
 */
function drawRiver(g: Ink, map: MapDefinition) {
  const samples = channelOf(map),
    seed = fnv(`${map.id}:ice`),
    layer = (r: number, color: number) => {
      for (let i = 0; i < samples.length; i += 2) disc(g, samples[i].x, samples[i].y, r, color);
    };
  layer(26, 0x6a8aa0);
  layer(24.5, 0x9ab8cc);
  layer(22.5, 0x7aa4bc);
  layer(20.5, RIVER);
  // Lumps of drifted snow along the banks.
  for (let i = 0; i < samples.length; i += 2) {
    const p = samples[i],
      h = hash01(seed, i);
    if (h > 0.45) continue;
    const o = (h < 0.22 ? -1 : 1) * (22 + hash01(seed, i, 2) * 3);
    oval(g, p.x + p.nx * o, p.y + p.ny * o, 3 + h * 6, 2 + h * 3, shade(0xb8d0e0, (hash01(seed, i, 3) - 0.5) * 0.2), 0.95);
  }
  // Depth in the ice: darker towards the middle, a tone per plate, pale cracks between them.
  const done = new Set<number>();
  for (let i = 0; i < samples.length; i += 3) {
    const p = samples[i];
    for (let ty = Math.floor(p.y - 20); ty <= Math.floor(p.y + 20); ty++)
      for (let tx = Math.floor(p.x - 20); tx <= Math.floor(p.x + 20); tx++) {
        const key = ty * 100000 + tx,
          x = tx + 0.5,
          y = ty + 0.5;
        if (done.has(key) || (x - p.x) ** 2 + (y - p.y) ** 2 > 19.5 ** 2) continue;
        done.add(key);
        const { id, edge } = plateAt(seed, x, y, 30);
        if (edge < 0.9) {
          g.fillStyle(0xd8f0ff, 0.8);
          g.fillRect(tx, ty, 1, 1);
        } else if (edge < 2) {
          g.fillStyle(0x4a7a98, 0.7);
          g.fillRect(tx, ty, 1, 1);
        } else if (hash01(seed, id) < 0.4) {
          g.fillStyle(hash01(seed, id, 1) < 0.5 ? 0x1c4058 : 0x2c5c78, 0.5);
          g.fillRect(tx, ty, 1, 1);
        }
      }
  }
  // Frost dust and trapped bubbles.
  for (let i = 5; i < samples.length; i += 11) {
    const p = samples[i],
      o = (hash01(seed, i, 5) - 0.5) * 26,
      x = p.x + p.nx * o,
      y = p.y + p.ny * o;
    if (hash01(seed, i, 6) < 0.5) oval(g, x, y, 6 + hash01(seed, i, 7) * 6, 2.5, 0xb8d8ec, 0.35);
    else for (let k = 0; k < 3; k++) disc(g, x + k * 2.4, y + (k % 2) * 1.6, 0.8 + k * 0.2, 0xc8e8f8, 0.6);
  }
}

// ── Polar water ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** Open water on the edge cells: a snow bank, a shelf of shore ice with its broken edge, black water with floes. */
function drawPolarSea(g: Ink, map: MapDefinition) {
  const n = CELL / SEA_TILE,
    seed = fnv(`${map.id}:floes`);
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
        if (d < 3) c = 0x9ab8cc;
        else if (d < 7) c = d < 6 ? 0x8eaabe : 0x5a7a90;
        else if (d < 10) c = 0x0e2434;
        else {
          const { id, edge } = plateAt(seed, x, y, 34),
            floe = hash01(seed, id) < 0.22 - Math.min(0.14, d / 600);
          c = floe ? (edge < 2.5 ? 0x0e2434 : edge < 4 ? 0x5a7a90 : shade(0x8eaabe, (hash01(seed, id, 1) - 0.5) * 0.12)) : blend(0x0c2232, 0x081824, Math.min(1, (d - 10) / 80));
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
/** Ice shards and the odd small pine along the ice shelf, clear of the path. */
function shorePieces(map: MapDefinition): readonly StandingPiece[] {
  const cached = SHORE_PIECES.get(map.id);
  if (cached) return cached;
  const list: StandingPiece[] = [],
    path = map.path.map((p) => ({ x: (p.x + 0.5) * CELL, y: (p.y + 0.5) * CELL }));
  if (seaCells(map).size)
    for (const s of shoreLine(map, 2, 36)) {
      const rand = mulberry32(fnv(`${map.id}:shore:${Math.round(s.x)}:${Math.round(s.y)}`)),
        roll = rand();
      if (roll > 0.4 || path.some((p) => (p.x - s.x) ** 2 + (p.y - s.y) ** 2 < 44 * 44)) continue;
      if (roll < 0.1) {
        const pines: Pine[] = [{ u: 0, v: 0, h: 22 + rand() * 8, r: 7 }];
        list.push({ x: s.x, y: s.y, shadow: (g) => pinesShadow(g, s.x, s.y, pines), draw: (g) => drawPines(g, s.x, s.y, pines) });
      } else {
        const o = shardsOf(rand, 0.5 + rand() * 0.2);
        list.push({ x: s.x, y: s.y, shadow: (g) => shardsShadow(g, s.x, s.y, o), draw: (g) => drawShards(g, s.x, s.y, o) });
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
export const frost: Theme = {
  backdrop: 0x0c1620,
  ground: [0x16242f, 0x14212b],
  grid: 0x3a5466,
  path: { edge: 0x9ab8cc, bed: RIVER, line: 0xc8ecff, arrow: 0xd6f2ff },
  accent: ACCENT,
  drawPath: drawRiver,
  sea: drawPolarSea,
  obstacle: (g, x, y, rand) => {
    const p = pieceOf(rand),
      { gx, gy } = groundOf(x, y);
    if (p.kind === "pines") drawPines(g, gx, gy, p.pines);
    else if (p.kind === "shards") drawShards(g, gx, gy, p.shards);
    else if (p.kind === "rocks") {
      drawPines(g, gx, gy, p.pines.filter((q) => q.v < 0));
      drawRocks(g, gx, gy, p.rocks);
    } else if (p.kind === "station") {
      drawStation(g, gx - 4, gy - 2);
      drawRocks(g, gx, gy, p.rocks);
    } else drawCache(g, gx, gy, p.cache);
  },
  tilted: {
    shadow: (g, x, y, rand) => {
      const p = pieceOf(rand),
        { gx, gy } = groundOf(x, y);
      if (p.kind === "pines") pinesShadow(g, gx, gy, p.pines);
      else if (p.kind === "shards") shardsShadow(g, gx, gy, p.shards);
      else if (p.kind === "rocks") {
        rocksShadow(g, gx, gy, p.rocks);
        pinesShadow(g, gx, gy, p.pines);
      } else if (p.kind === "station") {
        stationShadow(g, gx - 4, gy - 2);
        rocksShadow(g, gx, gy, p.rocks);
      } else cacheShadow(g, gx, gy, p.cache);
    },
    landmark: (g, x, y, s, variant) => {
      const { y0, k } = landmarkGround(x, y, s);
      scaled(g, x, y0, k, () => (variant ? seracShadow(g) : domeShadow(g)));
      scaled(g, x, y0, k, () => (variant ? drawSerac(g) : drawDome(g)));
    },
    // The dome's windows glow warm and its red beacon blinks; the serac glows faintly from inside.
    landmarkLight: (g, glow, x, y, s, variant, clock, lit) => {
      const { y0, k } = landmarkGround(x, y, s);
      if (variant) {
        halo(glow, x + 4 * k, Y(y0, -4, 30 * k), 26 * k, ACCENT, (0.1 + 0.04 * Math.sin(clock * 0.7 + x)) * lit);
        return;
      }
      for (let i = 1; i < 12; i++) {
        const t = ((i - 0.5) / 12) * Math.PI;
        disc(glow, x + Math.cos(t) * DOME.r * k, Y(y0, Math.sin(t) * DOME.r * k, 13.5 * k), 4 * k, 0xffd890, 0.18 * lit);
        disc(g, x + Math.cos(t) * DOME.r * k, Y(y0, Math.sin(t) * DOME.r * k, 13.5 * k), 1.6 * k, 0xffe0a0, 0.85);
      }
      const on = Math.sin(clock * 2.5 + x) > 0.3 ? 1 : 0.15,
        bx = x - 8 * k,
        by = Y(y0, -4 * k, DOME.beacon * k);
      disc(g, bx, by, 1.6 * k, on > 0.5 ? 0xffb0a0 : 0x5a1a14);
      disc(glow, bx, by, 7 * k, 0xff4a3a, 0.3 * on * lit);
    },
    extras: shorePieces,
  },
  decor: (g, x, y, rand) => {
    const kind = rand(),
      cx = x + 12 + rand() * 32,
      cy = y + 12 + rand() * 32;
    if (kind < 0.3) {
      // Snow crystal.
      g.lineStyle(1, 0x5d7f95, 0.9);
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3;
        g.lineBetween(cx - Math.cos(a) * 5, cy - Math.sin(a) * 5, cx + Math.cos(a) * 5, cy + Math.sin(a) * 5);
      }
    } else if (kind < 0.65) {
      // A wind-blown drift.
      oval(g, cx, cy, 10 + rand() * 8, 3 + rand() * 2, 0x2c4456, 0.8);
      oval(g, cx - 2, cy - 1, 7 + rand() * 4, 1.6, 0x3a5668, 0.7);
    } else if (kind < 0.85) {
      // Footprints in the snow.
      for (let i = 0; i < 4; i++) oval(g, cx - 9 + i * 6, cy + (i % 2 ? 2 : -2), 1.6, 1, 0x0e1a24, 0.7);
    } else {
      // A frozen puddle.
      oval(g, cx, cy, 7 + rand() * 4, 3 + rand() * 2, 0x2a4a60, 0.8);
      g.lineStyle(0.6, 0xc8ecff, 0.4);
      g.lineBetween(cx - 3, cy - 1, cx + 2, cy);
    }
  },
  // Snow drifting across the field, anemometers turning, lamps blinking, glints sliding on the river ice, the floes
  // rocking and mist over the polar water.
  ambient: ({ g, glow, lit, map, clock, blocked, hash }) => {
    for (const b of blocked) {
      const p = pieceAt(map, b.x, b.y),
        { gx, gy } = groundOf(b.x * CELL, b.y * CELL);
      if (p.kind === "station") {
        anemometer(g, gx - 4, gy - 2, clock, b.x * 2 + b.y);
        const on = Math.sin(clock * 2 + b.x + b.y) > 0.4 ? 1 : 0.2,
          lx = gx - 4 + 5,
          ly = Y(gy - 2, 0, 30);
        disc(g, lx, ly, 1, on > 0.5 ? 0xff6a4a : 0x5a1a14);
        disc(glow, lx, ly, 4, 0xff4a3a, 0.25 * on * lit);
      } else if (p.kind === "shards") halo(glow, gx, Y(gy, 0, 14), 12, ACCENT, (0.06 + 0.03 * Math.sin(clock + b.x)) * lit);
    }
    if (!map.columns) return;
    const samples = channelOf(map),
      total = samples[samples.length - 1].s;
    for (let k = 0; k * 200 < total; k++) {
      const s = (k * 200 + clock * 45) % total,
        p = samples[Math.min(samples.length - 1, Math.floor(s / CHANNEL_STEP))],
        o = Math.sin(k * 2.3) * 9;
      disc(glow, p.x + p.nx * o, p.y + p.ny * o, 5, 0xd8f4ff, 0.18 * lit);
      disc(g, p.x + p.nx * o, p.y + p.ny * o, 1, 0xffffff, 0.7);
    }
    const n = CELL / SEA_TILE;
    for (const [key, depths] of seaField(map, SHORE)) {
      const [cx, cy] = key.split(",").map(Number);
      const tx = Math.floor(hash01(cx, cy) * n),
        ty = Math.floor(hash01(cy, cx, 3) * n);
      if (depths[ty * n + tx] > 16) {
        const life = (clock * 0.3 + hash01(cx, cy, 2)) % 1;
        g.lineStyle(0.8, 0xbfe9ff, 0.2 * (1 - life));
        strokeOval(g, cx * CELL + tx * SEA_TILE, cy * CELL + ty * SEA_TILE, 8 + life * 30, (8 + life * 30) * SQUASH);
      }
      if (hash01(cx, cy, 9) < 0.35) {
        g.fillStyle(0xc8dcea, 0.05);
        fillOval(g, (cx + 0.5) * CELL + Math.sin(clock * 0.15 + cx) * 14, (cy + 0.5) * CELL, 90, 24);
      }
    }
    // Snowfall over the whole board, a little denser than before.
    const w = map.columns * CELL,
      h = map.rows * CELL;
    for (let k = 0; k < map.columns * 3; k++) {
      const s = hash(k, 0),
        fy = ((clock * (14 + s * 10) + s * h * 3) % (h + 20)) - 10,
        fx = (s * w * 7 + Math.sin(clock * 0.8 + k) * 12) % w;
      g.fillStyle(SNOW, 0.25 + s * 0.4);
      fillRound(g, fx, fy, 0.8 + s * 1.3);
    }
  },
};
