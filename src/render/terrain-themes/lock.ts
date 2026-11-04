import { CELL, disc, fillOval, hash01, type Ink, oval, shade } from "../shapes";
import { SQUASH, Y } from "../tower-art/tilt";
import { type Random, type StandingPiece, type Theme } from "./kit";
import { CHANNEL_STEP, channelOf, SEA_TILE, seaCells, seaField, shoreEdges } from "../coast";
import { blend } from "../ground";
import { fnv } from "../../core/hash";
import type { MapDefinition } from "../../core/types";
import {
  bargeShadow, capstanShadow, controlTowerShadow, CRANE_BEACON, craneShadow, cylindersShadow, drawBarge, drawCapstan, drawControlTower, drawCrane,
  drawCylinders, drawKiosk, drawLantern, drawMooring, drawPallets, drawPipes, fender, kioskShadow, kioskWindow, LANTERN, lanternShadow,
  mooringOf, mooringShadow, palletsOf, palletsShadow, pipesOf, pipesShadow, ripple, TOWER, type Mooring, type Pallet, type PipeRack,
} from "./lock-props";

// Lock Ring: a canal lock and dock complex at night on blue-grey concrete. A steel dock road with gantry crane rails
// instead of a sunken track; props in the towers' 3/4 tilt (`Theme.tilted`, `lock-props.ts`): mooring bollards,
// capstans, pipe racks, cargo pallets, gas cylinders, harbour lanterns and control kiosks; a gantry crane and the lock
// control tower as landmarks; and obstacle groups at the board edge turned into water basins behind straight quay
// walls (`Theme.sea`) with tyre fenders, ripples, mist and a moored barge.

const ACCENT = 0x7fe3ff;
/** Kind thresholds of the first `cellRandom` draw (`hash` in the ambient names the prop the same way). */
const MOORING = 0.24,
  CAPSTAN = 0.36,
  PIPES = 0.52,
  PALLETS = 0.7,
  CYLINDERS = 0.78,
  LANTERN_KIND = 0.88;
/** A kiosk's facing comes from the kind draw itself, so the ambient finds its lit window. */
const kioskFacing = (kind: number) => ((kind - LANTERN_KIND) / (1 - LANTERN_KIND) - 0.5) * 1.2;
/** Basins have straight quay walls: no wobble in their depth field. */
const QUAY = 0;

type Piece =
  | { kind: "mooring"; mooring: Mooring }
  | { kind: "capstan"; a: number }
  | { kind: "pipes"; pipes: PipeRack }
  | { kind: "pallets"; pallets: Pallet[] }
  | { kind: "cylinders"; a: number }
  | { kind: "lantern"; pallets: Pallet[] }
  | { kind: "kiosk"; a: number };
function pieceOf(rand: Random): Piece {
  const kind = rand();
  if (kind < MOORING) return { kind: "mooring", mooring: mooringOf(rand) };
  if (kind < CAPSTAN) return { kind: "capstan", a: rand() * Math.PI * 2 };
  if (kind < PIPES) return { kind: "pipes", pipes: pipesOf(rand) };
  if (kind < PALLETS) return { kind: "pallets", pallets: palletsOf(rand) };
  if (kind < CYLINDERS) return { kind: "cylinders", a: (rand() - 0.5) * 0.8 };
  if (kind < LANTERN_KIND) return { kind: "lantern", pallets: rand() < 0.5 ? palletsOf(rand).slice(0, 1).map((p) => ({ ...p, du: 10, dv: 7, z: 0 })) : [] };
  return { kind: "kiosk", a: kioskFacing(kind) };
}
const groundOf = (x: number, y: number) => ({ gx: x + CELL / 2, gy: y + 34 });

// ── Dock road ───────────────────────────────────────────────────────────────────────────────────────────────────────
const DECK = 0x3e4b58;
/**
 * The path as a steel dock road with rounded bends (`coast.ts` `channelOf`): a concrete coping, diamond-plate deck
 * panels with their seams, a pair of gantry crane rails sunk in grooves, hazard paint along both edges and drain
 * grates between the rails. No arrows: the lane lights chasing towards the reactor show the way.
 */
