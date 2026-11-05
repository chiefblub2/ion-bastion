import { CELL, disc, hash01, type Ink, oval, shade, strokeOval } from "../shapes";
import { SQUASH, Y } from "../tower-art/tilt";
import { cellRandom, zigzagPoints, type Random, type Theme } from "./kit";
import { CHANNEL_STEP, channelOf } from "../coast";
import { halo } from "../material";
import { fnv } from "../../core/hash";
import type { MapDefinition } from "../../core/types";
import {
  cartOf, cartShadow, clusterOf, clusterShadow, drawCart, drawCluster, drawGeode, drawGiant, drawHeadframe, drawLantern, drawMites, geodeFace, geodeOf,
  geodeShadow, giantShadow, GIANT, HEADFRAME, headframeShadow, LAMP, lanternLamp, lanternShadow, miteTips, mitesOf, mitesShadow, type Cart,
  type Cluster, type Geode, type Mite,
} from "./geode-props";

// Crystal Cave: a turquoise mine cavern lit by miners' lanterns and its own glowing minerals. A mine-cart track on a
// gravel bed instead of the sunken track: timber sleepers, two steel rails and glowing veins in the rock beside it;
// props in the towers' 3/4 tilt (`Theme.tilted`, `geode-props.ts`): split geodes with amethyst (or quartz) hearts,
// quartz clusters on rock, banded stalagmites, ore carts and lantern posts; a giant open geode and a timber headframe
// over a shaft as landmarks. Its maps have no obstacle groups at the board edge, so it has no `sea`.

const ACCENT = 0x5ef2e0;
/** Kind thresholds of the first `cellRandom` draw. */
const GEODE = 0.3,
  CLUSTER = 0.54,
  MITES = 0.74,
  CART = 0.88;

type Piece =
  | { kind: "geode"; geode: Geode }
  | { kind: "cluster"; cluster: Cluster }
  | { kind: "mites"; mites: Mite[] }
  | { kind: "cart"; cart: Cart }
  | { kind: "lantern"; mites: Mite[] };
function pieceOf(rand: Random): Piece {
  const kind = rand();
  if (kind < GEODE) return { kind: "geode", geode: geodeOf(rand) };
  if (kind < CLUSTER) return { kind: "cluster", cluster: clusterOf(rand) };
  if (kind < MITES) return { kind: "mites", mites: mitesOf(rand) };
  if (kind < CART) return { kind: "cart", cart: cartOf(rand) };
  return { kind: "lantern", mites: mitesOf(rand).slice(0, 1).map((m) => ({ ...m, u: 10, v: 6, r: m.r * 0.6, h: m.h * 0.5 })) };
}
const groundOf = (x: number, y: number) => ({ gx: x + CELL / 2, gy: y + 36 });
/** A lantern post stands at the back left of its cell. */
const LANTERN_AT = { u: -6, v: -5 } as const;
/** A cell's piece rolled once per map for the ambient, from the same stream as its baked body. */
const PIECES = new Map<string, Piece>();
function pieceAt(map: MapDefinition, x: number, y: number) {
  const key = `${map.id}:${x}:${y}`;
  let p = PIECES.get(key);
  if (!p) PIECES.set(key, (p = pieceOf(cellRandom(map, x, y))));
  return p;
}

// ── Mine track ──────────────────────────────────────────────────────────────────────────────────────────────────────
const GRAVEL = 0x2a3a3c;
/**
 * The path as a mine-cart track with rounded bends (`coast.ts` `channelOf`): a gravel bed with a rocky edge, timber
 * sleepers across it, two steel rails, and glowing mineral veins running through the rock beside it.
 */
