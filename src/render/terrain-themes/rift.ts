import { CELL, disc, hash01, type Ink, oval, shade, strokeOval } from "../shapes";
import { Y } from "../tower-art/tilt";
import { cellRandom, mulberry32, plateAt, type Random, type StandingPiece, type Theme } from "./kit";
import { CHANNEL_STEP, channelOf, SEA_TILE, seaCells, seaField, shoreLine } from "../coast";
import { blend } from "../ground";
import { halo } from "../material";
import { fnv } from "../../core/hash";
import type { MapDefinition } from "../../core/types";
import {
  CAGE, cageShadow, debrisGlows, debrisOf, debrisShadow, drawCage, drawDebris, drawMonolith, drawPortal, drawPylon, drawSlabs, drawTear, HOT, MONOLITH,
  monolithShadow, PORTAL, portalShadow, pylonOf, pylonRunes, pylonShadow, RIFT, slabsOf, slabsShadow, TEAR, tearOutline, tearShadow, type Pylon,
  type Shard, type Slab,
} from "./rift-props";

// The Rift: ground torn open by a breach in reality, under a violet glow. A fracture scar instead of the sunken track:
// dark rock split into plates by glowing cracks, with a burning seam of the breach meandering down its middle; props
// in the towers' 3/4 tilt (`Theme.tilted`, `rift-props.ts`): hovering rock, standing tears in the air, twisted
// pylons, containment cages and heaved slabs; a ring portal and a shattered floating monolith as landmarks; and
// obstacle groups at the board edge falling away into the void (`Theme.sea`): a crumbling rim, then darkness with
// violet haze, and chips of rock drifting into it.

const ACCENT = 0xf08aff;
/** Kind thresholds of the first `cellRandom` draw. */
const DEBRIS = 0.3,
  TEAR_KIND = 0.46,
  PYLON = 0.64,
  CAGE_KIND = 0.78;
/** The void's edge crumbles like a coast. */
const EDGE = 7;

type Piece =
  | { kind: "debris"; debris: Shard[] }
  | { kind: "tear"; lean: number; slabs: Slab[] }
  | { kind: "pylon"; pylon: Pylon }
  | { kind: "cage" }
  | { kind: "slabs"; slabs: Slab[] };
