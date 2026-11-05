import { CELL, disc, hash01, type Ink, oval, shade } from "../shapes";
import { Y } from "../tower-art/tilt";
import { cellRandom, mulberry32, plateAt, type Random, type StandingPiece, type Theme } from "./kit";
import { channelOf, SEA_TILE, seaCells, seaField, shoreLine } from "../coast";
import { blend } from "../ground";
import { halo } from "../material";
import { fnv } from "../../core/hash";
import type { MapDefinition } from "../../core/types";
import type { Crystal } from "./shard-props";
import {
  archShadow, bouldersOf, bouldersShadow, cacheShadow, colossusShadow, drawArch, drawBoulders, drawCache, drawColossus, drawGlass, drawHoodoo, drawHull,
  drawRibs, glassOf, glassShadow, hoodooOf, hoodooShadow, hullEngine, hullOf, hullShadow, LANTERN, ribsOf, ribsShadow, SAND, type Boulders, type Hoodoo,
  type Hull, type Ribs,
} from "./dune-props";

// Dune Sea: a desert under a hot dusk sky. A caravan trail of packed sand instead of the sunken track: wheel ruts,
// footprints and drifts creeping in from both sides; props in the towers' 3/4 tilt (`Theme.tilted`, `dune-props.ts`):
// sandstone hoodoos, the hull of a crashed hauler, giant rib cages, shards of desert glass, wind-carved boulders and
// caravan caches; a rock arch and a toppled colossus head as landmarks; and obstacle groups at the board edge turned
// into a glass sea (`Theme.sea`): sand fused into cracked sheets of smoky green-gold glass.

const ACCENT = 0xffc46b;
/** Kind thresholds of the first `cellRandom` draw. */
const HOODOO = 0.3,
  HULL = 0.44,
  RIBS = 0.56,
  GLASS_KIND = 0.7,
  BOULDERS = 0.88;
/** A glass shore meanders like a coast. */
const SHORE = 6;

type Piece =
  | { kind: "hoodoo"; hoodoo: Hoodoo }
  | { kind: "hull"; hull: Hull }
  | { kind: "ribs"; ribs: Ribs }
  | { kind: "glass"; glass: Crystal[] }
  | { kind: "boulders"; boulders: Boulders }
  | { kind: "cache"; flip: boolean };
