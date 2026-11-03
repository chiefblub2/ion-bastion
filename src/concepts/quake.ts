/**
 * Quake concept, "Pile Driver": a cracked bronze-trimmed slab with a column at the back and an arm overhanging the
 * strike pit (still), a heavy ram on hydraulic rods that hangs raised and slams into the pit on every shockwave
 * (turret, its height follows `kick` only), and the charge slot, lamps, strike dust and pit glow (live). No aim: the
 * tower ignores `tower.angle`, and its pulse is centred on the ground.
 */
import { halo } from "../render/material";
import { disc, oval, ring, shade } from "../render/shapes";
import type { TurretContext } from "../render/tower-art/kit";
import { FOOT, INSET, OUTLINE, SQUASH, X, Y, block, fillPoints, onGround, point, quad, tube, turn } from "../render/tower-art/tilt";
import type { Concept } from "./types";

const DROP = 6;
/** Heights: slab, column, arm, the ram's raised and struck bottom and its thickness, the rod sleeves. */
const SLAB = 4,
  POST = 27,
  BEAM1 = 30.5,
  ARM0 = 25.5,
  ARM1 = 29,
  RAISED = 10.5,
  STRUCK = SLAB + 0.4,
  RAM = 5.5,
  SLEEVE = 21.5;
/** Gunmetal, its top, the metallic highlight, the deep pit and the chrome of the rods. */
const WALL = 0x3a3631,
  TOP = 0x585049,
  METAL = 0x9c8f82,
  DEEP = 0x17130f,
  CHROME = 0xc9d2d6;

/** The slab: a square with cut corners, clockwise on the screen. */
const SLAB_FOOT = [19, -12, 19, 12, 12, 19, -12, 19, -19, 12, -19, -12, -12, -19, 12, -19];
/** Two posts at the back corners, the crossbeam on them and the arm reaching forward over the pit. */
const POSTS = [
  [-15, -16, -10.5, -16, -10.5, -11.5, -15, -11.5],
  [10.5, -16, 15, -16, 15, -11.5, 10.5, -11.5],
];
const BEAM = [-15.5, -16.5, 15.5, -16.5, 15.5, -11, -15.5, -11];
const ARM_FOOT = [-3.8, -13, 3.8, -13, 3.8, 2.5, -3.8, 2.5];
/** Level 5: armour plates on the outer sides of the posts. */
const CHEEKS = [
  [-16.4, -15.6, -15, -15.6, -15, -11.9, -16.4, -11.9],
  [15, -15.6, 16.4, -15.6, 16.4, -11.9, 15, -11.9],
];
/** Front faces of the posts: the across centre of each, for rails and charge slots. */
const POST_U = [-12.75, 12.75],
  POST_V = -11.5;
/** The ram, centred over the pit. */
const RAM_FOOT = [-7, -3, 7, -3, 7.5, 2.5, 7, 9, -7, 9, -7.5, 2.5];
const PIT = 7.5,
  PIT_V = 3;
/** Rods: across offsets (u) at the ram's centre line. */
const RODS = [-3.6, 3.6],
  ROD_V = 1;

