import { CELL, disc, hash01, type Ink, oval, shade } from "../shapes";
import { SQUASH, X, Y } from "../tower-art/tilt";
import { cellRandom, type Random, type Theme } from "./kit";
import { CHANNEL_STEP, channelOf } from "../coast";
import { halo } from "../material";
import { fnv } from "../../core/hash";
import type { MapDefinition } from "../../core/types";
import {
  boilerOf, boilerParts, boilerShadow, BRASS, CLOCK, clockTowerShadow, drawBoiler, drawClockTower, drawEngine, drawEscapement, drawPipes, drawStack,
  drawStanding, engineOf, engineShadow, ESCAPE, escapementShadow, flywheelOf, pendulum, pipesOf, pipesShadow, pipeTops, stackOf, stackShadow,
  standingHub, standingOf, standingShadow, type Boiler, type Engine, type Pipes, type Stack, type Standing,
} from "./gear-props";

// Gearworks: a clockwork foundry in brass and copper under warm lamplight. A riveted iron track with two brass rails
// and a toothed rack down its middle instead of the sunken track; props in the towers' 3/4 tilt (`Theme.tilted`,
// `gear-props.ts`): great cogs standing in iron frames, stacks of lying gears, twin-cylinder piston engines, riveted
// boilers and banks of steam pipes; a clock tower and a great escapement with a swinging pendulum as landmarks. Its
// ring maps hold only scattered obstacle cells, so there is no `sea`.

const ACCENT = 0xd9a441;
/** Kind thresholds of the first `cellRandom` draw. */
const STANDING = 0.3,
  STACK = 0.48,
  ENGINE = 0.66,
  BOILER = 0.84;

type Piece =
  | { kind: "standing"; standing: Standing }
  | { kind: "stack"; stack: Stack }
  | { kind: "engine"; engine: Engine }
  | { kind: "boiler"; boiler: Boiler }
  | { kind: "pipes"; pipes: Pipes };
