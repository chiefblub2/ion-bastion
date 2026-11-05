import { CELL, disc, hash01, type Ink, oval, shade } from "../shapes";
import { Y } from "../tower-art/tilt";
import { cellRandom, mulberry32, type Random, type StandingPiece, type Theme } from "./kit";
import { channelOf, SEA_TILE, seaCells, seaField, shoreLine } from "../coast";
import { blend } from "../ground";
import { halo } from "../material";
import { fnv } from "../../core/hash";
import type { MapDefinition } from "../../core/types";
import type { Crystal } from "./shard-props";
import {
  ASH, bouldersOf, bouldersShadow, CART_ORE, cartShadow, cragShadow, drawBoulders, drawCart, drawCrag, drawHut, drawObsidian, drawRig, drawVent,
  drawWellhead, FALL, hutBeacon, hutShadow, LAVA, obsidianOf, obsidianShadow, RIG, rigShadow, SULPHUR, VENT_MOUTH, ventShadow, WELL, wellheadShadow,
  type Boulder,
} from "./volcano-props";

// Volcano Chain: a pale ash plain on the flank of an active volcano, worked by a mining outpost. A rutted ash road
// instead of the sunken track: packed grey ash with dark wheel ruts, pumice, sulphur crust along its edges and the odd
// crack still glowing; props in the towers' 3/4 tilt (`Theme.tilted`, `volcano-props.ts`): sulphur vents, ash-dusted
// obsidian, ash-capped boulders, drill rigs over glowing boreholes, ore carts of glowing magma ore and sensor huts; a
// geothermal wellhead venting steam and a basalt crag with a lava fall as landmarks; obstacle groups at the board edge
// turned into lava rivers (`Theme.sea`) running between black, sulphur-crusted banks; and ash falling over everything.

const ACCENT = SULPHUR;
/** Kind thresholds of the first `cellRandom` draw. */
const VENT = 0.24,
  OBSIDIAN = 0.42,
  BOULDER = 0.6,
  RIG_KIND = 0.72,
  CART = 0.84;
/** A lava river meanders a little. */
const SHORE = 5;

type Piece =
  | { kind: "vent"; s: number }
  | { kind: "obsidian"; obsidian: Crystal[] }
  | { kind: "boulder"; boulders: Boulder[] }
  | { kind: "rig"; a: number; boulders: Boulder[] }
  | { kind: "cart"; a: number }
  | { kind: "hut"; a: number };
