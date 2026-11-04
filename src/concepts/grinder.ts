import { halo } from "../render/material";
import { shade } from "../render/shapes";
import type { TurretContext } from "../render/tower-art/kit";
import { OUTLINE, X, tube } from "../render/tower-art/tilt";
import { DROP, IRON, at, box2, chase, readyLight, readySocket, recess, slab, trapTilt, trim } from "./kit-traps-b";
import type { Concept } from "./types";

/**
 * A long, shallow trench across the full width of the path (the path runs east-west on the sheet, so the trench runs
 * north-south), two toothed rollers lying in it side by side, their axles across the walking direction, so whatever
 * walks the path must cross both. Trench half sizes (u along the path, v across it), wall height; rollers' centres
 * (u), axle height, radius and half length (v).
 */
const FRAME_U = 13,
  FRAME_V = 22,
  WALL = 2.4,
  ROLLERS = [-5.2, 5.2],
  AXLE = 0.8,
  R = 4.7,
  LEN = 18.5,
  TEETH = 8,
  /** Rows of spikes along each roller (v). */
  SPIKES = [-15, -9, -3, 3, 9, 15],
  T = 2.4;
/** The lamp on the back right corner; the chasing lights along the front wall. */
const LAMP = [FRAME_U - 1.3, -FRAME_V + 1.3] as const;

function base({ g, x, y, level, definition, color }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color,
    outer = box2(-FRAME_U, FRAME_U, -FRAME_V, FRAME_V);
  recess(g, x, y0, outer, 1.05);
  // Back wall, the dark trench floor, the side walls, the rollers' bodies (their teeth turn live), the front wall.
  slab(g, x, y0, box2(-FRAME_U, FRAME_U, -FRAME_V, -FRAME_V + T), 0, WALL, 0, IRON.wall, IRON.top, IRON.metal);
  const [px0, py0] = at(x, y0, -FRAME_U + T, -FRAME_V + T, 0),
    [px1, py1] = at(x, y0, FRAME_U - T, FRAME_V - T, 0);
  g.fillStyle(0x070908);
  g.fillRect(px0, py0, px1 - px0, py1 - py0);
  for (const u of [-FRAME_U, FRAME_U - T]) slab(g, x, y0, box2(u, u + T, -FRAME_V + T, FRAME_V - T), 0, WALL, 0, IRON.wall, IRON.top, IRON.metal);
  for (const u of ROLLERS) {
    tube(g, X(x, u), y0, Math.PI / 2, AXLE, -LEN, LEN, R, shade(c, -0.35));
    // Dark grooves round the roller between the spike rows.
    for (const v of SPIKES.slice(0, -1)) {
      const [ax, ay] = at(x, y0, u - R + 0.6, v + 3, AXLE + 0.6),
        [bx, by] = at(x, y0, u + R - 0.6, v + 3, AXLE + 0.6),
        [mx, my] = at(x, y0, u, v + 3, AXLE + R);
      g.lineStyle(0.7, shade(c, -0.65), 0.9);
      g.beginPath();
      g.moveTo(ax, ay);
      g.lineTo((ax + mx) / 2 - 0.4, my + 1.2);
      g.lineTo(mx, my);
      g.lineTo((bx + mx) / 2 + 0.4, my + 1.2);
      g.lineTo(bx, by);
      g.strokePath();
    }
  }
  slab(g, x, y0, box2(-FRAME_U, FRAME_U, FRAME_V - T, FRAME_V), 0, WALL, 0, IRON.wall, IRON.top, IRON.metal);
  // Olive bearing blocks where the axles end, on the back and front walls.
  for (const u of ROLLERS)
    for (const v of [-FRAME_V + 1.2, FRAME_V - 1.2]) slab(g, x, y0, box2(u - 2, u + 2, v - 1.6, v + 1.6), WALL, WALL + 1.4, 0, shade(c, -0.45), shade(c, -0.2), shade(c, 0.3));
  // Level 3: hazard chevrons on the side walls (where enemies step in); level 5: a trim line on the front wall.
  if (level >= 3)
    for (const u of [-FRAME_U + 1.2, FRAME_U - 1.2])
      for (const v of [-10, 0, 10]) {
        const [ax, ay] = at(x, y0, u, v - 2, WALL),
          [bx, by] = at(x, y0, u, v + 2, WALL);
        g.fillStyle(0xd9b43a, 0.9);
        g.fillTriangle(ax - 0.9, ay, ax + 0.9, ay, bx, by);
      }
  if (level >= 5) {
    const [ax, ay] = at(x, y0, -FRAME_U, FRAME_V, WALL),
      [bx, by] = at(x, y0, FRAME_U, FRAME_V, WALL);
    g.lineStyle(0.9, shade(color, -0.1), 1);
    g.lineBetween(ax, ay + 0.4, bx, by + 0.4);
  }
  if (level >= 2) readySocket(g, x, y0, LAMP[0], LAMP[1], WALL + 0.2, c);
}
/** From level 4 lights chase along the front wall. */
function below(ctx: TurretContext) {
  chase(ctx, ctx.x, ctx.y + DROP, [-7.5, -2.5, 2.5, 7.5].map((u) => [u, FRAME_V - 0.4] as const), WALL - 1.2);
}
/**
 * The rollers' teeth: rows of spikes round each roller that turn against each other (jerking on every bite, `kick`);
 * only the upper half of each roller stands proud of the trench, so only teeth turned up show, lit on the side turned to
 * the light. The nip between the rollers glows hot after a bite from level 5.
 */
