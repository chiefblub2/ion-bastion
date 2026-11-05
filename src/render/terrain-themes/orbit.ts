import { CELL, disc, fillRound, hash01, type Ink, oval, shade, strokeOval } from "../shapes";
import { Y } from "../tower-art/tilt";
import { cellRandom, type Random, type StandingPiece, type Theme } from "./kit";
import { CHANNEL_STEP, channelOf, SEA_TILE, seaCells, seaField, shoreEdges } from "../coast";
import { blend } from "../ground";
import { halo } from "../material";
import { fnv } from "../../core/hash";
import type { MapDefinition } from "../../core/types";
import {
  armOf, armShadow, cargoOf, cargoShadow, COMMS, commsShadow, dishShadow, dishTip, drawArm, drawCargo, drawComms, drawDish, drawHydro, drawShuttle,
  CYAN, drawSolar, drawSpheres, hydroShadow, SHUTTLE, solarCores, sphereGlows, shuttleShadow, solarOf, solarShadow, spheresOf, spheresShadow, wristOf, type Arm, type Cargo, type Solar,
  type Spheres,
} from "./orbit-props";

// Orbital Deck: the hull of a station in orbit, deep blue plating under its own work lights. A maglev lane instead of
// a road: a recessed track with two glowing rails, grip plating and edge light strips; props in the towers' 3/4 tilt
// (`Theme.tilted`, `orbit-props.ts`): hex energy collectors, armoured cargo modules, plasma cells, robotic arms, sensor
// dishes and hydroponics domes; a dropship on its pad and a sensor spire as landmarks; and obstacle groups at the board
// edge turned into viewports (`Theme.sea`): open space behind a hull rim, black void with nebula haze and stars.

const ACCENT = 0x8fb0ff;
/** Hot white core of a cyan emitter. */
const CORE = 0xd8fbff;
/** Kind thresholds of the first `cellRandom` draw. */
const SOLAR = 0.24,
  CARGO = 0.44,
  SPHERES = 0.58,
  ARM = 0.7,
  DISH = 0.84;
/** Viewports have straight hull edges. */
const RIM = 0;

type Piece =
  | { kind: "solar"; solar: Solar }
  | { kind: "cargo"; cargo: Cargo }
  | { kind: "spheres"; spheres: Spheres }
  | { kind: "arm"; arm: Arm; cargo: Cargo }
  | { kind: "dish"; a: number }
  | { kind: "hydro" };
function pieceOf(rand: Random): Piece {
  const kind = rand();
  if (kind < SOLAR) return { kind: "solar", solar: solarOf(rand) };
  if (kind < CARGO) return { kind: "cargo", cargo: cargoOf(rand) };
  if (kind < SPHERES) return { kind: "spheres", spheres: spheresOf(rand) };
  if (kind < ARM) {
    const arm = armOf(rand),
      cargo = cargoOf(rand);
    return { kind: "arm", arm, cargo: { ...cargo, pods: cargo.pods.slice(0, 1) } };
  }
  if (kind < DISH) return { kind: "dish", a: rand() * Math.PI * 2 };
  return { kind: "hydro" };
}
const groundOf = (x: number, y: number) => ({ gx: x + CELL / 2, gy: y + 36 });
/** The arm's base and the pod it works on share a cell. */
const ARM_AT = { u: -8, v: -4 } as const,
  ARM_POD = { u: 10, v: 6 } as const;
/** A cell's piece rolled once per map for the ambient, from the same stream as its baked body. */
const PIECES = new Map<string, Piece>();
function pieceAt(map: MapDefinition, x: number, y: number) {
  const key = `${map.id}:${x}:${y}`;
  let p = PIECES.get(key);
  if (!p) PIECES.set(key, (p = pieceOf(cellRandom(map, x, y))));
  return p;
}

// ── Maglev lane ─────────────────────────────────────────────────────────────────────────────────────────────────────
const LANE = 0x1a2244;
/**
 * The path as a maglev lane with rounded bends (`coast.ts` `channelOf`): a bright hull rim, a recessed lane of grip
 * plating with its hexagon studs, two maglev rails in dark grooves and painted chevrons pointing the way.
 */
