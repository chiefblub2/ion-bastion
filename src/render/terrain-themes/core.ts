import { CELL, disc, hash01, type Ink, oval, shade, strokeOval } from "../shapes";
import { SQUASH, Y } from "../tower-art/tilt";
import { cellRandom, type Random, type StandingPiece, type Theme } from "./kit";
import { CHANNEL_STEP, channelOf, SEA_TILE, seaCells, seaField, shoreEdges } from "../coast";
import { blend } from "../ground";
import { halo } from "../material";
import { fnv } from "../../core/hash";
import type { MapDefinition } from "../../core/types";
import {
  AMBER, cabinetLeds, cabinetsOf, cabinetsShadow, capacitorLamps, capacitorsOf, capacitorsShadow, COOLING_LAMPS, COOLING_RIM, coolingTowerShadow,
  drawCabinets, drawCapacitors, drawCoolingTower, drawMast, drawSpire, drawTanks, drawTransformer, drawVent, MAST, mastShadow, MINT, railPost,
  rodRack, spireShadow, SPIRE_ORB, tanksOf, tanksShadow, transformerLamp, transformerOf, transformerShadow, ventFan, ventShadow, type Cabinets,
  type Capacitors, type Tanks, type Transformer,
} from "./core-props";

// Core Fortress: the armoured keep around a power core at night, on gunmetal deck plating. A power bus causeway
// instead of a sunken track: an armoured deck with a conduit trough down its middle, copper bus bars and an amber
// energy line pulsing towards the reactor; props in the towers' 3/4 tilt (`Theme.tilted`, `core-props.ts`):
// transformers, capacitor banks, server cabinets, coolant tanks, floor vents and insulator masts; a cooling tower and a
// shield spire as landmarks; and obstacle groups at the board edge turned into coolant pools (`Theme.sea`) glowing
// Cherenkov blue behind steel coping, with fuel-rod racks on their floor.

/** Mint, not gold, so the reactor stands apart from the amber entry. */
const ACCENT = MINT;
/** Kind thresholds of the first `cellRandom` draw. */
const TRANSFORMER = 0.22,
  CAPACITORS = 0.4,
  CABINETS = 0.58,
  TANKS = 0.74,
  VENT = 0.88;
/** Pools have straight steel walls. */
const QUAY = 0;

type Piece =
  | { kind: "transformer"; t: Transformer }
  | { kind: "capacitors"; c: Capacitors }
  | { kind: "cabinets"; c: Cabinets }
  | { kind: "tanks"; t: Tanks }
  | { kind: "vent" }
  | { kind: "mast"; c: Capacitors };
function pieceOf(rand: Random): Piece {
  const kind = rand();
  if (kind < TRANSFORMER) return { kind: "transformer", t: transformerOf(rand) };
  if (kind < CAPACITORS) return { kind: "capacitors", c: capacitorsOf(rand) };
  if (kind < CABINETS) return { kind: "cabinets", c: cabinetsOf(rand) };
  if (kind < TANKS) return { kind: "tanks", t: tanksOf(rand) };
  if (kind < VENT) return { kind: "vent" };
  return { kind: "mast", c: { ...capacitorsOf(rand), count: 2 } };
}
const groundOf = (x: number, y: number) => ({ gx: x + CELL / 2, gy: y + 36 });
/** Where a mast stands in its cell (it shares the cell with a small capacitor pair). */
const MAST_AT = { u: -7, v: -4 } as const,
  MAST_PAIR = { u: 9, v: 5 } as const;
/** A cell's piece rolled once per map for the ambient, from the same stream as its baked body. */
const PIECES = new Map<string, Piece>();
function pieceAt(map: MapDefinition, x: number, y: number) {
  const key = `${map.id}:${x}:${y}`;
  let p = PIECES.get(key);
  if (!p) PIECES.set(key, (p = pieceOf(cellRandom(map, x, y))));
  return p;
}

// ── Power bus causeway ──────────────────────────────────────────────────────────────────────────────────────────────
const DECK = 0x2e363e;
/**
 * The path as an armoured causeway with rounded bends (`coast.ts` `channelOf`): a steel kerb, deck plates with seams
 * and rivets, hazard chevrons along both edges, and down the middle a sunken conduit trough between copper bus bars
 * with the amber energy line in it. No arrows: the pulses running to the reactor show the way.
 */
