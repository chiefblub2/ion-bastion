import { disc, hash01, oval, shade } from "../../shapes";
import { facing } from "../../material";
import { SQUASH, onGround } from "../tilt";
import type { TurretContext } from "../kit";
import { DROP, IRON, at, chase, readyLight, readySocket, slab, box2 } from "./kit-traps-b";
import type { TiltedConcept as Concept } from "../tilted";

/**
 * Loose caltrops strewn over the path: (u, v, turn) per jack, back to front. Six from level 1, nine from 3, twelve
 * from 5; the extra ones fill the gaps. No plate: the jacks lie on the bare path bed.
 */
const JACKS = [
  [-12, -12, 0.3], [3, -14, 1.9], [14, -9, 0.9], [-4, -5, 2.6], [9, 1, 0.1], [-14, 3, 1.4],
  [-1, 7, 2.2], [15, 9, 0.6], [-9, 13, 1.1],
  [-17, -6, 2.4], [5, 13, 1.6], [18, -1, 2.9],
].map(([u, v, t], i) => ({ u, v, t, i }));
const jacks = (level: number) => JACKS.slice(0, level >= 5 ? 12 : level >= 3 ? 9 : 6).sort((a, b) => a.v - b.v);
/** Arm length of a jack and the height its upright spike reaches. */
const ARM = 4.6,
  UP = 5;
/** The marker stake at the back right edge of the path: lamp from level 2. */
const STAKE = [19, -16] as const;

/**
 * One caltrop: three arms resting on the ground from a raised centre, a fourth spike pointing up; each face lit by how
 * it turns to the light. `lift` raises the whole jack (it jumps when an enemy treads on the bed).
 */
function jack(ctx: TurretContext, u: number, v: number, turn: number, lift: number) {
  const { g, x, y, definition: d, level, color } = ctx,
    c = d.color,
    y0 = y + DROP,
    hc = 1.6 + lift,
    [cx, cy] = at(x, y0, u, v, hc);
  // Arms: back ones first (the jack's own front arm covers the centre).
  const arms = [0, 1, 2].map((k) => turn + (k * 2 * Math.PI) / 3).sort((a, b) => Math.sin(a) - Math.sin(b));
  for (const a of arms) {
    const [tx, ty] = at(x, y0, u + Math.cos(a) * ARM, v + Math.sin(a) * ARM, 0.3 + lift * 0.6),
      px = -Math.sin(a) * 1.15,
      py = Math.cos(a) * 1.15 * SQUASH;
    g.fillStyle(0x0b1013, 0.9);
    g.fillTriangle(cx + px * 1.5, cy + py * 1.5 + 0.4, cx - px * 1.5, cy - py * 1.5 + 0.4, tx, ty + 0.5);
    g.fillStyle(shade(c, -0.25 + 0.35 * facing(a - Math.PI / 2)));
    g.fillTriangle(cx + px, cy + py, cx, cy, tx, ty);
    g.fillStyle(shade(c, -0.55 + 0.3 * facing(a + Math.PI / 2)));
    g.fillTriangle(cx, cy, cx - px, cy - py, tx, ty);
  }
  // The upright spike: lit left face, shaded right face; its tip in the path colour from level 6.
  const tipY = cy - UP;
  g.fillStyle(0x0b1013, 0.9);
  g.fillTriangle(cx - 1.7, cy + 0.5, cx + 1.7, cy + 0.5, cx, tipY - 0.7);
  g.fillStyle(shade(c, 0.35));
  g.fillTriangle(cx - 1.15, cy, cx, cy + 0.2, cx, tipY);
  g.fillStyle(shade(c, -0.4));
  g.fillTriangle(cx, cy + 0.2, cx + 1.15, cy, cx, tipY);
  if (level >= 6) disc(g, cx, tipY + 0.8, 0.6, color);
}

function base(ctx: TurretContext) {
  const { g, x, y, definition: d, level, color } = ctx,
    c = d.color,
    y0 = y + DROP;
  // Scuffed ground where the jacks lie, and each jack's small contact shadow.
  onGround(g, x, y0, 0, () => {
    for (const { u, v } of jacks(level)) oval(g, u + 1, v + 1.4, ARM + 0.6, ARM * 0.7, 0x050b10, 0.32);
  });
  // The marker stake: a short iron post driven into the path edge; from level 5 a band in the trap's colour.
  slab(g, x, y0, box2(STAKE[0] - 1.3, STAKE[0] + 1.3, STAKE[1] - 1.3, STAKE[1] + 1.3), 0, 6, 0, IRON.wall, IRON.top, IRON.metal);
  if (level >= 5) {
    const [sx, sy] = at(x, y0, STAKE[0], STAKE[1] + 1.3, 3);
    g.fillStyle(level >= 6 ? color : shade(c, -0.1));
    g.fillRect(sx - 1.3, sy - 0.7, 2.6, 1.4);
  }
  // Level 3: a second stake at the front left edge, both with a hazard cap.
  if (level >= 3) {
    slab(g, x, y0, box2(-20.3, -17.7, 15.7, 18.3), 0, 5, 0, IRON.wall, IRON.top, IRON.metal);
    for (const [u, v, h] of [
      [STAKE[0], STAKE[1], 6],
      [-19, 17, 5],
    ] as const) {
      const [hx, hy] = at(x, y0, u, v, h);
      disc(g, hx, hy, 1.2, 0xd9b43a);
    }
  }
  if (level >= 2) readySocket(g, x, y0, STAKE[0], STAKE[1] + 1.4, 4.4, c);
}

/** From level 4 small lights set into the path bed chase along its front edge. */
function below(ctx: TurretContext) {
  chase(ctx, ctx.x, ctx.y + DROP, [-14, -5, 4, 13].map((u) => [u, 19] as const), 0);
}

/** The jacks themselves: still at rest, they jump a little (each by its own amount) when an enemy treads on them. */
function turret(ctx: TurretContext) {
  for (const { u, v, t, i } of jacks(ctx.level)) jack(ctx, u, v, t, ctx.kick * (0.8 + 1.4 * hash01(i, 4, 11)));
}

function above(ctx: TurretContext) {
  const { glow, x, y, definition: d, kick } = ctx,
    y0 = y + DROP;
  // A glint runs over the bed as the jacks jump.
  if (kick > 0)
    for (const { u, v } of jacks(ctx.level)) {
      const [gx, gy] = at(x, y0, u, v, 3);
      disc(glow, gx, gy, 2.4, d.color, 0.18 * kick);
    }
  if (ctx.level >= 2) readyLight(ctx, x, y0, STAKE[0], STAKE[1] + 1.4, 4.4);
}

/** Caltrops: loose iron jacks strewn over the bare path, a marker stake at its edge; they jump when trodden on. */
export const concept: Concept = {
  tower: "spikes",
  name: "Strewn Jacks",
  idea: "Loose four-pointed iron caltrops strewn over the bare path bed (six, nine from L3, twelve from L5), a marker stake with the lamp at the path's edge; the jacks jump when trodden on.",
  tilt: { drop: DROP, squash: SQUASH, height: 0, deck: 0 },
  base,
  below,
  turret,
  above,
};
