import { halo } from "../render/material";
import { shade } from "../render/shapes";
import type { TurretContext } from "../render/tower-art/kit";
import { OUTLINE, SQUASH, X, Y, tube } from "../render/tower-art/tilt";
import { DROP, IRON, at, box2, chase, readyLight, readySocket, recess, slab, trapTilt, trim } from "./kit-traps-b";
import type { Concept } from "./types";

/**
 * Two rollers lying side by side in a sunken frame, one behind the other, their axles running east-west so only their
 * tops stand proud of the bed. Roller centres (v), axle height, radius and half length; frame half sizes and wall
 * height.
 */
const ROLLERS = [-5.8, 5.8],
  AXLE = 1,
  R = 5,
  LEN = 11.5,
  FRAME_U = 15.5,
  FRAME_V = 14,
  WALL = 2.6,
  TEETH = 8,
  /** Spikes along each tooth row (u). */
  SPIKES = [-8.5, -4.2, 0, 4.2, 8.5];
/** Direction towards the viewer (as in `towardViewer`): a tooth on the roller faces it when visible. */
const WV = Math.sqrt(1 - SQUASH * SQUASH),
  WH = SQUASH;

function base({ g, x, y, level, definition, color }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color,
    outer = box2(-FRAME_U, FRAME_U, -FRAME_V, FRAME_V);
  recess(g, x, y0, outer, 1.06);
  // Back wall, the dark pit, then the rollers' bodies back to front (their teeth turn live), then the walls in front.
  slab(g, x, y0, box2(-FRAME_U, FRAME_U, -FRAME_V, -FRAME_V + 2.6), 0, WALL, 0, IRON.wall, IRON.top, IRON.metal);
  const [px0, py0] = at(x, y0, -FRAME_U + 2.6, -FRAME_V + 2.6, 0),
    [px1, py1] = at(x, y0, FRAME_U - 2.6, FRAME_V - 2.6, 0);
  g.fillStyle(0x070908);
  g.fillRect(px0, py0, px1 - px0, py1 - py0);
  for (const v of ROLLERS) {
    tube(g, X(x, -LEN), y0 + v * SQUASH, 0, AXLE, 0, 2 * LEN, R, shade(c, -0.35));
    // End caps on the axle, in steel.
    for (const u of [-LEN - 0.8, LEN + 0.8]) tube(g, X(x, u - 0.8), y0 + v * SQUASH, 0, AXLE, 0, 1.6, 1.8, IRON.metal, 1, false);
  }
  for (const side of [-1, 1])
    slab(g, x, y0, box2(side > 0 ? FRAME_U - 2.6 : -FRAME_U, side > 0 ? FRAME_U : -FRAME_U + 2.6, -FRAME_V + 2.6, FRAME_V - 2.6), 0, WALL, 0, IRON.wall, IRON.top, IRON.metal);
  slab(g, x, y0, box2(-FRAME_U, FRAME_U, FRAME_V - 2.6, FRAME_V), 0, WALL, 0, IRON.wall, IRON.top, IRON.metal);
  // Olive bearing blocks on the side walls where the axles end; hazard chevrons from level 3; a trim rim from 5.
  for (const v of ROLLERS)
    for (const u of [-FRAME_U + 1.3, FRAME_U - 1.3]) slab(g, x, y0, box2(u - 1.8, u + 1.8, v - 2, v + 2), WALL, WALL + 1.4, 0, shade(c, -0.45), shade(c, -0.2), shade(c, 0.3));
  if (level >= 3)
    for (const u of [-9, 0, 9]) {
      const [ax, ay] = at(x, y0, u - 1.6, FRAME_V - 1.3, WALL),
        [bx, by] = at(x, y0, u + 1.6, FRAME_V - 1.3, WALL);
      g.fillStyle(0xd9b43a, 0.9);
      g.fillTriangle(ax, ay + 0.6, bx, by + 0.6, (ax + bx) / 2, ay - 1);
    }
  if (level >= 5) {
    const [ax, ay] = at(x, y0, -FRAME_U, FRAME_V, WALL),
      [bx, by] = at(x, y0, FRAME_U, FRAME_V, WALL);
    g.lineStyle(0.9, shade(color, -0.1), 1);
    g.lineBetween(ax, ay + 0.4, bx, by + 0.4);
  }
  if (level >= 2) readySocket(g, x, y0, FRAME_U - 1.3, -FRAME_V + 1.3, WALL + 0.2, c);
}
/** From level 4 lights chase along the front wall. */
function below(ctx: TurretContext) {
  chase(ctx, ctx.x, ctx.y + DROP, [-12, -4, 4, 12].map((u) => [u, FRAME_V - 0.4] as const), WALL - 1.2);
}
/**
 * The rollers' teeth: ridges along each roller that turn against each other (jerking on every bite, `kick`), lit on the
 * side turned to the light. The back roller only shows the teeth its front neighbour leaves free; the nip between
 * them glows hot after a bite from level 5.
 */
