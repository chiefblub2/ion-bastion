import { CELL, disc, fillOval, hash01, type Ink, oval, shade } from "../shapes";
import { SQUASH, Y } from "../tower-art/tilt";
import { type Random, type StandingPiece, type Theme } from "./kit";
import { CHANNEL_STEP, channelOf, SEA_TILE, seaCells, seaField, shoreEdges, wobble } from "../coast";
import { blend } from "../ground";
import { fnv } from "../../core/hash";
import type { MapDefinition } from "../../core/types";
import {
  barriersOf, barriersShadow, containerOf, containerShadow, cratesOf, crateShadow, drawBarriers, drawContainer, drawCrates, drawDrums,
  drawFence, drawGenerator, drawHedgehog, drawHelipad, drawMast, drawSandbags, drawWatchtower, drumsOf, drumsShadow, exhaustTip,
  fenceShadow, generatorShadow, HELIPAD_LIGHTS, hedgehogShadow, helipadShadow, mastLamps, mastShadow, sandbagsOf, sandbagsShadow,
  TOWER_LIGHT, watchtowerShadow, windsock, type Barrier, type Container, type Crate, type Drum, type Sandbags,
} from "./outpost-props";

// Border Zone outpost: a frontier army post on weathered concrete. A convoy road with hazard kerbs, edge lines and a
// dashed centre line instead of a sunken track; props in the towers' 3/4 tilt (`Theme.tilted`, `outpost-props.ts`):
// crate stacks, fuel drums, sandbag walls, concrete barriers, floodlight masts, containers and generators; a watchtower
// with a sweeping searchlight and a helipad as landmarks; and obstacle groups at the board edge turned into
// no-man's-land (`Theme.sea`): scorched earth with craters and tank traps behind a chain-link fence with razor wire.

const ACCENT = 0x93f5b8;
/** Kind thresholds of the first `cellRandom` draw (`hash` in the ambient names the prop the same way). */
const CRATES = 0.28,
  DRUMS = 0.44,
  SANDBAGS = 0.56,
  BARRIERS = 0.66,
  MAST = 0.74,
  CONTAINER = 0.86;
/** A mast's and a generator's facing come from the kind draw itself, so the ambient finds their lamps and exhausts. */
const mastFacing = (kind: number) => ((kind - BARRIERS) / (MAST - BARRIERS)) * Math.PI * 2;
const generatorFacing = (kind: number) => ((kind - CONTAINER) / (1 - CONTAINER)) * Math.PI * 2;

type Piece =
  | { kind: "crates"; crates: Crate[] }
  | { kind: "drums"; drums: Drum[] }
  | { kind: "sandbags"; wall: Sandbags; extra: Crate[] }
  | { kind: "barriers"; barriers: Barrier[] }
  | { kind: "mast"; a: number; drums: Drum[] }
  | { kind: "container"; container: Container }
  | { kind: "generator"; a: number };
function pieceOf(rand: Random): Piece {
  const kind = rand();
  if (kind < CRATES) return { kind: "crates", crates: cratesOf(rand) };
  if (kind < DRUMS) return { kind: "drums", drums: drumsOf(rand) };
  if (kind < SANDBAGS) return { kind: "sandbags", wall: sandbagsOf(rand), extra: rand() < 0.5 ? [{ du: 0, dv: -9, a: (rand() - 0.5) * 0.6, s: 6.5, z: 0, color: 0x3e4a34, mark: true }] : [] };
  if (kind < BARRIERS) return { kind: "barriers", barriers: barriersOf(rand) };
  if (kind < MAST) return { kind: "mast", a: mastFacing(kind), drums: rand() < 0.5 ? [{ du: 11, dv: 8, color: 0xc89a2a, tipped: false }] : [] };
  if (kind < CONTAINER) return { kind: "container", container: containerOf(rand) };
  return { kind: "generator", a: generatorFacing(kind) };
}
/** Ground point of a cell's prop. */
const groundOf = (x: number, y: number) => ({ gx: x + CELL / 2, gy: y + 34 });

// ── Convoy road ─────────────────────────────────────────────────────────────────────────────────────────────────────
const ROAD = { shoulder: 27.5, kerb: 23, kerbInner: 21.4, asphalt: 20.4, line: 16.4, track: 8 } as const;
const ASPHALT = 0x2c3034;
/**
 * The path as a convoy road with rounded bends (`coast.ts` `channelOf`): a gravel shoulder, a concrete kerb painted in
 * hazard stripes, worn asphalt with tyre tracks, white edge lines and a dashed amber centre line, cracks, patches and
 * a few puddles. No arrows: the studs blinking along the edges and the drifting chevrons show the way.
 */