function drawCauseway(g: Ink, map: MapDefinition) {
  const samples = channelOf(map),
    seed = fnv(`${map.id}:bus`),
    layer = (r: number, color: number) => {
      for (let i = 0; i < samples.length; i += 2) disc(g, samples[i].x, samples[i].y, r, color);
    },
    along = (o: number) => samples.map((p) => ({ x: p.x + p.nx * o, y: p.y + p.ny * o }));
  layer(25.5, 0x5a6670);
  layer(24, 0x1a2026);
  layer(23, DECK);
  // Deck plate seams across the causeway, rivets at their ends, a worn tone per plate.
  for (let i = 0; i + 9 < samples.length; i += 9) {
    const p = samples[i],
      q = samples[i + 9],
      tone = (hash01(seed, i) - 0.5) * 0.12;
    for (const side of [-1, 1]) {
      g.fillStyle(shade(DECK, tone), 1);
      g.fillPoints(
        [
          { x: p.x + p.nx * side * 8, y: p.y + p.ny * side * 8 },
          { x: p.x + p.nx * side * 21, y: p.y + p.ny * side * 21 },
          { x: q.x + q.nx * side * 21, y: q.y + q.ny * side * 21 },
          { x: q.x + q.nx * side * 8, y: q.y + q.ny * side * 8 },
        ],
        true,
      );
    }
    g.lineStyle(1, 0x161b20, 0.9);
    g.lineBetween(p.x - p.nx * 22, p.y - p.ny * 22, p.x + p.nx * 22, p.y + p.ny * 22);
    g.lineStyle(0.6, shade(DECK, 0.3), 0.6);
    g.lineBetween(p.x - p.nx * 22 + p.ny, p.y - p.ny * 22 - p.nx, p.x + p.nx * 22 + p.ny, p.y + p.ny * 22 - p.nx);
    for (const o of [-18, -11, 11, 18]) disc(g, p.x + p.nx * o - p.ny * 2.4, p.y + p.ny * o + p.nx * 2.4, 0.9, 0x6a7680);
  }
  // Hazard chevrons along both edges.
  for (let i = 0; i + 3 < samples.length; i += 3) {
    const p = samples[i],
      q = samples[i + 3],
      yellow = Math.floor(p.s / 9) % 2 === 0;
    g.lineStyle(2.4, yellow ? 0xc8a238 : 0x161b20, 0.85);
    for (const side of [-1, 1]) g.lineBetween(p.x + p.nx * side * 21, p.y + p.ny * side * 21, q.x + q.nx * side * 21, q.y + q.ny * side * 21);
  }
  // The conduit trough: lit lip, dark well, copper bus bars at its sides, the energy line in the middle.
  g.lineStyle(17, 0x5a6670, 1);
  g.strokePoints(along(-0.6), false);
  g.lineStyle(15, 0x0a0d10, 1);
  g.strokePoints(along(0), false);
  for (const side of [-1, 1]) {
    g.lineStyle(2.4, 0x4a2a14, 1);
    g.strokePoints(along(side * 5), false);
    g.lineStyle(1.2, 0xc88a4a, 0.95);
    g.strokePoints(along(side * 5 - 0.4), false);
  }
  g.lineStyle(2.6, 0x5a3a10, 1);
  g.strokePoints(along(0), false);
  g.lineStyle(1.2, AMBER, 0.9);
  g.strokePoints(along(0), false);
  // Clamps over the trough.
  for (let i = 12; i < samples.length; i += 24) {
    const p = samples[i],
      tx = p.ny,
      ty = -p.nx;
    g.fillStyle(0x3a4650);
    g.fillPoints([[-8, -1.6], [8, -1.6], [8, 1.6], [-8, 1.6]].map(([a, b]) => ({ x: p.x + p.nx * a + tx * b, y: p.y + p.ny * a + ty * b })), true);
    g.lineStyle(0.6, 0x6a7680, 0.9);
    g.lineBetween(p.x - p.nx * 8 - tx * 1.6, p.y - p.ny * 8 - ty * 1.6, p.x + p.nx * 8 - tx * 1.6, p.y + p.ny * 8 - ty * 1.6);
  }
}

