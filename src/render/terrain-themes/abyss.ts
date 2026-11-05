import { CELL, disc, fillRound, hash01, type Ink, oval, shade, strokeRound } from "../shapes";
import { SQUASH, Y } from "../tower-art/tilt";
import { cellRandom, mulberry32, type Random, type StandingPiece, type Theme } from "./kit";
import { CHANNEL_STEP, channelOf, SEA_TILE, seaCells, seaField, shoreLine } from "../coast";
import { blend } from "../ground";
import { halo } from "../material";
import { fnv } from "../../core/hash";
import type { MapDefinition } from "../../core/types";
import {
  clamGlow, clamOf, clamShadow, coralOf, coralShadow, coralTips, drawClam, drawCoral, drawKelp, drawSmoker, drawVents, drawWorms, drawWreck, GLOW,
  kelpOf, kelpShadow, SMOKERS, smokerShadow, VENT, ventMouths, ventsOf, ventsShadow, WRECK, wormsOf, wormsShadow, wreckShadow, type Clam, type Coral,
  type Kelp, type Vent, type Worm,
} from "./abyss-props";

// Deep Sea: the dark floor of an ocean trench, lit only by faint shafts from far above and by living light. A sandy
// trench floor instead of the sunken track: rippled silt between rocky lips edged with glowing algae; props in the
// towers' 3/4 tilt (`Theme.tilted`, `abyss-props.ts`): branching coral with glowing tips, hydrothermal vent
// chimneys, giant clams, tube worm thickets and kelp; a sunken shipwreck with a lantern still burning and a black
// smoker mound as landmarks; and obstacle groups at the board edge turned into an abyssal drop-off (`Theme.sea`):
// a rock lip falling away into black water with marine snow sinking into it.

const ACCENT = GLOW;
/** Kind thresholds of the first `cellRandom` draw. */
const CORAL = 0.34,
  VENTS = 0.52,
  CLAM = 0.66,
  WORMS = 0.82;
/** The drop-off's lip meanders like a coast. */
const LIP = 6;

type Piece =
  | { kind: "coral"; coral: Coral }
  | { kind: "vents"; vents: Vent[] }
  | { kind: "clam"; clam: Clam }
  | { kind: "worms"; worms: Worm[] }
  | { kind: "kelp"; kelp: Kelp[] };
