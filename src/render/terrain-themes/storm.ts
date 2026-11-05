import { CELL, disc, hash01, type Ink, lightning, oval, shade } from "../shapes";
import { Y } from "../tower-art/tilt";
import { cellRandom, type Random, type Theme } from "./kit";
import { CHANNEL_STEP, channelOf, SEA_TILE, seaField } from "../coast";
import { blend } from "../ground";
import { halo } from "../material";
import { fnv } from "../../core/hash";
import type { MapDefinition } from "../../core/types";
import type { Crystal } from "./shard-props";
import {
  blades, BOLT, bouldersOf, bouldersShadow, drawBoulders, drawNeedles, drawObservatory, drawPole, drawRod, drawShelter, drawTesla, drawTurbine, needlesOf,
  needlesShadow, OBSERVATORY, observatoryShadow, poleOf, poleShadow, ROD_TIP, rodShadow, SHELTER_LAMP, shelterShadow, TESLA, teslaShadow, turbineShadow,
  wireEnd, type Boulders, type Pole,
} from "./storm-props";

// Storm Plateau: a basalt plateau under a thunderstorm. A causeway of wet flagstones instead of the sunken track:
// slabs shining with rain, puddles catching the sky and runoff gutters along both sides; props in the towers' 3/4 tilt
// (`Theme.tilted`, `storm-props.ts`): basalt needles, lightning rods (struck now and then), wind turbines whose blades
// turn, storm shelters, rain-slick boulders and leaning power poles with a sparking wire; a tesla tower arcing and a
// weather observatory as landmarks; and obstacle groups at the board edge turned into cliffs over a storm sea
// (`Theme.sea`) with whitecaps. Slanted rain over everything.

const ACCENT = 0x9fd8ff;
/** Kind thresholds of the first `cellRandom` draw. */
const NEEDLES = 0.32,
  ROD = 0.48,
  TURBINE = 0.62,
  SHELTER = 0.72,
  BOULDERS = 0.88;
/** A lightning strike per slot of this many seconds at one rod, each lasting `STRIKE_TIME`. */
const STRIKE_PERIOD = 9,
  STRIKE_TIME = 0.3;
/** A cliff coast meanders a little. */
const SHORE = 5;

type Piece =
  | { kind: "needles"; needles: Crystal[] }
  | { kind: "rod"; boulders: Boulders }
  | { kind: "turbine" }
  | { kind: "shelter" }
  | { kind: "boulders"; boulders: Boulders }
  | { kind: "pole"; pole: Pole };