function drawTrack(g: Ink, map: MapDefinition) {
  const samples = channelOf(map),
    seed = fnv(`${map.id}:track`),
    layer = (r: number, color: number) => {
      for (let i = 0; i < samples.length; i += 2) disc(g, samples[i].x, samples[i].y, r, color);
    },
    along = (o: number) => samples.map((p) => ({ x: p.x + p.nx * o, y: p.y + p.ny * o }));
  layer(25.5, 0x16282c);
  layer(23.5, 0x3a4c50);
  layer(22, GRAVEL);
  // Gravel: grains in a few tones, rocks along the edges.
  for (let i = 0; i < samples.length; i++) {
    const p = samples[i];
    for (let k = 0; k < 3; k++) {
      const o = (hash01(seed, i, k) - 0.5) * 40,
        h = hash01(seed, k, i);
      disc(g, p.x + p.nx * o, p.y + p.ny * o, 0.6 + h * 0.9, h < 0.4 ? 0x445a5e : h < 0.75 ? 0x1e2e30 : 0x5a6c70, 0.9);
    }
    if (hash01(seed, i, 7) < 0.25) {
      const o = (hash01(seed, i, 8) < 0.5 ? -1 : 1) * (21 + hash01(seed, i, 9) * 3);
      disc(g, p.x + p.nx * o, p.y + p.ny * o, 1.6 + hash01(seed, i, 10) * 2, shade(0x4a5c60, (hash01(seed, i, 11) - 0.5) * 0.3));
    }
  }
  // Sleepers across the bed.
  for (let i = 0; i < samples.length; i += 4) {
    const p = samples[i],
      tx = p.ny,
      ty = -p.nx,
      tone = (hash01(seed, i, 12) - 0.5) * 0.2,
      sleeper = (w0: number, w1: number) => [[-15, w0], [15, w0], [15, w1], [-15, w1]].map(([n, t]) => ({ x: p.x + p.nx * n + tx * t, y: p.y + p.ny * n + ty * t }));
    g.fillStyle(0x140c06, 0.9);
    g.fillPoints(sleeper(-2.6, 3.2), true);
    g.fillStyle(shade(0x6a4a2a, tone));
    g.fillPoints(sleeper(-2.2, 2.2), true);
    g.fillStyle(shade(0x8a6a42, tone));
    g.fillPoints(sleeper(-2.2, -1.4), true);
  }
  // Rails.
  for (const side of [-1, 1]) {
    g.lineStyle(3, 0x0a1010, 1);
    g.strokePoints(along(side * 9 + 0.6), false);
    g.lineStyle(2, 0x6a7478, 1);
    g.strokePoints(along(side * 9), false);
    g.lineStyle(0.8, 0xc8d4d8, 0.9);
    g.strokePoints(along(side * 9 - 0.6), false);
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
/** A crossed glint on a crystal, for `on` in 0…1. */
function glint(g: Ink, x: number, y: number, on: number, color = 0xf4ffff) {
  if (on < 0.4) return;
  const r = 2 + 4 * on;
  g.lineStyle(1.1, color, 0.9 * on);
  g.lineBetween(x - r, y, x + r, y);
  g.lineBetween(x, y - r, x, y + r);
}

// ── Theme ───────────────────────────────────────────────────────────────────────────────────────────────────────────
export const geode: Theme = {
  backdrop: 0x081a1d,
  ground: [0x0f2a2e, 0x0d2528],
  grid: 0x1c474c,
  path: { edge: 0x3a4c50, bed: GRAVEL, line: 0x5ef2e0, arrow: 0xa86cf0 },
  accent: ACCENT,
  drawPath: drawTrack,
  obstacle: (g, x, y, rand) => {
    const p = pieceOf(rand),
      { gx, gy } = groundOf(x, y);
    if (p.kind === "geode") drawGeode(g, gx, gy, p.geode);
    else if (p.kind === "cluster") drawCluster(g, gx, gy, p.cluster);
    else if (p.kind === "mites") drawMites(g, gx, gy, p.mites);
    else if (p.kind === "cart") drawCart(g, gx, gy, p.cart);
    else {
      drawLantern(g, gx + LANTERN_AT.u, gy + LANTERN_AT.v * SQUASH);
      drawMites(g, gx, gy, p.mites);
    }
  },
  tilted: {
    shadow: (g, x, y, rand) => {
      const p = pieceOf(rand),
        { gx, gy } = groundOf(x, y);
      if (p.kind === "geode") geodeShadow(g, gx, gy, p.geode);
      else if (p.kind === "cluster") clusterShadow(g, gx, gy, p.cluster);
      else if (p.kind === "mites") mitesShadow(g, gx, gy, p.mites);
      else if (p.kind === "cart") cartShadow(g, gx, gy, p.cart);
      else {
        lanternShadow(g, gx + LANTERN_AT.u, gy + LANTERN_AT.v * SQUASH);
        mitesShadow(g, gx, gy, p.mites);
      }
    },
    landmark: (g, x, y, s, variant) => {
      const { y0, k } = landmarkGround(x, y, s);
      scaled(g, x, y0, k, () => (variant ? headframeShadow(g) : giantShadow(g)));
      scaled(g, x, y0, k, () => (variant ? drawHeadframe(g) : drawGiant(g)));
    },
    // The giant geode glows violet from inside and glints; the headframe's lamp burns and the wheel's cable shines.
    landmarkLight: (g, glow, x, y, s, variant, clock, lit) => {
      const { y0, k } = landmarkGround(x, y, s);
      if (variant) {
        const lx = x + 10 * k,
          ly = Y(y0, 0, HEADFRAME.lamp * k),
          f = 0.85 + 0.15 * Math.sin(clock * 9 + x);
        g.fillStyle(0xffd890, f);
        g.fillRect(lx - 2.2 * k, ly - 3 * k, 4.4 * k, 6 * k);
        halo(glow, lx, ly, 20 * k, LAMP, 0.24 * f * lit);
        halo(glow, x, Y(y0, 0, 3 * k), 22 * k, LAMP, 0.08 * lit);
        return;
      }
      const fy = Y(y0, 0, (GIANT.h + 2) * k),
        on = 0.7 + 0.3 * Math.sin(clock * 1.2 + x);
      halo(glow, x, fy - 6 * k, GIANT.r * 1.1 * k, 0xa86cf0, 0.26 * on * lit);
      for (let i = 0; i < 3; i++) glint(g, x + (hash01(x, i) - 0.5) * 40 * k, fy - hash01(i, x) * 22 * k, Math.sin(clock * 2 + i * 2.1), 0xf0e0ff);
    },
  },
  decor: (g, x, y, rand) => {
    const cx = x + 12 + rand() * 32,
      cy = y + 14 + rand() * 28,
      kind = rand();
    if (kind < 0.4) {
      // A thin glowing mineral vein.
      const pts = zigzagPoints(cx - 10, cy, rand, 22, 4);
      g.lineStyle(3, 0x5ef2e0, 0.1);
      g.strokePoints(pts, false);
      g.lineStyle(1, 0x5ef2e0, 0.5);
      g.strokePoints(pts, false);
    } else if (kind < 0.65) {
      // Tiny glow-mushrooms.
      for (let i = 0; i < 2; i++) {
        const mx = cx + i * 6 - 3,
          my = cy + (rand() - 0.5) * 4;
        disc(g, mx, my, 6, 0x5ef2e0, 0.1);
        g.fillStyle(0x1a5a60);
        g.fillRect(mx - 0.5, my, 1, 3);
        oval(g, mx, my, 2.5, 1.5, 0x5ef2e0, 0.9);
      }
    } else if (kind < 0.85) {
      // A drip pool under the cave roof.
      oval(g, cx, cy, 6 + rand() * 4, 2.6 + rand() * 1.4, 0x0a2024, 0.9);
      g.lineStyle(0.6, 0x9ffcf0, 0.3);
      g.lineBetween(cx - 3, cy - 0.6, cx + 1, cy - 0.8);
    } else {
      // Loose crystal chips.
      for (let i = 0; i < 3; i++) disc(g, cx + (rand() - 0.5) * 12, cy + (rand() - 0.5) * 6, 1 + rand(), rand() < 0.5 ? 0xa86cf0 : 0x9ae8e4, 0.85);
    }
  },
  // Lanterns flickering warm, geodes glowing from inside, glints on the quartz, drips falling onto the stalagmites,
  // and caustics of crystal light drifting along the track.
  ambient: ({ g, glow, lit, map, clock, blocked }) => {
    for (const b of blocked) {
      const p = pieceAt(map, b.x, b.y),
        { gx, gy } = groundOf(b.x * CELL, b.y * CELL);
      if (p.kind === "geode") {
        const fy = Y(gy, 0, geodeFace(p.geode)),
          on = 0.65 + 0.35 * Math.sin(clock * 1.4 + b.x + b.y);
        halo(glow, gx, fy, p.geode.r * 1.4, p.geode.tint ? ACCENT : 0xa86cf0, 0.22 * on * lit);
        glint(g, gx + (hash01(b.x, b.y) - 0.5) * p.geode.r, fy - 2, Math.sin(clock * 2.2 + b.x * 3), p.geode.tint ? 0xf4ffff : 0xf0e0ff);
      } else if (p.kind === "cluster") {
        const top = p.cluster.crystals.reduce((a, c) => (c.len > a.len ? c : a));
        halo(glow, gx, Y(gy, 0, 14), 14, ACCENT, (0.1 + 0.04 * Math.sin(clock + b.x)) * lit);
        glint(g, gx + top.u, Y(gy + top.v * SQUASH, 0, top.len * 0.8), Math.sin(clock * 2.4 + b.y * 2));
      } else if (p.kind === "mites" || p.kind === "lantern") {
        for (const t of miteTips(p.mites)) {
          const life = (clock * 0.45 + hash01(b.x, b.y, t.u)) % 1,
            x = gx + t.u,
            y = gy + t.v * SQUASH;
          if (life < 0.7) disc(g, x, Y(y, 0, t.h + 40 * (1 - life / 0.7)), 0.9, 0xb8fff4, 0.8);
          else {
            const r = (life - 0.7) * 20;
            g.lineStyle(0.6, 0xb8fff4, 0.6 * (1 - (life - 0.7) / 0.3));
            strokeOval(g, x, Y(y, 0, t.h), r, r * SQUASH);
          }
        }
        if (p.kind === "lantern") {
          const lx = gx + LANTERN_AT.u + lanternLamp.u,
            ly = Y(gy + LANTERN_AT.v * SQUASH, 0, lanternLamp.h),
            f = 0.8 + 0.12 * Math.sin(clock * 11 + b.x) + 0.08 * Math.sin(clock * 23 + b.y);
          halo(glow, lx, ly, 16, LAMP, 0.26 * f * lit);
          glow.fillStyle(LAMP, 0.06 * f * lit);
          glow.fillTriangle(lx, ly, lx - 22, gy + 8, lx + 22, gy + 8);
        }
      }
    }
    if (!map.columns) return;
    const samples = channelOf(map),
      total = samples[samples.length - 1].s;
    // Caustics drifting along the track, and a glint sliding down the rails.
    for (let k = 0; k * 90 < total; k++) {
      const s = (k * 90 + clock * 12) % total,
        p = samples[Math.min(samples.length - 1, Math.floor(s / CHANNEL_STEP))],
        w = 0.5 + 0.5 * Math.sin(clock * 0.9 + k * 2.3);
      g.lineStyle(1.4, 0x9ffcf0, 0.05 + 0.08 * w);
      strokeOval(g, p.x + Math.sin(clock * 0.5 + k) * 8, p.y + Math.cos(clock * 0.45 + k * 2) * 5, 22 + 10 * w, 9 + 4 * w);
    }
    for (let k = 0; k * 300 < total; k++) {
      const s = (k * 300 + clock * 50) % total,
        p = samples[Math.min(samples.length - 1, Math.floor(s / CHANNEL_STEP))];
      for (const side of [-1, 1]) disc(glow, p.x + p.nx * side * 8.4, p.y + p.ny * side * 8.4, 3.4, 0xd8fffc, 0.2 * lit);
    }
  },
};