// ── Coolant pools ───────────────────────────────────────────────────────────────────────────────────────────────────
/** Pool colours by distance from the wall: steel coping with its yellow line, the wall, then glowing blue water. */
function poolColor(d: number) {
  if (d < 1.2) return 0x6a7680;
  if (d < 2.4) return 0xc8a238;
  if (d < 3.6) return 0x5a6670;
  if (d < 8) return blend(0x0c161e, 0x0a2a3c, (d - 3.6) / 4.4);
  if (d < 60) return blend(0x0c344a, 0x125676, (d - 8) / 52);
  return 0x145e80;
}
function drawPools(g: Ink, map: MapDefinition) {
  const n = CELL / SEA_TILE,
    field = seaField(map, QUAY);
  for (const [k, depths] of field) {
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
        const c = poolColor(Math.round(depths[ty * n + tx] * 2) / 2);
        if (c !== color) {
          flush(tx);
          run = 0;
          color = c;
        }
        run++;
      }
      flush(n);
    }
    // Fuel-rod racks on the floor of the deep water.
    if (racked(depths, cx, cy)) rodRack(g, (cx + 0.5) * CELL, (cy + 0.5) * CELL);
  }
}
/** Whether a pool cell holds a fuel-rod rack: deep water only, and only some of it. */
const racked = (depths: Float32Array, cx: number, cy: number) => depths[(CELL / SEA_TILE / 2) * (CELL / SEA_TILE + 1)] > 40 && hash01(cx, cy, 31) < 0.22;
const COPING = new Map<string, StandingPiece[]>();
/** Handrail stanchions along the pool coping. */
function copingPieces(map: MapDefinition): readonly StandingPiece[] {
  const cached = COPING.get(map.id);
  if (cached) return cached;
  const list: StandingPiece[] = [];
  if (seaCells(map).size)
    for (const e of shoreEdges(map)) {
      const x = (e.x0 + e.x1) / 2 + e.nx * 1.5,
        y = (e.y0 + e.y1) / 2 + e.ny * 1.5;
      list.push({ x, y, shadow: () => undefined, draw: (g) => railPost(g, x, y) });
    }
  COPING.set(map.id, list);
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
function steam(g: Ink, x: number, y: number, clock: number, seed: number, size = 1, count = 5) {
  for (let i = 0; i < count; i++) {
    const life = (clock * 0.22 + i / count + hash01(seed)) % 1;
    disc(g, x + life * 14 * size + Math.sin(clock * 0.8 + i * 2) * 2 * size, y - life * 34 * size, (4 + life * 9) * size, 0xc8d4dc, 0.16 * Math.sin(Math.PI * life));
  }
}

// ── Theme ───────────────────────────────────────────────────────────────────────────────────────────────────────────
export const core: Theme = {
  backdrop: 0x0e1114,
  ground: [0x161b20, 0x13181c],
  grid: 0x39424b,
  path: { edge: 0x5a6670, bed: DECK, line: AMBER, arrow: 0xe8c25a },
  accent: ACCENT,
  drawPath: drawCauseway,
  sea: drawPools,
  obstacle: (g, x, y, rand) => {
    const p = pieceOf(rand),
      { gx, gy } = groundOf(x, y);
    if (p.kind === "transformer") drawTransformer(g, gx, gy, p.t);
    else if (p.kind === "capacitors") drawCapacitors(g, gx, gy, p.c);
    else if (p.kind === "cabinets") drawCabinets(g, gx, gy - 4, p.c);
    else if (p.kind === "tanks") drawTanks(g, gx, gy, p.t);
    else if (p.kind === "vent") drawVent(g, gx, gy - 2);
    else {
      drawMast(g, gx + MAST_AT.u, gy + MAST_AT.v * SQUASH);
      drawCapacitors(g, gx + MAST_PAIR.u, gy + MAST_PAIR.v * SQUASH, p.c);
    }
  },
  tilted: {
    shadow: (g, x, y, rand) => {
      const p = pieceOf(rand),
        { gx, gy } = groundOf(x, y);
      if (p.kind === "transformer") transformerShadow(g, gx, gy, p.t);
      else if (p.kind === "capacitors") capacitorsShadow(g, gx, gy, p.c);
      else if (p.kind === "cabinets") cabinetsShadow(g, gx, gy - 4, p.c);
      else if (p.kind === "tanks") tanksShadow(g, gx, gy, p.t);
      else if (p.kind === "vent") ventShadow(g, gx, gy - 2);
      else {
        mastShadow(g, gx + MAST_AT.u, gy + MAST_AT.v * SQUASH);
        capacitorsShadow(g, gx + MAST_PAIR.u, gy + MAST_PAIR.v * SQUASH, p.c);
      }
    },
    landmark: (g, x, y, s, variant) => {
      const { y0, k } = landmarkGround(x, y, s);
      scaled(g, x, y0, k, () => (variant ? spireShadow(g) : coolingTowerShadow(g)));
      scaled(g, x, y0, k, () => (variant ? drawSpire(g) : drawCoolingTower(g)));
    },
    // The cooling tower steams, its rim lamps blinking red; the shield spire's orb pulses and sends rings up.
    landmarkLight: (g, glow, x, y, s, variant, clock, lit) => {
      const { y0, k } = landmarkGround(x, y, s);
      if (variant) {
        const oy = Y(y0, 0, SPIRE_ORB * k),
          on = 0.6 + 0.4 * Math.sin(clock * 2.2 + x);
        halo(glow, x, oy, 22 * k, ACCENT, 0.28 * on * lit);
        disc(glow, x, oy, 6 * k, 0xe8fff0, 0.3 * on * lit);
        const life = (clock * 0.5 + hash01(x)) % 1;
        glow.lineStyle(1.5 * k, ACCENT, 0.3 * (1 - life) * lit);
        const r = (8 + life * 30) * k;
        strokeOval(glow, x, Y(y0, 0, (SPIRE_ORB - 10 + life * 20) * k), r * 2, r * 2 * SQUASH);
        return;
      }
      steam(g, x, Y(y0, 0, COOLING_RIM * k), clock, x, 1.4 * k, 6);
      const on = Math.sin(clock * 2.4 + x) > 0.2 ? 1 : 0.15;
      for (const l of COOLING_LAMPS) {
        disc(g, x + l.x * k, y0 + l.y * k, 1.3 * k, on > 0.5 ? 0xffb0a0 : 0x5a1a14);
        disc(glow, x + l.x * k, y0 + l.y * k, 5 * k, 0xff4a3a, 0.28 * on * lit);
      }
    },
    extras: copingPieces,
  },
  decor: (g, x, y, rand) => {
    const kind = rand(),
      cx = x + 12 + rand() * 32,
      cy = y + 12 + rand() * 32;
    if (kind < 0.3) {
      // An inspection hatch with four bolts.
      g.lineStyle(1, 0x1f262d, 0.9);
      g.strokeRect(x + 10, y + 12, CELL - 20, CELL - 24);
      for (const [dx, dy] of [[13, 15], [CELL - 13, 15], [13, CELL - 15], [CELL - 13, CELL - 15]]) disc(g, x + dx, y + dy, 1.2, 0x2e3840);
    } else if (kind < 0.55) {
      // Floor grating slats.
      g.lineStyle(2, 0x0c0f12);
      for (let i = 0; i < 4; i++) g.lineBetween(cx - 7, cy - 6 + i * 4, cx + 7, cy - 6 + i * 4);
    } else if (kind < 0.8) {
      // A cable run from the left edge to the bottom edge.
      const a = { x, y: y + 10 + rand() * 30 },
        b = { x: x + 10 + rand() * 30, y: y + CELL },
        c = { x: x + 20 + rand() * 20, y: y + 10 + rand() * 20 },
        cable = Array.from({ length: 9 }, (_, i) => {
          const t = i / 8;
          return { x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t ** 2 * b.x, y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t ** 2 * b.y };
        });
      g.lineStyle(3, 0x0a0d10);
      g.strokePoints(cable, false);
      g.lineStyle(1, 0x2a333c);
      g.strokePoints(cable, false);
    } else {
      // A stencilled hazard triangle.
      g.lineStyle(1.2, 0xc8a238, 0.4);
      g.strokeTriangle(cx, cy - 6, cx - 7, cy + 5, cx + 7, cy + 5);
      oval(g, cx, cy + 2.4, 0.9, 0.9, 0xc8a238, 0.4);
    }
  },
  // Server LEDs flickering, transformer and capacitor lamps, vent fans turning over a mint glow, red mast lamps,
  // energy pulses down the bus conduit to the reactor, lane lights, and the coolant pools shimmering.
  ambient: ({ g, glow, lit, map, clock, blocked }) => {
    for (const b of blocked) {
      const p = pieceAt(map, b.x, b.y),
        { gx, gy } = groundOf(b.x * CELL, b.y * CELL);
      if (p.kind === "cabinets")
        for (const l of cabinetLeds(p.c)) {
          const h = hash01(b.x, b.y, l.i),
            on = Math.floor(clock * (2 + h * 5) + h * 9) % 3 !== 0;
          if (!on) continue;
          const color = h < 0.7 ? ACCENT : h < 0.9 ? AMBER : 0xff5a4a;
          disc(g, gx + l.x, gy - 4 + l.y, 0.7, color);
          disc(glow, gx + l.x, gy - 4 + l.y, 2.2, color, 0.25 * lit);
        }
      else if (p.kind === "transformer") {
        const l = transformerLamp(p.t),
          on = Math.floor(clock * 1.5 + b.x * 0.7 + b.y) % 2 === 0;
        disc(g, gx + l.x, gy + l.y, 1.2, on ? ACCENT : 0x1a3a2a);
        if (on) disc(glow, gx + l.x, gy + l.y, 4, ACCENT, 0.3 * lit);
      } else if (p.kind === "capacitors" || p.kind === "mast") {
        const at = p.kind === "mast" ? { x: gx + MAST_PAIR.u, y: gy + MAST_PAIR.v * SQUASH } : { x: gx, y: gy },
          charge = (clock * 0.4 + hash01(b.x, b.y)) % 1;
        capacitorLamps(p.c).forEach((l, i) => {
          const on = charge > i / p.c.count ? 1 : 0.2;
          disc(g, at.x + l.x, at.y + l.y, 1, on > 0.5 ? AMBER : 0x3a2a10);
          if (on > 0.5) disc(glow, at.x + l.x, at.y + l.y, 3.4, AMBER, 0.22 * lit);
        });
        if (p.kind === "mast") {
          const on = Math.sin(clock * 3 + b.x + b.y) > 0.3 ? 1 : 0.15,
            mx = gx + MAST_AT.u,
            my = Y(gy + MAST_AT.v * SQUASH, 0, MAST);
          disc(g, mx, my, 1.5, on > 0.5 ? 0xffb0a0 : 0x5a1a14);
          disc(glow, mx, my, 4.5, 0xff4a3a, 0.25 * on * lit);
        }
      } else if (p.kind === "vent") {
        const vx = gx,
          vy = gy - 2;
        halo(glow, vx, Y(vy, 0, 8), 9, ACCENT, (0.1 + 0.04 * Math.sin(clock * 2 + b.x)) * lit);
        ventFan(g, vx, vy, clock, b.x * 3 + b.y);
      }
    }
    if (!map.columns) return;
    const samples = channelOf(map),
      total = samples[samples.length - 1].s;
    // Energy pulses down the conduit, towards the reactor.
    for (let k = 0; k * 140 < total; k++) {
      const s = (k * 140 + clock * 70) % total,
        i = Math.min(samples.length - 1, Math.floor(s / CHANNEL_STEP));
      for (let t = 0; t < 6; t++) {
        const q = samples[Math.max(0, i - t * 2)];
        disc(g, q.x, q.y, 1.6 - t * 0.2, 0xffe6a0, 0.7 * (1 - t / 6));
      }
      halo(glow, samples[i].x, samples[i].y, 12, AMBER, 0.22 * lit);
    }
    // Lane lights in the kerbs, breathing in turn.
    for (let i = 0; i < samples.length; i += 14) {
      const p = samples[i],
        on = Math.max(0.2, Math.sin(clock * 2 - p.s * 0.02)) ** 2;
      for (const side of [-1, 1]) {
        const x = p.x + p.nx * side * 15,
          y = p.y + p.ny * side * 15;
        disc(glow, x, y, 3.2, ACCENT, 0.22 * on * lit);
        disc(g, x, y, 0.8, 0xe8fff0, 0.3 + 0.6 * on);
      }
    }
    // The coolant pools: a shimmer drifting over the water and the rod racks glowing.
    const n = CELL / SEA_TILE;
    for (const [key, depths] of seaField(map, QUAY)) {
      const [cx, cy] = key.split(",").map(Number);
      if (racked(depths, cx, cy)) halo(glow, (cx + 0.5) * CELL, (cy + 0.5) * CELL, 24, 0x5ac8ff, (0.22 + 0.06 * Math.sin(clock * 1.7 + cx)) * lit);
      for (let j = 0; j < 2; j++) {
        const tx = Math.floor(hash01(cx, cy, j) * n),
          ty = Math.floor(hash01(cy, cx, j + 3) * n);
        if (depths[ty * n + tx] < 12) continue;
        const life = (clock * 0.3 + hash01(j, cx, cy)) % 1,
          x = cx * CELL + tx * SEA_TILE + Math.sin(clock * 0.5 + j) * 6,
          y = cy * CELL + ty * SEA_TILE;
        oval(glow, x, y, 6 + life * 6, (6 + life * 6) * SQUASH, 0x7ad8ff, 0.08 * Math.sin(Math.PI * life) * lit);
      }
    }
  },
};