function above(ctx: TurretContext) {
  const { g, glow, x, y, tower, definition, level, clock, kick } = ctx,
    y0 = y + DROP,
    c = definition.color,
    spin = clock * 3 + tower.id + kick * 0.6,
    // The front roller's top edge on the screen: back teeth below it are hidden.
    frontTop = Y(y0, ROLLERS[1], AXLE + R) - 0.5;
  for (const [i, v] of ROLLERS.entries()) {
    const rot = (i ? -1 : 1) * spin;
    for (let k = 0; k < TEETH; k++) {
      const phi = rot + (k * 2 * Math.PI) / TEETH,
        facing = Math.cos(phi) * WV + Math.sin(phi) * WH;
      if (facing < 0.2) continue;
      const tv = v + Math.cos(phi) * R,
        th = AXLE + Math.sin(phi) * R;
      if (th < WALL - 0.4 && Math.abs(tv) > FRAME_V - 3) continue;
      const ty = Y(y0, tv, th);
      if (i === 0 && ty > frontTop) continue;
      // A row of short spikes pointing out of the roller, lit on the side turned to the light.
      const out = 2.4,
        lit = shade(c, 0.05 + 0.45 * Math.max(0, Math.sin(phi + 0.5)) * facing);
      for (const u of SPIKES) {
        const bx = X(x, u),
          tx = X(x, u),
          tipY = Y(y0, tv + Math.cos(phi) * out, th + Math.sin(phi) * out);
        g.fillStyle(OUTLINE, 0.9);
        g.fillTriangle(bx - 1.9, ty + 0.4, bx + 1.9, ty + 0.4, tx, tipY - 0.5);
        g.fillStyle(lit);
        g.fillTriangle(bx - 1.3, ty, bx + 1.3, ty, tx, tipY);
      }
    }
  }
  // The nip between the rollers.
  const [nx, ny] = at(x, y0, -LEN + 1, 0, AXLE + R * 0.75),
    [mx] = at(x, y0, LEN - 1, 0, AXLE + R * 0.75);
  if (kick > 0 && level >= 5) {
    glow.lineStyle(2.4, trim(ctx), 0.4 * kick);
    glow.lineBetween(nx, ny, mx, ny);
    halo(glow, (nx + mx) / 2, ny, 9, c, 0.25 * kick);
  }
  if (level >= 2) readyLight(ctx, x, y0, FRAME_U - 1.3, -FRAME_V + 1.3, WALL + 0.2);
}

export const concept: Concept = {
  tower: "grinder",
  name: "Roller Pit",
  idea: "Two olive toothed rollers side by side in a sunken steel frame, only their tops proud of the bed; the teeth turn against each other and jerk on every bite.",
  tilt: trapTilt(WALL),
  base,
  below,
  turret: () => {},
  above,
};
