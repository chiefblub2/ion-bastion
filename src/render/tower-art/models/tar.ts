import { arcBand, disc, oval, ring, shade } from "../../shapes";
import { SQUASH, fillPoints, onGround, point, tube } from "../tilt";
import type { TurretContext } from "../kit";
import { DROP, at, chase, readyLight, readySocket } from "./kit-traps-b";
import type { TiltedConcept as Concept } from "../tilted";

/** Tar tinted with the tower's grey-violet: `k` from -1 (black) toward the colour itself; never glossy. */
const tar = (c: number, k: number) => shade(c, k);
/** The mound's layers: (scale of the outline, height, colour step), bottom to top; it bulges ~3.5 px above the bed. */
const LAYERS = [
  [1, 0, -0.74],
  [0.93, 0.9, -0.62],
  [0.82, 1.9, -0.54],
  [0.66, 2.8, -0.48],
  [0.46, 3.5, -0.44],
] as const;
/** Radius of the blob outline at angle t: lumpy, longer along the path (u) than across it. */
const radius = (t: number) => 15 + 2.4 * Math.sin(3 * t + 0.8) + 1.6 * Math.sin(5 * t + 2.1) + 1.1 * Math.sin(7 * t + 0.3);
const N = 22;
const OUTLINE_PTS = Array.from({ length: N }, (_, i) => {
  const t = (i / N) * Math.PI * 2;
  return [Math.cos(t) * radius(t) * 1.12, Math.sin(t) * radius(t) * 0.86] as const;
});
/** Drips spreading from the mound onto the path: (angle, reach beyond the edge, size). */
const DRIPS = [
  [0.4, 5, 2.4],
  [1.3, 3.5, 2],
  [2.2, 4.5, 2.6],
  [3.4, 3, 1.8],
  [4.6, 4, 2.2],
  [5.6, 5.5, 2],
] as const;
/** The half-sunk barrel at the back left (ground point of its middle, its heading). */
const BARREL = { u: -10, v: -10, a: 0.35, len: 10, r: 3.8, h: 2 } as const;
const LAMP = [12.5, -8] as const;
/** Front edge of the mound, where the chasing lights sit on the bed. */
const FRONT = [-0.9, -0.3, 0.3, 0.9].map((s) => {
  const t = Math.PI / 2 + s;
  return [Math.cos(t) * radius(t) * 1.12 + 0, Math.sin(t) * radius(t) * 0.86 + 1.6] as const;
});

/** One layer of the mound: the blob outline scaled by `k`, filled at height h. */
function layer(g: TurretContext["g"], x: number, y0: number, k: number, h: number, color: number, dy = 0) {
  onGround(g, x, y0, h, () => {
    // A dull, slightly lighter edge on the upper left (lit side, no gloss), then the layer itself a hair inside it.
    OUTLINE_PTS.forEach(([u, v], i) => point(i, u * k - 0.5, v * k + dy - 0.6));
    fillPoints(g, N, shade(color, 0.12));
    OUTLINE_PTS.forEach(([u, v], i) => point(i, u * k, v * k + dy));
    fillPoints(g, N, color);
  });
}

function base(ctx: TurretContext) {
  const { g, x, y, definition: d, level, color } = ctx,
    c = d.color,
    y0 = y + DROP;
  // Tar soaked into the bed and the drips spreading out from the mound.
  onGround(g, x, y0, 0, () => {
    OUTLINE_PTS.forEach(([u, v], i) => point(i, u * 1.08 + 1.2, v * 1.08 + 1.6));
    fillPoints(g, N, 0x050608, 0.45);
    for (const [t, reach, size] of DRIPS) {
      const r = radius(t),
        eu = Math.cos(t) * (r * 1.12 + reach * 0.5),
        ev = Math.sin(t) * (r * 0.86 + reach * 0.5);
      oval(g, eu, ev, size + reach * 0.4, size * 0.8, tar(c, -0.8));
      oval(g, Math.cos(t) * (r * 1.12 + reach), Math.sin(t) * (r * 0.86 + reach), size * 0.8, size * 0.65, tar(c, -0.76));
    }
  });
  // The barrel lying half sunk at the back: its hoops, and from L5 a band in the trap's colour (path colour from L6).
  const bx = at(x, y0, BARREL.u, BARREL.v, 0)[0];
  const by0 = y0 + BARREL.v * SQUASH;
  const ca = Math.cos(BARREL.a),
    sa = Math.sin(BARREL.a);
  tube(g, bx - ca * BARREL.len * 0.5, by0 - sa * BARREL.len * 0.5 * SQUASH, BARREL.a, BARREL.h, 0, BARREL.len, BARREL.r, 0x6a7175);
  for (const f of [0.2, 0.8]) tube(g, bx - ca * BARREL.len * 0.5, by0 - sa * BARREL.len * 0.5 * SQUASH, BARREL.a, BARREL.h, BARREL.len * f - 0.4, BARREL.len * f + 0.4, BARREL.r + 0.2, 0x34383b, 1, false);
  if (level >= 5) tube(g, bx - ca * BARREL.len * 0.5, by0 - sa * BARREL.len * 0.5 * SQUASH, BARREL.a, BARREL.h, BARREL.len * 0.5 - 0.6, BARREL.len * 0.5 + 0.6, BARREL.r + 0.25, level >= 6 ? color : shade(c, 0.15), 1, false);
  // Tar running down the barrel from its open end.
  onGround(g, x, y0, BARREL.h + BARREL.r * 0.6, () => oval(g, BARREL.u + ca * 3, BARREL.v + sa * 3, 2.4, 1.6, tar(c, -0.66)));
  // The mound: lumpy layers, each a little smaller and a shade lighter, so it bulges up from the bed with soft edges.
  for (const [k, h, step] of LAYERS) layer(g, x, y0, k, h, tar(c, step), k > 0.9 ? 0 : 0.6 * (1 - k));
  // Folds in the top surface: matte creases, a touch lighter than the tar.
  onGround(g, x, y0, 3.5, () => {
    g.lineStyle(0.8, tar(c, -0.46), 0.85);
    for (const [cx, cy, r, a0] of [
      [-4, 1, 6, 3.4],
      [5, -1, 5, 0.2],
    ] as const) {
      g.beginPath();
      for (let s = 0; s <= 6; s++) {
        const t = a0 + (s / 6) * 1.5;
        if (s) g.lineTo(cx + Math.cos(t) * r, cy + Math.sin(t) * r);
        else g.moveTo(cx + Math.cos(t) * r, cy + Math.sin(t) * r);
      }
      g.strokePath();
    }
  });
  // L3: three iron stakes pinned round the spill's edge, half buried in tar.
  if (level >= 3)
    for (const t of [0.9, 2.5, 4.2]) {
      const r = radius(t),
        [sx, sy] = at(x, y0, Math.cos(t) * r * 1.12, Math.sin(t) * r * 0.86, 0);
      g.fillStyle(0x2a2d30);
      g.fillRect(sx - 0.8, sy - 4, 1.6, 4);
      g.fillStyle(0x7d8589);
      g.fillRect(sx - 0.8, sy - 4, 0.6, 3.6);
      oval(g, sx, sy, 1.8, 0.8, tar(c, -0.7));
    }
  if (level >= 2) readySocket(g, x, y0, LAMP[0], LAMP[1], 0.4, c);
}