function base({ g, x, y, level, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  onGround(g, x, y0, 0, () => {
    oval(g, 5, 6, 26, 22, 0x050b10, 0.22);
    oval(g, 2, 2, 21, 20, 0x050b10, 0.35);
  });
  let n = turn(SLAB_FOOT, 0, FOOT);
  turn(SLAB_FOOT, 0, INSET, 0.92);
  block(g, x, y0, FOOT, INSET, n, 0, SLAB - 1, 1, WALL, TOP, METAL);
  // The slab's top: the strike pit, cracks running out of it, bolts and a trim inlay.
  onGround(g, x, y0, SLAB, () => {
    g.fillStyle(DEEP, 0.95);
    g.fillRect(-PIT, PIT_V - PIT, PIT * 2, PIT * 2);
    g.fillStyle(shade(c, -0.6), 1);
    g.fillRect(-PIT + 1.5, PIT_V - PIT + 1.5, PIT * 2 - 3, PIT * 2 - 3);
    for (const lip of [0.7, 0]) {
      g.lineStyle(lip ? 0.8 : 1.3, lip ? shade(TOP, 0.35) : DEEP, 0.9);
      for (const [a, b, cc] of [
        [-0.9, 0.12, 15],
        [0.85, -0.18, 16],
        [2.4, 0.2, 15.5],
        [3.9, -0.12, 14],
      ]) {
        const r0 = PIT + 1;
        g.beginPath();
        g.moveTo(Math.cos(a) * r0 + lip, PIT_V + Math.sin(a) * r0 + lip);
        g.lineTo(Math.cos(a + b) * (r0 + 4) + lip, PIT_V + Math.sin(a + b) * (r0 + 4) + lip);
        g.lineTo(Math.cos(a - b) * cc + lip, Math.sin(a - b) * cc + lip);
        g.strokePath();
      }
    }
    if (level >= 4) {
      g.lineStyle(0.9, shade(color, -0.2), 0.95);
      g.strokeRect(-PIT - 1.4, PIT_V - PIT - 1.4, PIT * 2 + 2.8, PIT * 2 + 2.8);
    }
    const bolts = level >= 3 ? [[-15, -8], [15, -8], [-15, 14], [15, 14]] : [[-15, 14], [15, 14]];
    for (const [bx, by] of bolts) {
      disc(g, bx, by, 1.4, shade(WALL, -0.45));
      disc(g, bx - 0.35, by - 0.35, 0.6, METAL, 0.9);
    }
  });
  // The posts with a bronze rail and a charge slot on their faces (lit live), cheeks from level 5, beam and arm.
  for (const post of POSTS) {
    n = turn(post, 0, FOOT);
    block(g, x, y0, FOOT, FOOT, n, SLAB - 0.5, POST, 0, WALL, TOP, METAL);
  }
  for (const u of POST_U) {
    const face = (du: number, h: number) => [X(x, u + du), Y(y0, POST_V, h)] as const;
    quad(g, ...face(-1.6, SLAB + 1), ...face(-0.9, SLAB + 1), ...face(-0.9, POST - 1), ...face(-1.6, POST - 1), shade(c, -0.15));
    quad(g, ...face(0.1, 7), ...face(1.7, 7), ...face(1.7, 24), ...face(0.1, 24), DEEP);
  }
  if (level >= 5)
    for (const cheek of CHEEKS) {
      n = turn(cheek, 0, FOOT);
      block(g, x, y0, FOOT, FOOT, n, SLAB + 2, POST - 3, 0, shade(WALL, 0.1), shade(TOP, 0.08), METAL);
    }
  n = turn(BEAM, 0, FOOT);
  turn(BEAM, 0, INSET, 0.9, 0, 0, -0.3);
  block(g, x, y0, FOOT, INSET, n, POST, BEAM1, 0.8, shade(WALL, 0.05), TOP, METAL);
  n = turn(ARM_FOOT, 0, FOOT);
  turn(ARM_FOOT, 0, INSET, 0.85, 0, 0, -0.4);
  block(g, x, y0, FOOT, INSET, n, ARM0, ARM1, 0.8, shade(WALL, 0.08), TOP, METAL);
  // Rod sleeves hanging under the arm.
  for (const u of RODS) tube(g, X(x, u), Y(y0, ROD_V, 0) + 0, 0, SLEEVE, 0, ARM0 - SLEEVE, 1.9, shade(WALL, -0.1), 1, true, Math.PI / 2);
}

/** Height of the ram's bottom: hanging raised at rest, down in the pit right after a strike. */
const ramBottom = (kick: number) => STRUCK + (RAISED - STRUCK) * (1 - kick);

function turret({ g, x, y, definition, level, kick, color }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color,
    h0 = ramBottom(kick),
    h1 = h0 + RAM,
    trim = level >= 6 ? color : shade(c, 0.1);
  // The ram's shadow in the pit, sharper and closer the lower it hangs.
  const k = (h0 - STRUCK) / (RAISED - STRUCK);
  turn(RAM_FOOT, 0, FOOT, 0.95 - 0.1 * k);
  onGround(g, x, y0, SLAB, () => {
    for (let i = 0; i < 6; i++) point(i, FOOT[2 * i] + 1.5 + 4 * k, FOOT[2 * i + 1] + 2 + 5 * k);
    fillPoints(g, 6, 0x050b10, 0.45 - 0.15 * k);
  });
  // The ram: a bronze block with a dark striking shoe and hazard stripes on its front.
  const n = turn(RAM_FOOT, 0, FOOT);
  turn(RAM_FOOT, 0, INSET, 0.82, 0, 0, 0.5);
  block(g, x, y0, FOOT, FOOT, n, h0, h0 + 1.6, 0, DEEP, shade(DEEP, 0.2), METAL);
  block(g, x, y0, FOOT, INSET, n, h0 + 1.6, h1, 1.2, shade(c, -0.25), shade(c, 0.05), shade(c, 0.5));
  for (const u of [-4, 0, 4]) {
    const fy = (h: number) => Y(y0, 9, h);
    quad(g, X(x, u - 1.4), fy(h0 + 2.2), X(x, u), fy(h0 + 2.2), X(x, u + 1.4), fy(h1 - 0.6), X(x, u), fy(h1 - 0.6), DEEP);
  }
  // A trim band across the ram's top; bolts from level 3.
  const ht = h1 + 1.2;
  quad(g, X(x, -5.6), Y(y0, 6.2, ht), X(x, 5.6), Y(y0, 6.2, ht), X(x, 5.6), Y(y0, 7.2, ht), X(x, -5.6), Y(y0, 7.2, ht), trim);
  if (level >= 3)
    for (const u of [-5, 5]) {
      disc(g, X(x, u), Y(y0, -1, ht), 0.9, shade(c, -0.6));
      disc(g, X(x, u) - 0.3, Y(y0, -1, ht) - 0.3, 0.4, METAL);
    }
  // Chrome rods from the ram's top up into the sleeves.
  for (const u of RODS) tube(g, X(x, u), Y(y0, ROD_V, 0), 0, ht, 0, SLEEVE + 0.5 - ht, 1.1, CHROME, 1, true, Math.PI / 2);
}

function live({ g, glow, x, y, definition, level, kick, charge, energy, clock, color }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  // The charge slots on the posts fill from the bottom as the next strike builds.
  const top = 7 + 17 * charge;
  if (charge > 0.02)
    for (const u of POST_U) {
      const face = (du: number, h: number) => [X(x, u + du), Y(y0, POST_V, h)] as const;
      quad(g, ...face(0.5, 7.5), ...face(1.3, 7.5), ...face(1.3, top), ...face(0.5, top), shade(c, -0.05 + 0.45 * charge));
      quad(glow, ...face(-0.8, 7), ...face(2.6, 7), ...face(2.6, top + 1), ...face(-0.8, top + 1), c, Math.min(0.45, 0.12 + 0.25 * charge + energy));
    }
  // Lamp on the arm's tip from level 2.
  if (level >= 2) {
    const lx = X(x, 0),
      ly = Y(y0, 2.5, ARM1 - 1.6);
    disc(g, lx, ly, 1.2, OUTLINE);
    disc(g, lx, ly, 0.75, shade(color, 0.2));
    disc(glow, lx, ly, 2.4, color, 0.35);
  }
  // From level 4 three lights chase along the slab's front face.
  if (level >= 4)
    [-7, 0, 7].forEach((u, i) => {
      const on = 0.25 + 0.75 * Math.max(0, Math.sin(4 * clock - i * 1.3)),
        lx = X(x, u),
        ly = Y(y0, 19, SLAB / 2);
      quad(g, lx - 1.2, ly - 0.6, lx + 1.2, ly - 0.6, lx + 1.2, ly + 0.6, lx - 1.2, ly + 0.6, shade(color, -0.6 + 0.7 * on));
      if (on > 0.5) disc(glow, lx, ly, 2.2, color, 0.3 * on);
    });
  // The strike: the pit flares, dust puffs and a ring runs out over the slab.
  if (kick > 0) {
    const spread = 1 - kick;
    onGround(glow, x, y0, SLAB, () => halo(glow, 0, PIT_V, 10 + 6 * spread, c, 0.4 * kick));
    onGround(g, x, y0, SLAB, () => ring(g, 0, PIT_V, 10 + 12 * spread, 1 + 1.5 * kick, shade(c, 0.4), 0.7 * kick));
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2,
        r = 10 + 8 * spread;
      disc(g, X(x, Math.cos(a) * r), Y(y0, PIT_V + Math.sin(a) * r, SLAB + 2 * spread), 1.6 + 2.6 * spread, 0x9c8f82, 0.5 * kick);
    }
  }
}

/** Quake: a pile driver. */
export const concept = {
  tower: "quake",
  name: "Pile Driver",
  idea: "Cracked slab with a gantry (two posts, beam, arm) over the strike pit; a heavy bronze ram on chrome rods hangs raised and slams into the pit on every shockwave.",
  tilt: { drop: DROP, squash: SQUASH, height: 0, deck: SLAB },
  base,
  turret,
  live,
} satisfies Concept;
