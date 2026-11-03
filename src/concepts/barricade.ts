import { facing, halo } from "../render/material";
import { disc, shade } from "../render/shapes";
import type { TurretContext } from "../render/tower-art/kit";
import { OUTLINE, onGround } from "../render/tower-art/tilt";
import { SX, SY, box, frame, project } from "../render/tower-art/tilt-frame";
import { wallShareOf } from "../systems/barricade";
import { DROP, IRON, at, chase, ngon, readyLight, readySocket, slab, trapTilt, trim } from "./kit-traps-b";
import type { Concept } from "./types";

/**
 * A Czech hedgehog: three square girders, square to each other, crossing at the hub, each with one end resting on the
 * bed and the other standing up (a cube's edges with its diagonal upright). Ground angle of each girder's upper end;
 * all rise at asin(1/√3); half length and half width; the hub sits at the height that puts the lower ends on the bed.
 */
const RISE = Math.asin(1 / Math.sqrt(3)),
  GIRDERS = [Math.PI / 2 + 0.35, Math.PI / 2 + 0.35 + (2 * Math.PI) / 3, Math.PI / 2 + 0.35 + (4 * Math.PI) / 3],
  HALF = 11.5,
  WIDTH = 1.8,
  HUB = HALF * Math.sin(RISE);
/** Corner stakes driven into the trampled ground. */
const STAKES = [
  [-15, -12],
  [15, -12],
  [-15, 12],
  [15, 12],
] as const;

function base({ g, x, y, level, definition, color }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  // Trampled earth under the wall (a lighter, churned patch) and the wall's contact shadow.
  onGround(g, x, y0, 0, () => {
    disc(g, 0, 0, 18, shade(c, -0.72), 0.55);
    disc(g, -2, -1.5, 13, shade(c, -0.62), 0.35);
    disc(g, 3, 4, 11, 0x050b10, 0.28);
  });
  for (const [u, v] of STAKES) {
    slab(g, x, y0, ngon(4, 1.6, Math.PI / 4), 0, 3.2, 0, shade(c, -0.55), shade(c, -0.3), shade(c, 0.1), 1, u, v);
    if (level >= 3) {
      const [bx, by] = at(x, y0, u, v, 3.4);
      disc(g, bx, by, 0.6, IRON.metal);
    }
  }
  // From level 5 a chain runs between the front stakes, in the trim colour.
  if (level >= 5) {
    const [ax, ay] = at(x, y0, -15, 12, 2.4),
      [bx, by] = at(x, y0, 15, 12, 2.4);
    g.lineStyle(1.4, OUTLINE, 0.8);
    g.lineBetween(ax, ay + 1, bx, by + 1);
    g.lineStyle(0.8, shade(color, -0.1), 1);
    g.lineBetween(ax, ay + 1, bx, by + 1);
  }
  if (level >= 2) readySocket(g, x, y0, 15, -12, 3.6, c);
}
/** The front stakes' chasing lights from level 4. */
function below(ctx: TurretContext) {
  chase(ctx, ctx.x, ctx.y + DROP, STAKES.map(([u, v]) => [u, v + 1.8] as const), 0.6);
}
/** One girder: a square beam through the hub, a spiked steel tip up top and a foot plate on the bed. */
function girder(ctx: TurretContext, a: number, jolt: number) {
  const { g, x, y, definition } = ctx,
    y0 = y + DROP,
    c = definition.color,
    f = frame(a, RISE, HUB, jolt, 0);
  box(g, x, y0, f, -HALF, HALF, -WIDTH, WIDTH, -WIDTH, WIDTH, shade(c, -0.12), shade(c, 0.05));
  // A steel band near the top and the spike.
  box(g, x, y0, f, HALF - 3.4, HALF - 2.4, -WIDTH - 0.25, WIDTH + 0.25, -WIDTH - 0.25, WIDTH + 0.25, shade(IRON.metal, -0.25));
  project(x, y0, f, HALF, -WIDTH, 0, 0);
  project(x, y0, f, HALF, WIDTH, 0, 1);
  project(x, y0, f, HALF + 3.8, 0, 0, 2);
  g.fillStyle(OUTLINE, 0.9);
  g.fillTriangle(SX[0] - 0.5, SY[0] + 0.5, SX[1] + 0.5, SY[1] + 0.5, SX[2], SY[2] - 0.6);
  g.fillStyle(shade(IRON.metal, 0.15 + 0.3 * facing(a)));
  g.fillTriangle(SX[0], SY[0], SX[1], SY[1], SX[2], SY[2]);
}
/**
 * The hedgehog (cached; whole). Girders whose upper end leans away are drawn first; a hit (`kick`) jolts it sideways.
 * A wall's damage is tower state, not part of the look, so cracks and the breach are drawn over it (`above`).
 */