function drawRoad(g: Ink, map: MapDefinition) {
  const samples = channelOf(map),
    seed = fnv(`${map.id}:road`),
    layer = (r: number, color: number, step = 2) => {
      for (let i = 0; i < samples.length; i += step) disc(g, samples[i].x, samples[i].y, r, color);
    },
    along = (o: number) => samples.map((p) => ({ x: p.x + p.nx * o, y: p.y + p.ny * o }));
  layer(ROAD.shoulder, 0x3e3d36);
  layer(ROAD.kerb, 0x8e9088);
  layer(ROAD.kerbInner, 0x5c5e58);
  layer(ROAD.asphalt, ASPHALT);
  // Gravel on the shoulder.
  for (let i = 0; i < samples.length; i += 2) {
    const p = samples[i],
      h = hash01(seed, i);
    for (const side of [-1, 1]) if (h > 0.4) disc(g, p.x + p.nx * side * (24.5 + h * 2.5), p.y + p.ny * side * (24.5 + h * 2.5), 0.7 + h * 0.8, shade(0x3e3d36, h > 0.7 ? 0.25 : -0.2), 0.8);
  }
  // Hazard stripes along both kerbs.
  for (let i = 0; i + 3 < samples.length; i += 3) {
    const p = samples[i],
      q = samples[i + 3],
      yellow = Math.floor(p.s / 9) % 2 === 0;
    g.lineStyle(1.8, yellow ? 0xd8b040 : 0x26282a, 0.9);
    for (const side of [-1, 1]) g.lineBetween(p.x + p.nx * side * 22.2, p.y + p.ny * side * 22.2, q.x + q.nx * side * 22.2, q.y + q.ny * side * 22.2);
  }
  // Asphalt grain, patches and cracks.
  for (let i = 0; i < samples.length; i += 1) {
    const p = samples[i],
      h = hash01(seed, i, 3),
      o = (hash01(seed, i, 4) - 0.5) * 36;
    if (h < 0.35) disc(g, p.x + p.nx * o, p.y + p.ny * o, 0.6, shade(ASPHALT, h < 0.17 ? 0.18 : -0.25), 0.8);
    if (h > 0.985) {
      const w = 6 + hash01(seed, i, 5) * 8;
      g.fillStyle(shade(ASPHALT, -0.15), 0.9);
      g.fillPoints([-1, 1].flatMap((k) => [{ x: p.x + p.nx * (o - w / 2) + p.ny * k * w * 0.6, y: p.y + p.ny * (o - w / 2) - p.nx * k * w * 0.6 }, { x: p.x + p.nx * (o + w / 2) + p.ny * k * w * 0.6, y: p.y + p.ny * (o + w / 2) - p.nx * k * w * 0.6 }]).sort((a, b) => Math.atan2(a.y - p.y, a.x - p.x) - Math.atan2(b.y - p.y, b.x - p.x)), true);
    } else if (h > 0.965) {
      let x = p.x + p.nx * o,
        y = p.y + p.ny * o;
      g.lineStyle(0.8, shade(ASPHALT, -0.4), 0.9);
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        x += (hash01(seed, i, 10 + k) - 0.5) * 9;
        y += (hash01(seed, i, 20 + k) - 0.5) * 9;
        g.lineTo(x, y);
      }
      g.strokePath();
    }
  }
  // Tyre tracks, then the white edge lines.
  for (const side of [-1, 1]) {
    g.lineStyle(4.5, 0x1c1f22, 0.3);
    g.strokePoints(along(side * ROAD.track), false);
    g.lineStyle(1.4, 0xdedcd0, 0.75);
    g.strokePoints(along(side * ROAD.line), false);
  }
  // Dashed amber centre line.
  g.lineStyle(1.6, 0xe0a43a, 0.8);
  for (let i = 0; i + 3 < samples.length; i++) {
    const p = samples[i];
    if (Math.floor(p.s / 9) % 2 || Math.floor(samples[i + 1].s / 9) % 2) continue;
    g.lineBetween(p.x, p.y, samples[i + 1].x, samples[i + 1].y);
  }
  // A few puddles catching the sky.
  for (let i = 30; i < samples.length; i += 37) {
    if (hash01(seed, i, 7) > 0.45) continue;
    const p = samples[i],
      o = (hash01(seed, i, 8) - 0.5) * 22;
    oval(g, p.x + p.nx * o, p.y + p.ny * o, 6 + hash01(seed, i, 9) * 4, 2.6, 0x3e4e5a, 0.85);
    g.lineStyle(0.8, 0x8aa0b0, 0.6);
    g.lineBetween(p.x + p.nx * o - 3, p.y + p.ny * o - 0.6, p.x + p.nx * o + 1, p.y + p.ny * o - 0.6);
  }
}

