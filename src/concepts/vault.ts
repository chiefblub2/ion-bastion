import { halo } from "../render/material";
import { disc, shade } from "../render/shapes";
import type { TurretContext } from "../render/tower-art/kit";
import { OUTLINE, SQUASH, X, Y, onGround, quad } from "../render/tower-art/tilt";
import { lampInk, lampLight } from "../render/tower-art/tilt-parts";
import { METAL, STEEL, STEEL_TOP, contact, flatRing, ngon, slab } from "./kit-support-b";
import type { Concept } from "./types";

// Vault: the Strongroom. A squat octagonal strongroom with a round door on its front wall: locking bolts, a
// graduated dial ring and a gold boss (base, still); coin lamps on the roof, one more per level, and the trim (base);
// the dial's three-spoke handle turning to and fro and the lamps' light (above, live). Nothing turns with an aim, so
// the turret is empty.
const DROP = 4,
  TOP = 15,
  R = 18,
  DOOR_V = R * Math.cos(Math.PI / 8),
  DOOR_H = 8,
  DOOR_R = 6.4;
const BODY = ngon(8, R, Math.PI / 8),
  BODY_IN = ngon(8, R - 2, Math.PI / 8),
  PLINTH = ngon(8, R + 2.5, Math.PI / 8),
  PLINTH_IN = ngon(8, R + 1.5, Math.PI / 8);
/** Coin lamps along the roof's front edge. */
const COINS = [-6, 0, 6];
const doorAt = (x: number, y0: number) => [X(x, 0), Y(y0, DOOR_V, DOOR_H)] as const;
const coinAt = (x: number, y0: number, u: number) => [X(x, u), Y(y0, R - 5.5, TOP + 1.6)] as const;

function base({ g, x, y, level, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color,
    gold = shade(c, -0.15);
  contact(g, x, y0, R + 2);
  slab(g, x, y0, PLINTH, PLINTH_IN, 0, 2, STEEL, STEEL_TOP, METAL, 0.8);
  slab(g, x, y0, BODY, BODY_IN, 2, TOP, shade(STEEL, 0.02), shade(STEEL_TOP, 0.06), METAL, 1.6);
  // Gold banding round the walls from level 3.
  if (level >= 3)
    for (let i = 0; i < 4; i++) {
      const a0 = Math.PI / 8 + (i * Math.PI) / 4,
        a1 = a0 + Math.PI / 4,
        h = TOP - 2;
      g.lineStyle(1.1, gold, 0.95);
      g.lineBetween(X(x, Math.cos(a0) * (R + 0.2)), Y(y0, Math.sin(a0) * (R + 0.2), h), X(x, Math.cos(a1) * (R + 0.2)), Y(y0, Math.sin(a1) * (R + 0.2), h));
    }
  // The door on the front wall: a dark rebate, the door leaf, six locking bolts, the dial ring and its boss.
  const [dx, dy] = doorAt(x, y0);
  disc(g, dx, dy, DOOR_R + 1.3, OUTLINE);
  disc(g, dx, dy, DOOR_R + 0.6, shade(STEEL, -0.35));
  disc(g, dx, dy, DOOR_R, shade(STEEL_TOP, 0.12));
  disc(g, dx + 0.6, dy + 0.7, DOOR_R - 1, shade(STEEL_TOP, -0.05));
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + Math.PI / 6;
    disc(g, dx + Math.cos(a) * (DOOR_R + 0.6), dy + Math.sin(a) * (DOOR_R + 0.6), 0.9, gold);
  }
  disc(g, dx, dy, 3.6, OUTLINE, 0.9);
  disc(g, dx, dy, 3.1, shade(c, -0.45));
  // Roof: a hatch seam, a trim inlay in the path colour from level 4, the coin lamps' sockets.
  onGround(g, x, y0, TOP + 1.6, () => {
    g.lineStyle(0.8, shade(STEEL, -0.4), 0.9);
    g.lineBetween(-8, -6, 8, -6);
  });
  if (level >= 4) flatRing(g, x, y0, TOP + 1.6, R - 4, 0.9, color, 0.95);
  COINS.forEach((u, i) => lampInk(g, ...coinAt(x, y0, u), c, i < level ? 1 : 0.1));
}

function turret() {}
function below() {}

/** The dial's handle turning to and fro, the dial's ticks, the coin lamps' light and a gleam on the door. */
function above({ g, glow, x, y, tower, level, clock, energy, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color,
    dial = Math.sin(clock * 0.9 + tower.id) * 1.6,
    [dx, dy] = doorAt(x, y0);
  g.fillStyle(shade(c, 0.35));
  for (let i = 0; i < 8; i++) {
    const a = dial + (i * Math.PI) / 4;
    g.fillRect(dx + Math.cos(a) * 2.9 - 0.35, dy + Math.sin(a) * 2.9 - 0.35, 0.7, 0.7);
  }
  for (let i = 0; i < 3; i++) {
    const a = -dial * 1.3 + (i * Math.PI * 2) / 3,
      ex = dx + Math.cos(a) * 5.2,
      ey = dy + Math.sin(a) * 5.2;
    g.lineStyle(1.6, OUTLINE, 0.9);
    g.lineBetween(dx, dy, ex, ey);
    g.lineStyle(0.8, shade(c, 0.1), 1);
    g.lineBetween(dx, dy, ex, ey);
    disc(g, ex, ey, 0.8, c);
  }
  disc(g, dx, dy, 1.4, c);
  disc(g, dx - 0.4, dy - 0.4, 0.5, 0xffffff, 0.8);
  COINS.forEach((u, i) => {
    if (i < level) lampLight(glow, ...coinAt(x, y0, u), c);
  });
  halo(glow, dx, dy, 7, c, 0.08 + energy);
  // A slow gleam sweeping the roof's front edge.
  const sweep = ((clock * 0.35 + tower.id * 0.17) % 1) * 2 - 0.5;
  if (sweep > 0 && sweep < 1) {
    const u = -R * 0.6 + sweep * R * 1.2;
    quad(glow, X(x, u - 1), Y(y0, R - 2.8, TOP + 1.2), X(x, u + 1), Y(y0, R - 2.8, TOP + 1.2), X(x, u + 2), Y(y0, R - 0.4, TOP), X(x, u), Y(y0, R - 0.4, TOP), 0xffffff, 0.25);
  }
}

export const concept: Concept = {
  tower: "vault",
  name: "Strongroom",
  idea: "Squat octagonal strongroom with a round door on its front wall: gold bolts, a dial turning to and fro; coin lamps on the roof, one per level.",
  tilt: { drop: DROP, squash: SQUASH, height: TOP, deck: TOP + 1.6 },
  base,
  below,
  turret,
  above,
};
