import { halo } from "../render/material";
import { disc, shade } from "../render/shapes";
import type { TurretContext } from "../render/tower-art/kit";
import { OUTLINE, X, Y, quad } from "../render/tower-art/tilt";
import { DROP, IRON, at, box2, chase, ngon, readyLight, readySocket, recess, slab, trapTilt, trim } from "./kit-traps-b";
import type { Concept } from "./types";

/** Posts: ground u of each, footing plate half size, post height and its hexagonal footprint. */
const POSTS = [-16, 16],
  POST_H = 7,
  POST = ngon(6, 3.2, Math.PI / 6),
  FOOTING = box2(-5, 5, -4.2, 4.2),
  WIRE_H = 5.2;

function base({ g, x, y, level, definition, color }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  for (const u of POSTS) {
    const foot = FOOTING.map((p, i) => (i % 2 ? p : p + u));
    recess(g, x, y0, foot, 1.12);
    // A hazard-striped footing plate, flush with the bed.
    slab(g, x, y0, foot, 0, 1, 0, IRON.wall, IRON.top, IRON.metal);
    for (let k = -1; k <= 1; k++) {
      const [ax, ay] = at(x, y0, u + k * 3.2 - 1.2, -4, 1),
        [bx, by] = at(x, y0, u + k * 3.2 + 0.5, -4, 1),
        [cx, cy] = at(x, y0, u + k * 3.2 + 1.7, 4, 1),
        [dx, dy] = at(x, y0, u + k * 3.2, 4, 1);
      quad(g, ax, ay, bx, by, cx, cy, dx, dy, shade(c, -0.25), 0.9);
    }
    // From level 5 a rim plate in the trim colour round each footing.
    if (level >= 5) {
      const [lx, ly] = at(x, y0, u, 3.6, 1);
      g.fillStyle(shade(color, -0.2));
      g.fillRect(lx - 4.2, ly - 0.4, 8.4, 0.9);
    }
    // The post: a hexagonal bollard with a yellow cap band.
    slab(g, x, y0, POST, 1, POST_H, 0, IRON.wall, IRON.top, IRON.metal, 1, u, 0);
    slab(g, x, y0, POST, POST_H - 1.6, POST_H - 0.6, 0, shade(c, -0.35), shade(c, -0.1), shade(c, 0.4), 1, u, 0);
    if (level >= 3) {
      // Anchor bolts in the footing's corners.
      for (const [bu, bv] of [
        [-3.2, -2.4],
        [3.2, 2.4],
      ]) {
        const [bx, by] = at(x, y0, u + bu, bv, 1);
        disc(g, bx, by, 0.75, OUTLINE);
        disc(g, bx - 0.25, by - 0.25, 0.35, IRON.metal);
      }
    }
    if (level >= 2) readySocket(g, x, y0, u, 0, POST_H + 0.4, c);
  }
}
/** The posts' ready lamps (lit while armed) and from level 4 lights chasing along the footings. */
function below(ctx: TurretContext) {
  const y0 = ctx.y + DROP;
  chase(
    ctx,
    ctx.x,
    y0,
    POSTS.flatMap((u) => [[u - 2.6, 3.4] as const, [u + 2.6, 3.4] as const]),
    0.6,
  );
}
/**
 * The wire between the post tops: sagging while it re-arms, taut and humming once armed, with a glint running along it;
 * kicked down when an enemy trips it. Its ring hooks and the lamps' light sit on the posts.
 */
function above(ctx: TurretContext) {
  const { g, glow, x, y, tower, definition, level, clock, charge, kick } = ctx,
    y0 = y + DROP,
    c = definition.color,
    sag = (1 - charge) * 4 + kick * 3,
    pts: [number, number][] = [];
  for (let i = 0; i <= 8; i++) {
    const f = i / 8,
      u = POSTS[0] + (POSTS[1] - POSTS[0]) * f,
      h = WIRE_H - Math.sin(f * Math.PI) * sag + (charge >= 1 ? Math.sin(clock * 30 + i) * 0.25 : 0);
    pts.push([X(x, u), Y(y0, 0, h)]);
  }
  // Its shadow on the bed, then the wire.
  g.lineStyle(1, 0x050b10, 0.35);
  g.beginPath();
  pts.forEach(([px, py], i) => (i ? g.lineTo(px + 1.5, Y(y0, 2.5, 0) + (py - Y(y0, 0, WIRE_H)) * 0.15) : g.moveTo(px + 1.5, Y(y0, 2.5, 0))));
  g.strokePath();
  glow.lineStyle(3, c, 0.06 + 0.16 * charge);
  glow.beginPath();
  pts.forEach(([px, py], i) => (i ? glow.lineTo(px, py) : glow.moveTo(px, py)));
  glow.strokePath();
  g.lineStyle(1.4, OUTLINE, 0.8);
  g.beginPath();
  pts.forEach(([px, py], i) => (i ? g.lineTo(px, py + 0.4) : g.moveTo(px, py + 0.4)));
  g.strokePath();
  g.lineStyle(0.9, shade(trim(ctx), 0.1 + 0.3 * charge), 1);
  g.beginPath();
  pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
  g.strokePath();
  if (charge >= 1) {
    const f = (clock * 0.8 + tower.id * 0.37) % 1,
      [gx, gy] = pts[Math.round(f * 8)];
    disc(glow, gx, gy, 3, c, 0.22);
    disc(g, gx, gy, 0.9, 0xffffff, 0.9);
  }
  // Ring hooks where the wire meets the posts.
  for (const u of POSTS) {
    const [hx, hy] = at(x, y0, u, 0, WIRE_H);
    disc(g, hx, hy, 1.1, shade(c, -0.5));
  }
  if (kick > 0) {
    const [mx, my] = pts[4];
    halo(glow, mx, my, 6 * (1 + kick), c, 0.3 * kick);
  }
  if (level >= 2) for (const u of POSTS) readyLight(ctx, x, y0, u, 0, POST_H + 0.4);
}

export const concept: Concept = {
  tower: "tripwire",
  name: "Bollard Wire",
  idea: "Two hexagonal bollards on hazard-striped footings at the path's edges; the wire between them sags while it re-arms and hums taut once armed.",
  tilt: trapTilt(1),
  base,
  below,
  turret: () => {},
  above,
};