function turret(ctx: TurretContext) {
  const { g, x, y, kick } = ctx,
    y0 = y + DROP,
    jolt = kick * 1.2;
  // Foot plates where the lower ends rest, then the girders back to front.
  for (const a of GIRDERS) {
    const [fx, fy] = at(x, y0, jolt - Math.cos(a) * HALF * Math.cos(RISE), -Math.sin(a) * HALF * Math.cos(RISE), 0);
    g.fillStyle(OUTLINE, 0.6);
    g.fillRect(fx - 3, fy - 1.2, 6, 2.6);
  }
  for (const a of [...GIRDERS].sort((p, q) => Math.sin(p) - Math.sin(q))) girder(ctx, a, jolt);
  // A riveted hub plate where the girders cross.
  const [hx, hy] = at(x, y0, jolt, 0, HUB + WIDTH + 0.6);
  disc(g, hx, hy, 2.4, OUTLINE);
  disc(g, hx, hy, 1.8, shade(trim(ctx), -0.15));
  disc(g, hx - 0.45, hy - 0.45, 0.7, IRON.metal);
}
/** Damage cracks, the HP pips over the wall and the ready lamp; a breached wall lies scorched with a red warning light. */
function above(ctx: TurretContext) {
  const { g, glow, x, y, tower, definition, level, clock } = ctx,
    y0 = y + DROP,
    c = definition.color,
    share = wallShareOf(tower, definition),
    worn = 1 - share;
  if (worn > 0.33) {
    g.lineStyle(1, OUTLINE, 0.9);
    for (let k = 0; k < (worn > 0.66 ? 3 : 1); k++) {
      const [cx, cy] = at(x, y0, Math.cos(GIRDERS[k]) * 5, Math.sin(GIRDERS[k]) * 5, HUB + 4);
      g.beginPath();
      g.moveTo(cx - 1.5, cy - 2);
      g.lineTo(cx + 0.8, cy);
      g.lineTo(cx - 0.8, cy + 2);
      g.strokePath();
    }
  }
  if (share <= 0) {
    const [wx, wy] = at(x, y0, 0, 0, HUB);
    halo(glow, wx, wy, 10, 0xff4d4d, Math.sin(clock * 8) > 0 ? 0.25 : 0.05);
  }
  // HP pips floating over the wall.
  const pips = 5,
    lit = Math.ceil(share * pips),
    [px0, py0] = at(x, y0, 0, 0, 2 * HUB + 8);
  for (let i = 0; i < pips; i++) {
    const left = px0 - 12 + i * 5,
      on = i < lit && !(i === lit - 1 && share < 0.25 && Math.sin(clock * 10) < 0);
    g.fillStyle(OUTLINE, 0.9);
    g.fillRect(left - 0.6, py0 - 0.6, 4.2, 3.2);
    g.fillStyle(on ? (share > 0.5 ? shade(c, 0.45) : 0xff6a3d) : 0x1a2226);
    g.fillRect(left, py0, 3, 2);
  }
  if (level >= 2) readyLight(ctx, x, y0, 15, -12, 3.6);
}

export const concept: Concept = {
  tower: "barricade",
  name: "Hedgehog Wall",
  idea: "A Czech hedgehog of three crossed rust girders with spiked steel ends on trampled ground between corner stakes; HP pips float over it, cracks open as it is chewed.",
  tilt: trapTilt(0.5),
  base,
  below,
  turret,
  above,
};