function pieceOf(rand: Random): Piece {
  const kind = rand();
  if (kind < DEBRIS) return { kind: "debris", debris: debrisOf(rand) };
  if (kind < TEAR_KIND) return { kind: "tear", lean: (rand() - 0.5) * 0.4, slabs: slabsOf(rand).slice(0, 1).map((s) => ({ ...s, p: 12, q: 6, l: s.l * 0.7 })) };
  if (kind < PYLON) return { kind: "pylon", pylon: pylonOf(rand) };
  if (kind < CAGE_KIND) return { kind: "cage" };
  return { kind: "slabs", slabs: slabsOf(rand) };
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

// ── Fracture scar ───────────────────────────────────────────────────────────────────────────────────────────────────
const SCAR = 0x1e1630;
/** Offset of the breach seam across the path at path distance s: it meanders between the edges. */
const seamOffset = (seed: number, s: number) => Math.sin(s * 0.045 + hash01(seed) * 6) * 6 + Math.sin(s * 0.11 + hash01(seed, 1) * 6) * 2.5;
/**
 * The path as a fracture scar with rounded bends (`coast.ts` `channelOf`): a raised lip of broken rock, dark stone
 * split into plates by thin glowing cracks, and the burning seam of the breach meandering down its middle.
 */
function drawScar(g: Ink, map: MapDefinition) {
  const samples = channelOf(map),
    seed = fnv(`${map.id}:scar`),
    layer = (r: number, color: number) => {
      for (let i = 0; i < samples.length; i += 2) disc(g, samples[i].x, samples[i].y, r, color);
    };
  layer(25.5, 0x3a2e4c);
  layer(23.5, 0x140e20);
  layer(22, SCAR);
  // Broken lip: chips of rock along both edges.
  for (let i = 0; i < samples.length; i += 2) {
    const p = samples[i],
      h = hash01(seed, i);
    if (h > 0.4) continue;
    const o = (h < 0.2 ? -1 : 1) * (22.5 + hash01(seed, i, 2) * 3);
    disc(g, p.x + p.nx * o, p.y + p.ny * o, 1 + h * 3, shade(0x4a3e5e, (hash01(seed, i, 3) - 0.5) * 0.3), 0.95);
  }
  // Plates and cracks.
  const done = new Set<number>();
  for (let i = 0; i < samples.length; i += 3) {
    const p = samples[i];
    for (let ty = Math.floor(p.y - 21); ty <= Math.floor(p.y + 21); ty++)
      for (let tx = Math.floor(p.x - 21); tx <= Math.floor(p.x + 21); tx++) {
        const key = ty * 100000 + tx,
          x = tx + 0.5,
          y = ty + 0.5;
        if (done.has(key) || (x - p.x) ** 2 + (y - p.y) ** 2 > 21 ** 2) continue;
        done.add(key);
        const { id, edge } = plateAt(seed, x, y, 28);
        if (edge < 0.9) {
          g.fillStyle(0x9a40d8, 0.75);
          g.fillRect(tx, ty, 1, 1);
        } else if (edge < 2) {
          g.fillStyle(0x0c0816, 0.8);
          g.fillRect(tx, ty, 1, 1);
        } else if (hash01(seed, id) < 0.35) {
          g.fillStyle(hash01(seed, id, 1) < 0.5 ? 0x281e3c : 0x18122a, 0.7);
          g.fillRect(tx, ty, 1, 1);
        }
      }
  }
  // The breach seam: a dark gash with the burning line inside.
  const seam = () => samples.map((p) => ({ x: p.x + p.nx * seamOffset(seed, p.s), y: p.y + p.ny * seamOffset(seed, p.s) }));
  g.lineStyle(5, 0x0a0414, 1);
  g.strokePoints(seam(), false);
  g.lineStyle(2.4, 0x8a30c8, 1);
  g.strokePoints(seam(), false);
  g.lineStyle(1, HOT, 0.9);
  g.strokePoints(seam(), false);
}

// ── The void ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Edge cells falling away: a crumbling rim, a violet-lit drop, then darkness with a faint swirl of haze. */
function drawVoid(g: Ink, map: MapDefinition) {
  const n = CELL / SEA_TILE,
    seed = fnv(`${map.id}:void`);
  for (const [k, depths] of seaField(map, EDGE)) {
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
        if (d < 2.5) c = 0x4a3e5e;
        else if (d < 4) c = 0x9a40d8;
        else if (d < 14) c = blend(0x2a1040, 0x08030f, (d - 4) / 10);
        else {
          const swirl = Math.sin(x * 0.02 + Math.sin(y * 0.03 + hash01(seed) * 6) * 2.5) * Math.sin(y * 0.018 + x * 0.006);
          c = swirl > 0.55 ? blend(0x05020a, 0x24103a, Math.min(1, (swirl - 0.55) * 1.6)) : 0x05020a;
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
const RIM = new Map<string, StandingPiece[]>();
/** Rock chips hanging at the void's rim, a few torn loose and hovering out over it. */
function rimPieces(map: MapDefinition): readonly StandingPiece[] {
  const cached = RIM.get(map.id);
  if (cached) return cached;
  const list: StandingPiece[] = [],
    path = map.path.map((p) => ({ x: (p.x + 0.5) * CELL, y: (p.y + 0.5) * CELL }));
  if (seaCells(map).size)
    for (const s of shoreLine(map, 6, 40)) {
      const rand = mulberry32(fnv(`${map.id}:rim:${Math.round(s.x)}:${Math.round(s.y)}`));
      if (rand() > 0.45 || path.some((p) => (p.x - s.x) ** 2 + (p.y - s.y) ** 2 < 44 * 44)) continue;
      const d = debrisOf(rand).slice(0, 2).map((q) => ({ ...q, r: q.r * 0.6, h: q.h + 6 }));
      list.push({ x: s.x, y: s.y, shadow: () => undefined, draw: (g) => drawDebris(g, s.x, s.y, d) });
    }
  RIM.set(map.id, list);
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
export const rift: Theme = {
  backdrop: 0x0d0814,
  ground: [0x170f22, 0x140d1e],
  grid: 0x3d2a58,
  path: { edge: 0x3a2e4c, bed: SCAR, line: 0xf08aff, arrow: 0xf5a4ff },
  accent: ACCENT,
  drawPath: drawScar,
  sea: drawVoid,
  obstacle: (g, x, y, rand) => {
    const p = pieceOf(rand),
      { gx, gy } = groundOf(x, y);
    if (p.kind === "debris") drawDebris(g, gx, gy, p.debris);
    else if (p.kind === "tear") {
      drawTear(g, gx - 4, gy - 2, p.lean);
      drawSlabs(g, gx, gy, p.slabs);
    } else if (p.kind === "pylon") drawPylon(g, gx, gy - 2, p.pylon);
    else if (p.kind === "cage") drawCage(g, gx, gy - 2);
    else drawSlabs(g, gx, gy, p.slabs);
  },
  tilted: {
    shadow: (g, x, y, rand) => {
      const p = pieceOf(rand),
        { gx, gy } = groundOf(x, y);
      if (p.kind === "debris") debrisShadow(g, gx, gy, p.debris);
      else if (p.kind === "tear") {
        tearShadow(g, gx - 4, gy - 2);
        slabsShadow(g, gx, gy, p.slabs);
      } else if (p.kind === "pylon") pylonShadow(g, gx, gy - 2, p.pylon);
      else if (p.kind === "cage") cageShadow(g, gx, gy - 2);
      else slabsShadow(g, gx, gy, p.slabs);
    },
    landmark: (g, x, y, s, variant) => {
      const { y0, k } = landmarkGround(x, y, s);
      scaled(g, x, y0, k, () => (variant ? monolithShadow(g) : portalShadow(g)));
      scaled(g, x, y0, k, () => (variant ? drawMonolith(g) : drawPortal(g)));
    },
    // The portal's void swirls and its rim burns; the monolith's pieces bob apart, light leaking from their breaks.
    landmarkLight: (g, glow, x, y, s, variant, clock, lit) => {
      const { y0, k } = landmarkGround(x, y, s);
      if (variant) {
        MONOLITH.forEach((m, i) => {
          if (!i) return;
          const gap = Y(y0, 0, (m.h0 - 3) * k),
            on = 0.6 + 0.4 * Math.sin(clock * 1.6 + i);
          halo(glow, x + m.du * k, gap, 14 * k, RIFT, 0.22 * on * lit);
          oval(g, x + m.du * k, gap, 7 * k * m.k, 1.6 * k, HOT, 0.7 * on);
        });
        return;
      }
      const cy = Y(y0, 0, PORTAL.h * k),
        r = (PORTAL.r - 3) * k;
      halo(glow, x, cy, r * 1.3, RIFT, 0.22 * lit);
      for (let i = 0; i < 3; i++) {
        const t0 = clock * (0.9 + i * 0.4) + i * 2.1;
        g.lineStyle(1.4 * k, i % 2 ? RIFT : 0x8a50ff, 0.55);
        g.beginPath();
        for (let j = 0; j <= 18; j++) {
          const t = t0 + j * 0.28,
            rr = r * (0.95 - j * 0.045);
          if (j) g.lineTo(x + Math.cos(t) * rr, cy + Math.sin(t) * rr);
          else g.moveTo(x + Math.cos(t) * rr, cy + Math.sin(t) * rr);
        }
        g.strokePath();
      }
      disc(g, x, cy, 3 * k, HOT, 0.6 + 0.3 * Math.sin(clock * 4));
    },
    extras: rimPieces,
  },
  decor: (g, x, y, rand) => {
    const kind = rand(),
      cx = x + 12 + rand() * 32,
      cy = y + 12 + rand() * 32;
    if (kind < 0.4) {
      // A hairline crack glowing faintly.
      let px = cx - 9,
        py = cy;
      g.lineStyle(1, 0x7a30b8, 0.5);
      g.beginPath();
      g.moveTo(px, py);
      for (let i = 0; i < 4; i++) {
        px += 4 + rand() * 2;
        py += (rand() - 0.5) * 6;
        g.lineTo(px, py);
      }
      g.strokePath();
    } else if (kind < 0.65) {
      // Pebbles that never came down: tiny discs with their shadows set apart.
      for (let i = 0; i < 3; i++) {
        const px = cx + (rand() - 0.5) * 14,
          py = cy + (rand() - 0.5) * 8;
        oval(g, px + 2, py + 3, 1.8, 0.9, 0x05020a, 0.6);
        disc(g, px, py - 2, 1.2, 0x5a4a70, 0.9);
      }
    } else if (kind < 0.85) {
      // A scorched ring where something touched down.
      g.lineStyle(1.2, 0x2a1a3a, 0.7);
      strokeOval(g, cx, cy, 16, 9);
    } else {
      // A violet crystal of fused ground.
      oval(g, cx, cy, 3, 2, 0x6a3a9a, 0.8);
    }
  },
  // Hovering rocks lit from below, tears shimmering, rune seams pulsing, anomalies throbbing in their cages, the
  // breach seam breathing along the scar, and motes of rock drifting up out of the void.
  ambient: ({ g, glow, lit, map, clock, blocked }) => {
    for (const b of blocked) {
      const p = pieceAt(map, b.x, b.y),
        { gx, gy } = groundOf(b.x * CELL, b.y * CELL);
      if (p.kind === "debris")
        for (const d of debrisGlows(p.debris)) {
          const on = 0.6 + 0.4 * Math.sin(clock * 1.3 + d.x + b.x);
          halo(glow, gx + d.x, gy + d.y, d.r * 1.6, RIFT, 0.14 * on * lit);
          disc(glow, gx + d.x, gy + d.base, d.r * 0.7, RIFT, 0.14 * on * lit);
        }
      else if (p.kind === "tear") {
        const out = tearOutline(p.lean, 1).map((q) => ({ x: gx - 4 + q.x, y: gy - 2 + q.y })),
          on = 0.6 + 0.4 * Math.sin(clock * 3 + b.x * 2);
        glow.lineStyle(4, RIFT, 0.25 * on * lit);
        glow.strokePoints(out, true);
        halo(glow, gx - 4, gy - 2 - TEAR.h, 16, RIFT, 0.12 * on * lit);
        // Sparks pulled into the tear.
        for (let i = 0; i < 3; i++) {
          const life = (clock * 0.6 + hash01(b.x, b.y, i)) % 1,
            a = hash01(i, b.x, b.y) * Math.PI * 2;
          disc(g, gx - 4 + Math.cos(a) * 16 * (1 - life), gy - 2 - TEAR.h + Math.sin(a) * 12 * (1 - life), 0.9, HOT, life);
        }
      } else if (p.kind === "pylon")
        pylonRunes(p.pylon).forEach((r, i) => {
          const on = Math.max(0, Math.sin(clock * 2.4 - i * 0.7)) ** 2;
          disc(g, gx + r.x, gy - 2 + r.y, 1, HOT, 0.3 + 0.7 * on);
          disc(glow, gx + r.x, gy - 2 + r.y, 4, RIFT, 0.25 * on * lit);
        });
      else if (p.kind === "cage") {
        const cy = Y(gy - 2, 0, CAGE.h),
          on = 0.6 + 0.4 * Math.sin(clock * 3.3 + b.x);
        halo(glow, gx, cy, 16, RIFT, 0.26 * on * lit);
        g.lineStyle(1, HOT, 0.4 * on);
        strokeOval(g, gx, cy, CAGE.r * 2.6 * on, CAGE.r * 2.6 * on);
      }
    }
    if (!map.columns) return;
    const samples = channelOf(map),
      total = samples[samples.length - 1].s;
    // The seam breathing: soft swells of light running down it.
    for (let k = 0; k * 120 < total; k++) {
      const s = (k * 120 + clock * 40) % total,
        p = samples[Math.min(samples.length - 1, Math.floor(s / CHANNEL_STEP))];
      halo(glow, p.x, p.y, 14, RIFT, 0.16 * lit);
    }
    // Motes rising out of the void.
    const n = CELL / SEA_TILE;
    for (const [key, depths] of seaField(map, EDGE)) {
      const [cx, cy] = key.split(",").map(Number);
      for (let j = 0; j < 2; j++) {
        const tx = Math.floor(hash01(cx, cy, j) * n),
          ty = Math.floor(hash01(cy, cx, j + 4) * n);
        if (depths[ty * n + tx] < 10) continue;
        const life = (clock * 0.25 + hash01(j, cx, cy)) % 1,
          x = cx * CELL + tx * SEA_TILE + Math.sin(clock + j) * 4,
          y = cy * CELL + ty * SEA_TILE - life * 30;
        disc(g, x, y, 0.8 + (1 - life), 0x6a5a80, Math.sin(Math.PI * life) * 0.9);
      }
      if (hash01(cx, cy, 9) < 0.3) halo(glow, (cx + 0.5) * CELL, (cy + 0.5) * CELL + Math.sin(clock * 0.3 + cx) * 6, 30, 0x6a20a8, 0.07 * lit);
    }
  },
};