// ── No-man's-land ───────────────────────────────────────────────────────────────────────────────────────────────────
/** Colours of no-man's-land by distance from the outpost (`seaField`): a gravel verge, then dark earth, then scorched ground. */
const WASTE: readonly [number, number][] = [
  [0, 0x3e3d36],
  [7, 0x3a382f],
  [14, 0x2e2a24],
  [40, 0x26221d],
  [120, 0x1e1b18],
];
function wasteColor(d: number, n: number) {
  let c = WASTE[WASTE.length - 1][1];
  for (let i = 1; i < WASTE.length; i++)
    if (d < WASTE[i][0]) {
      c = blend(WASTE[i - 1][1], WASTE[i][1], (d - WASTE[i - 1][0]) / (WASTE[i][0] - WASTE[i - 1][0]));
      break;
    }
  return d > 14 ? blend(c, n > 0 ? 0x34261a : 0x141312, Math.abs(n) * 0.35) : c;
}
interface Crater { x: number; y: number; r: number; smoke: boolean }
const CRATERS = new Map<string, Crater[]>();
/** Shell craters out in no-man's-land: about one in three cells deep enough, jittered off the cell centre. */
function cratersOf(map: MapDefinition): readonly Crater[] {
  const cached = CRATERS.get(map.id);
  if (cached) return cached;
  const list: Crater[] = [],
    seed = fnv(`${map.id}:craters`),
    n = CELL / SEA_TILE;
  for (const [k, depths] of seaField(map)) {
    const [cx, cy] = k.split(",").map(Number);
    if (hash01(seed, cx, cy) > 0.38 || depths[(n / 2) * n + n / 2] < 22) continue;
    list.push({ x: (cx + 0.3 + 0.4 * hash01(seed, cy, cx)) * CELL, y: (cy + 0.3 + 0.4 * hash01(cx, seed, cy)) * CELL, r: 8 + 7 * hash01(seed, cx * 7, cy), smoke: hash01(seed, cy * 3, cx) < 0.5 });
  }
  CRATERS.set(map.id, list);
  return list;
}
/** No-man's-land on the edge cells: verge, earth and scorched ground by distance, with shell craters and debris. */
function drawWaste(g: Ink, map: MapDefinition) {
  const n = CELL / SEA_TILE,
    seed = fnv(`${map.id}:waste`);
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
        const x = cx * CELL + tx * SEA_TILE,
          noise = Math.round(wobble(seed, x, y, 26) * 4) / 4,
          c = wasteColor(Math.round(depths[ty * n + tx]), noise);
        if (c !== color) {
          flush(tx);
          run = 0;
          color = c;
        }
        run++;
      }
      flush(n);
    }
    // Debris: stones and twisted scrap.
    for (let i = 0; i < 4; i++) {
      const x = (cx + hash01(seed, cx, cy * 9 + i)) * CELL,
        y = (cy + hash01(seed, cy, cx * 9 + i)) * CELL;
      if (hash01(seed, i, cx + cy) < 0.5) oval(g, x, y, 1.6 + hash01(seed, x, y) * 1.8, 1.1, 0x48443c, 0.9);
      else {
        g.lineStyle(1, 0x5a4a3a, 0.8);
        g.lineBetween(x - 3, y, x + 2, y - 2);
        g.lineBetween(x + 2, y - 2, x + 4, y + 1);
      }
    }
  }
  for (const c of cratersOf(map)) {
    oval(g, c.x + 1, c.y + 1, c.r + 3, (c.r + 3) * SQUASH, 0x3e362c);
    oval(g, c.x, c.y, c.r, c.r * SQUASH, 0x15130f);
    oval(g, c.x + c.r * 0.15, c.y + c.r * 0.1, c.r * 0.75, c.r * 0.75 * SQUASH, 0x221e19);
    g.lineStyle(1, 0x5a5040, 0.7);
    g.beginPath();
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI * 0.95 + (i / 8) * Math.PI * 0.9;
      if (i) g.lineTo(c.x + Math.cos(a) * (c.r + 1.5), c.y + Math.sin(a) * (c.r + 1.5) * SQUASH);
      else g.moveTo(c.x + Math.cos(a) * (c.r + 1.5), c.y + Math.sin(a) * (c.r + 1.5) * SQUASH);
    }
    g.strokePath();
  }
}
const BORDER = new Map<string, StandingPiece[]>();
/**
 * The perimeter: a chain-link fence along every side where the outpost meets no-man's-land, set a little out from the
 * concrete, and Czech hedgehogs scattered further out (never in a crater).
 */
