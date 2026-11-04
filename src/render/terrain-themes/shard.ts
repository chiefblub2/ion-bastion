import { CELL, disc, hash01, type Ink, oval, shade, strokeOval } from "../shapes";
import { SQUASH, Y } from "../tower-art/tilt";
import { mulberry32, type Random, type StandingPiece, type Theme } from "./kit";
import { CHANNEL_STEP, channelOf, SEA_TILE, seaCells, seaField, shoreLine, wobble } from "../coast";
import { blend } from "../ground";
import { halo } from "../material";
import { fnv } from "../../core/hash";
import type { MapDefinition } from "../../core/types";
import {
  clusterOf, clusterShadow, CRYSTAL_COLORS, crystal, crystalShadow, drawCluster, drawFloater, drawGeode, drawMonolith, drawPylon, drawSensor,
  drawSplitGeode, floaterShadow, geodeOf, geodeShadow, HOVER, MONOLITH_CORE, monolithShadow, PYLON_CORE, pylonShadow, SENSOR_LAMP, sensorShadow,
  splitGeodeShadow, type Cluster, type Geode,
} from "./shard-props";

// Shard Field: an alien crystal field in violet and lilac. A ley line instead of a road: a dark polished-glass channel
// edged with crushed crystal and split by a glowing seam; props in the towers' 3/4 tilt (`Theme.tilted`,
// `shard-props.ts`): crystal clusters, cracked geodes, floating shards, sensor tripods and resonance pylons; a crystal
// monolith and a cracked giant geode as landmarks; and obstacle groups at the board edge turned into a crystal sea
// (`Theme.sea`): a faceted glassy sheet lit from below, fringed with small crystals and pierced by spires.

const ACCENT = 0xd8ccff;
const SEAM = 0xb9a8ff;
/** Kind thresholds of the first `cellRandom` draw (`hash` in the ambient names the prop the same way). */
const CLUSTER = 0.5,
  PAIR = 0.6,
  GEODE = 0.7,
  FLOATER = 0.8,
  SENSOR = 0.88;
/** Sea depth field wobble: a crystal shore meanders a little. */
const SHORE = 4;

type Piece =
  | { kind: "cluster"; clusters: { c: Cluster; du: number; dv: number; k: number }[] }
  | { kind: "geode"; geode: Geode }
  | { kind: "floater"; color: number; a: number; under: Cluster }
  | { kind: "sensor"; a: number; under: Cluster }
  | { kind: "pylon"; a: number; color: number };
function pieceOf(rand: Random): Piece {
  const kind = rand();
  if (kind < CLUSTER) return { kind: "cluster", clusters: [{ c: clusterOf(rand, 0.9 + rand() * 0.25), du: 0, dv: 0, k: 1 }] };
  if (kind < PAIR) return { kind: "cluster", clusters: [{ c: clusterOf(rand, 0.6), du: -9, dv: -5, k: 1 }, { c: clusterOf(rand, 0.55), du: 10, dv: 6, k: 1 }] };
  if (kind < GEODE) return { kind: "geode", geode: geodeOf(rand) };
  if (kind < FLOATER) return { kind: "floater", color: CRYSTAL_COLORS[Math.floor(rand() * CRYSTAL_COLORS.length)], a: rand() * Math.PI, under: clusterOf(rand, 0.4) };
  if (kind < SENSOR) return { kind: "sensor", a: rand() * Math.PI * 2, under: clusterOf(rand, 0.45) };
  return { kind: "pylon", a: (rand() - 0.5) * 0.8, color: CRYSTAL_COLORS[Math.floor(rand() * CRYSTAL_COLORS.length)] };
}
const groundOf = (x: number, y: number) => ({ gx: x + CELL / 2, gy: y + 36 });

// ── Ley line ────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * The path as a ley line with rounded bends (`coast.ts` `channelOf`): a border of crushed crystal, a channel of dark
 * polished glass with a sheen on the side turned to the light, and a glowing seam down the middle that splits into
 * fine fractures. No arrows: pulses running along the seam show the way.
 */