function pieceOf(rand: Random): Piece {
  const kind = rand();
  if (kind < HOODOO) return { kind: "hoodoo", hoodoo: hoodooOf(rand) };
  if (kind < HULL) return { kind: "hull", hull: hullOf(rand) };
  if (kind < RIBS) return { kind: "ribs", ribs: ribsOf(rand) };
  if (kind < GLASS_KIND) return { kind: "glass", glass: glassOf(rand) };
  if (kind < BOULDERS) return { kind: "boulders", boulders: bouldersOf(rand) };
  return { kind: "cache", flip: rand() < 0.5 };
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

// ── Caravan trail ───────────────────────────────────────────────────────────────────────────────────────────────────
const TRAIL = 0x8a6a40;
/**
 * The path as a caravan trail with rounded bends (`coast.ts` `channelOf`): a soft bank of loose sand, packed sand in
 * two tones, a pair of wheel ruts, footprints between them, and drifts of fresh sand blown in over the edges.
 */
function drawTrail(g: Ink, map: MapDefinition) {
  const samples = channelOf(map),
    seed = fnv(`${map.id}:trail`),
    layer = (r: number, color: number) => {
      for (let i = 0; i < samples.length; i += 2) disc(g, samples[i].x, samples[i].y, r, color);
    },
    along = (o: number) => samples.map((p) => ({ x: p.x + p.nx * o, y: p.y + p.ny * o }));
  layer(26, 0x5a4220);
  layer(24, 0x7a5a32);
  layer(21.5, TRAIL);
  // Wind ripples across the packed sand.
  for (let i = 0; i < samples.length; i += 3) {
    const p = samples[i],
      tx = p.ny,
      ty = -p.nx,
      bow = 1.5 + hash01(seed, i) * 1.5;
    g.lineStyle(0.8, shade(TRAIL, -0.18), 0.6);
    g.strokePoints([-0.9, -0.3, 0.3, 0.9].map((k) => ({ x: p.x + p.nx * 19 * k + tx * bow * (1 - k * k), y: p.y + p.ny * 19 * k + ty * bow * (1 - k * k) })), false);
  }
  // Wheel ruts: a darker groove with a lit lip on the far side.
  for (const side of [-1, 1]) {
    g.lineStyle(3.2, shade(TRAIL, -0.28), 0.9);
    g.strokePoints(along(side * 8), false);
    g.lineStyle(0.8, shade(TRAIL, 0.22), 0.8);
    g.strokePoints(along(side * 8 - 1.6), false);
  }
  // Footprints down the middle.
  for (let i = 0; i < samples.length; i += 3) {
    const p = samples[i],
      o = (i / 3) % 2 ? 2 : -2;
    oval(g, p.x + p.nx * o, p.y + p.ny * o, 1.3, 1, shade(TRAIL, -0.3), 0.7);
  }
  // Drifts blown in over the edges.
  for (let i = 0; i < samples.length; i += 2) {
    const p = samples[i],
      h = hash01(seed, i, 2);
    if (h > 0.2) continue;
    const side = hash01(seed, i, 3) < 0.5 ? -1 : 1,
      o = side * (18 + h * 10);
    oval(g, p.x + p.nx * o, p.y + p.ny * o, 4 + h * 14, 2.5 + h * 6, shade(TRAIL, 0.08 + (hash01(seed, i, 4) - 0.5) * 0.1), 0.85);
  }
}

// ── Glass sea ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** The glass sea on the edge cells: a sand bank, a rim of frosted glass, then smoky glass plates split by bright cracks. */
function drawGlassSea(g: Ink, map: MapDefinition) {
  const n = CELL / SEA_TILE,
    seed = fnv(`${map.id}:glass`);
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
        if (d < 3) c = 0x9a7440;
        else if (d < 7) c = blend(0x8a7a50, 0x6a7a5a, (d - 3) / 4);
        else {
          const { id, edge } = plateAt(seed, x, y, 30),
            tone = (hash01(seed, id) - 0.5) * 0.18;
          c = edge < 1 ? 0x9ab890 : edge < 2.4 ? 0x22302a : shade(blend(0x4a6a52, 0x2a3e38, Math.min(1, (d - 7) / 60)), tone);
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
/** Glass shards along the glass sea's rim, clear of the path. */
function shorePieces(map: MapDefinition): readonly StandingPiece[] {
  const cached = SHORE_PIECES.get(map.id);
  if (cached) return cached;
  const list: StandingPiece[] = [],
    path = map.path.map((p) => ({ x: (p.x + 0.5) * CELL, y: (p.y + 0.5) * CELL }));
  if (seaCells(map).size)
    for (const s of shoreLine(map, 3, 34)) {
      const rand = mulberry32(fnv(`${map.id}:shore:${Math.round(s.x)}:${Math.round(s.y)}`));
      if (rand() > 0.45 || path.some((p) => (p.x - s.x) ** 2 + (p.y - s.y) ** 2 < 44 * 44)) continue;
      const o = glassOf(rand, 0.5 + rand() * 0.25);
      list.push({ x: s.x, y: s.y, shadow: (g) => glassShadow(g, s.x, s.y, o), draw: (g) => drawGlass(g, s.x, s.y, o) });
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
export const dune: Theme = {
  backdrop: 0x1a1206,
  ground: [0x2a1f10, 0x261c0e],
  grid: 0x4a3818,
  path: { edge: 0x7a5a32, bed: TRAIL, line: 0xffc46b, arrow: 0xffd48a },
  accent: ACCENT,
  drawPath: drawTrail,
  sea: drawGlassSea,
  obstacle: (g, x, y, rand) => {
    const p = pieceOf(rand),
      { gx, gy } = groundOf(x, y);
    if (p.kind === "hoodoo") drawHoodoo(g, gx, gy - 2, p.hoodoo);
    else if (p.kind === "hull") drawHull(g, gx, gy, p.hull);
    else if (p.kind === "ribs") drawRibs(g, gx, gy, p.ribs);
    else if (p.kind === "glass") drawGlass(g, gx, gy, p.glass);
    else if (p.kind === "boulders") drawBoulders(g, gx, gy, p.boulders);
    else drawCache(g, gx, gy - 2, p.flip);
  },
  tilted: {
    shadow: (g, x, y, rand) => {
      const p = pieceOf(rand),
        { gx, gy } = groundOf(x, y);
      if (p.kind === "hoodoo") hoodooShadow(g, gx, gy - 2, p.hoodoo);
      else if (p.kind === "hull") hullShadow(g, gx, gy, p.hull);
      else if (p.kind === "ribs") ribsShadow(g, gx, gy, p.ribs);
      else if (p.kind === "glass") glassShadow(g, gx, gy, p.glass);
      else if (p.kind === "boulders") bouldersShadow(g, gx, gy, p.boulders);
      else cacheShadow(g, gx, gy - 2);
    },
    landmark: (g, x, y, s, variant) => {
      const { y0, k } = landmarkGround(x, y, s);
      scaled(g, x, y0, k, () => (variant ? colossusShadow(g) : archShadow(g)));
      scaled(g, x, y0, k, () => (variant ? drawColossus(g) : drawArch(g)));
    },
    // Sand streams off the arch's lintel; the colossus' eyes catch the last light.
    landmarkLight: (g, glow, x, y, s, variant, clock, lit) => {
      const { y0, k } = landmarkGround(x, y, s);
      if (variant) {
        for (const u of [-8, 8]) halo(glow, x + u * k, Y(y0, 21 * k, 19 * k), 6 * k, 0xffb04a, (0.12 + 0.05 * Math.sin(clock * 0.8 + u)) * lit);
        return;
      }
      for (let i = 0; i < 6; i++) {
        const life = (clock * 0.6 + i / 6 + hash01(x, i)) % 1;
        disc(g, x + (-10 + i * 4) * k + life * 8 * k, Y(y0, 0, 52 * k) + life * 40 * k, 0.8 * k, 0xe8c58a, 0.6 * (1 - life));
      }
    },
    extras: shorePieces,
  },
  decor: (g, x, y, rand) => {
    const kind = rand(),
      cx = x + 12 + rand() * 32,
      cy = y + 14 + rand() * 28;
    if (kind < 0.45) {
      // Wind ripples: a few shallow bows.
      g.lineStyle(1, 0x3d2c14, 0.85);
      for (let i = 0; i < 3; i++) {
        const ry = y + 14 + i * 12 + rand() * 4,
          rx = x + 10 + rand() * 8;
        g.strokePoints([0, 0.25, 0.5, 0.75, 1].map((t) => ({ x: rx + t * 30, y: ry - Math.sin(t * Math.PI) * 3 })), false);
      }
    } else if (kind < 0.7) {
      // Pebbles with a lit edge.
      for (let i = 0; i < 3; i++) {
        const sx = cx + (rand() - 0.5) * 16,
          sy = cy + (rand() - 0.5) * 12,
          sr = 1.5 + rand() * 2;
        oval(g, sx + 1, sy + 1.2, sr * 1.2, sr * 0.5, 0x0a0602, 0.4);
        disc(g, sx, sy, sr, 0x5a4428);
        disc(g, sx - sr * 0.3, sy - sr * 0.3, sr * 0.45, 0x7a6038);
      }
    } else if (kind < 0.85) {
      // A glint of glass in the sand.
      disc(g, cx, cy, 1.6, 0x8ac8b8, 0.8);
      disc(g, cx - 0.4, cy - 0.4, 0.6, 0xe8f8f0, 0.9);
    } else {
      // A dry shrub.
      g.lineStyle(1, 0x5a4428, 0.9);
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i - 2.5) * 0.4;
        g.lineBetween(cx, cy, cx + Math.cos(a) * 6, cy + Math.sin(a) * 5);
      }
    }
  },
  // Sand streaming across the board, heat shimmer over the trail, a hauler's engine still glowing, caravan lanterns,
  // glints on the desert glass and on the glass sea.
  ambient: ({ g, glow, lit, map, clock, hash, blocked }) => {
    for (const b of blocked) {
      const p = pieceAt(map, b.x, b.y),
        { gx, gy } = groundOf(b.x * CELL, b.y * CELL);
      if (p.kind === "hull" && hash01(b.x, b.y) < 0.5) {
        const e = hullEngine(p.hull);
        halo(glow, gx + e.x, gy + e.y, 9, 0xff8a3a, (0.16 + 0.08 * Math.sin(clock * 3 + b.x)) * lit);
      } else if (p.kind === "cache") {
        const lx = gx + LANTERN.u * (p.flip ? -1 : 1),
          ly = Y(gy - 2 + LANTERN.v * 0.65, 0, LANTERN.h - 3),
          f = 0.85 + 0.15 * Math.sin(clock * 9 + b.x);
        disc(g, lx, ly, 1.6, 0xffd890, f);
        halo(glow, lx, ly, 12, 0xffb050, 0.22 * f * lit);
      } else if (p.kind === "glass") {
        const on = Math.max(0, Math.sin(clock * 0.9 + b.x * 1.7 + b.y)) ** 12;
        if (on > 0.05) disc(glow, gx - 1, Y(gy, 0, 14), 4, 0xf0ffe0, 0.35 * on * lit);
      }
    }
    if (!map.columns) return;
    // Sand streaming across the board in thin streaks.
    const w = map.columns * CELL,
      h = map.rows * CELL;
    for (let k = 0; k < map.columns * 2; k++) {
      const s = hash(k, 3),
        t = hash(3, k),
        fx = ((clock * (50 + s * 40) + s * w * 5) % (w + 40)) - 20,
        fy = (t * h + Math.sin(clock * 0.6 + k) * 8) % h;
      g.fillStyle(0xe8c58a, 0.16 + s * 0.2);
      g.fillRect(fx, fy, 3 + s * 5, 1);
    }
    // Heat shimmer over the trail.
    const samples = channelOf(map);
    for (let i = 7; i < samples.length; i += 19) {
      const p = samples[i],
        rise = (clock * 0.5 + hash01(i, 5)) % 1,
        wob = Math.sin(clock * 3 + i) * 3;
      g.lineStyle(1.5, 0xffd9a0, 0.14 * (1 - rise));
      g.lineBetween(p.x + wob - 6, p.y - 6 - rise * 12, p.x + wob + 6, p.y - 8 - rise * 12);
    }
    // Glints sliding over the glass sea.
    const n = CELL / SEA_TILE;
    for (const [key, depths] of seaField(map, SHORE)) {
      const [cx, cy] = key.split(",").map(Number),
        tx = Math.floor(hash01(cx, cy) * n),
        ty = Math.floor(hash01(cy, cx, 3) * n);
      if (depths[ty * n + tx] < 10) continue;
      const on = Math.max(0, Math.sin(clock * 0.7 + hash01(cx, cy, 2) * 40)) ** 10;
      if (on > 0.05) {
        disc(glow, cx * CELL + tx * SEA_TILE, cy * CELL + ty * SEA_TILE, 6, 0xf0ffd8, 0.3 * on * lit);
        oval(g, cx * CELL + tx * SEA_TILE, cy * CELL + ty * SEA_TILE, 6 * on, 0.8, 0xffffff, 0.6 * on);
      }
    }
  },
};