/** From level 4 lights set into the bed chase along the spill's front edge. */
function below(ctx: TurretContext) {
  chase(ctx, ctx.x, ctx.y + DROP, FRONT, 0);
}

/**
 * Slow, heavy bubbles on the mound's top: a dull dome swells for seconds, bursts into a crater that closes again and
 * stretches a string; a catch (`kick`) heaves the whole mound. Matte throughout.
 */
function above(ctx: TurretContext) {
  const { g, glow, x, y, tower: t, definition: d, level, clock, kick } = ctx,
    c = d.color,
    y0 = y + DROP,
    top = 3.5 + kick * 0.8;
  const spots = [
    [-5, 0.5],
    [3.5, -2],
    [0, 3],
  ] as const;
  onGround(g, x, y0, top, () => {
    spots.forEach(([bx, by], i) => {
      const phase = (clock * 0.22 + i * 0.37 + t.id * 0.13) % 1;
      if (phase < 0.8) {
        const r = 0.8 + 2.8 * (phase / 0.8);
        oval(g, bx + 0.4, by + 0.6, r + 0.4, r + 0.2, tar(c, -0.72));
        disc(g, bx, by, r, tar(c, -0.56 + 0.06 * (phase / 0.8)));
        arcBand(g, bx, by, r - 0.4, 0.9, Math.PI * 1.05, Math.PI * 1.6, tar(c, -0.36), 0.85);
      } else {
        const k = (phase - 0.8) / 0.2;
        ring(g, bx, by, 3.6 - 2 * k, 1.1, tar(c, -0.76), 1 - k);
        ring(g, bx, by, 4 - 2 * k, 0.5, tar(c, -0.42), 0.7 * (1 - k));
      }
    });
    // A catch heaves the mound: a dull swell and a faint glow of the tar's colour.
    if (kick > 0) {
      ring(g, 0, 0, 10 * (0.5 + 0.5 * (1 - kick)), 1.6, tar(c, -0.48), kick);
      ring(glow, 0, 0, 10 * (0.5 + 0.5 * (1 - kick)), 2.4, c, 0.18 * kick);
    }
  });
  // A bursting bubble stretches a thin string of tar before it snaps.
  spots.forEach(([bu, bv], i) => {
    const phase = (clock * 0.22 + i * 0.37 + t.id * 0.13) % 1;
    if (phase < 0.8 || phase > 0.9) return;
    const k = (phase - 0.8) / 0.1,
      [sx, sy] = at(x, y0, bu, bv, top);
    g.lineStyle(0.7, tar(c, -0.5), 1 - k);
    g.lineBetween(sx, sy, sx + 0.4, sy - 2 - 4 * k);
    disc(g, sx + 0.4, sy - 2 - 4 * k, 0.8, tar(c, -0.52), 1 - k);
  });
  if (level >= 2) readyLight(ctx, x, y0, LAMP[0], LAMP[1], 0.4);
}

/** Tar Pit: a lumpy, glossless mound of grey-violet tar bulging from the path, a half-sunk barrel leaking into it. */
export const concept: Concept = {
  tower: "tar",
  name: "Tar Heap",
  idea: "An irregular, glossless mound of thick grey-violet tar bulging up from the path, soft lumpy edges and drips spreading onto the bed, a half-sunk barrel leaking into it; slow heavy bubbles on its top.",
  tilt: { drop: DROP, squash: SQUASH, height: 0, deck: 3.5 },
  base,
  below,
  turret: () => {},
  above,
};