function drawDockRoad(g: Ink, map: MapDefinition) {
  const samples = channelOf(map),
    seed = fnv(`${map.id}:dock`),
    layer = (r: number, color: number) => {
      for (let i = 0; i < samples.length; i += 2) disc(g, samples[i].x, samples[i].y, r, color);
    },
    along = (o: number) => samples.map((p) => ({ x: p.x + p.nx * o, y: p.y + p.ny * o }));
  layer(25.5, 0x7c8894);
  layer(23.8, 0x5a6672);
  layer(22.6, DECK);
  // Diamond plate: little raised ticks in alternating directions.
  for (let i = 0; i < samples.length; i++) {
    const p = samples[i],
      tx = p.ny,
      ty = -p.nx;
    for (let k = -3; k <= 3; k++) {
      const o = k * 6 + ((i % 2) * 3 - 1.5),
        d = (i + k) % 2 ? 1 : -1,
        x = p.x + p.nx * o,
        y = p.y + p.ny * o;
      g.lineStyle(0.7, shade(DECK, 0.22), 0.6);
      g.lineBetween(x - tx * 1.2 - p.nx * d * 0.8, y - ty * 1.2 - p.ny * d * 0.8, x + tx * 1.2 + p.nx * d * 0.8, y + ty * 1.2 + p.ny * d * 0.8);
    }
  }
  // Panel seams across the deck.
  for (let i = 0; i < samples.length; i += 7) {
    const p = samples[i];
    g.lineStyle(1, 0x26303a, 0.85);
    g.lineBetween(p.x - p.nx * 22, p.y - p.ny * 22, p.x + p.nx * 22, p.y + p.ny * 22);
    g.lineStyle(0.6, shade(DECK, 0.3), 0.6);
    g.lineBetween(p.x - p.nx * 22 + p.ny, p.y - p.ny * 22 - p.nx, p.x + p.nx * 22 + p.ny, p.y + p.ny * 22 - p.nx);
  }
  // Hazard paint along both edges.
  for (let i = 0; i + 3 < samples.length; i += 3) {
    const p = samples[i],
      q = samples[i + 3],
      yellow = Math.floor(p.s / 8) % 2 === 0;
    g.lineStyle(2.4, yellow ? 0xd8b040 : 0x1e2328, 0.9);
    for (const side of [-1, 1]) g.lineBetween(p.x + p.nx * side * 21, p.y + p.ny * side * 21, q.x + q.nx * side * 21, q.y + q.ny * side * 21);
  }
  // Crane rails in their grooves.
  for (const side of [-1, 1]) {
    g.lineStyle(3.6, 0x161b20, 0.95);
    g.strokePoints(along(side * 11), false);
    g.lineStyle(1.3, 0x9aa6b0, 0.95);
    g.strokePoints(along(side * 11 - 0.4), false);
  }
  // Drain grates between the rails, and a few puddles.
  for (let i = 25; i < samples.length; i += 41) {
    const p = samples[i],
      tx = p.ny,
      ty = -p.nx;
    g.fillStyle(0x161b20);
    g.fillPoints([[-6, -4], [6, -4], [6, 4], [-6, 4]].map(([a, b]) => ({ x: p.x + p.nx * a + tx * b, y: p.y + p.ny * a + ty * b })), true);
    g.lineStyle(0.8, 0x6a7680, 0.9);
    for (let k = -4; k <= 4; k += 2) g.lineBetween(p.x + p.nx * k - tx * 3.4, p.y + p.ny * k - ty * 3.4, p.x + p.nx * k + tx * 3.4, p.y + p.ny * k + ty * 3.4);
    if (hash01(seed, i) < 0.6) {
      const o = (hash01(seed, i, 2) - 0.5) * 30;
      oval(g, p.x + p.nx * o + tx * 14, p.y + p.ny * o + ty * 14, 7, 3, 0x2a4a5e, 0.8);
    }
  }
}