function pieceOf(rand: Random): Piece {
  const kind = rand();
  if (kind < CORAL) return { kind: "coral", coral: coralOf(rand) };
  if (kind < VENTS) return { kind: "vents", vents: ventsOf(rand) };
  if (kind < CLAM) return { kind: "clam", clam: clamOf(rand) };
  if (kind < WORMS) return { kind: "worms", worms: wormsOf(rand) };
  return { kind: "kelp", kelp: kelpOf(rand) };
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

// ── Trench floor ────────────────────────────────────────────────────────────────────────────────────────────────────
const SILT = 0x0e2a3a;
/**
 * The path as a trench floor with rounded bends (`coast.ts` `channelOf`): rocky lips with glowing algae along their
 * edge, a bed of pale silt rippled across the current, scattered shells and a dark seam of deeper water down the middle.
 */
function drawTrench(g: Ink, map: MapDefinition) {
  const samples = channelOf(map),
    seed = fnv(`${map.id}:trench`),
    layer = (r: number, color: number) => {
      for (let i = 0; i < samples.length; i += 2) disc(g, samples[i].x, samples[i].y, r, color);
    },
    along = (o: number) => samples.map((p) => ({ x: p.x + p.nx * o, y: p.y + p.ny * o }));
  layer(26, 0x1a3444);
  layer(24, 0x0a1a26);
  layer(22, SILT);
  // Lumps of rock along the lips.
  for (let i = 0; i < samples.length; i += 2) {
    const p = samples[i],
      h = hash01(seed, i);
    if (h > 0.5) continue;
    const o = (h < 0.25 ? -1 : 1) * (23 + hash01(seed, i, 2) * 3);
    oval(g, p.x + p.nx * o, p.y + p.ny * o, 2.5 + h * 5, 1.6 + h * 3, shade(0x24384a, (hash01(seed, i, 3) - 0.5) * 0.3), 0.95);
  }
  // A slightly darker seam of deeper water down the middle, then the ripple marks across the current.
  g.lineStyle(12, 0x0a2232, 0.6);
  g.strokePoints(along(0), false);
  for (let i = 0; i < samples.length; i += 6) {
    const p = samples[i],
      tx = p.ny,
      ty = -p.nx,
      bow = 2 + hash01(seed, i, 4) * 1.5;
    g.lineStyle(1, 0x2a5a6a, 0.3 + hash01(seed, i, 8) * 0.2);
    g.strokePoints([-0.85, -0.4, 0, 0.4, 0.85].map((k) => ({ x: p.x + p.nx * 19 * k + tx * bow * (1 - k * k), y: p.y + p.ny * 19 * k + ty * bow * (1 - k * k) })), false);
  }
  // Shells and pale pebbles in the silt.
  for (let i = 4; i < samples.length; i += 9) {
    const p = samples[i],
      o = (hash01(seed, i, 5) - 0.5) * 32,
      x = p.x + p.nx * o,
      y = p.y + p.ny * o;
    if (hash01(seed, i, 6) < 0.4) {
      g.fillStyle(0x6a9aa8, 0.85);
      g.fillTriangle(x - 2.4, y + 1.4, x + 2.4, y + 1.4, x, y - 2);
    } else disc(g, x, y, 0.9 + hash01(seed, i, 7), 0x2a5a6a, 0.9);
  }
  // Glowing algae dots along both lips.
  for (let i = 0; i < samples.length; i += 4) {
    const p = samples[i];
    for (const side of [-1, 1]) if (hash01(seed, i, side + 9) < 0.6) disc(g, p.x + p.nx * side * 21.5, p.y + p.ny * side * 21.5, 0.9, 0x2a9a9a, 0.9);
  }
}

// ── Drop-off ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** The drop-off on the edge cells: a rock lip, its edge lit faintly, then water falling away into black. */
function drawDropOff(g: Ink, map: MapDefinition) {
  const n = CELL / SEA_TILE,
    seed = fnv(`${map.id}:drop`);
  for (const [k, depths] of seaField(map, LIP)) {
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
        if (d < 3) c = shade(0x24384a, (hash01(seed, Math.floor(x / 6), Math.floor(y / 6)) - 0.5) * 0.2);
        else if (d < 4.5) c = 0x3a6a7a;
        else if (d < 8) c = 0x0e1e2a;
        else c = blend(0x061420, 0x01040a, Math.min(1, (d - 8) / 50));
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
const LIP_PIECES = new Map<string, StandingPiece[]>();
/** Coral and kelp clinging to the lip of the drop-off, clear of the path. */
function lipPieces(map: MapDefinition): readonly StandingPiece[] {
  const cached = LIP_PIECES.get(map.id);
  if (cached) return cached;
  const list: StandingPiece[] = [],
    path = map.path.map((p) => ({ x: (p.x + 0.5) * CELL, y: (p.y + 0.5) * CELL }));
  if (seaCells(map).size)
    for (const s of shoreLine(map, 2, 34)) {
      const rand = mulberry32(fnv(`${map.id}:lip:${Math.round(s.x)}:${Math.round(s.y)}`)),
        roll = rand();
      if (roll > 0.45 || path.some((p) => (p.x - s.x) ** 2 + (p.y - s.y) ** 2 < 44 * 44)) continue;
      if (roll < 0.2) {
        const k = kelpOf(rand).slice(0, 2).map((q) => ({ ...q, u: q.u * 0.4, v: q.v * 0.3, h: q.h * 0.7 }));
        list.push({ x: s.x, y: s.y, shadow: (g) => kelpShadow(g, s.x, s.y), draw: (g) => drawKelp(g, s.x, s.y, k) });
      } else {
        const c = coralOf(rand);
        c.branches = c.branches.slice(0, 3).map((b) => ({ ...b, h: b.h * 0.6, spread: b.spread * 0.6 }));
        list.push({ x: s.x, y: s.y, shadow: (g) => coralShadow(g, s.x, s.y), draw: (g) => drawCoral(g, s.x, s.y, c) });
      }
    }
  LIP_PIECES.set(map.id, list);
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
/** A rising plume (black smoke over a smoker, bubbles elsewhere) from (x, y), drifting with the current. */
function plume(g: Ink, x: number, y: number, clock: number, seed: number, size: number, color: number, alpha: number, count = 5) {
  for (let i = 0; i < count; i++) {
    const life = (clock * 0.22 + i / count + hash01(seed)) % 1;
    disc(g, x + life * 10 * size + Math.sin(clock * 0.8 + i * 2) * 2 * size, y - life * 34 * size, (2.5 + life * 7) * size, color, alpha * Math.sin(Math.PI * life));
  }
}

// ── Theme ───────────────────────────────────────────────────────────────────────────────────────────────────────────
export const abyss: Theme = {
  backdrop: 0x020a14,
  ground: [0x061424, 0x051220],
  grid: 0x0f3050,
  path: { edge: 0x1a3444, bed: SILT, line: 0x3df2e0, arrow: 0x7af8ea },
  accent: ACCENT,
  drawPath: drawTrench,
  sea: drawDropOff,
  obstacle: (g, x, y, rand) => {
    const p = pieceOf(rand),
      { gx, gy } = groundOf(x, y);
    if (p.kind === "coral") drawCoral(g, gx, gy, p.coral);
    else if (p.kind === "vents") drawVents(g, gx, gy, p.vents);
    else if (p.kind === "clam") drawClam(g, gx, gy, p.clam);
    else if (p.kind === "worms") drawWorms(g, gx, gy, p.worms);
    else drawKelp(g, gx, gy, p.kelp);
  },
  tilted: {
    shadow: (g, x, y, rand) => {
      const p = pieceOf(rand),
        { gx, gy } = groundOf(x, y);
      if (p.kind === "coral") coralShadow(g, gx, gy);
      else if (p.kind === "vents") ventsShadow(g, gx, gy, p.vents);
      else if (p.kind === "clam") clamShadow(g, gx, gy);
      else if (p.kind === "worms") wormsShadow(g, gx, gy);
      else kelpShadow(g, gx, gy);
    },
    landmark: (g, x, y, s, variant) => {
      const { y0, k } = landmarkGround(x, y, s);
      scaled(g, x, y0, k, () => (variant ? smokerShadow(g) : wreckShadow(g)));
      scaled(g, x, y0, k, () => (variant ? drawSmoker(g) : drawWreck(g)));
    },
    // The wreck's lantern still burns and bubbles leak from its hull; the black smoker's chimneys glow and pour smoke.
    landmarkLight: (g, glow, x, y, s, variant, clock, lit) => {
      const { y0, k } = landmarkGround(x, y, s);
      if (variant) {
        for (const c of SMOKERS) {
          const mx = x + c.u * k,
            my = Y(y0, c.v * k, c.h * k);
          halo(glow, mx, my, 12 * k, VENT, (0.22 + 0.06 * Math.sin(clock * 3 + c.u)) * lit);
          plume(g, mx, my - 2 * k, clock, x + c.u, 1.3 * k, 0x0a0e12, 0.5, 6);
        }
        return;
      }
      const lx = x + WRECK.lantern.u * k,
        ly = Y(y0, WRECK.lantern.v * k, (WRECK.lantern.h - 2) * k),
        f = 0.8 + 0.2 * Math.sin(clock * 7 + x);
      disc(g, lx, ly, 1.6 * k, 0xffe0a0, f);
      halo(glow, lx, ly, 14 * k, 0xffc870, 0.24 * f * lit);
      for (let i = 0; i < 3; i++) {
        const life = (clock * 0.4 + i / 3) % 1;
        g.lineStyle(1, 0xbff8ff, 0.55 * (1 - life));
        strokeRound(g, x + (-2 + i * 4) * k + Math.sin(life * 6 + i) * 2, y0 - (22 + life * 40) * k, (1.2 + life * 2) * k);
      }
    },
    extras: lipPieces,
  },
  decor: (g, x, y, rand) => {
    const kind = rand(),
      cx = x + 12 + rand() * 32,
      cy = y + 14 + rand() * 28;
    if (kind < 0.35) {
      // Seaweed fronds.
      for (let i = 0; i < 3; i++) {
        const bx = cx + (i - 1) * 4,
          lean = (rand() - 0.5) * 8,
          h = 10 + rand() * 6;
        g.lineStyle(1.5, i === 1 ? 0x2a8a5a : 0x1f6a48, 0.85);
        g.strokePoints([{ x: bx, y: cy + 6 }, { x: bx + lean, y: cy + 6 - h * 0.5 }, { x: bx - lean * 0.4, y: cy + 6 - h }], false);
      }
    } else if (kind < 0.6) {
      // A shell.
      g.fillStyle(0x3a6a7a, 0.9);
      g.fillTriangle(cx - 5, cy + 3, cx + 5, cy + 3, cx, cy - 4);
      g.lineStyle(1, 0x9ad8e0, 0.6);
      for (const dx of [-2.5, 0, 2.5]) g.lineBetween(cx, cy + 3, cx + dx * 1.2, cy - 3);
    } else if (kind < 0.8) {
      // A starfish.
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        g.lineStyle(2, 0xc8603a, 0.85);
        g.lineBetween(cx, cy, cx + Math.cos(a) * 5, cy + Math.sin(a) * 5 * SQUASH);
      }
    } else {
      // Pale pebbles on the seabed.
      for (let i = 0; i < 3; i++) disc(g, cx + (rand() - 0.5) * 14, cy + (rand() - 0.5) * 8, 1.5 + rand() * 1.5, 0x1a4658, 0.9);
    }
  },
  // Slow light shafts from far above, marine snow sinking, coral tips and clams pulsing, vents glowing and bubbling,
  // living light running along the trench lips.
  ambient: ({ g, glow, lit, map, clock, hash, blocked, still }) => {
    for (const b of blocked) {
      const p = pieceAt(map, b.x, b.y),
        { gx, gy } = groundOf(b.x * CELL, b.y * CELL);
      if (p.kind === "coral")
        coralTips(p.coral).forEach((t, i) => {
          const on = 0.5 + 0.5 * Math.sin(clock * 1.6 + i * 1.3 + b.x);
          disc(glow, gx + t.u, Y(gy, t.v, t.h), 5, p.coral.tip, 0.22 * on * lit);
        });
      else if (p.kind === "vents")
        for (const m of ventMouths(p.vents)) {
          halo(glow, gx + m.x, gy + m.y, m.r * 2.4, VENT, (0.2 + 0.06 * Math.sin(clock * 3 + b.x + m.x)) * lit);
          for (let i = 0; i < 3; i++) {
            const life = (clock * 0.7 + i / 3 + hash01(b.x, b.y, i)) % 1;
            g.lineStyle(1.1, 0xbff8ff, 0.6 * (1 - life));
            strokeRound(g, gx + m.x + Math.sin(life * 7 + i) * 3, gy + m.y - 2 - life * 34, 1.2 + life * 2.4);
          }
        }
      else if (p.kind === "clam") {
        const c = clamGlow(p.clam);
        halo(glow, gx + c.x, gy + c.y, 14, 0x3ab8e0, (0.16 + 0.08 * Math.sin(clock * 1.2 + b.y)) * lit);
      } else if (p.kind === "worms") halo(glow, gx, gy - 14, 12, 0xff6a5a, (0.06 + 0.03 * Math.sin(clock + b.x)) * lit);
    }
    if (!map.columns) return;
    const w = map.columns * CELL,
      h = map.rows * CELL;
    // Light shafts swaying from far above.
    for (let k = 0; k < Math.ceil(map.columns / 2); k++) {
      const s = hash(k, 5),
        sway = Math.sin(clock * 0.25 + s * 20) * 14,
        x0 = s * w + sway;
      glow.fillStyle(0x7af8ea, (0.025 + 0.015 * Math.sin(clock * 0.5 + s * 9)) * lit);
      glow.fillPoints([{ x: x0, y: 0 }, { x: x0 + 22, y: 0 }, { x: x0 + 70, y: h }, { x: x0 + 30, y: h }], true);
    }
    // Marine snow sinking slowly over everything.
    if (!still)
      for (let k = 0; k < map.columns * 3; k++) {
        const s = hash(k, 7),
          fy = (clock * (5 + s * 5) + s * h * 3) % (h + 20) - 10,
          fx = (s * w * 7 + Math.sin(clock * 0.4 + k) * 8) % w;
        g.fillStyle(0xc8e8f0, 0.15 + s * 0.25);
        fillRound(g, fx, fy, 0.5 + s * 0.8);
      }
    // Living light pulses running along both lips of the trench.
    const samples = channelOf(map),
      total = samples[samples.length - 1].s;
    for (let k = 0; k * 170 < total; k++) {
      const s = (k * 170 + clock * 35) % total,
        p = samples[Math.min(samples.length - 1, Math.floor(s / CHANNEL_STEP))];
      for (const side of [-1, 1]) {
        disc(glow, p.x + p.nx * side * 21.5, p.y + p.ny * side * 21.5, 6, ACCENT, 0.22 * lit);
        disc(g, p.x + p.nx * side * 21.5, p.y + p.ny * side * 21.5, 1.2, 0xd8fff8, 0.9);
      }
    }
    // Faint glints sinking into the drop-off.
    const n = CELL / SEA_TILE;
    for (const [key, depths] of seaField(map, LIP)) {
      const [cx, cy] = key.split(",").map(Number),
        tx = Math.floor(hash01(cx, cy) * n),
        ty = Math.floor(hash01(cy, cx, 3) * n);
      if (depths[ty * n + tx] < 12) continue;
      const life = (clock * 0.15 + hash01(cx, cy, 2)) % 1;
      disc(glow, cx * CELL + tx * SEA_TILE, cy * CELL + ty * SEA_TILE + life * 30, 3, ACCENT, 0.2 * Math.sin(Math.PI * life) * lit);
    }
  },
};