function drawLeyLine(g: Ink, map: MapDefinition) {
  const samples = channelOf(map),
    seed = fnv(`${map.id}:ley`),
    layer = (r: number, color: number) => {
      for (let i = 0; i < samples.length; i += 2) disc(g, samples[i].x, samples[i].y, r, color);
    },
    along = (o: number) => samples.map((p) => ({ x: p.x + p.nx * o, y: p.y + p.ny * o }));
  layer(25, 0x2c2444);
  layer(21.5, 0x15112a);
  layer(19.5, 0x1d1736);
  // Crushed crystal along the border, glinting.
  for (let i = 0; i < samples.length; i++) {
    const p = samples[i],
      h = hash01(seed, i);
    if (h > 0.55) continue;
    const side = h < 0.27 ? -1 : 1,
      o = side * (21.5 + hash01(seed, i, 2) * 3);
    disc(g, p.x + p.nx * o, p.y + p.ny * o, 0.6 + h * 1.6, h < 0.12 ? 0xe8e0ff : CRYSTAL_COLORS[i % CRYSTAL_COLORS.length], 0.8);
  }
  // Sheen on the glass, then the seam with a soft halo.
  g.lineStyle(4, 0x3a3166, 0.45);
  g.strokePoints(along(-10), false);
  g.lineStyle(7, SEAM, 0.12);
  g.strokePoints(along(0), false);
  g.lineStyle(1.8, SEAM, 0.85);
  g.strokePoints(along(0), false);
  // Fractures branching off the seam.
  for (let i = 8; i < samples.length; i += 9) {
    const p = samples[i],
      h = hash01(seed, i, 3);
    if (h > 0.7) continue;
    const side = h < 0.35 ? -1 : 1,
      tx = p.ny,
      ty = -p.nx;
    let x = p.x,
      y = p.y;
    g.lineStyle(0.9, SEAM, 0.55);
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 1; k <= 3; k++) {
      x += p.nx * side * (3 + hash01(seed, i, 10 + k) * 3) + tx * (hash01(seed, i, 20 + k) - 0.3) * 4;
      y += p.ny * side * (3 + hash01(seed, i, 10 + k) * 3) + ty * (hash01(seed, i, 20 + k) - 0.3) * 4;
      g.lineTo(x, y);
    }
    g.strokePath();
  }
}

