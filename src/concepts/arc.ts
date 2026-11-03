import { halo } from "../render/material";
import { disc, shade } from "../render/shapes";
import { hash01 } from "../render/shapes";
import type { TurretContext } from "../render/tower-art/kit";
import { OUTLINE, X, Y, drum, onGround } from "../render/tower-art/tilt";
import { DROP, IRON, at, box2, chase, readyLight, readySocket, recess, slab, trapTilt, trim } from "./kit-traps-b";
import type { Concept } from "./types";

/** Frame half size and height; the coil's turns (half size of each square) and the terminal post. */
const S = 16,
  H = 1.8,
  TURNS = [12.5, 10, 7.5, 5],
  POST_R = 2.6,
  POST_H = 6;
const COPPER = 0xb8743a;

/** The square spiral as ground points (u, v): inward, a corner at a time. */
function spiral() {
  const pts: [number, number][] = [];
  TURNS.forEach((r, i) => {
    const next = TURNS[i + 1] ?? 3.5;
    pts.push([-r, -r], [r, -r], [r, r], [-next, r]);
  });
  return pts;
}
const COIL = spiral();

function base({ g, x, y, level, definition, color }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color,
    frameShape = box2(-S, S, -S, S);
  recess(g, x, y0, frameShape, 1.07);
  slab(g, x, y0, frameShape, 0, H, 0.8, IRON.wall, shade(IRON.deep, 0.1), IRON.metal, 0.9);
  // The copper coil inlaid in the deck: a dark groove, then the copper strip lit on its upper-left edges.
  onGround(g, x, y0, H, () => {
    for (const [w, col] of [
      [2.6, OUTLINE],
      [1.5, COPPER],
      [0.5, shade(COPPER, 0.45)],
    ] as const) {
      g.lineStyle(w, col, 1);
      g.beginPath();
      COIL.forEach(([u, v], i) => (i ? g.lineTo(u - (w < 1 ? 0.4 : 0), v - (w < 1 ? 0.4 : 0)) : g.moveTo(u, v)));
      g.strokePath();
    }
    // Hazard corners in the plate's acid green; from level 5 a trim inlay round the frame.
    g.fillStyle(shade(c, -0.25), 0.9);
    for (const [su, sv] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      g.fillTriangle(su * S, sv * S, su * (S - 4), sv * S, su * S, sv * (S - 4));
    }
    if (level >= 5) {
      g.lineStyle(0.9, shade(color, -0.1), 1);
      g.strokeRect(-S + 1.4, -S + 1.4, 2 * S - 2.8, 2 * S - 2.8);
    }
    if (level >= 3)
      for (const [su, sv] of [
        [-1, 1],
        [1, -1],
      ]) {
        disc(g, su * (S - 2.2), sv * (S - 2.2), 0.8, OUTLINE);
        disc(g, su * (S - 2.2) - 0.3, sv * (S - 2.2) - 0.3, 0.35, IRON.metal);
      }
  });
  // The terminal: a short insulator post with a copper cap.
  drum(g, x, y0, POST_R + 0.8, H, H + 1.2, IRON.wall, IRON.top, 10);
  drum(g, x, y0, POST_R, H + 1.2, POST_H - 1, 0xd8d2bf, 0xece6d3, 10);
  drum(g, x, y0, POST_R - 0.4, POST_H - 1, POST_H, COPPER, shade(COPPER, 0.3), 10);
  if (level >= 2) readySocket(g, x, y0, S - 3, S - 3, H + 0.2, c);
}
/** From level 4 lights chase round the frame's front edge. */
function below(ctx: TurretContext) {
  chase(ctx, ctx.x, ctx.y + DROP, [-12, -4, 4, 12].map((u) => [u, S - 0.8] as const), H);
}
/**
 * The coil's charge: glowing brighter as it charges, sparks crawling over it once charged, and an arc discharge from
 * the terminal when an enemy steps on it (`kick`).
 */
function above(ctx: TurretContext) {
  const { g, glow, x, y, tower, definition, level, clock, charge, kick } = ctx,
    y0 = y + DROP,
    c = definition.color;
  onGround(glow, x, y0, H, () => {
    glow.lineStyle(2.6, c, 0.05 + (charge >= 1 ? 0.12 + 0.06 * Math.sin(clock * 9 + tower.id) : 0.08 * charge));
    glow.beginPath();
    COIL.forEach(([u, v], i) => (i ? glow.lineTo(u, v) : glow.moveTo(u, v)));
    glow.strokePath();
  });
  const [tx, ty] = at(x, y0, 0, 0, POST_H + 0.3);
  if (charge >= 1) {
    // Sparks hop between the cap and a point on the coil.
    const step = Math.floor(clock * 14);
    for (let i = 0; i < 2; i++) {
      const k = Math.floor(hash01(tower.id, step, i) * COIL.length),
        [u, v] = COIL[k],
        ex = X(x, u),
        ey = Y(y0, v, H);
      glow.lineStyle(1.2, shade(c, 0.3), 0.55);
      glow.beginPath();
      glow.moveTo(tx, ty);
      for (let s = 1; s < 4; s++) {
        const f = s / 4,
          off = (hash01(step, i, s) - 0.5) * 3;
        glow.lineTo(tx + (ex - tx) * f + off, ty + (ey - ty) * f - off);
      }
      glow.lineTo(ex, ey);
      glow.strokePath();
    }
    disc(glow, tx, ty, 3, c, 0.25);
  }
  disc(g, tx, ty, 1.1, charge >= 1 ? shade(trim(ctx), 0.5) : shade(COPPER, -0.2));
  if (kick > 0) {
    halo(glow, tx, ty, 14 * (0.6 + kick), c, 0.4 * kick);
    disc(g, tx, ty, 2.6 * kick, 0xffffff, kick);
  }
  if (level >= 2) readyLight(ctx, x, y0, S - 3, S - 3, H + 0.2);
}

export const concept: Concept = {
  tower: "arc",
  name: "Coil Floor",
  idea: "A flush steel plate with a square copper coil inlaid round an insulator terminal; the coil glows as it charges and sparks hop from the cap once armed.",
  tilt: trapTilt(1.8),
  base,
  below,
  turret: () => {},
  above,
};