function pieceOf(rand: Random): Piece {
  const kind = rand();
  if (kind < VENT) return { kind: "vent", s: 0.85 + rand() * 0.3 };
  if (kind < OBSIDIAN) return { kind: "obsidian", obsidian: obsidianOf(rand) };
  if (kind < BOULDER) return { kind: "boulder", boulders: bouldersOf(rand) };
  if (kind < RIG_KIND) return { kind: "rig", a: rand() * Math.PI * 2, boulders: [{ ...bouldersOf(rand)[0], r: 6, du: -12, dv: 8 }] };
  if (kind < CART) return { kind: "cart", a: (rand() - 0.5) * 0.9 };
  return { kind: "hut", a: (rand() - 0.5) * 0.7 };
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

// ── Ash road ────────────────────────────────────────────────────────────────────────────────────────────────────────
const ROAD = 0x6a645c;
/**
 * The path as a haul road of packed ash with rounded bends (`coast.ts` `channelOf`): sulphur-crusted verges, pale
 * ash drifted over the edges, two dark wheel ruts, pumice and grit, and here and there a crack still glowing.
 */
function drawAshRoad(g: Ink, map: MapDefinition) {
  const samples = channelOf(map),
    seed = fnv(`${map.id}:ash`),
    layer = (r: number, color: number) => {
      for (let i = 0; i < samples.length; i += 2) disc(g, samples[i].x, samples[i].y, r, color);
    },
    along = (o: number) => samples.map((p) => ({ x: p.x + p.nx * o, y: p.y + p.ny * o }));
  layer(25.5, 0x8a8478);
  layer(23.5, 0x7a7468);
  layer(22, ROAD);
  // Sulphur crust and ash drifts along the verges.
  for (let i = 0; i < samples.length; i += 2) {
    const p = samples[i],
      h = hash01(seed, i);
    if (h > 0.3) continue;
    const side = h < 0.15 ? -1 : 1,
      o = side * (21 + hash01(seed, i, 2) * 3);
    disc(g, p.x + p.nx * o, p.y + p.ny * o, 1.2 + h * 4, hash01(seed, i, 3) < 0.3 ? shade(SULPHUR, -0.3) : shade(ASH, -0.2), 0.7);
  }
  // Wheel ruts.
  for (const side of [-1, 1]) {
    g.lineStyle(5, shade(ROAD, -0.3), 0.8);
    g.strokePoints(along(side * 9), false);
    g.lineStyle(1, shade(ROAD, -0.45), 0.7);
    g.strokePoints(along(side * 9 + 1.5), false);
  }
  // Tread marks across the ruts.
  for (let i = 0; i < samples.length; i += 2) {
    const p = samples[i];
    for (const side of [-1, 1]) {
      const cx = p.x + p.nx * side * 9,
        cy = p.y + p.ny * side * 9;
      g.lineStyle(0.6, shade(ROAD, -0.5), 0.6);
      g.lineBetween(cx - p.nx * 2, cy - p.ny * 2, cx + p.nx * 2, cy + p.ny * 2);
    }
  }
  // Pumice and grit.
  for (let i = 0; i < samples.length; i += 2) {
    if (hash01(seed, i, 4) > 0.35) continue;
    const p = samples[i],
      o = (hash01(seed, i, 5) - 0.5) * 36;
    disc(g, p.x + p.nx * o, p.y + p.ny * o, 0.7 + hash01(seed, i, 6) * 1.4, hash01(seed, i, 7) < 0.5 ? 0x9a948a : 0x3a3634, 0.9);
  }
  // Cracks still glowing, a few along the road.
  for (let i = 20; i < samples.length; i += 53) {
    const p = samples[i],
      tx = p.ny,
      ty = -p.nx,
      pts = [-1, -0.4, 0.2, 0.8].map((k, j) => ({ x: p.x + p.nx * (hash01(seed, i, j) - 0.5) * 10 + tx * k * 10, y: p.y + p.ny * (hash01(seed, i, j) - 0.5) * 10 + ty * k * 10 }));
    g.lineStyle(2, 0x2a1408, 0.9);
    g.strokePoints(pts, false);
    g.lineStyle(0.9, LAVA, 0.9);
    g.strokePoints(pts, false);
  }
}

// ── Lava river ──────────────────────────────────────────────────────────────────────────────────────────────────────
/** A lava river on the edge cells: a sulphur-crusted bank of black basalt, a molten edge, and bright flowing lava. */
function drawLavaRiver(g: Ink, map: MapDefinition) {
  const n = CELL / SEA_TILE,
    seed = fnv(`${map.id}:river`);
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
        if (d < 2) c = shade(SULPHUR, -0.2);
        else if (d < 6) c = 0x2a2626;
        else if (d < 8) c = 0x5a1a08;
        else {
          // Bands of cooler skin drifting on the flow.
          const band = Math.sin(x * 0.07 + Math.sin(y * 0.05 + hash01(seed) * 6) * 2.4 + y * 0.03);
          c = band > 0.85 ? 0xf06a1e : blend(0xff7a24, 0xffa040, Math.min(1, (d - 8) / 40));
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
const BANK = new Map<string, StandingPiece[]>();
/** Obsidian and the odd boulder along the lava banks, clear of the path. */
function bankPieces(map: MapDefinition): readonly StandingPiece[] {
  const cached = BANK.get(map.id);
  if (cached) return cached;
  const list: StandingPiece[] = [],
    path = map.path.map((p) => ({ x: (p.x + 0.5) * CELL, y: (p.y + 0.5) * CELL }));
  if (seaCells(map).size)
    for (const s of shoreLine(map, 2, 34)) {
      const rand = mulberry32(fnv(`${map.id}:bank:${Math.round(s.x)}:${Math.round(s.y)}`)),
        roll = rand();
      if (roll > 0.45 || path.some((p) => (p.x - s.x) ** 2 + (p.y - s.y) ** 2 < 44 * 44)) continue;
      if (roll < 0.15) {
        const b = [{ ...bouldersOf(rand)[0], r: 7 + rand() * 3, du: 0, dv: 0 }];
        list.push({ x: s.x, y: s.y, shadow: (g) => bouldersShadow(g, s.x, s.y, b), draw: (g) => drawBoulders(g, s.x, s.y, b) });
      } else {
        const o = obsidianOf(rand, 0.55 + rand() * 0.2);
        list.push({ x: s.x, y: s.y, shadow: (g) => obsidianShadow(g, s.x, s.y, o), draw: (g) => drawObsidian(g, s.x, s.y, o) });
      }
    }
  BANK.set(map.id, list);
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
/** Steam puffs rising from (x, y), drifting right and fading. */
function steam(g: Ink, x: number, y: number, clock: number, seed: number, size = 1, count = 4) {
  for (let i = 0; i < count; i++) {
    const life = (clock * 0.28 + i / count + hash01(seed)) % 1;
    disc(g, x + life * 12 * size + Math.sin(clock + i * 2) * 2 * size, y - life * 30 * size, (2.5 + life * 7) * size, 0xf0ece4, 0.3 * Math.sin(Math.PI * life));
  }
}

// ── Theme ───────────────────────────────────────────────────────────────────────────────────────────────────────────
export const volcano: Theme = {
  backdrop: 0x2a2726,
  ground: [0x4a4542, 0x433f3c],
  grid: 0x5f5954,
  path: { edge: 0x8a8478, bed: ROAD, line: LAVA, arrow: SULPHUR },
  accent: ACCENT,
  drawPath: drawAshRoad,
  sea: drawLavaRiver,
  obstacle: (g, x, y, rand) => {
    const p = pieceOf(rand),
      { gx, gy } = groundOf(x, y);
    if (p.kind === "vent") drawVent(g, gx, gy, p.s);
    else if (p.kind === "obsidian") drawObsidian(g, gx, gy, p.obsidian);
    else if (p.kind === "boulder") drawBoulders(g, gx, gy, p.boulders);
    else if (p.kind === "rig") {
      drawRig(g, gx + 2, gy - 4, p.a);
      drawBoulders(g, gx, gy, p.boulders);
    } else if (p.kind === "cart") drawCart(g, gx, gy, p.a);
    else drawHut(g, gx, gy - 2, p.a);
  },
  tilted: {
    shadow: (g, x, y, rand) => {
      const p = pieceOf(rand),
        { gx, gy } = groundOf(x, y);
      if (p.kind === "vent") ventShadow(g, gx, gy, p.s);
      else if (p.kind === "obsidian") obsidianShadow(g, gx, gy, p.obsidian);
      else if (p.kind === "boulder") bouldersShadow(g, gx, gy, p.boulders);
      else if (p.kind === "rig") {
        rigShadow(g, gx + 2, gy - 4);
        bouldersShadow(g, gx, gy, p.boulders);
      } else if (p.kind === "cart") cartShadow(g, gx, gy, p.a);
      else hutShadow(g, gx, gy - 2, p.a);
    },
    landmark: (g, x, y, s, variant) => {
      const { y0, k } = landmarkGround(x, y, s);
      scaled(g, x, y0, k, () => (variant ? cragShadow(g) : wellheadShadow(g)));
      scaled(g, x, y0, k, () => (variant ? drawCrag(g) : drawWellhead(g)));
    },
    // The wellhead's silencer vents a column of steam; the lava fall pulses and its pool glows and spits.
    landmarkLight: (g, glow, x, y, s, variant, clock, lit) => {
      const { y0, k } = landmarkGround(x, y, s);
      if (variant) {
        const px = x + FALL.pool.u * k,
          py = Y(y0, FALL.pool.v * k, 0);
        halo(glow, px, py, 26 * k, LAVA, (0.24 + 0.06 * Math.sin(clock * 2 + x)) * lit);
        halo(glow, x + FALL.top.u * k, Y(y0, 0, FALL.top.h * 0.6 * k), 14 * k, 0xff8a3a, 0.18 * lit);
        for (let i = 0; i < 3; i++) {
          const life = (clock * 0.6 + i / 3) % 1,
            t = (life - 0.5 + i * 0.1) * 1.2;
          disc(g, px + Math.sin(t * 3 + i) * 10 * k, py - Math.sin(Math.PI * life) * 12 * k, 1.2 * k, 0xffc070, 1 - life);
        }
        const fall = (clock * 0.8) % 1;
        disc(g, x + (FALL.top.u + (FALL.pool.u - FALL.top.u) * fall) * k, Y(y0, FALL.pool.v * fall * k, FALL.top.h * (1 - fall) * k), 1.8 * k, 0xfff0b0, 0.8);
        return;
      }
      steam(g, x + WELL.u * k, Y(y0, -10 * k, WELL.steam * k), clock, x, 1.8 * k, 6);
      halo(glow, x, Y(y0, 6 * k, 22 * k), 6 * k, 0xff4a3a, (Math.sin(clock * 3 + x) > 0.3 ? 0.3 : 0.05) * lit);
    },
    extras: bankPieces,
  },
  decor: (g, x, y, rand) => {
    const kind = rand(),
      cx = x + 12 + rand() * 32,
      cy = y + 14 + rand() * 28;
    if (kind < 0.4) {
      // Pale ash drift.
      oval(g, cx, cy, 10 + rand() * 6, 3 + rand() * 2, 0xaaa49b, 0.4);
      oval(g, cx - 2, cy - 1, 6 + rand() * 3, 1.6, 0xd0cac0, 0.35);
    } else if (kind < 0.6) {
      // Sulphur crust.
      for (let i = 0; i < 4; i++) disc(g, cx + (rand() - 0.5) * 12, cy + (rand() - 0.5) * 6, 1 + rand() * 1.4, rand() < 0.5 ? SULPHUR : 0xc9a92c, 0.75);
    } else if (kind < 0.8) {
      // Pumice and scoria.
      for (let i = 0; i < 5; i++) disc(g, cx + (rand() - 0.5) * 14, cy + (rand() - 0.5) * 8, 0.9 + rand() * 1.2, rand() < 0.5 ? 0x9a948a : 0x2a2626, 0.9);
    } else {
      // A cooled lava streak, dim orange at its core.
      g.lineStyle(3.6, 0x1c1816, 0.8);
      g.lineBetween(cx - 8, cy + 2, cx + 8, cy - 2);
      g.lineStyle(1.2, 0xc2441a, 0.55);
      g.lineBetween(cx - 7, cy + 2, cx + 7, cy - 2);
    }
  },
  // Steam from the vents, boreholes and ore glowing, beacons blinking, the lava rivers flowing, ash falling.
  ambient: ({ g, glow, lit, map, clock, hash, blocked }) => {
    for (const b of blocked) {
      const p = pieceAt(map, b.x, b.y),
        { gx, gy } = groundOf(b.x * CELL, b.y * CELL);
      if (p.kind === "vent") {
        const my = Y(gy, 0, VENT_MOUTH * p.s);
        steam(g, gx, my - 1, clock, b.x * 7 + b.y, p.s);
        halo(glow, gx, my, 7 * p.s, 0xff8a2a, (0.14 + 0.05 * Math.sin(clock * 3 + b.x)) * lit);
      } else if (p.kind === "rig") {
        halo(glow, gx + 2, gy - 4, 12, LAVA, (0.22 + 0.06 * Math.sin(clock * 2.4 + b.y)) * lit);
        const on = Math.sin(clock * 2.6 + b.x + b.y) > 0.3 ? 1 : 0.15;
        disc(g, gx + 2, Y(gy - 4, 0, RIG.lamp), 1.3, on > 0.5 ? 0xffb0a0 : 0x5a1a14);
        disc(glow, gx + 2, Y(gy - 4, 0, RIG.lamp), 5, 0xff4a3a, 0.3 * on * lit);
      } else if (p.kind === "cart") halo(glow, gx, Y(gy, 0, CART_ORE.h), 10, LAVA, (0.16 + 0.05 * Math.sin(clock * 1.8 + b.x)) * lit);
      else if (p.kind === "hut") {
        const l = hutBeacon(p.a),
          on = Math.sin(clock * 2 + b.x * 1.3 + b.y) > 0.5 ? 1 : 0.2;
        disc(g, gx + l.x, gy - 2 + l.y, 1.3, on > 0.5 ? 0xfff08a : 0x5a4a14);
        disc(glow, gx + l.x, gy - 2 + l.y, 5, SULPHUR, 0.3 * on * lit);
      }
    }
    if (!map.columns) return;
    const w = map.columns * CELL,
      h = map.rows * CELL;
    // The lava rivers flowing: bright flecks drifting with the current, glow breathing over them.
    const n = CELL / SEA_TILE;
    for (const [key, depths] of seaField(map, SHORE)) {
      const [cx, cy] = key.split(",").map(Number);
      for (let j = 0; j < 3; j++) {
        const life = (clock * 0.25 + hash01(cx, cy, j)) % 1,
          tx = Math.floor(((hash01(cy, cx, j) + life) % 1) * n),
          ty = Math.floor(hash01(cx, j, cy) * n);
        if (depths[ty * n + tx] < 9) continue;
        oval(g, cx * CELL + tx * SEA_TILE, cy * CELL + ty * SEA_TILE, 4, 1.2, 0xffe0a0, 0.6 * Math.sin(Math.PI * life));
      }
      if (hash01(cx, cy, 9) < 0.5) halo(glow, (cx + 0.5) * CELL, (cy + 0.5) * CELL, 34, LAVA, (0.1 + 0.03 * Math.sin(clock + cx)) * lit);
    }
    // Ash falling slowly over the board.
    for (let k = 0; k < Math.ceil(map.columns * 2.2); k++) {
      const s = hash(k, 91),
        life = (clock * (0.035 + s * 0.03) + hash(k, 92)) % 1,
        fx = s * w + Math.sin(clock * 0.6 + s * 30) * 14 + life * 30,
        fy = life * (h + 20) - 10;
      g.fillStyle(0xb8b2a8, 0.28 + 0.2 * s);
      g.fillRect(fx, fy, 2 + s * 1.5, 1.6);
    }
  },
};