// ── Crystal sea ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** Crystal sea colours by distance from the shore: a bright crust edge, a dark rind, then the glassy sheet glowing deeper in. */
function seaColor(d: number, facet: number) {
  if (d < 2.4) return 0xcabaff;
  if (d < 6) return 0x3e3270;
  const deep = blend(0x261c48, 0x5a3cb4, Math.min(1, (d - 6) / 90));
  return shade(deep, facet);
}
/** The crystal sea on the edge cells: crust, rind and a faceted glassy sheet whose light rises from below. */
function drawCrystalSea(g: Ink, map: MapDefinition) {
  const n = CELL / SEA_TILE,
    seed = fnv(`${map.id}:facets`);
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
          // Facets: a warped grid of cells, each a step lighter or darker.
          fx = Math.floor((x + wobble(seed, x, y, 30) * 10) / 22),
          fy = Math.floor((y + wobble(seed + 1, x, y, 30) * 10) / 18),
          facet = (Math.round(hash01(seed, fx, fy) * 4) - 2) * 0.05,
          c = seaColor(Math.round(depths[ty * n + tx]), facet);
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
const SEA_PIECES = new Map<string, StandingPiece[]>();
/** Small crystal clusters fringing the shore and tall spires breaking through the sheet further out. */
function seaPieces(map: MapDefinition): readonly StandingPiece[] {
  const cached = SEA_PIECES.get(map.id);
  if (cached) return cached;
  const list: StandingPiece[] = [],
    path = map.path.map((p) => ({ x: (p.x + 0.5) * CELL, y: (p.y + 0.5) * CELL })),
    clear = (x: number, y: number) => !path.some((p) => (p.x - x) ** 2 + (p.y - y) ** 2 < 44 * 44);
  if (seaCells(map).size) {
    for (const s of shoreLine(map, 4, 30)) {
      const rand = mulberry32(fnv(`${map.id}:fringe:${Math.round(s.x)}:${Math.round(s.y)}`));
      if (rand() > 0.5 || !clear(s.x, s.y)) continue;
      const c = clusterOf(rand, 0.45 + rand() * 0.2);
      list.push({ x: s.x, y: s.y, shadow: (g) => clusterShadow(g, s.x, s.y, c), draw: (g) => drawCluster(g, s.x, s.y, c) });
    }
    for (const s of shoreLine(map, 40, 60)) {
      const rand = mulberry32(fnv(`${map.id}:spire:${Math.round(s.x)}:${Math.round(s.y)}`));
      if (rand() > 0.5) continue;
      const k = { u: 0, v: 0, a: rand() * Math.PI * 2, lean: rand() * 0.3, len: 30 + rand() * 24, r: 6 + rand() * 3, color: CRYSTAL_COLORS[Math.floor(rand() * CRYSTAL_COLORS.length)] };
      list.push({ x: s.x, y: s.y, shadow: (g) => crystalShadow(g, s.x, s.y, k), draw: (g) => crystal(g, s.x, s.y, k) });
    }
  }
  SEA_PIECES.set(map.id, list);
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

/** A soft sparkle flashing briefly once per cycle. */
function sparkle(g: Ink, glow: Ink, x: number, y: number, clock: number, seed: number, lit: number, color = 0xffffff) {
  const on = Math.max(0, Math.sin(clock * 1.4 + seed * 40)) ** 12;
  if (on < 0.05) return;
  g.lineStyle(1, color, 0.9 * on);
  g.lineBetween(x - 3.5 * on, y, x + 3.5 * on, y);
  g.lineBetween(x, y - 3.5 * on, x, y + 3.5 * on);
  disc(glow, x, y, 4, color, 0.3 * on * lit);
}

// ── Theme ───────────────────────────────────────────────────────────────────────────────────────────────────────────
export const shard: Theme = {
  backdrop: 0x120f1c,
  ground: [0x1e1a2e, 0x1b1729],
  grid: 0x40385a,
  path: { edge: 0x2c2444, bed: 0x1d1736, line: SEAM, arrow: ACCENT },
  accent: ACCENT,
  drawPath: drawLeyLine,
  sea: drawCrystalSea,
  obstacle: (g, x, y, rand) => {
    const p = pieceOf(rand),
      { gx, gy } = groundOf(x, y);
    if (p.kind === "cluster") for (const c of p.clusters) drawCluster(g, gx + c.du, gy + c.dv * SQUASH, c.c);
    else if (p.kind === "geode") drawGeode(g, gx, gy, p.geode);
    else if (p.kind === "floater") {
      drawCluster(g, gx + 10, gy + 6, p.under);
      drawFloater(g, gx - 2, gy - 2, p.color, p.a);
    } else if (p.kind === "sensor") {
      drawCluster(g, gx - 11, gy - 4, p.under);
      drawSensor(g, gx + 4, gy + 2, p.a);
    } else drawPylon(g, gx, gy, p.a, p.color);
  },
  tilted: {
    shadow: (g, x, y, rand) => {
      const p = pieceOf(rand),
        { gx, gy } = groundOf(x, y);
      if (p.kind === "cluster") for (const c of p.clusters) clusterShadow(g, gx + c.du, gy + c.dv * SQUASH, c.c);
      else if (p.kind === "geode") geodeShadow(g, gx, gy, p.geode);
      else if (p.kind === "floater") {
        clusterShadow(g, gx + 10, gy + 6, p.under);
        floaterShadow(g, gx - 2, gy - 2);
      } else if (p.kind === "sensor") {
        clusterShadow(g, gx - 11, gy - 4, p.under);
        sensorShadow(g, gx + 4, gy + 2);
      } else pylonShadow(g, gx, gy);
    },
    landmark: (g, x, y, s, variant) => {
      const { y0, k } = landmarkGround(x, y, s);
      scaled(g, x, y0, k, () => (variant ? splitGeodeShadow(g) : monolithShadow(g)));
      scaled(g, x, y0, k, () => (variant ? drawSplitGeode(g, 0x9d8cff) : drawMonolith(g, 0xb8a6ff)));
    },
    // The monolith's core breathes and sends resonance rings over the ground; the cracked geode glows from inside.
    landmarkLight: (g, glow, x, y, s, variant, clock, lit) => {
      const { y0, k } = landmarkGround(x, y, s);
      if (variant) {
        const beat = 0.6 + 0.4 * Math.sin(clock * 1.2 + x);
        halo(glow, x, Y(y0 + 6 * k, 0, 34 * k), 24 * k, 0xa48cff, 0.14 * beat * lit);
        return;
      }
      const beat = 0.5 + 0.5 * Math.sin(clock * 1.6 + x);
      halo(glow, x, y0 - MONOLITH_CORE * k, 16 * k, 0xd8ccff, (0.1 + 0.1 * beat) * lit);
      for (let i = 0; i < 2; i++) {
        const life = (clock * 0.25 + i / 2) % 1,
          r = (20 + life * 80) * k;
        glow.lineStyle(2, ACCENT, 0.22 * (1 - life) * lit);
        strokeOval(glow, x, y0, r * 2, r * 2 * SQUASH);
      }
    },
    extras: seaPieces,
  },
  decor: (g, x, y, rand) => {
    const kind = rand(),
      cx = x + 12 + rand() * 32,
      cy = y + 12 + rand() * 32;
    if (kind < 0.35) {
      // A sprinkle of crystal grit.
      for (let i = 0; i < 5; i++) disc(g, cx + (rand() - 0.5) * 14, cy + (rand() - 0.5) * 10, 0.7 + rand(), CRYSTAL_COLORS[Math.floor(rand() * 5)], 0.75);
    } else if (kind < 0.6) {
      // A faint luminous vein in the stone.
      let px = cx - 10,
        py = cy;
      g.lineStyle(1, 0x6a58b0, 0.45);
      g.beginPath();
      g.moveTo(px, py);
      for (let k = 0; k < 4; k++) {
        px += 5 + rand() * 2;
        py += (rand() - 0.5) * 6;
        g.lineTo(px, py);
      }
      g.strokePath();
    } else if (kind < 0.8) {
      // A tiny crystal sprout lying flat.
      g.fillStyle(0x7a6ac8, 0.85);
      g.fillTriangle(cx - 2, cy + 2, cx + 2, cy + 2, cx + 1, cy - 5);
      g.fillStyle(0xb8a6ff, 0.85);
      g.fillTriangle(cx - 2, cy + 2, cx + 1, cy - 5, cx - 1, cy - 3);
    } else {
      // A dark pebble of glassy stone.
      oval(g, cx, cy, 4, 2.4, 0x2a2440, 0.9);
      oval(g, cx - 1, cy - 0.8, 1.6, 0.8, 0x6a5ea0, 0.7);
    }
  },
  // Pulses running along the seam, sparkles on the crystals, glowing floaters, pylons and sensors, motes rising and
  // glints on the crystal sea.
  ambient: ({ g, glow, lit, map, clock, hash, blocked }) => {
    for (const b of blocked) {
      const h = hash(b.x, b.y),
        { gx, gy } = groundOf(b.x * CELL, b.y * CELL);
      if (h < PAIR) sparkle(g, glow, gx + (h - 0.3) * 20, gy - 26 - h * 10, clock, h + b.x, lit);
      else if (h >= GEODE && h < FLOATER) {
        const bob = Math.sin(clock * 1.5 + h * 30) * 1.5;
        halo(glow, gx - 2, Y(gy - 2, 0, HOVER) + bob, 9, 0xb8e4ff, 0.14 * lit);
        for (let i = 0; i < 3; i++) {
          const a = clock * 1.2 + (i * Math.PI * 2) / 3;
          disc(g, gx - 2 + Math.cos(a) * 9, Y(gy - 2, Math.sin(a) * 9, HOVER), 0.9, 0xe8f6ff, 0.8);
        }
      } else if (h >= FLOATER && h < SENSOR) {
        const on = Math.sin(clock * 3 + h * 50) > 0.6 ? 1 : 0.2;
        disc(glow, gx + 4 + SENSOR_LAMP.x, gy + 2 + SENSOR_LAMP.y, 4, 0xff5a6a, 0.3 * on * lit);
        disc(g, gx + 4 + SENSOR_LAMP.x, gy + 2 + SENSOR_LAMP.y, 0.9, on > 0.5 ? 0xffd0d4 : 0x5a1a20);
      } else if (h >= SENSOR) {
        const beat = 0.5 + 0.5 * Math.sin(clock * 2 + h * 40);
        halo(glow, gx, Y(gy, 0, PYLON_CORE), 10, 0xf0c8ff, (0.08 + 0.1 * beat) * lit);
      }
    }
    if (!map.columns) return;
    const samples = channelOf(map),
      total = samples[samples.length - 1].s;
    for (let k = 0; k * 120 < total; k++) {
      const s = (k * 120 + clock * 40) % total,
        p = samples[Math.min(samples.length - 1, Math.floor(s / CHANNEL_STEP))];
      halo(glow, p.x, p.y, 8, SEAM, 0.22 * lit);
      disc(g, p.x, p.y, 1.5, 0xf4f0ff, 0.9);
    }
    // Motes drifting up over the field.
    const w = map.columns * CELL,
      h = map.rows * CELL;
    for (let k = 0; k < map.columns * 1.5; k++) {
      const s = hash(k, 601),
        life = (clock * (0.05 + s * 0.05) + s) % 1,
        x = s * w + Math.sin(clock * 0.6 + k) * 8,
        y = hash(k, 602) * h - life * 60;
      disc(glow, x, y, 2.5, ACCENT, 0.18 * Math.sin(Math.PI * life) * lit);
    }
    // Glints on the crystal sea.
    const n = CELL / SEA_TILE;
    for (const [k, depths] of seaField(map, SHORE)) {
      const [cx, cy] = k.split(",").map(Number);
      for (let j = 0; j < 2; j++) {
        const tx = Math.floor(hash01(cx, cy, j) * n),
          ty = Math.floor(hash01(cy, cx, j + 7) * n);
        if (depths[ty * n + tx] > 8) sparkle(g, glow, cx * CELL + tx * SEA_TILE, cy * CELL + ty * SEA_TILE, clock, hash01(j, cx, cy), lit, 0xe0d8ff);
      }
    }
  },
};