// ── Basins ──────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Basin colours by distance from the quay: concrete coping with its yellow edge line, the wet wall, then dark water. */
function basinColor(d: number) {
  if (d < 1.2) return 0x8e9aa6;
  if (d < 2.4) return 0xc8a238;
  if (d < 3.6) return 0x8e9aa6;
  if (d < 9) return blend(0x1a2632, 0x163242, (d - 3.6) / 5.4);
  if (d < 70) return blend(0x12405a, 0x0c2c40, (d - 9) / 61);
  return 0x0a2436;
}
/** The basins on the edge cells: coping, quay wall and water by distance from the quay (`seaField` without wobble). */
function drawBasins(g: Ink, map: MapDefinition) {
  const n = CELL / SEA_TILE;
  for (const [k, depths] of seaField(map, QUAY)) {
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
        const c = basinColor(Math.round(depths[ty * n + tx] * 2) / 2);
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
const QUAYSIDE = new Map<string, StandingPiece[]>();
/** Tyre fenders hung along the quay walls, and one moored barge in the deepest water that has room for it. */
function quayPieces(map: MapDefinition): readonly StandingPiece[] {
  const cached = QUAYSIDE.get(map.id);
  if (cached) return cached;
  const list: StandingPiece[] = [];
  if (seaCells(map).size) {
    for (const e of shoreEdges(map)) {
      const x = (e.x0 + e.x1) / 2 + e.nx * 5,
        y = (e.y0 + e.y1) / 2 + e.ny * 5;
      list.push({ x, y, shadow: () => undefined, draw: (g) => fender(g, x, y) });
    }
    // The barge needs open water under its whole hull, inside the board: the deepest such spot wins.
    const n = CELL / SEA_TILE,
      sea = seaCells(map),
      field = seaField(map, QUAY),
      depthAt = (x: number, y: number) => {
        const cx = Math.floor(x / CELL),
          cy = Math.floor(y / CELL),
          cell = field.get(`${cx},${cy}`);
        if (!cell || !sea.has(`${cx},${cy}`)) return 0;
        return cell[Math.floor((y - cy * CELL) / SEA_TILE) * n + Math.floor((x - cx * CELL) / SEA_TILE)];
      },
      width = map.columns * CELL,
      height = map.rows * CELL;
    let best: { d: number; x: number; y: number } | undefined;
    // Clear of the board edges by about a cell, so it never hides under a corner label or runs off the board.
    for (let y = CELL * 0.9; y < height - CELL * 0.9; y += 8)
      for (let x = CELL * 1.8; x < width - CELL * 1.8; x += 8) {
        // The map's name label sits in one of the board corners: keep out of all four.
        const corner = (x < CELL * 5 || x > width - CELL * 5) && (y < CELL * 1.8 || y > height - CELL * 1.8);
        if (corner) continue;
        const d = Math.min(...[[-44, -14], [44, -14], [-44, 14], [44, 14], [0, 0]].map(([dx, dy]) => depthAt(x + dx, y + dy)));
        if (d > 10 && (!best || d > best.d)) best = { d, x, y };
      }
    if (best) {
      const { x, y } = best;
      list.push({ x, y, shadow: (g) => bargeShadow(g, x, y), draw: (g) => drawBarge(g, x, y) });
    }
  }
  QUAYSIDE.set(map.id, list);
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
export const lock: Theme = {
  backdrop: 0x0b1522,
  ground: [0x2c3742, 0x2a343f],
  grid: 0x4c5c6c,
  path: { edge: 0x7c8894, bed: DECK, line: 0x9aa6b0, arrow: ACCENT },
  accent: ACCENT,
  drawPath: drawDockRoad,
  sea: drawBasins,
  obstacle: (g, x, y, rand) => {
    const p = pieceOf(rand),
      { gx, gy } = groundOf(x, y);
    if (p.kind === "mooring") drawMooring(g, gx, gy, p.mooring);
    else if (p.kind === "capstan") drawCapstan(g, gx, gy, p.a);
    else if (p.kind === "pipes") drawPipes(g, gx, gy, p.pipes);
    else if (p.kind === "pallets") drawPallets(g, gx, gy, p.pallets);
    else if (p.kind === "cylinders") drawCylinders(g, gx, gy, p.a);
    else if (p.kind === "lantern") {
      drawLantern(g, gx - 4, gy - 4);
      drawPallets(g, gx, gy, p.pallets);
    } else drawKiosk(g, gx, gy, p.a);
  },
  tilted: {
    shadow: (g, x, y, rand) => {
      const p = pieceOf(rand),
        { gx, gy } = groundOf(x, y);
      if (p.kind === "mooring") mooringShadow(g, gx, gy, p.mooring);
      else if (p.kind === "capstan") capstanShadow(g, gx, gy, p.a);
      else if (p.kind === "pipes") pipesShadow(g, gx, gy, p.pipes);
      else if (p.kind === "pallets") palletsShadow(g, gx, gy, p.pallets);
      else if (p.kind === "cylinders") cylindersShadow(g, gx, gy, p.a);
      else if (p.kind === "lantern") {
        lanternShadow(g, gx - 4, gy - 4);
        palletsShadow(g, gx, gy, p.pallets);
      } else kioskShadow(g, gx, gy, p.a);
    },
    landmark: (g, x, y, s, variant) => {
      const { y0, k } = landmarkGround(x, y, s);
      scaled(g, x, y0, k, () => (variant ? controlTowerShadow(g) : craneShadow(g)));
      scaled(g, x, y0, k, () => (variant ? drawControlTower(g) : drawCrane(g)));
    },
    // The crane's red warning beacon blinks; the control tower's windows glow and its cyan beacon pulses.
    landmarkLight: (g, glow, x, y, s, variant, clock, lit) => {
      const { y0, k } = landmarkGround(x, y, s);
      if (variant) {
        const on = 0.5 + 0.5 * Math.sin(clock * 1.6 + x);
        glow.fillStyle(0xf0d890, 0.1 * lit);
        fillOval(glow, x, Y(y0, 12 * k, 47.5 * k), 34 * k, 10 * k);
        disc(glow, x + 8 * k, Y(y0, -6 * k, TOWER.beacon * k), 7 * k, ACCENT, 0.3 * on * lit);
        disc(g, x + 8 * k, Y(y0, -6 * k, TOWER.beacon * k), 1.6 * k, 0xe8fbff, 0.5 + 0.5 * on);
        return;
      }
      const on = Math.sin(clock * 3 + x) > 0.3 ? 1 : 0.15,
        bx = x + CRANE_BEACON.x * k,
        by = y0 - CRANE_BEACON.h * k;
      disc(glow, bx, by, 9 * k, 0xff4a3a, 0.3 * on * lit);
      disc(g, bx, by, 1.8 * k, on > 0.5 ? 0xffb0a0 : 0x5a1a14);
    },
    extras: quayPieces,
  },
  decor: (g, x, y, rand) => {
    const kind = rand(),
      cx = x + 12 + rand() * 32,
      cy = y + 12 + rand() * 32;
    if (kind < 0.25) {
      // Manhole cover.
      disc(g, cx, cy, 5.5, 0x1e262e, 0.9);
      disc(g, cx, cy, 4.5, 0x3a4652, 0.9);
      g.lineStyle(0.6, 0x1e262e, 0.8);
      for (const o of [-2, 0, 2]) g.lineBetween(cx - 3.6, cy + o, cx + 3.6, cy + o);
    } else if (kind < 0.5) {
      // A painted hazard box on the concrete.
      g.lineStyle(1.2, 0xc8a238, 0.45);
      g.strokeRect(x + 10, y + 14, 36, 28);
      for (let i = 0; i < 6; i++) g.lineBetween(x + 10 + i * 6, y + 42, x + 16 + i * 6, y + 14 + Math.max(0, i * 6 - 30));
    } else if (kind < 0.75) {
      // A puddle reflecting the lights.
      oval(g, cx, cy, 8 + rand() * 6, 3 + rand() * 2, 0x22384a, 0.75);
      g.lineStyle(0.8, ACCENT, 0.25);
      g.lineBetween(cx - 3, cy - 0.5, cx + 2, cy - 0.5);
    } else {
      // A length of chain.
      for (let i = 0; i < 6; i++) oval(g, cx - 8 + i * 3, cy + Math.sin(i) * 1.5, 1.8, 1.1, 0x6a7078, 0.9);
    }
  },
  // Lanterns and kiosk windows glowing, lane lights chasing along the road, ripples, glints and mist on the basins.
  ambient: ({ g, glow, lit, map, clock, hash, blocked }) => {
    for (const b of blocked) {
      const h = hash(b.x, b.y),
        { gx, gy } = groundOf(b.x * CELL, b.y * CELL);
      if (h >= CYLINDERS && h < LANTERN_KIND) {
        const f = 0.92 + 0.08 * Math.sin(clock * 11 + h * 70);
        disc(glow, gx - 4, Y(gy - 4, 0, LANTERN), 10, 0xffe2a0, 0.25 * f * lit);
        glow.fillStyle(0xffe2a0, 0.06 * f * lit);
        fillOval(glow, gx - 4, gy - 2, 46, 20);
      } else if (h >= LANTERN_KIND) {
        const w = kioskWindow(kioskFacing(h));
        disc(glow, gx + w.x, gy + w.y, 9, 0xf0d890, 0.18 * lit);
      }
    }
    if (!map.columns) return;
    const samples = channelOf(map),
      total = samples[samples.length - 1].s;
    // Lane lights between rail and edge, chasing towards the reactor.
    for (let i = 0; i < samples.length; i += 10) {
      const p = samples[i],
        on = Math.max(0.15, Math.sin(clock * 4 - p.s * 0.03)) ** 2;
      for (const side of [-1, 1]) {
        const x = p.x + p.nx * side * 16.5,
          y = p.y + p.ny * side * 16.5;
        disc(glow, x, y, 3.6, ACCENT, 0.25 * on * lit);
        disc(g, x, y, 0.9, 0xe8fbff, 0.4 + 0.6 * on);
      }
    }
    // A glint sliding along the rails.
    for (let k = 0; k * 260 < total; k++) {
      const s = (k * 260 + clock * 60) % total,
        p = samples[Math.min(samples.length - 1, Math.floor(s / CHANNEL_STEP))];
      for (const side of [-1, 1]) disc(glow, p.x + p.nx * side * 10.6, p.y + p.ny * side * 10.6, 4, 0xd8f4ff, 0.2 * lit);
    }
    // Ripples, glints and drifting mist on the basins.
    const n = CELL / SEA_TILE;
    for (const [k, depths] of seaField(map, QUAY)) {
      const [cx, cy] = k.split(",").map(Number);
      for (let j = 0; j < 2; j++) {
        const tx = Math.floor(hash01(cx, cy, j) * n),
          ty = Math.floor(hash01(cy, cx, j + 3) * n);
        if (depths[ty * n + tx] < 16) continue;
        const x = cx * CELL + tx * SEA_TILE,
          y = cy * CELL + ty * SEA_TILE;
        ripple(g, x, y, clock, cx * 13 + cy * 7 + j);
        const on = Math.max(0, Math.sin(clock * 1.3 + hash01(j, cx, cy) * 40)) ** 8;
        if (on > 0.05) disc(glow, x + 6, y - 4, 3, 0xd8f4ff, 0.3 * on * lit);
      }
      if (hash01(cx, cy, 9) < 0.35) {
        const drift = Math.sin(clock * 0.15 + cx) * 14;
        g.fillStyle(0x9ab8c8, 0.05);
        fillOval(g, (cx + 0.5) * CELL + drift, (cy + 0.5) * CELL, 90, 26);
      }
    }
  },
};