function drawLane(g: Ink, map: MapDefinition) {
  const samples = channelOf(map),
    seed = fnv(`${map.id}:lane`),
    layer = (r: number, color: number) => {
      for (let i = 0; i < samples.length; i += 2) disc(g, samples[i].x, samples[i].y, r, color);
    },
    along = (o: number) => samples.map((p) => ({ x: p.x + p.nx * o, y: p.y + p.ny * o }));
  layer(25.5, 0x8a96b8);
  layer(24, 0x3a4670);
  layer(22.5, LANE);
  // Grip plating: a grid of small studs, panels with seams.
  for (let i = 0; i < samples.length; i += 2) {
    const p = samples[i];
    for (let k = -3; k <= 3; k++) {
      if (Math.abs(k) === 2) continue;
      const o = k * 5.6 + (i % 4 ? 2.8 : 0);
      disc(g, p.x + p.nx * o, p.y + p.ny * o, 0.8, shade(LANE, 0.35), 0.8);
    }
  }
  for (let i = 0; i < samples.length; i += 12) {
    const p = samples[i];
    g.lineStyle(1, 0x0c1024, 0.9);
    g.lineBetween(p.x - p.nx * 22, p.y - p.ny * 22, p.x + p.nx * 22, p.y + p.ny * 22);
  }
  // Maglev rails in their grooves.
  for (const side of [-1, 1]) {
    g.lineStyle(4.4, 0x06081a, 1);
    g.strokePoints(along(side * 11), false);
    g.lineStyle(1.6, 0x6a86d8, 0.95);
    g.strokePoints(along(side * 11 - 0.4), false);
  }
  // Chevrons down the middle, painted pale and worn.
  for (let i = 10; i + 3 < samples.length; i += 16) {
    const p = samples[i],
      tx = p.ny,
      ty = -p.nx,
      wear = 0.35 + hash01(seed, i) * 0.25;
    g.lineStyle(2, 0xb8c8ff, wear);
    g.strokePoints([{ x: p.x + p.nx * 5 - tx * 2.5, y: p.y + p.ny * 5 - ty * 2.5 }, { x: p.x + tx * 2.5, y: p.y + ty * 2.5 }, { x: p.x - p.nx * 5 - tx * 2.5, y: p.y - p.ny * 5 - ty * 2.5 }], false);
  }
}