function pieceOf(rand: Random): Piece {
  const kind = rand();
  if (kind < NEEDLES) return { kind: "needles", needles: needlesOf(rand) };
  if (kind < ROD) return { kind: "rod", boulders: { list: bouldersOf(rand).list.slice(0, 1).map((b) => ({ ...b, u: 12, v: 6, r: 5 })) } };
  if (kind < TURBINE) return { kind: "turbine" };
  if (kind < SHELTER) return { kind: "shelter" };
  if (kind < BOULDERS) return { kind: "boulders", boulders: bouldersOf(rand) };
  return { kind: "pole", pole: poleOf(rand) };
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

// ── Flagstone causeway ──────────────────────────────────────────────────────────────────────────────────────────────
const SLAB = 0x2a3448;
/**
 * The path as a causeway of wet flagstones with rounded bends (`coast.ts` `channelOf`): a dark kerb with runoff
 * gutters, slabs in staggered courses, each its own tone with a wet sheen on its lit edge, and puddles holding the sky.
 */
function drawCauseway(g: Ink, map: MapDefinition) {
  const samples = channelOf(map),
    seed = fnv(`${map.id}:slabs`),
    layer = (r: number, color: number) => {
      for (let i = 0; i < samples.length; i += 2) disc(g, samples[i].x, samples[i].y, r, color);
    },
    along = (o: number) => samples.map((p) => ({ x: p.x + p.nx * o, y: p.y + p.ny * o }));
  layer(25.5, 0x3a4660);
  layer(23.5, 0x0a1220);
  layer(21.5, SLAB);
  // Runoff gutters: dark water running along both sides.
  for (const side of [-1, 1]) {
    g.lineStyle(2, 0x0e1a2c, 1);
    g.strokePoints(along(side * 22.5), false);
    g.lineStyle(0.6, 0x5a8ab0, 0.5);
    g.strokePoints(along(side * 22.2), false);
  }
  // Slabs: courses every 15 px, split into two or three stones, staggered.
  for (let i = 0; i + 5 < samples.length; i += 5) {
    const p = samples[i],
      q = samples[i + 5],
      course = i / 5,
      cuts = course % 2 ? [-21, -7, 7, 21] : [-21, 0, 21];
    for (let j = 0; j + 1 < cuts.length; j++) {
      const a = cuts[j] + 0.6,
        b = cuts[j + 1] - 0.6,
        tone = (hash01(seed, course, j) - 0.5) * 0.12,
        c = shade(SLAB, tone);
      g.fillStyle(c);
      g.fillPoints([
        { x: p.x + p.nx * a, y: p.y + p.ny * a },
        { x: p.x + p.nx * b, y: p.y + p.ny * b },
        { x: q.x + q.nx * b, y: q.y + q.ny * b },
        { x: q.x + q.nx * a, y: q.y + q.ny * a },
      ], true);
      // A wet sheen along the slab's leading edge.
      g.lineStyle(0.7, 0x8ab8e0, 0.25 + hash01(seed, course, j + 9) * 0.2);
      g.lineBetween(p.x + p.nx * a, p.y + p.ny * a, p.x + p.nx * b, p.y + p.ny * b);
    }
  }
  // Puddles in the low slabs.
  for (let i = 13; i < samples.length; i += 53) {
    const p = samples[i],
      o = (hash01(seed, i, 6) - 0.5) * 22,
      x = p.x + p.nx * o,
      y = p.y + p.ny * o,
      r = 5 + hash01(seed, i, 7) * 5;
    oval(g, x, y, r, r * 0.5, 0x1a2a40, 0.9);
    g.lineStyle(0.8, 0x7ab8e0, 0.45);
    g.lineBetween(x - r * 0.5, y - 0.6, x + r * 0.1, y - 0.8);
  }
}

// ── Storm sea ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** The storm sea on the edge cells: a basalt cliff lip, its dark face, surf at the foot, then churning grey-blue water. */
function drawStormSea(g: Ink, map: MapDefinition) {
  const n = CELL / SEA_TILE,
    seed = fnv(`${map.id}:swell`);
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
        if (d < 2) c = 0x4a5874;
        else if (d < 7) c = blend(0x1a2234, 0x0e1420, (d - 2) / 5);
        else if (d < 8.5) c = 0x5a7890;
        else {
          // Swell bands across the sea, a whitecap where two crests meet.
          const w = Math.sin(x * 0.07 + y * 0.03 + Math.sin(y * 0.05 + hash01(seed) * 6) * 1.6),
            v = Math.sin(x * 0.02 - y * 0.06 + hash01(seed, 1) * 6),
            base = blend(0x22344a, 0x142234, Math.min(1, (d - 8.5) / 60));
          c = w > 0.96 && v > 0.5 ? 0x7a98ac : w > 0.82 ? shade(base, 0.12) : w < -0.8 ? shade(base, -0.12) : base;
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
export const storm: Theme = {
  backdrop: 0x0b0f18,
  ground: [0x141a26, 0x121722],
  grid: 0x24304a,
  path: { edge: 0x3a4660, bed: SLAB, line: 0x9fd8ff, arrow: 0xcfeaff },
  accent: ACCENT,
  drawPath: drawCauseway,
  sea: drawStormSea,
  obstacle: (g, x, y, rand) => {
    const p = pieceOf(rand),
      { gx, gy } = groundOf(x, y);
    if (p.kind === "needles") drawNeedles(g, gx, gy, p.needles);
    else if (p.kind === "rod") {
      drawRod(g, gx - 3, gy - 3);
      drawBoulders(g, gx, gy, p.boulders);
    } else if (p.kind === "turbine") drawTurbine(g, gx, gy - 2);
    else if (p.kind === "shelter") drawShelter(g, gx, gy - 4);
    else if (p.kind === "boulders") drawBoulders(g, gx, gy, p.boulders);
    else drawPole(g, gx - 2, gy - 2, p.pole);
  },
  tilted: {
    shadow: (g, x, y, rand) => {
      const p = pieceOf(rand),
        { gx, gy } = groundOf(x, y);
      if (p.kind === "needles") needlesShadow(g, gx, gy, p.needles);
      else if (p.kind === "rod") {
        rodShadow(g, gx - 3, gy - 3);
        bouldersShadow(g, gx, gy, p.boulders);
      } else if (p.kind === "turbine") turbineShadow(g, gx, gy - 2);
      else if (p.kind === "shelter") shelterShadow(g, gx, gy - 4);
      else if (p.kind === "boulders") bouldersShadow(g, gx, gy, p.boulders);
      else poleShadow(g, gx - 2, gy - 2, p.pole);
    },
    landmark: (g, x, y, s, variant) => {
      const { y0, k } = landmarkGround(x, y, s);
      scaled(g, x, y0, k, () => (variant ? observatoryShadow(g) : teslaShadow(g)));
      scaled(g, x, y0, k, () => (variant ? drawObservatory(g) : drawTesla(g)));
    },
    // The tesla tower's toroid arcs to the ground in short bursts; the observatory's window glows and its windsock flaps.
    landmarkLight: (g, glow, x, y, s, variant, clock, lit) => {
      const { y0, k } = landmarkGround(x, y, s);
      if (variant) {
        g.lineStyle(2.2 * k, 0xffe0a0, 0.7);
        g.strokePoints(Array.from({ length: 9 }, (_, i) => {
          const t = Math.PI * (0.15 + i * 0.0875);
          return { x: x + Math.cos(t) * 20.1 * k, y: Y(y0, Math.sin(t) * 20.1 * k, OBSERVATORY.window * k) };
        }), false);
        halo(glow, x, Y(y0, 20 * k, OBSERVATORY.window * k), 14 * k, 0xffd890, 0.16 * lit);
        return;
      }
      const ty = Y(y0, 0, TESLA.h * k),
        burst = Math.floor(clock * 2.5),
        on = hash01(burst, x) < 0.55;
      halo(glow, x, ty, 22 * k, BOLT, (on ? 0.22 : 0.08) * lit);
      if (!on) return;
      for (let j = 0; j < 2; j++) {
        const a = hash01(burst, j, x) * Math.PI * 2,
          ex = x + Math.cos(a) * 30 * k,
          ey = y0 + Math.sin(a) * 18 * k;
        lightning({ g, glow }, x + Math.cos(a) * TESLA.r * k, ty, ex, ey, BOLT, 0.8, burst * 7 + j, false);
      }
    },
  },
  decor: (g, x, y, rand) => {
    const kind = rand(),
      cx = x + 12 + rand() * 32,
      cy = y + 14 + rand() * 28;
    if (kind < 0.45) {
      // A puddle with a highlight.
      oval(g, cx, cy, 8 + rand() * 4, 3.5, 0x0a1020, 0.8);
      g.lineStyle(1, 0x7ab8e0, 0.45);
      g.lineBetween(cx - 4, cy - 1, cx + 2, cy - 1);
    } else if (kind < 0.8) {
      // Cracked stone.
      g.lineStyle(1, 0x05080e, 0.85);
      g.strokePoints([{ x: cx - 8, y: cy + 1 }, { x: cx - 3, y: cy - 2 }, { x: cx + 2, y: cy + 1 }, { x: cx + 8, y: cy - 1 }], false);
    } else {
      // A scorch mark where lightning struck, a few cold sparks left in it.
      oval(g, cx, cy, 7, 4.5, 0x05070c, 0.7);
      for (let i = 0; i < 3; i++) disc(g, cx + (rand() - 0.5) * 10, cy + (rand() - 0.5) * 6, 0.8, 0x9fd8ff, 0.7);
    }
  },
  // Slanted rain, turbine blades turning, lamps and sparks, a strike at one rod now and then, crackle along the
  // causeway and whitecaps rolling on the storm sea.
  ambient: ({ g, glow, lit, map, clock, hash, blocked, still }) => {
    const rods: { x: number; y: number }[] = [];
    for (const b of blocked) {
      const p = pieceAt(map, b.x, b.y),
        { gx, gy } = groundOf(b.x * CELL, b.y * CELL);
      if (p.kind === "turbine") blades(g, gx, gy - 2, clock * (1.6 + hash01(b.x, b.y)) + b.x);
      else if (p.kind === "rod") {
        rods.push({ x: gx - 3, y: Y(gy - 3, 0, ROD_TIP) });
        disc(glow, gx - 3, Y(gy - 3, 0, ROD_TIP), 4, BOLT, (0.12 + 0.06 * Math.sin(clock * 5 + b.x)) * lit);
      } else if (p.kind === "shelter") {
        const on = Math.sin(clock * 1.8 + b.x) > -0.2 ? 1 : 0.3;
        disc(g, gx + SHELTER_LAMP.x, gy - 4 + SHELTER_LAMP.y, 1.3, 0xffd890, on);
        halo(glow, gx + SHELTER_LAMP.x, gy - 4 + SHELTER_LAMP.y, 9, 0xffc870, 0.2 * on * lit);
      } else if (p.kind === "pole") {
        const e = wireEnd(p.pole),
          ex = gx - 2 + e.u,
          ey = Y(gy - 2 + e.v * 0.65, 0, e.h),
          spark = hash01(Math.floor(clock * 6), b.x, b.y) < 0.25;
        if (spark) {
          for (let i = 0; i < 3; i++) disc(g, ex + (hash01(clock, i) - 0.5) * 8, ey + (hash01(i, clock) - 0.5) * 6, 0.8, 0xffffff, 0.9);
          disc(glow, ex, ey, 7, BOLT, 0.3 * lit);
        }
      }
    }
    // One strike per slot at a hashed moment and rod, so strikes stay rare and never overlap.
    const w = map.columns * CELL,
      h = map.rows * CELL,
      slot = Math.floor(clock / STRIKE_PERIOD),
      t = (clock % STRIKE_PERIOD) - hash01(slot, 97) * (STRIKE_PERIOD - 1),
      tip = rods[Math.floor(hash01(slot, 98) * rods.length)];
    if (tip && t >= 0 && t < STRIKE_TIME) {
      const f = 1 - t / STRIKE_TIME,
        flick = f * (0.6 + 0.4 * Math.sin(clock * 90));
      halo(glow, tip.x, tip.y, 26, BOLT, 0.3 * flick * lit);
      lightning({ g, glow }, tip.x + 8, tip.y - 70, tip.x, tip.y, BOLT, flick, slot, true);
      if (!still && w) {
        g.fillStyle(0xffffff, 0.05 * flick);
        g.fillRect(0, 0, w, h);
      }
    }
    if (!w) return;
    // Rain slanting across the board.
    g.lineStyle(1, 0x9fc8e8, 0.22);
    for (let k = 0; k < Math.ceil(map.columns * 2.5); k++) {
      const s = hash(k, 91),
        life = (clock * 1.3 + s * 7) % 1,
        x0 = ((s * 13.7) % 1) * (w + 60) - 30 + life * 40,
        y0 = life * (h + 20) - 10;
      g.lineBetween(x0, y0, x0 - 5, y0 + 12);
    }
    // Crackle running along the causeway towards the reactor.
    const samples = channelOf(map),
      total = samples[samples.length - 1].s;
    for (let k = 0; k * 180 < total; k++) {
      const s = (k * 180 + clock * 80) % total,
        i = Math.min(samples.length - 1, Math.floor(s / CHANNEL_STEP)),
        p = samples[i];
      if (Math.sin(clock * 11 + k * 3.1) < 0.2) continue;
      const q = samples[Math.min(samples.length - 1, i + 4)];
      g.lineStyle(1.2, BOLT, 0.6);
      g.strokePoints([{ x: p.x, y: p.y }, { x: (p.x + q.x) / 2 + (k % 2 ? 3 : -3), y: (p.y + q.y) / 2 + (k % 2 ? -3 : 3) }, { x: q.x, y: q.y }], false);
      disc(glow, p.x, p.y, 6, BOLT, 0.18 * lit);
    }
    // Whitecaps rolling on the storm sea.
    const n = CELL / SEA_TILE;
    for (const [key, depths] of seaField(map, SHORE)) {
      const [cx, cy] = key.split(",").map(Number);
      for (let j = 0; j < 2; j++) {
        const tx = Math.floor(hash01(cx, cy, j) * n),
          ty = Math.floor(hash01(cy, cx, j + 3) * n);
        if (depths[ty * n + tx] < 14) continue;
        const life = (clock * 0.4 + hash01(j, cx, cy)) % 1,
          x = cx * CELL + tx * SEA_TILE + life * 14,
          y = cy * CELL + ty * SEA_TILE;
        oval(g, x, y, 4 + life * 6, 1.2, 0xe0ecf4, 0.5 * Math.sin(Math.PI * life));
      }
    }
  },
};