function above(ctx: TurretContext) {
  const { g, glow, x, y, tower, definition, level, clock, kick } = ctx,
    y0 = y + DROP,
    c = definition.color,
    spin = clock * 3 + tower.id + kick * 0.6,
    out = 2.2;
  for (const [i, u] of ROLLERS.entries()) {
    const rot = (i ? -1 : 1) * spin;
    for (let k = 0; k < TEETH; k++) {
      const phi = rot + (k * 2 * Math.PI) / TEETH,
        up = Math.sin(phi);
      if (up < 0.12) continue;
      const bu = u + Math.cos(phi) * R,
        bh = AXLE + up * R,
        tu = u + Math.cos(phi) * (R + out),
        th = AXLE + up * (R + out),
        lit = shade(c, 0.05 + 0.45 * Math.max(0, -Math.cos(phi) * 0.7 + up * 0.5));
      for (const v of SPIKES) {
        const [b0x, b0y] = at(x, y0, bu, v - 1.3, bh),
          [b1x, b1y] = at(x, y0, bu, v + 1.3, bh),
          [tx, ty] = at(x, y0, tu, v, th);
        g.fillStyle(OUTLINE, 0.9);
        g.fillTriangle(b0x - 0.5, b0y - 0.4, b1x - 0.5, b1y + 0.4, tx, ty - 0.5);
        g.fillStyle(lit);
        g.fillTriangle(b0x, b0y, b1x, b1y, tx, ty);
      }
    }
  }
  // The nip between the rollers, along the trench.
  if (kick > 0 && level >= 5) {
    const [nx, ny] = at(x, y0, 0, -LEN + 1, AXLE + R * 0.7),
      [, my] = at(x, y0, 0, LEN - 1, AXLE + R * 0.7);
    glow.lineStyle(2.4, trim(ctx), 0.4 * kick);
    glow.lineBetween(nx, ny, nx, my);
    halo(glow, nx, (ny + my) / 2, 9, c, 0.25 * kick);
  }
  if (level >= 2) readyLight(ctx, x, y0, LAMP[0], LAMP[1], WALL + 0.2);
}

export const concept: Concept = {
  tower: "grinder",
  name: "Roller Trench",
  idea: "A long, shallow trench across the full width of the path with two spiked olive rollers lying in it side by side, axles across the walking direction; the teeth turn against each other and jerk on every bite.",
  tilt: trapTilt(WALL),
  base,
  below,
  turret: () => {},
  above,
};