function borderPieces(map: MapDefinition): readonly StandingPiece[] {
  const cached = BORDER.get(map.id);
  if (cached) return cached;
  const list: StandingPiece[] = [],
    seed = fnv(`${map.id}:border`),
    n = CELL / SEA_TILE;
  if (seaCells(map).size) {
    for (const e of shoreEdges(map)) {
      const x0 = e.x0 + e.nx * 5,
        y0 = e.y0 + e.ny * 5,
        x1 = e.x1 + e.nx * 5,
        y1 = e.y1 + e.ny * 5;
      list.push({ x: (x0 + x1) / 2, y: Math.max(y0, y1), shadow: (g) => fenceShadow(g, x0, y0, x1, y1), draw: (g) => drawFence(g, x0, y0, x1, y1) });
    }
    const craters = cratersOf(map);
    for (const [k, depths] of seaField(map)) {
      const [cx, cy] = k.split(",").map(Number);
      if (hash01(seed, cx, cy) > 0.45 || depths[(n / 2) * n + n / 2] < 16) continue;
      const x = (cx + 0.25 + 0.5 * hash01(seed, cy, cx)) * CELL,
        y = (cy + 0.25 + 0.5 * hash01(cx, seed, cy)) * CELL,
        a = hash01(seed, cx * 3, cy * 5) * Math.PI;
      if (craters.some((c) => (c.x - x) ** 2 + (c.y - y) ** 2 < (c.r + 10) ** 2)) continue;
      list.push({ x, y, shadow: (g) => hedgehogShadow(g, x, y), draw: (g) => drawHedgehog(g, x, y, a) });
    }
  }
  BORDER.set(map.id, list);
  return list;
}

// ── Landmarks ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** Calls `draw` with the ink scaled by `k` about (x, y0), so a landmark is drawn once at its 2×2 size. */
function scaled(g: Ink, x: number, y0: number, k: number, draw: () => void) {
  g.save();
  g.translateCanvas(x, y0);
  g.scaleCanvas(k, k);
  draw();
  g.restore();
}
const landmarkGround = (x: number, y: number, s: number) => ({ y0: y + s * 0.3, k: s / CELL });