// ── Viewports ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** Space by distance from the hull: the rim, hazard band and frame, then black space with faint nebula haze and stars. */
function drawViewports(g: Ink, map: MapDefinition) {
  const n = CELL / SEA_TILE,
    seed = fnv(`${map.id}:space`);
  for (const [k, depths] of seaField(map, RIM)) {
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
        if (d < 1.5) c = 0x8a96b8;
        else if (d < 3.5) c = Math.floor((x + y) / 6) % 2 ? 0xe0b040 : 0x1a1e28;
        else if (d < 6) c = 0x2a3248;
        else if (d < 7) c = 0x0c1024;
        else {
          // Faint nebula haze over the void: two slow waves crossed, violet where they agree, blue where they part.
          const haze = Math.sin(x * 0.011 + Math.sin(y * 0.017 + hash01(seed) * 6) * 2) * Math.sin(y * 0.013 + x * 0.004 + hash01(seed, 1) * 6),
            deep = blend(0x050816, 0x02030a, Math.min(1, (d - 7) / 30));
          c = haze > 0.45 ? blend(deep, 0x1e1242, Math.min(1, (haze - 0.45) * 1.4)) : haze < -0.6 ? blend(deep, 0x0a1a3a, Math.min(1, (-haze - 0.6) * 1.6)) : deep;
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
    // Fixed stars in the black, a few tinted and a rare bright one with a cross glint.
    for (let j = 0; j < 14; j++) {
      const tx = Math.floor(hash01(cx, cy, j) * n),
        ty = Math.floor(hash01(cy, cx, j + 7) * n),
        x = cx * CELL + tx * SEA_TILE,
        y = cy * CELL + ty * SEA_TILE;
      if (depths[ty * n + tx] < 9) continue;
      const h = hash01(j, cx, cy),
        tint = h < 0.15 ? 0xffd8a8 : h < 0.3 ? 0xa8c8ff : 0xdbe6ff;
      disc(g, x, y, 0.4 + h * 0.8, tint, 0.4 + hash01(cx, j, cy) * 0.6);
      if (h > 0.96) {
        g.lineStyle(0.6, tint, 0.6);
        g.lineBetween(x - 3, y, x + 3, y);
        g.lineBetween(x, y - 3, x, y + 3);
      }
    }
  }
}
const RAILS = new Map<string, StandingPiece[]>();
/** Handrail posts along the viewport rims. */
function rimPieces(map: MapDefinition): readonly StandingPiece[] {
  const cached = RAILS.get(map.id);
  if (cached) return cached;
  const list: StandingPiece[] = [];
  if (seaCells(map).size)
    for (const e of shoreEdges(map)) {
      const x = (e.x0 + e.x1) / 2 + e.nx * 1,
        y = (e.y0 + e.y1) / 2 + e.ny * 1;
      list.push({
        x,
        y,
        shadow: () => undefined,
        draw: (g) => {
          g.lineStyle(1.4, 0x0c1024);
          g.lineBetween(x, y, x, y - 9);
          g.lineStyle(0.8, 0xa8b4d8);
          g.lineBetween(x - 0.3, y, x - 0.3, y - 9);
          disc(g, x, y - 9, 1.1, 0xa8b4d8);
        },
      });
    }
  RAILS.set(map.id, list);
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
/** A blinking nav light: on g a small lamp, on glow its light. */
function navLight(g: Ink, glow: Ink, x: number, y: number, color: number, on: number, lit: number, r = 1.2) {
  disc(g, x, y, r, on > 0.5 ? shade(color, 0.4) : shade(color, -0.6));
  if (on > 0.5) disc(glow, x, y, r * 4, color, 0.3 * lit);
}

// ── Theme ───────────────────────────────────────────────────────────────────────────────────────────────────────────
export const orbit: Theme = {
  backdrop: 0x070a14,
  ground: [0x10162a, 0x0e1325],
  grid: 0x2c3a60,
  path: { edge: 0x8a96b8, bed: LANE, line: 0x8fb0ff, arrow: 0xa4c0ff },
  accent: ACCENT,
  drawPath: drawLane,
  sea: drawViewports,
  obstacle: (g, x, y, rand) => {
    const p = pieceOf(rand),
      { gx, gy } = groundOf(x, y);
    if (p.kind === "solar") drawSolar(g, gx, gy - 2, p.solar);
    else if (p.kind === "cargo") drawCargo(g, gx, gy, p.cargo);
    else if (p.kind === "spheres") drawSpheres(g, gx, gy, p.spheres);
    else if (p.kind === "arm") {
      drawArm(g, gx + ARM_AT.u, gy + ARM_AT.v * 0.65, p.arm);
      drawCargo(g, gx + ARM_POD.u, gy + ARM_POD.v * 0.65, p.cargo);
    } else if (p.kind === "dish") drawDish(g, gx, gy, p.a);
    else drawHydro(g, gx, gy);
  },
  tilted: {
    shadow: (g, x, y, rand) => {
      const p = pieceOf(rand),
        { gx, gy } = groundOf(x, y);
      if (p.kind === "solar") solarShadow(g, gx, gy - 2, p.solar);
      else if (p.kind === "cargo") cargoShadow(g, gx, gy, p.cargo);
      else if (p.kind === "spheres") spheresShadow(g, gx, gy, p.spheres);
      else if (p.kind === "arm") {
        armShadow(g, gx + ARM_AT.u, gy + ARM_AT.v * 0.65, p.arm);
        cargoShadow(g, gx + ARM_POD.u, gy + ARM_POD.v * 0.65, p.cargo);
      } else if (p.kind === "dish") dishShadow(g, gx, gy);
      else hydroShadow(g, gx, gy);
    },
    landmark: (g, x, y, s, variant) => {
      const { y0, k } = landmarkGround(x, y, s);
      scaled(g, x, y0, k, () => (variant ? commsShadow(g) : shuttleShadow(g)));
      scaled(g, x, y0, k, () => (variant ? drawComms(g) : drawShuttle(g)));
    },
    // The shuttle's engines idle blue and its wingtip lights blink red and green; the comms array's beacon pulses.
    // The dropship's engines idle cyan, its canopy glows and its wingtip lights blink red and green; the sensor spire's
    // emitter pulses and holographic rings turn round its column.
    landmarkLight: (g, glow, x, y, s, variant, clock, lit) => {
      const { y0, k } = landmarkGround(x, y, s);
      if (variant) {
        const ey = Y(y0, 0, (COMMS.beacon - 4) * k),
          on = 0.7 + 0.3 * Math.sin(clock * 2.2 + x);
        halo(glow, x, ey, 18 * k, CYAN, 0.28 * on * lit);
        COMMS.rings.forEach((h, i) => {
          const r = (24 - i * 5) * k,
            ry = Y(y0, 0, h * k),
            spin = clock * (0.8 + i * 0.3) * (i % 2 ? -1 : 1);
          glow.lineStyle(1.2 * k, CYAN, 0.16 * lit);
          strokeOval(glow, x, ry, r * 2, r * 2 * 0.65);
          // Three bright arcs riding round each ring.
          for (let j = 0; j < 3; j++) {
            const t = spin + (j / 3) * Math.PI * 2;
            disc(glow, x + Math.cos(t) * r, ry + Math.sin(t) * r * 0.65, 2.4 * k, CYAN, 0.3 * lit);
            disc(g, x + Math.cos(t) * r, ry + Math.sin(t) * r * 0.65, 0.9 * k, CORE, Math.sin(t) > 0 ? 0.9 : 0.4);
          }
        });
        return;
      }
      for (const e of SHUTTLE.engines) {
        const ex = x + e.u * k,
          ey = Y(y0, e.v * k, e.h * k);
        disc(g, ex, ey, 1.8 * k, CORE, 0.7 + 0.3 * Math.sin(clock * 9 + e.v));
        halo(glow, ex, ey, 14 * k, CYAN, 0.28 * lit);
      }
      halo(glow, x + SHUTTLE.canopy.u * k, Y(y0, SHUTTLE.canopy.v * k, SHUTTLE.canopy.h * k), 10 * k, CYAN, 0.18 * lit);
      // The landing ring's lamps chasing round the pad.
      for (let i = 0; i < 12; i++) {
        const t = (i / 12) * Math.PI * 2,
          on = Math.max(0, Math.sin(clock * 3 - i * 0.6)) ** 3;
        disc(glow, x + Math.cos(t) * 34 * k, Y(y0, Math.sin(t) * 34 * k, 6.4 * k), 3 * k, CYAN, 0.3 * on * lit);
      }
      SHUTTLE.nav.forEach((n, i) => navLight(g, glow, x + n.u * k, Y(y0, n.v * k, n.h * k), i ? 0x4aff8a : 0xff4a3a, Math.sin(clock * 3 + i * 1.5) > 0.5 ? 1 : 0, lit, 1.4 * k));
    },
    extras: rimPieces,
  },
  decor: (g, x, y, rand) => {
    const kind = rand(),
      cx = x + 12 + rand() * 32,
      cy = y + 12 + rand() * 32;
    if (kind < 0.35) {
      // A deck hatch with its corner bolts.
      g.lineStyle(1, 0x1a2242, 0.9);
      g.strokeRect(x + 6, y + 6, CELL - 12, CELL - 12);
      for (const [dx, dy] of [[9, 9], [CELL - 9, 9], [9, CELL - 9], [CELL - 9, CELL - 9]]) disc(g, x + dx, y + dy, 1.2, 0x2a3866);
    } else if (kind < 0.6) {
      // A tie-down ring.
      oval(g, cx, cy, 3.4, 2.2, 0x2a3866, 0.9);
      oval(g, cx, cy, 2, 1.2, 0x0e1325, 0.9);
    } else if (kind < 0.8) {
      // A stencilled deck number.
      g.lineStyle(1.2, 0x3a4a80, 0.6);
      g.strokeRect(cx - 6, cy - 4, 5, 8);
      g.lineBetween(cx + 2, cy - 4, cx + 2, cy + 4);
    } else {
      // A cable run in its floor channel.
      g.lineStyle(3, 0x070a18, 0.9);
      g.lineBetween(x, cy, x + CELL, cy + (rand() - 0.5) * 6);
      g.lineStyle(1, 0x3a4a80, 0.8);
      g.lineBetween(x, cy, x + CELL, cy);
    }
  },
  // Nav lights blinking on the props, dish feeds and arm wrists lit, grow lights in the domes, lane lights chasing to
  // the reactor, light running along the maglev rails, and stars twinkling in the viewports.
  ambient: ({ g, glow, lit, map, clock, blocked }) => {
    for (const b of blocked) {
      const p = pieceAt(map, b.x, b.y),
        { gx, gy } = groundOf(b.x * CELL, b.y * CELL),
        blink = Math.sin(clock * 2.4 + b.x * 1.3 + b.y) > 0.6 ? 1 : 0;
      if (p.kind === "dish") {
        const t = dishTip(p.a);
        halo(glow, gx + t.x, gy + t.y, 8, CYAN, (0.18 + 0.1 * blink) * lit);
      } else if (p.kind === "arm") {
        const w = wristOf(p.arm),
          ax = gx + ARM_AT.u,
          ay = gy + ARM_AT.v * 0.65;
        navLight(g, glow, ax + w.u, Y(ay, w.v, w.h + 1.5), 0xffc857, 1, lit, 0.9);
      } else if (p.kind === "hydro") halo(glow, gx, Y(gy, 0, 8), 14, 0xd88aff, (0.12 + 0.03 * Math.sin(clock * 0.8 + b.x)) * lit);
      else if (p.kind === "solar") for (const c of solarCores(p.solar)) halo(glow, gx + c.x, gy - 2 + c.y, 7, CYAN, (0.2 + 0.08 * Math.sin(clock * 2 + b.x)) * lit);
      else if (p.kind === "spheres") for (const c of sphereGlows(p.spheres)) halo(glow, gx + c.x, gy + c.y, c.r * 3, p.spheres.color, (0.2 + 0.06 * Math.sin(clock * 3 + c.x + b.y)) * lit);
      else if (p.kind === "cargo") navLight(g, glow, gx, Y(gy, 0, 2), CYAN, blink, lit, 0.6);
    }
    if (!map.columns) return;
    const samples = channelOf(map),
      total = samples[samples.length - 1].s;
    // Lane lights along the rim, chasing towards the reactor.
    for (let i = 0; i < samples.length; i += 8) {
      const p = samples[i],
        on = Math.max(0.1, Math.sin(clock * 5 - p.s * 0.025)) ** 3;
      for (const side of [-1, 1]) {
        const x = p.x + p.nx * side * 18.5,
          y = p.y + p.ny * side * 18.5;
        disc(glow, x, y, 3.2, ACCENT, 0.25 * on * lit);
        disc(g, x, y, 0.8, 0xe8f0ff, 0.3 + 0.7 * on);
      }
    }
    // A pulse running along the maglev rails.
    for (let k = 0; k * 220 < total; k++) {
      const s = (k * 220 + clock * 90) % total,
        p = samples[Math.min(samples.length - 1, Math.floor(s / CHANNEL_STEP))];
      for (const side of [-1, 1]) disc(glow, p.x + p.nx * side * 10.6, p.y + p.ny * side * 10.6, 5, 0x8ab0ff, 0.25 * lit);
    }
    // Stars twinkling in the viewports.
    const n = CELL / SEA_TILE;
    for (const [key, depths] of seaField(map, RIM)) {
      const [cx, cy] = key.split(",").map(Number);
      for (let j = 0; j < 3; j++) {
        const tx = Math.floor(hash01(cx, cy, j + 20) * n),
          ty = Math.floor(hash01(cy, cx, j + 27) * n),
          x = cx * CELL + tx * SEA_TILE,
          y = cy * CELL + ty * SEA_TILE;
        if (depths[ty * n + tx] < 9) continue;
        const tw = Math.max(0, Math.sin(clock * (0.8 + hash01(j, cx)) + hash01(cx, cy, j) * 30));
        g.fillStyle(0xdbe6ff, tw * 0.8);
        fillRound(g, x, y, 0.6 + tw);
      }
    }
  },
};