function pieceOf(rand: Random): Piece {
  const kind = rand();
  if (kind < STANDING) return { kind: "standing", standing: standingOf(rand) };
  if (kind < STACK) return { kind: "stack", stack: stackOf(rand) };
  if (kind < ENGINE) return { kind: "engine", engine: engineOf(rand) };
  if (kind < BOILER) return { kind: "boiler", boiler: boilerOf(rand) };
  return { kind: "pipes", pipes: pipesOf(rand) };
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

// ── Rack track ──────────────────────────────────────────────────────────────────────────────────────────────────────
const DECK = 0x3a2c1c;
/**
 * The path as a riveted iron track with rounded bends (`coast.ts` `channelOf`): a brass kerb, iron deck plates with
 * rivets at their seams, two polished brass rails and a toothed rack between them, worn bright where it runs.
 */
function drawRack(g: Ink, map: MapDefinition) {
  const samples = channelOf(map),
    seed = fnv(`${map.id}:rack`),
    layer = (r: number, color: number) => {
      for (let i = 0; i < samples.length; i += 2) disc(g, samples[i].x, samples[i].y, r, color);
    },
    along = (o: number) => samples.map((p) => ({ x: p.x + p.nx * o, y: p.y + p.ny * o }));
  layer(25.5, 0x8a6424);
  layer(24, 0x2a1d10);
  layer(22.5, DECK);
  // Deck plates: a seam every few samples, rivets along it, a tone per plate.
  for (let i = 0; i + 8 < samples.length; i += 8) {
    const p = samples[i],
      q = samples[i + 8],
      tone = (hash01(seed, i) - 0.5) * 0.14;
    for (const side of [-1, 1]) {
      g.fillStyle(shade(DECK, tone), 1);
      g.fillPoints([{ x: p.x + p.nx * side * 15, y: p.y + p.ny * side * 15 }, { x: p.x + p.nx * side * 21.5, y: p.y + p.ny * side * 21.5 }, { x: q.x + q.nx * side * 21.5, y: q.y + q.ny * side * 21.5 }, { x: q.x + q.nx * side * 15, y: q.y + q.ny * side * 15 }], true);
    }
    g.lineStyle(1, 0x1a1208, 0.85);
    g.lineBetween(p.x - p.nx * 22, p.y - p.ny * 22, p.x + p.nx * 22, p.y + p.ny * 22);
    for (const o of [-19, -17, 17, 19]) disc(g, p.x + p.nx * o - p.ny * 2, p.y + p.ny * o + p.nx * 2, 0.9, 0xb8742e);
  }
  // The rack: a dark bed and teeth across it.
  g.lineStyle(9, 0x1a1208, 1);
  g.strokePoints(along(0), false);
  for (let i = 0; i < samples.length; i++) {
    if (i % 2) continue;
    const p = samples[i];
    g.lineStyle(2.2, 0x6a4a1e, 1);
    g.lineBetween(p.x - p.nx * 3.6, p.y - p.ny * 3.6, p.x + p.nx * 3.6, p.y + p.ny * 3.6);
    g.lineStyle(0.6, 0xd8a85a, 0.7);
    g.lineBetween(p.x - p.nx * 3.6 - p.ny * 0.6, p.y - p.ny * 3.6 + p.nx * 0.6, p.x + p.nx * 3.6 - p.ny * 0.6, p.y + p.ny * 3.6 + p.nx * 0.6);
  }
  // Brass rails in their chairs.
  for (const side of [-1, 1]) {
    for (let i = 4; i < samples.length; i += 6) {
      const p = samples[i];
      oval(g, p.x + p.nx * side * 10, p.y + p.ny * side * 10, 2.6, 2.6, 0x1a1208, 0.9);
    }
    g.lineStyle(3.4, 0x2a1d10, 1);
    g.strokePoints(along(side * 10), false);
    g.lineStyle(1.8, BRASS, 1);
    g.strokePoints(along(side * 10 - 0.3), false);
    g.lineStyle(0.6, 0xf0d488, 0.8);
    g.strokePoints(along(side * 10 - 0.9), false);
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
/** Steam puffs rising from (x, y), drifting right and fading. */
function steam(g: Ink, x: number, y: number, clock: number, seed: number, size = 1, count = 4) {
  for (let i = 0; i < count; i++) {
    const life = (clock * 0.35 + i / count + hash01(seed)) % 1;
    disc(g, x + life * 10 * size + Math.sin(clock * 1.2 + i * 2) * 1.5 * size, y - life * 24 * size, (1.6 + life * 6) * size, 0xe8e0d0, 0.22 * Math.sin(Math.PI * life));
  }
}
/** A glint riding round a cog's rim (centre on screen, radius), turning with the clock. */
function rimGlint(g: Ink, glow: Ink, cx: number, cy: number, r: number, clock: number, speed: number, lit: number) {
  for (let k = 0; k < 2; k++) {
    const a = clock * speed + k * Math.PI;
    disc(g, cx + Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.86, 1.2, 0xfff0b8, 0.75);
    disc(glow, cx + Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.86, 3, 0xffd890, 0.18 * lit);
  }
}

// ── Theme ───────────────────────────────────────────────────────────────────────────────────────────────────────────
export const gear: Theme = {
  backdrop: 0x1a1208,
  ground: [0x3a2a14, 0x46331a],
  grid: 0x5a4424,
  path: { edge: 0x8a6424, bed: DECK, line: ACCENT, arrow: 0xe8c273 },
  accent: ACCENT,
  drawPath: drawRack,
  obstacle: (g, x, y, rand) => {
    const p = pieceOf(rand),
      { gx, gy } = groundOf(x, y);
    if (p.kind === "standing") drawStanding(g, gx, gy - 2, p.standing);
    else if (p.kind === "stack") drawStack(g, gx, gy, p.stack);
    else if (p.kind === "engine") drawEngine(g, gx, gy, p.engine);
    else if (p.kind === "boiler") drawBoiler(g, gx, gy, p.boiler);
    else drawPipes(g, gx, gy - 2, p.pipes);
  },
  tilted: {
    shadow: (g, x, y, rand) => {
      const p = pieceOf(rand),
        { gx, gy } = groundOf(x, y);
      if (p.kind === "standing") standingShadow(g, gx, gy - 2, p.standing);
      else if (p.kind === "stack") stackShadow(g, gx, gy, p.stack);
      else if (p.kind === "engine") engineShadow(g, gx, gy, p.engine);
      else if (p.kind === "boiler") boilerShadow(g, gx, gy, p.boiler);
      else pipesShadow(g, gx, gy - 2, p.pipes);
    },
    landmark: (g, x, y, s, variant) => {
      const { y0, k } = landmarkGround(x, y, s);
      scaled(g, x, y0, k, () => (variant ? escapementShadow(g) : clockTowerShadow(g)));
      scaled(g, x, y0, k, () => (variant ? drawEscapement(g) : drawClockTower(g)));
    },
    // The clock face glows warm; the escapement's pendulum swings and a glint rides round its wheel.
    landmarkLight: (g, glow, x, y, s, variant, clock, lit) => {
      const { y0, k } = landmarkGround(x, y, s);
      if (variant) {
        const swing = Math.sin(clock * 1.6 + x) * 0.32;
        rimGlint(g, glow, x, Y(y0, -4 * k, ESCAPE.h * k), ESCAPE.r * k, clock, 0.5, lit);
        pendulum(g, x, y0, k, swing);
        return;
      }
      halo(glow, x, Y(y0, CLOCK.v * k, CLOCK.h * k), (CLOCK.r + 6) * k, 0xffd890, (0.2 + 0.03 * Math.sin(clock * 0.8)) * lit);
      // The second hand sweeping round the face.
      const a = clock * 1.05 - Math.PI / 2,
        cx = x,
        cy = Y(y0, CLOCK.v * k, CLOCK.h * k);
      g.lineStyle(0.6 * k, 0xc83a2e, 0.9);
      g.lineBetween(cx, cy, cx + Math.cos(a) * CLOCK.r * 0.8 * k, cy + Math.sin(a) * CLOCK.r * 0.8 * k);
    },
  },
  decor: (g, x, y, rand) => {
    const kind = rand(),
      cx = x + 12 + rand() * 32,
      cy = y + 12 + rand() * 32;
    if (kind < 0.35) {
      // A riveted floor plate.
      g.lineStyle(1, 0x2a1d0c, 0.7);
      g.strokeRect(x + 8, y + 8, CELL - 16, CELL - 16);
      for (const [dx, dy] of [[11, 11], [CELL - 11, 11], [11, CELL - 11], [CELL - 11, CELL - 11]]) {
        disc(g, x + dx, y + dy, 1.6, 0xb8742e);
        disc(g, x + dx - 0.5, y + dy - 0.5, 0.6, 0xe6a070);
      }
    } else if (kind < 0.6) {
      // An oil stain.
      oval(g, cx, cy, 8 + rand() * 4, 3.5 + rand() * 1.5, 0x0c0804, 0.6);
      oval(g, cx - 2, cy - 1, 3, 1.2, 0x5a4424, 0.7);
    } else if (kind < 0.8) {
      // A dropped cog wheel lying flat.
      const r = 3.5 + rand() * 2;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        disc(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r * SQUASH, 1, 0x8a6424);
      }
      oval(g, cx, cy, r, r * SQUASH, 0x9a7226);
      oval(g, cx, cy, r * 0.35, r * 0.35 * SQUASH, 0x2a1d0c);
    } else {
      // Brass shavings.
      for (let i = 0; i < 5; i++) {
        const sx = cx + (rand() - 0.5) * 14,
          sy = cy + (rand() - 0.5) * 8;
        g.lineStyle(0.8, 0xd8a85a, 0.7);
        g.lineBetween(sx, sy, sx + 2 + rand() * 2, sy - 1 + rand() * 2);
      }
    }
  },
  // Steam from the boilers and pipes, fireboxes glowing, glints riding round the cogs and flywheels, and glints
  // running along the brass rails.
  ambient: ({ g, glow, lit, map, clock, blocked }) => {
    for (const b of blocked) {
      const p = pieceAt(map, b.x, b.y),
        { gx, gy } = groundOf(b.x * CELL, b.y * CELL);
      if (p.kind === "standing") {
        const h = standingHub(p.standing);
        rimGlint(g, glow, X(gx, h.u), Y(gy - 2, h.v, h.h), h.r, clock, 0.7 + hash01(b.x, b.y) * 0.4, lit);
      } else if (p.kind === "engine") {
        const w = flywheelOf(p.engine);
        rimGlint(g, glow, X(gx, w.u), Y(gy, w.v, w.h), w.r, clock, 2.4, lit);
      } else if (p.kind === "boiler") {
        const parts = boilerParts(p.boiler);
        steam(g, gx + parts.chimney.x, gy + parts.chimney.y, clock, b.x * 5 + b.y, 1.1, 5);
        const f = 0.75 + 0.25 * Math.sin(clock * 7 + b.x * 3);
        disc(g, gx + parts.door.x, gy + parts.door.y, 2.2, 0xff8a3a, 0.8 * f);
        halo(glow, gx + parts.door.x, gy + parts.door.y, 12, 0xff8a3a, 0.2 * f * lit);
      } else if (p.kind === "pipes") {
        const tops = pipeTops(p.pipes),
          i = Math.floor(clock * 0.4 + hash01(b.x, b.y) * 5) % tops.length;
        steam(g, gx + tops[i].x, gy - 2 + tops[i].y, clock, b.x * 7 + b.y * 3 + i, 0.8, 3);
      }
    }
    if (!map.columns) return;
    const samples = channelOf(map),
      total = samples[samples.length - 1].s;
    for (let k = 0; k * 180 < total; k++) {
      const s = (k * 180 + clock * 40) % total,
        p = samples[Math.min(samples.length - 1, Math.floor(s / CHANNEL_STEP))];
      for (const side of [-1, 1]) {
        disc(glow, p.x + p.nx * side * 10, p.y + p.ny * side * 10, 6, 0xffd890, 0.18 * lit);
        disc(g, p.x + p.nx * side * 10, p.y + p.ny * side * 10, 1, 0xfff0b8, 0.8);
      }
    }
  },
};