// ── Theme ───────────────────────────────────────────────────────────────────────────────────────────────────────────
export const outpost: Theme = {
  backdrop: 0x0f1416,
  ground: [0x3c423d, 0x394039],
  grid: 0x58625c,
  path: { edge: 0x8e9088, bed: ASPHALT, line: 0xdedcd0, arrow: 0xe0a43a },
  accent: ACCENT,
  drawPath: drawRoad,
  sea: drawWaste,
  obstacle: (g, x, y, rand) => {
    const p = pieceOf(rand),
      { gx, gy } = groundOf(x, y);
    if (p.kind === "crates") drawCrates(g, gx, gy, p.crates);
    else if (p.kind === "drums") drawDrums(g, gx, gy, p.drums);
    else if (p.kind === "sandbags") {
      drawCrates(g, gx, gy, p.extra);
      drawSandbags(g, gx, gy, p.wall);
    } else if (p.kind === "barriers") drawBarriers(g, gx, gy, p.barriers);
    else if (p.kind === "mast") {
      drawMast(g, gx, gy, p.a);
      drawDrums(g, gx, gy, p.drums);
    } else if (p.kind === "container") drawContainer(g, gx, gy, p.container);
    else drawGenerator(g, gx, gy, p.a);
  },
  tilted: {
    shadow: (g, x, y, rand) => {
      const p = pieceOf(rand),
        { gx, gy } = groundOf(x, y);
      if (p.kind === "crates") for (const c of p.crates) crateShadow(g, gx, gy, c);
      else if (p.kind === "drums") drumsShadow(g, gx, gy, p.drums);
      else if (p.kind === "sandbags") {
        sandbagsShadow(g, gx, gy, p.wall);
        for (const c of p.extra) crateShadow(g, gx, gy, c);
      } else if (p.kind === "barriers") barriersShadow(g, gx, gy, p.barriers);
      else if (p.kind === "mast") {
        mastShadow(g, gx, gy);
        drumsShadow(g, gx, gy, p.drums);
      } else if (p.kind === "container") containerShadow(g, gx, gy, p.container);
      else generatorShadow(g, gx, gy, p.a);
    },
    landmark: (g, x, y, s, variant) => {
      const { y0, k } = landmarkGround(x, y, s);
      scaled(g, x, y0, k, () => (variant ? helipadShadow(g) : watchtowerShadow(g)));
      scaled(g, x, y0, k, () => (variant ? drawHelipad(g) : drawWatchtower(g)));
    },
    // The watchtower's searchlight sweeps the board; the helipad's landing lights chase round its ring under a windsock.
    landmarkLight: (g, glow, x, y, s, variant, clock, lit) => {
      const { y0, k } = landmarkGround(x, y, s);
      if (variant) {
        const lead = Math.floor(clock * 8) % HELIPAD_LIGHTS.length;
        HELIPAD_LIGHTS.forEach((l, i) => {
          const on = i === lead ? 1 : 0.25,
            lx = x + l.x * k,
            ly = y0 + l.y * k;
          disc(glow, lx, ly, 5 * k, ACCENT, 0.25 * on * lit);
          disc(g, lx, ly, 1.4 * k, on > 0.5 ? 0xe8fff0 : 0x4a8a64);
        });
        windsock(g, x, y0, k, clock);
        return;
      }
      const lx = x + TOWER_LIGHT.x * k,
        ly = Y(y0, 0, TOWER_LIGHT.h * k),
        a = clock * 0.55,
        reach = CELL * 4.5 * k,
        end = { x: lx + Math.cos(a) * reach, y: y0 + Math.sin(a) * reach * SQUASH };
      for (const [w, alpha] of [[0.2, 0.05], [0.1, 0.07]] as const) {
        const side = { x: -Math.sin(a) * reach * w, y: Math.cos(a) * reach * w * SQUASH };
        glow.fillStyle(0xfff4d0, alpha * lit);
        glow.fillTriangle(lx, ly, end.x + side.x, end.y + side.y, end.x - side.x, end.y - side.y);
      }
      fillOval(glow, end.x, end.y, reach * 0.22, reach * 0.22 * SQUASH);
      disc(glow, lx, ly, 8 * k, 0xfff4d0, 0.3 * lit);
    },
    extras: borderPieces,
  },
  decor: (g, x, y, rand) => {
    const kind = rand(),
      cx = x + 12 + rand() * 32,
      cy = y + 12 + rand() * 32;
    if (kind < 0.3) {
      // Oil stain.
      oval(g, cx, cy, 6 + rand() * 5, 3.5 + rand() * 2, 0x1c2020, 0.45);
      oval(g, cx - 1, cy - 0.5, 3, 1.4, 0x3a4450, 0.4);
    } else if (kind < 0.55) {
      // Weeds through a crack.
      g.lineStyle(0.8, 0x1e2422, 0.9);
      g.lineBetween(cx - 8, cy + 2, cx + 7, cy - 1);
      for (let i = 0; i < 4; i++) {
        const a = -Math.PI / 2 + (i - 1.5) * 0.45;
        g.lineStyle(1.2, 0x5a6a3a, 0.85);
        g.lineBetween(cx, cy, cx + Math.cos(a) * 5, cy + Math.sin(a) * 5);
      }
    } else if (kind < 0.62) {
      // Painted corners of a parking bay and its stencilled number.
      g.lineStyle(1.6, 0xc8a238, 0.55);
      for (const [px, py, sx, sy] of [[x + 6, y + 6, 1, 1], [x + 50, y + 6, -1, 1], [x + 6, y + 50, 1, -1], [x + 50, y + 50, -1, -1]]) {
        g.lineBetween(px, py, px + sx * 8, py);
        g.lineBetween(px, py, px, py + sy * 8);
      }
      g.fillStyle(0xc8a238, 0.4);
      const digit = Math.floor(rand() * 9) + 1;
      for (let i = 0; i < digit % 4 + 1; i++) g.fillRect(x + 22 + i * 4, y + 24, 2.4, 8);
    } else if (kind < 0.78) {
      // Bolts and a washer.
      for (let i = 0; i < 3; i++) disc(g, cx + (rand() - 0.5) * 10, cy + (rand() - 0.5) * 8, 1.1, 0x6a6e6a);
      disc(g, cx + 4, cy - 2, 1.8, 0x5a5e5a);
      disc(g, cx + 4, cy - 2, 0.7, 0x2a2e2e);
    } else {
      // Tyre marks.
      const a = rand() * Math.PI;
      g.lineStyle(2.4, 0x1e2224, 0.35);
      for (const o of [-4, 4]) g.lineBetween(cx - Math.cos(a) * 10 - Math.sin(a) * o, cy - Math.sin(a) * 10 + Math.cos(a) * o, cx + Math.cos(a) * 10 - Math.sin(a) * o, cy + Math.sin(a) * 10 + Math.cos(a) * o);
    }
  },
  // Floodlights on the masts, exhaust from the generators, studs blinking along the road, chevrons drifting to the
  // reactor, smoke from the craters and dust blowing over the concrete.
  ambient: ({ g, glow, lit, map, clock, hash, blocked }) => {
    for (const b of blocked) {
      const h = hash(b.x, b.y),
        { gx, gy } = groundOf(b.x * CELL, b.y * CELL);
      if (h >= BARRIERS && h < MAST) {
        const flicker = 0.9 + 0.1 * Math.sin(clock * 13 + h * 90);
        for (const l of mastLamps(mastFacing(h))) {
          glow.fillStyle(0xfff0c8, 0.05 * lit * flicker);
          glow.fillTriangle(gx + l.x, gy + l.y, gx + l.gx - 12, gy + l.gy, gx + l.gx + 12, gy + l.gy);
          glow.fillStyle(0xfff0c8, 0.09 * lit * flicker);
          fillOval(glow, gx + l.gx, gy + l.gy, 18, 9);
          disc(glow, gx + l.x, gy + l.y, 5, 0xfff6dc, 0.3 * lit);
        }
      } else if (h >= CONTAINER) {
        const tip = exhaustTip(generatorFacing(h));
        for (let i = 0; i < 4; i++) {
          const life = (clock * 0.6 + i / 4 + h) % 1;
          disc(g, gx + tip.x + life * 8 + Math.sin(clock * 2 + i) * 1.5, gy + tip.y - life * 16, 1.5 + life * 4, 0x8a8e8a, 0.28 * (1 - life));
        }
      }
    }
    if (!map.columns) return;
    const samples = channelOf(map);
    // Road studs along both edge lines, blinking in a slow wave towards the reactor.
    for (let i = 0; i < samples.length; i += 12) {
      const p = samples[i],
        on = 0.35 + 0.65 * Math.max(0, Math.sin(clock * 2.2 - p.s * 0.02));
      for (const side of [-1, 1]) {
        const x = p.x + p.nx * side * 18.6,
          y = p.y + p.ny * side * 18.6;
        disc(glow, x, y, 3.5, ACCENT, 0.22 * on * lit);
        disc(g, x, y, 0.9, 0xe8fff0, 0.5 + 0.5 * on);
      }
    }
    // Faint chevrons drifting along the centre line.
    const total = samples[samples.length - 1].s;
    g.lineStyle(1.6, ACCENT, 0.2);
    for (let k = 0; k * 80 < total; k++) {
      const s = (k * 80 + clock * 26) % total,
        p = samples[Math.min(samples.length - 1, Math.floor(s / CHANNEL_STEP))],
        tx = p.ny,
        ty = -p.nx;
      for (const side of [-1, 1]) g.lineBetween(p.x + tx * 3, p.y + ty * 3, p.x - tx * 3 + p.nx * side * 5, p.y - ty * 3 + p.ny * side * 5);
    }
    // Smoke rising from some craters in no-man's-land.
    for (const c of cratersOf(map)) {
      if (!c.smoke) continue;
      for (let i = 0; i < 5; i++) {
        const life = (clock * 0.18 + i / 5 + c.r) % 1;
        disc(g, c.x + life * 14 + Math.sin(clock * 0.7 + i * 2) * 3, c.y - life * 34, 2.5 + life * 7, 0x5a5650, 0.16 * Math.sin(Math.PI * life));
      }
    }
    // Dust blowing across the outpost.
    const w = map.columns * CELL,
      h = map.rows * CELL;
    for (let k = 0; k < map.columns; k++) {
      const s = hash(k, 301),
        x = ((clock * (18 + s * 14) + s * w * 5) % (w + 40)) - 20,
        y = hash(k, 302) * h + Math.sin(clock * 0.8 + k) * 6;
      g.fillStyle(0xb8b0a0, 0.08 + 0.08 * s);
      fillOval(g, x, y, 3 + s * 3, 1.2);
    }
  },
};
